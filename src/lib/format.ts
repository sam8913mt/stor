import { tr, LOC } from '../i18n';
export const fmt = (n: number) => new Intl.NumberFormat(LOC).format(Math.round(n));
export const price = (n: number) => tr('lformat.1', '{0} تومان', [fmt(n)]);
export const dateFa = (s: string) => new Intl.DateTimeFormat(LOC, { dateStyle: 'medium' }).format(new Date(s));
export const dateTimeFa = (s: string) => new Intl.DateTimeFormat(LOC, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s));

/** Normalises Arabic/Persian letter + digit variants for forgiving search. */
export const normFa = (s: string) =>
  s.replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u200c\u200f]/g, ' ').toLowerCase().trim();

export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const ORDER_STATUS: Record<string, string> = {
  pending: tr('lformat.2', 'در انتظار تأیید'), confirmed: tr('lformat.3', 'تأیید شده'), processing: tr('lformat.4', 'در حال آماده‌سازی'),
  shipped: tr('lformat.5', 'ارسال شده'), delivered: tr('lformat.6', 'تحویل داده شد'), cancelled: tr('lformat.7', 'لغو شده'),
};
export const PAY_STATUS: Record<string, string> = { unpaid: tr('lformat.8', 'پرداخت نشده'), paid: tr('lformat.9', 'پرداخت شده'), refunded: tr('lformat.10', 'بازگشت وجه') };
export const PAY_METHOD: Record<string, string> = { cod: tr('lformat.11', 'پرداخت در محل'), bank_transfer: tr('lformat.12', 'کارت‌به‌کارت / واریز بانکی'), zarinpal: tr('lformat.13', 'پرداخت آنلاین (زرین‌پال)'), stripe: tr('lformat.14', 'پرداخت با کارت بانکی') };
export const ONLINE_PROVIDERS = ['zarinpal', 'stripe'];
export const TONES = ['ivory', 'sand', 'taupe', 'stone', 'mocha', 'charcoal'] as const;
export const TONE_LABEL: Record<string, string> = { ivory: tr('lformat.15', 'عاجی'), sand: tr('lformat.16', 'شنی'), taupe: tr('lformat.17', 'قهوه‌ای روشن'), stone: tr('lformat.18', 'سنگی'), mocha: tr('lformat.19', 'موکا'), charcoal: tr('lformat.20', 'زغالی') };
export const SILHOUETTES = ['coat', 'top', 'trousers', 'skirt', 'dress', 'bag', 'scarf', 'knit'] as const;
export const SIL_LABEL: Record<string, string> = { coat: tr('lformat.21', 'بالاپوش'), top: tr('lformat.22', 'بلوز'), trousers: tr('lformat.23', 'شلوار'), skirt: tr('lformat.24', 'دامن'), dress: tr('lformat.25', 'پیراهن'), bag: tr('lformat.26', 'کیف'), scarf: tr('lformat.27', 'شال'), knit: tr('lformat.28', 'بافت') };

