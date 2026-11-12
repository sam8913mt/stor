// Supabase Auth "Send SMS" hook: Supabase generates the one-time code and calls this function, which delivers it through the
// Iranian SMS gateway chosen in Admin → SMS. Setup: Dashboard → Authentication → Hooks → Send SMS → HTTPS →
// https://<project-ref>.supabase.co/functions/v1/sms-hook, then store the generated secret:  supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_…"
import { admin } from '../_shared/lib.ts';
import { sendSms, smsSettings } from '../_shared/sms.ts';

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function verify(req: Request, payload: string): Promise<boolean> {
  const secret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace(/^v1,whsec_/, '');
  const id = req.headers.get('webhook-id') ?? ''; const ts = req.headers.get('webhook-timestamp') ?? ''; const sigs = req.headers.get('webhook-signature') ?? '';
  if (!secret || !id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;       // replay protection (5 minutes)
  const key = await crypto.subtle.importKey('raw', b64(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${payload}`)));
  const expected = btoa(String.fromCharCode(...mac));
  return sigs.split(' ').some((p) => p.replace(/^v1,/, '') === expected);
}
const fail = (message: string, status = 400) => new Response(JSON.stringify({ error: { http_code: status, message } }), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 405);
  const payload = await req.text();
  if (!(await verify(req, payload))) return fail('BAD_SIGNATURE', 401);
  let phone = ''; let otp = '';
  try { const j = JSON.parse(payload); phone = String(j?.user?.phone ?? ''); otp = String(j?.sms?.otp ?? ''); } catch { return fail('BAD_PAYLOAD'); }
  if (!phone || !otp) return fail('BAD_PAYLOAD');
  const S = await smsSettings(admin());
  if (S.provider === 'none') return fail('SMS_PROVIDER_NOT_CONFIGURED', 503);
  try {
    await sendSms(S.provider, phone.startsWith('+') ? phone : `+${phone}`, `${S.store}: کد ورود شما ${otp}\nاین کد را به کسی ندهید.`, S.sender);
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  } catch (e) { return fail(`SEND_FAILED: ${String(e).slice(0, 200)}`, 502); }
});
