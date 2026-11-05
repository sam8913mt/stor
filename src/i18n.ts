/**
 * Lightweight i18n (Persian default, English optional).
 *  - UI strings:   tr('id', 'متن فارسی', [vars]) — Persian lives in the code as the fallback; English lives in locales/en.ts by id.
 *  - Content data: lf(row, 'title') reads title_en when English is active and filled, else title_fa.
 * Switching language stores the choice and reloads, so module-level constants are always built in the right language.
 */
import { EN } from './locales/en';

export type Lang = 'fa' | 'en';
const stored = (() => { try { return localStorage.getItem('aram.lang'); } catch { return null; } })();
export const LANG: Lang = stored === 'en' ? 'en' : 'fa';
export const LOC = LANG === 'en' ? 'en-US' : 'fa-IR';
/** Clause separator: Persian comma or English comma. */
export const SEP = LANG === 'en' ? ', ' : '، ';
export const RTL = LANG === 'fa';

if (typeof document !== 'undefined') {
  document.documentElement.lang = LANG;
  document.documentElement.dir = RTL ? 'rtl' : 'ltr';
}

export function setLang(l: Lang) {
  try { localStorage.setItem('aram.lang', l); } catch { /* storage unavailable */ }
  window.location.reload();
}

export function tr(id: string, fa: string, vars?: unknown[]): string {
  let s = LANG === 'en' ? (EN[id] ?? fa) : fa;
  if (vars) s = s.replace(/\{(\d+)\}/g, (_m, i: string) => String(vars[Number(i)] ?? ''));
  return s;
}

/** Localised content field: `lf(product, 'title')` → title_en (English mode, if filled) or title_fa. */
export function lf(o: unknown, base: string): string {
  const r = o as Record<string, unknown> | null | undefined;
  if (!r) return '';
  if (LANG === 'en') { const en = r[`${base}_en`]; if (typeof en === 'string' && en.trim()) return en; }
  const fa = r[`${base}_fa`];
  return typeof fa === 'string' ? fa : '';
}
