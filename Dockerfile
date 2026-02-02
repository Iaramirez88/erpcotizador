FROM node:20-bookworm-slim

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
RUN npm ci --include=dev --ignore-scripts

# Copiar código
COPY . .

# Prisma generate requiere un DATABASE_URL presente (no necesariamente válido) para resolver env().
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN npx prisma generate

# Build de Next
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
