# این Dockerfile با context ریشه‌ی مونوریپو (kgchat/) اجرا می‌شه چون از npm workspaces استفاده می‌کنیم
FROM node:22-alpine AS builder
WORKDIR /repo

# فقط package.jsonها رو اول کپی می‌کنیم تا لایه‌ی npm install کش بشه —
# با این کار تغییر فایل‌های سورس (بدون تغییر وابستگی‌ها) دیگه npm install کامل رو دوباره اجرا نمی‌کنه
COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/widget/package.json apps/widget/package.json
RUN npm ci

COPY . .

RUN npm run build -w packages/shared-types
RUN npm run build -w apps/widget
RUN npm run build -w apps/api
RUN npm run build -w apps/dashboard
RUN mkdir -p apps/api/dashboard apps/api/public/widget-dist && \
    cp -r apps/dashboard/dist/. apps/api/dashboard/ && \
    cp apps/widget/dist/widget.js apps/api/public/widget-dist/widget.js
RUN npm ci --omit=dev --omit=optional --workspace=@mira/api --workspace=@mira/shared-types --include-workspace-root=false --ignore-scripts --no-audit --no-fund

# مرحله runtime — همون ساختار /repo رو حفظ می‌کنیم تا symlink های workspace (node_modules/@kgchat/*) درست resolve بشن
FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

# برای محاسبه‌ی درست ساعت کاری به وقت تهران (Intl با timeZone غیر از UTC)
RUN apk add --no-cache tzdata

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY LICENSE NOTICE ./
COPY --from=builder /repo/packages/shared-types ./packages/shared-types
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/api/public ./apps/api/public
COPY --from=builder /repo/apps/api/dashboard ./apps/api/dashboard

# پردازش برنامه به دسترسی ریشه نیازی ندارد.
USER node

WORKDIR /repo/apps/api
EXPOSE 3000
# مایگریشن و seed idempotent هستن، پس اجرای خودکارشون قبل از هر بالا آمدن سرویس امن است
CMD ["sh", "-c", "node dist/database/init.js && exec node dist/main.js"]
