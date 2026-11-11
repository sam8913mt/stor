import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
/** Public storefront URL incl. trailing slash, e.g. https://user.github.io/repo/ (set with `supabase secrets set SITE_URL=…`). */
export const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/?$/, '/');

/** Allows the storefront origin (SITE_URL) and localhost dev servers; everything else gets the storefront origin (browser blocks it). */
const siteOrigin = SITE_URL !== '/' ? new URL(SITE_URL).origin : '';
export const cors = (req: Request) => {
  const o = req.headers.get('origin') ?? '';
  const ok = !siteOrigin || o === siteOrigin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return corsHeaders(ok && o ? o : siteOrigin || '*');
};
const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Vary': 'Origin',
});

export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

/** Service-role client: bypasses RLS. Only used server-side after the caller has been authenticated/verified. */
export const admin = (): SupabaseClient => createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

/** Client acting as the calling user (RLS applies). */
export const asUser = (req: Request): SupabaseClient =>
  createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } });

/** Validates the caller's access token with Supabase Auth. Returns null for missing/invalid tokens (including the public anon key). */
export async function getUser(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error ? null : data.user;
}

export const redirect = (path: string) => new Response(null, { status: 302, headers: { Location: `${SITE_URL}#${path}` } });
export const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};
