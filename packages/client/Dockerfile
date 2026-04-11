FROM node:22-alpine AS builder
WORKDIR /app
# Copy root lockfile and workspace manifest alongside the package manifest so
# npm ci can install from the single monorepo lockfile reproducibly.
COPY package-lock.json package.json ./
COPY packages/client/package.json ./packages/client/
RUN npm ci --workspace=packages/client
COPY packages/client/tsconfig.json packages/client/tsconfig.node.json packages/client/vite.config.ts ./packages/client/
COPY packages/client/postcss.config.js packages/client/tailwind.config.js ./packages/client/
COPY packages/client/index.html ./packages/client/
COPY packages/client/src ./packages/client/src
COPY packages/client/public ./packages/client/public
# No VITE_SERVER_URL or VITE_PUBLIC_URL at build time — both are injected at
# container start by entrypoint.sh so the same image works in any environment.
RUN npm run build --workspace=packages/client

FROM nginx:alpine
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY packages/client/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
