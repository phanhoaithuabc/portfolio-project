FROM node:26-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9 AS build
WORKDIR /app
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/portfolio/package.json apps/portfolio/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY packages ./packages
COPY apps/portfolio ./apps/portfolio
RUN npm run build -w @portfolio/web

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
USER root
RUN apk upgrade --no-cache
COPY apps/portfolio/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/portfolio/dist /usr/share/nginx/html
USER 101
EXPOSE 8080