# این Dockerfile با context ریشه‌ی مونوریپو (kgchat/) اجرا می‌شه چون از npm workspaces استفاده می‌کنیم
FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/widget/package.json apps/widget/package.json
RUN npm install

COPY . .

RUN npm run build -w packages/shared-types
RUN npm run build -w apps/worker

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo /repo

WORKDIR /repo/apps/worker
CMD ["node", "dist/main.js"]
