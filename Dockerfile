# syntax=docker/dockerfile:1
# Lernraum – Next.js standalone server + SQLite (data on the /data volume)

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1

# ---- dependencies
# better-sqlite3 ships prebuilt binaries (prebuilds/) and loads only those. npm ci
# would still run `node-gyp rebuild` for it (binding.gyp), which fails here because
# the slim image has no Python or compiler – so install scripts are skipped and the
# bundled binary is smoke-tested instead. The other packages with install scripts
# are dev tools (esbuild, unrs-resolver) that `next build` does not need.
FROM base AS deps
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts \
 && node -e "new (require('better-sqlite3'))(':memory:').prepare('select 1').get()"

# ---- build
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Europe/Berlin \
    DATABASE_PATH=/data/lernraum.db \
    MIGRATIONS_PATH=/app/drizzle
# The base image already contains tzdata and the unprivileged user "node" (uid 1000).
RUN mkdir -p /data && chown node:node /data

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts/seed-demo.mjs /app/scripts/backup.mjs ./scripts/

USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
