# Se construye desde la raíz del repositorio (ver docker-compose.yml).
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @picanteria/shared -w @picanteria/api --include-workspace-root --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @picanteria/shared && npm run build -w @picanteria/api

WORKDIR /app/apps/api
EXPOSE 3000
# Aplica las migraciones, crea el administrador inicial si no existe y arranca la API.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]
