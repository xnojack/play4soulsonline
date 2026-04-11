FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json tsconfig.node.json vite.config.ts ./
COPY postcss.config.js tailwind.config.js ./
RUN npm install
COPY index.html ./
COPY src ./src
COPY public ./public
ARG VITE_SERVER_URL=
ARG VITE_PUBLIC_URL=
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
