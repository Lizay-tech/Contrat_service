# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- Runtime ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Dependances de production uniquement.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Artefacts compiles (inclut migrations/seeders transpiles en .js).
COPY --from=build /app/dist ./dist

# Repertoire de stockage documentaire.
RUN mkdir -p storage/uploads && chown -R node:node /app
USER node

EXPOSE 8091
CMD ["node", "dist/server.js"]
