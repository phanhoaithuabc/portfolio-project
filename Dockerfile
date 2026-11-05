FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS base
WORKDIR /app
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*

FROM base AS source
COPY package.json package-lock.json ./
COPY apps/portfolio/package.json apps/portfolio/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY tsconfig.json ./tsconfig.json
COPY packages ./packages
COPY services ./services
COPY scripts ./scripts

FROM source AS test
COPY . .
USER node
CMD ["npm", "test"]

FROM source AS build
RUN npm run build:runtime && npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORTFOLIO_DATABASE_FILE=/var/lib/portfolio/database/portfolio.sqlite PORTFOLIO_UPLOAD_DIR=/var/lib/portfolio/uploads
RUN mkdir -p /var/lib/portfolio/database /var/lib/portfolio/uploads && chown -R node:node /var/lib/portfolio
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/ ./
COPY --from=build /app/services/portfolio/src/project-page.html ./services/portfolio/src/project-page.html
COPY --from=build /app/services/portfolio/migrations ./services/portfolio/migrations
USER node
ENTRYPOINT ["node", "--import", "./packages/observability/src/register.js"]
CMD ["services/portfolio/src/index.js"]