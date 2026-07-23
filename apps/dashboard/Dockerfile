# این Dockerfile با context ریشه‌ی مونوریپو (kgchat/) اجرا می‌شه
# برای فاز ۱، داشبورد به‌صورت dev-server اجرا می‌شه (ساخت production build در فازهای بعدی/سخت‌سازی)
FROM node:20-alpine
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

EXPOSE 5173
CMD ["sh", "-c", "npm run build -w packages/shared-types && npm run dev -w apps/dashboard"]
