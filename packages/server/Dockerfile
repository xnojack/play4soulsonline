FROM node:22-alpine AS builder
WORKDIR /app
# better-sqlite3 requires native compilation — install build tools for node-gyp
RUN apk add --no-cache python3 make g++
# Copy root lockfile and workspace manifest alongside the package manifest so
# npm ci can install from the single monorepo lockfile reproducibly.
COPY package-lock.json package.json ./
COPY packages/server/package.json ./packages/server/
RUN npm ci --workspace=packages/server
COPY packages/server/src ./packages/server/src
COPY packages/server/tsconfig.json ./packages/server/
RUN npm run build --workspace=packages/server

FROM node:22-alpine
WORKDIR /app
# better-sqlite3 requires native compilation — install build tools for node-gyp
RUN apk add --no-cache python3 make g++
COPY package-lock.json package.json ./
COPY packages/server/package.json ./packages/server/
RUN npm ci --workspace=packages/server --omit=dev
COPY --from=builder /app/packages/server/dist ./dist
# Copy local dev card images if present (populated by the scraper for local dev).
# In CI the directory won't exist — the volume mount supplies images at runtime.
COPY packages/server/public* ./public/
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001
CMD ["node", "dist/index.js"]
