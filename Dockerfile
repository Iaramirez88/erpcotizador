FROM node:20-bookworm-slim

WORKDIR /app

# Instalar deps (incluye devDeps porque necesitamos prisma CLI/tsx para worker)
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# Copiar código
COPY . .

# Build de Next
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
