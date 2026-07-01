# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune to production dependencies for the runtime image.
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

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
CMD ["node", "dist/server.js"]
