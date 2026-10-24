# این Dockerfile با context ریشه‌ی مونوریپو (kgchat/) اجرا می‌شه چون از npm workspaces استفاده می‌کنیم
FROM node:22-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/widget/package.json apps/widget/package.json
RUN npm ci

COPY . .

RUN npm run build -w packages/shared-types
RUN npm run build -w apps/worker
RUN npm ci --omit=dev --omit=optional --workspace=@mira/worker --workspace=@mira/shared-types --include-workspace-root=false --ignore-scripts --no-audit --no-fund

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY LICENSE NOTICE ./
COPY --from=builder /repo/packages/shared-types ./packages/shared-types
COPY --from=builder /repo/apps/worker/dist ./apps/worker/dist
COPY --from=builder /repo/apps/worker/package.json ./apps/worker/package.json

WORKDIR /repo/apps/worker
USER node
CMD ["node", "dist/main.js"]
