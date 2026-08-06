<<<<<<< HEAD
# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

=======
# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app
# Ne pas telecharger Chromium a l'install (non requis pour compiler).
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
RUN npm ci
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

<<<<<<< HEAD
# Prune to production dependencies for the runtime image.
RUN npm prune --omit=dev

# ---- Runtime stage ----
=======
# ---------- Runtime ----------
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

<<<<<<< HEAD
# dumb-init for correct signal handling (graceful shutdown).
RUN apk add --no-cache dumb-init && \
    addgroup -S educa && adduser -S educa -G educa

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
# Migrations/seeders are compiled into dist; ship the TS too for the ts-node
# migrate scripts run via docker-compose (dev/staging).
COPY --from=build /app/src ./src
COPY tsconfig.json ./

RUN mkdir -p /app/data/uploads && chown -R educa:educa /app
USER educa

EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:8091/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
=======
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
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
CMD ["node", "dist/server.js"]
