import { createClient } from '@supabase/supabase-js';

// Values are baked in at build time from GitHub secrets / .env. They are PUBLIC (URL + anon key); RLS protects the data.
// Be forgiving about copy-paste mistakes (quotes, spaces, missing https://, a path after the host) instead of crashing the whole app:
// `createClient` throws synchronously on a malformed URL, which would otherwise leave visitors with a blank page.
const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : '');
const rawUrl = clean(import.meta.env.VITE_SUPABASE_URL);
const rawKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

function normaliseUrl(u: string): string | null {
  if (!u) return null;
  try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).origin; } catch { return null; }
}
const url = normaliseUrl(rawUrl);
const keyOk = rawKey.length >= 20 && !/\s/.test(rawKey);

/** False when the URL/key are missing or unusable; the UI then shows a setup notice instead of failing silently. */
export const isConfigured = Boolean(url && keyOk);

export const supabase = createClient(isConfigured ? (url as string) : 'http://localhost:54321', isConfigured ? rawKey : 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
