// Keep-alive ping: runs one tiny READ-ONLY query so the project sees regular, legitimate activity.
// Called by pg_cron (see sql/10_keep_alive.sql) or by hand with curl. It writes nothing and returns no data.
// Auth: the caller must send header `x-cron-secret` equal to the CRON_SECRET function secret (same secret as process-email-queue).
// If CRON_SECRET is not set, every request is rejected.
import { admin, cors, json, timingSafeEqual } from '../_shared/lib.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  const secret = Deno.env.get('CRON_SECRET') ?? '';
  const given = req.headers.get('x-cron-secret') ?? '';
  if (!secret || !timingSafeEqual(given, secret)) return json(req, { ok: false, error: 'UNAUTHORIZED' }, 401);

  // Read one key name from the small `settings` table (service role bypasses RLS; nothing is returned to the caller).
  const { error } = await admin().from('settings').select('key').limit(1);
  if (error) return json(req, { ok: false, error: 'DB_ERROR' }, 503);

  return json(req, { ok: true, timestamp: new Date().toISOString() });
});
