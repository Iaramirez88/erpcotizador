## syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base

WORKDIR /app

# Prisma en imágenes slim suele requerir OpenSSL presente.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Copiamos lo mínimo necesario para que Prisma tenga schema disponible durante la instalación.
COPY package.json package-lock.json* prisma.config.ts ./
COPY prisma ./prisma

# Instalar deps (incluye devDeps porque necesitamos prisma CLI/tsx para worker)
# Evitamos scripts para que `postinstall` no falle durante el build.
FROM base AS deps
RUN --mount=type=cache,target=/root/.npm \
	npm ci --include=dev --ignore-scripts

FROM deps AS source

# Copiar código
COPY . .

# Prisma generate requiere un DATABASE_URL presente (no necesariamente válido) para resolver env().
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN npx prisma generate

# Imagen web: solo esta etapa compila Next.js
FROM source AS web

ENV NEXT_DISABLE_BUILD_CHECKS=1
ENV CI=1
ENV NEXT_TELEMETRY_DISABLED=1
ARG BUILD_MAX_OLD_SPACE_SIZE=1536
ENV NODE_OPTIONS=--max-old-space-size=${BUILD_MAX_OLD_SPACE_SIZE}
RUN --mount=type=cache,target=/app/.next/cache \
	npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]

# Imagen worker: reutiliza dependencias y código, pero evita el build de Next.
FROM source AS worker

ENV NODE_ENV=production

CMD ["npm", "run", "worker:ocr"]

# Imagen migrate: solo necesita Prisma CLI y schema.
FROM source AS migrate

ENV NODE_ENV=production

CMD ["npx", "prisma", "migrate", "deploy"]
