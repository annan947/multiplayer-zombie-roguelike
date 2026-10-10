FROM node:22-slim
WORKDIR /game
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY shared ./shared
COPY server ./server
EXPOSE 2567
CMD ["node","--import","tsx","server/src/index.ts"]
