# ARAM — فروشگاه آنلاین (React + TypeScript + Supabase)

بدون هیچ وابستگی اجرایی: نه CDN، نه npm، نه Vite. همه‌چیز (React، روتر، کلاینت Supabase) داخل `assets/app.js` است.

## اجرا با Live Server (VS Code)
1. `config.js` را باز کنید و `SUPABASE_URL` و `SUPABASE_ANON_KEY` را بنویسید (Supabase → Project Settings → API).
2. روی `index.html` راست‌کلیک ← **Open with Live Server**. (دابل‌کلیک هم کار می‌کند.)

## آدرس بدون `#` (GitHub Pages)
با هر push روی `main` ورک‌فلو `.github/workflows/deploy.yml` سایت را با آدرس‌های تمیز (`/shop`، `/admin`) منتشر می‌کند: `404.html` درخواست‌ها را به `index.html` برمی‌گرداند و `CLEAN_URLS` را خودکار روشن می‌کند. در Settings → Pages منبع را روی **GitHub Actions** بگذارید.
روی کامپیوتر خودتان (Live Server) `CLEAN_URLS` در `config.js` خاموش است و آدرس‌ها `index.html#/shop` می‌مانند چون Live Server مسیرهای ناشناخته را به `index.html` نمی‌رساند. اگر Edge Functionهای پرداخت دارید و سایت را با `#` اجرا می‌کنید، سکرت `ROUTER_MODE=hash` را در Supabase بگذارید.

## ثبت‌نام با شماره موبایل
در Supabase: **Authentication ← Providers ← Phone** را روشن کنید و **Enable phone confirmations** را خاموش بگذارید (بدون پیامک؛ اگر پنل ارائه‌دهنده SMS خواست، مقدار نمونه بدهید). ورود با شماره و رمز انجام می‌شود (`09121234567`). حساب‌های قدیمی با ایمیل هم همچنان وارد می‌شوند. اگر دیتابیس را قبلاً نصب کرده‌اید، `sql/11_phone_auth.sql` را یک‌بار اجرا کنید.
سبد خرید و علاقه‌مندی‌ها برای کاربر مهمان قفل است و دکمه‌های «ورود» و «ثبت‌نام» نشان داده می‌شود. مدیر بعد از ورود (بدون آدرس مقصد) مستقیم به `/admin` می‌رود.

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
