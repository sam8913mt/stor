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
const cfg = (typeof window !== 'undefined' && window.ARAM_CONFIG) || {};
const rawUrl = clean(cfg.SUPABASE_URL);
const rawKey = clean(cfg.SUPABASE_ANON_KEY);

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
