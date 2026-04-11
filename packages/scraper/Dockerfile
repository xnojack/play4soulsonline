FROM node:20-alpine AS builder
WORKDIR /app
# Copy root lockfile and workspace manifest alongside the package manifest so
# npm ci can install from the single monorepo lockfile reproducibly.
COPY package-lock.json package.json ./
COPY packages/scraper/package.json ./packages/scraper/
RUN npm ci --workspace=packages/scraper
COPY packages/scraper/src ./packages/scraper/src
COPY packages/scraper/tsconfig.json ./packages/scraper/
RUN npm run build --workspace=packages/scraper

FROM node:20-alpine
WORKDIR /app
COPY package-lock.json package.json ./
COPY packages/scraper/package.json ./packages/scraper/
RUN npm ci --workspace=packages/scraper --omit=dev
COPY --from=builder /app/packages/scraper/dist ./packages/scraper/dist

# Card data is written to /app/data — mount a volume here to persist output
VOLUME ["/app/data"]

CMD ["node", "packages/scraper/dist/index.js"]
