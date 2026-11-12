/** Phone numbers: Persian/Arabic digits accepted; Iranian numbers (0912…, 912…, 98912…, +98912…) become E.164 (+98912…). */
const DIGITS: Record<string, string> = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
export const latinDigits = (s: string) => s.replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d] ?? d);

/** Returns the E.164 number, or null when it is not a plausible mobile number. */
export function normalizePhone(input: string): string | null {
  const raw = latinDigits(input).trim();
  const plus = raw.startsWith('+') || raw.startsWith('00');
  let d = raw.replace(/\D/g, '');
  if (raw.startsWith('00')) d = d.slice(2);
  if (!plus) {
    if (/^09\d{9}$/.test(d)) d = '98' + d.slice(1);
    else if (/^9\d{9}$/.test(d)) d = '98' + d;
  }
  if (/^989\d{9}$/.test(d)) return '+' + d;
  if (plus && /^\d{8,15}$/.test(d)) return '+' + d;
  return null;
}
/** 0912 345 6789 for display. */
export const showPhone = (p?: string | null) => (p ? (p.replace(/^\+98/, '0')) : '');
