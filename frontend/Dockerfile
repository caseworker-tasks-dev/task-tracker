FROM node:24-slim
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases .yarn/releases
RUN node .yarn/releases/yarn-4.16.0.cjs install --immutable

COPY . .
RUN node .yarn/releases/yarn-4.16.0.cjs build:prod && chown -R node:node /app

USER node
ENV NODE_ENV=production
EXPOSE 3100
CMD ["node", "-r", "./.pnp.cjs", "-r", "ts-node/register", "-r", "tsconfig-paths/register", "src/main/server.ts"]
