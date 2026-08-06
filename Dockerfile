# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app
# Ne pas telecharger Chromium a l'install (non requis pour compiler).
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- Runtime ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Chromium systeme + libs requises par Puppeteer (rendu PDF HTML+CSS).
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Dependances de production uniquement (sans re-telecharger Chromium).
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Artefacts compiles (inclut migrations/seeders transpiles en .js).
COPY --from=build /app/dist ./dist

# Repertoire de stockage documentaire.
RUN mkdir -p storage/uploads && chown -R node:node /app
USER node

EXPOSE 8091
CMD ["node", "dist/server.js"]
