# Production image for CyberGram. Runs anywhere containers run: Cloudflare Containers,
# Fly.io, Render, Railway, a VPS, Kubernetes.
#
#   docker build -t cybergram .
#   docker run -p 3000:3000 --env-file .env.production cybergram
#
# Required at runtime: APP_URL (https), APP_SECRET, DATABASE_URL (PostgreSQL).
# Recommended: SMTP_URL, STORAGE_DRIVER=s3 with the S3_* values, CRON_SECRET.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Fonts are downloaded here, once, and then served from the app's own origin.
RUN npx next build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    # Apply pending migrations when the server starts. With several instances, run
    # `npm run db:migrate` as a release step instead and set this to false.
    AUTO_MIGRATE=true

# Never run as root.
RUN useradd --system --uid 1001 --create-home app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/drizzle ./drizzle
USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
