# RidesRus API — built from the monorepo root:
#   docker build -f apps/api/Dockerfile -t ridesrus-api .
FROM node:24-slim
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Only the workspaces the API needs. Install scripts run for the packages
# allow-listed in the root package.json (Prisma engines, esbuild, embedded-postgres).
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/api apps/api
RUN npm ci --include=dev --workspace @ridesrus/core --workspace @ridesrus/api --include-workspace-root \
 && npm run build -w @ridesrus/core \
 && cd apps/api && npx prisma generate && npx nest build

ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 3005
# Migrations and the (idempotent) seed run on every boot, then the server starts.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx scripts/seed.ts && node dist/main.js"]
