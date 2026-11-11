# ARAM — فروشگاه آنلاین (React + TypeScript + Supabase)

بدون هیچ وابستگی اجرایی: نه CDN، نه npm، نه Vite. همه‌چیز (React، روتر، کلاینت Supabase) داخل `assets/app.js` است.

## اجرا با Live Server (VS Code)
1. `config.js` را باز کنید و `SUPABASE_URL` و `SUPABASE_ANON_KEY` را بنویسید (Supabase → Project Settings → API).
2. روی `index.html` راست‌کلیک ← **Open with Live Server**. (دابل‌کلیک هم کار می‌کند.)

## دیتابیس
`sql/00_INSTALL_ALL.sql` را در Supabase → SQL Editor اجرا کنید؛ بعد `SUPABASE_SETUP.md` و `ADMIN_SETUP.md`.

## ویرایش کد
```bash
npm install
npm run dev        # ساخت خودکار assets/ با هر ذخیره (همراه Live Server)
npm run build      # خروجی نهایی در assets/
npm run typecheck  # بررسی تایپ‌ها
```
منبع: `src/` (صفحات `pages`، پنل `admin`، `vendor/router.tsx` و `vendor/supabase.ts` پیاده‌سازی‌های سبک داخلی). بک‌اند: `sql/` و `supabase/functions/`.
انتشار روی GitHub Pages: `DEPLOYMENT.md` (Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
