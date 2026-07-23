# این Dockerfile با context ریشه‌ی مونوریپو (kgchat/) اجرا می‌شه چون از npm workspaces استفاده می‌کنیم
FROM node:20-alpine AS builder
WORKDIR /repo

# فقط package.jsonها رو اول کپی می‌کنیم تا لایه‌ی npm install کش بشه —
# با این کار تغییر فایل‌های سورس (بدون تغییر وابستگی‌ها) دیگه npm install کامل رو دوباره اجرا نمی‌کنه
COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/widget/package.json apps/widget/package.json
RUN npm install

COPY . .

RUN npm run build -w packages/shared-types
RUN npm run build -w apps/widget
RUN npm run build -w apps/api

# مرحله runtime — همون ساختار /repo رو حفظ می‌کنیم تا symlink های workspace (node_modules/@kgchat/*) درست resolve بشن
FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

# برای محاسبه‌ی درست ساعت کاری به وقت تهران (Intl با timeZone غیر از UTC)
RUN apk add --no-cache tzdata

COPY --from=builder /repo /repo

# خروجی build شده ویجت رو برای صفحه دمو دستی فاز ۱ در دسترس قرار می‌دیم
RUN mkdir -p /repo/apps/api/public/widget-dist && \
    cp /repo/apps/widget/dist/widget.js /repo/apps/api/public/widget-dist/widget.js

WORKDIR /repo/apps/api
EXPOSE 3000
# مایگریشن و seed idempotent هستن، پس اجرای خودکارشون قبل از هر بالا آمدن سرویس امن است
CMD ["sh", "-c", "npm run migration:run && npm run seed && node dist/main.js"]