export const ERROR_FA: Record<string, string> = {
  AUTH_REQUIRED: tr('lformat.29', 'برای ثبت سفارش وارد حساب کاربری شوید.'),
  EMPTY_CART: tr('lformat.30', 'سبد خرید خالی است.'),
  BAD_SHIPPING: tr('lformat.31', 'اطلاعات تحویل کامل نیست.'),
  BAD_PAYMENT: tr('lformat.32', 'روش پرداخت معتبر نیست.'),
  BAD_QTY: tr('lformat.33', 'تعداد هر کالا باید بین ۱ تا ۱۰ باشد.'),
  UNAVAILABLE: tr('lformat.34', 'یکی از کالاهای سبد دیگر موجود نیست. سبد را بررسی کنید.'),
  BAD_COUPON: tr('lformat.35', 'کد تخفیف معتبر نیست یا شرایط استفاده از آن برقرار نیست.'),
  FORBIDDEN: tr('lformat.36', 'دسترسی مجاز نیست.'),
  RATE_LIMIT: tr('lformat.37', 'تعداد سفارش‌ها در زمان کوتاه زیاد است. چند دقیقه بعد دوباره تلاش کنید.'),
  CANNOT_CANCEL: tr('lformat.38', 'این سفارش دیگر قابل لغو نیست. برای کمک با پشتیبانی تماس بگیرید.'),
  NOT_PAYABLE: tr('lformat.39', 'این سفارش قابل پرداخت نیست.'),
  BAD_PROVIDER: tr('lformat.40', 'این روش پرداخت فعال نیست.'),
  PROVIDER_NOT_CONFIGURED: tr('lformat.41', 'درگاه پرداخت هنوز راه‌اندازی نشده است. روش دیگری انتخاب کنید یا با پشتیبانی تماس بگیرید.'),
  PROVIDER_ERROR: tr('lformat.42', 'درگاه پرداخت درخواست را نپذیرفت. دوباره تلاش کنید.'),
  PROVIDER_UNREACHABLE: tr('lformat.43', 'اتصال به درگاه پرداخت برقرار نشد. دوباره تلاش کنید.'),
  ADDRESS_LIMIT: tr('lformat.44', 'حداکثر ۱۰ نشانی می‌توانید ذخیره کنید.'),
  LAST_SUPER_ADMIN: tr('lformat.45', 'آخرین مدیر کل را نمی‌توان حذف یا تنزل داد.'),
  PROTECTED_ROLE: tr('lformat.46', 'نقش مدیر کل قابل تغییر نیست.'),
  IMMUTABLE: tr('lformat.47', 'این مقدار پس از ثبت سفارش قابل تغییر نیست.'),
  NOT_CONFIGURED: tr('lformat.48', 'سرویس هنوز پیکربندی نشده است (کلید یا تنظیمات ناقص است).'),
  EMAIL_DISABLED: tr('lformat.49', 'ارسال ایمیل در تنظیمات غیرفعال است.'),
  BAD_EMAIL: tr('lformat.50', 'نشانی ایمیل معتبر نیست.'),
  SEND_FAILED: tr('lformat.51', 'ارسال ایمیل ناموفق بود. کلید و تنظیمات ارائه‌دهنده را بررسی کنید.'),
  'Failed to fetch': tr('lformat.52', 'اتصال به سرور برقرار نشد. اینترنت خود را بررسی کنید.'),
  NetworkError: tr('lformat.53', 'اتصال به سرور برقرار نشد. اینترنت خود را بررسی کنید.'),
};
export function errorFa(message: string): string {
  if (message.startsWith('OUT_OF_STOCK')) return tr('lformat.54', 'موجودی یکی از کالاها کافی نیست. تعداد را کم کنید.');
  const hit = Object.keys(ERROR_FA).find((k) => message.includes(k));
  if (hit) return ERROR_FA[hit];
  if (message.includes('duplicate key')) return tr('lformat.55', 'این مقدار قبلاً ثبت شده است.');
  if (message.includes('row-level security')) return tr('lformat.56', 'مجوز انجام این کار را ندارید.');
  if (/token has expired|otp.*(expired|invalid)|invalid.*(otp|token)/i.test(message)) return 'کد اشتباه است یا منقضی شده. دوباره درخواست کد کنید.';
  if (/rate limit|too many|seconds/i.test(message)) return 'درخواست‌ها زیاد است؛ کمی صبر کنید و دوباره تلاش کنید.';
  if (message.includes('Invalid login')) return tr('lformat.57', 'شماره یا رمز عبور درست نیست.');
  if (message.includes('already registered') || message.includes('already been registered')) return tr('lformat.58', 'با این شماره قبلاً ثبت‌نام شده است. وارد شوید.');
  if (/phone.*(disabled|not supported|provider)|unsupported phone|sms.*(provider|not)/i.test(message)) return 'ثبت‌نام با شماره در Supabase فعال نیست: Authentication ← Providers ← Phone را روشن کنید و Phone confirmations را خاموش بگذارید.';
  if (message.includes('Password should')) return tr('lformat.59', 'رمز عبور باید حداقل ۶ نویسه باشد.');
  return message;
}
