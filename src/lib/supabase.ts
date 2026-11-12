import { createClient } from '@supabase/supabase-js';

/**
 * Supabase URL + anon key are PUBLIC values (Row Level Security protects the data).
 * They are read at runtime from `config.js` (window.ARAM_CONFIG) so the site can be configured without rebuilding,
 * and fall back to nothing (a visible setup notice is shown instead of a blank page).
 */
declare global {
  interface Window { ARAM_CONFIG?: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string } }
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : '');
export const CONFIG_STORE_KEY = 'aram.config';
const fromFile = (typeof window !== 'undefined' && window.ARAM_CONFIG) || {};
const fromStore = (() => { try { return JSON.parse(localStorage.getItem(CONFIG_STORE_KEY) ?? '{}') as { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string }; } catch { return {}; } })();
const placeholder = (v: string) => !v || /YOUR-PROJECT-REF|YOUR-ANON/i.test(v);
// config.js wins; if it still holds the placeholders, the values typed into the on-page setup form (saved in this browser) are used.
const pick = (a: unknown, b: unknown) => (placeholder(clean(a)) ? clean(b) : clean(a));
const rawUrl = pick(fromFile.SUPABASE_URL, fromStore.SUPABASE_URL);
const rawKey = pick(fromFile.SUPABASE_ANON_KEY, fromStore.SUPABASE_ANON_KEY);

function normaliseUrl(u: string): string | null {
  if (!u || /YOUR-PROJECT-REF/i.test(u)) return null;
  try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).origin; } catch { return null; }
}
const url = normaliseUrl(rawUrl);
const keyOk = rawKey.length >= 20 && !/\s/.test(rawKey) && !/YOUR-ANON/i.test(rawKey);

/** False when the URL/key are missing or unusable; the UI then shows a setup notice instead of failing silently. */
export const isConfigured = Boolean(url && keyOk);

export const supabase = createClient(isConfigured ? (url as string) : 'http://localhost:54321', isConfigured ? rawKey : 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
