// SMS gateway adapters. The provider is chosen in Admin → SMS (setting sms_provider); secrets live ONLY in Supabase secrets:
//   supabase secrets set SMS_API_KEY=…            (Kavenegar / SMS.ir API key)
//   supabase secrets set SMS_USERNAME=… SMS_PASSWORD=…   (Melipayamak only)
// Adapters follow each provider's public REST docs; run Admin → SMS → "ارسال آزمایشی" once after you choose a provider.
export type Provider = 'none' | 'kavenegar' | 'smsir' | 'melipayamak';
export const PROVIDERS: Provider[] = ['none', 'kavenegar', 'smsir', 'melipayamak'];

/** +98912… → 0912… (Iranian gateways expect the local form). Other countries keep the international form. */
export const localNumber = (e164: string) => e164.replace(/^\+98/, '0');

export async function sendSms(provider: string, to: string, text: string, sender: string): Promise<void> {
  const key = Deno.env.get('SMS_API_KEY') ?? '';
  const mobile = localNumber(to);
  if (provider === 'kavenegar') {
    if (!key) throw new Error('SMS_API_KEY is not set');
    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(key)}/sms/send.json?receptor=${encodeURIComponent(mobile)}${sender ? `&sender=${encodeURIComponent(sender)}` : ''}&message=${encodeURIComponent(text)}`;
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.return?.status !== 200) throw new Error(`kavenegar ${r.status}: ${String(j?.return?.message ?? '').slice(0, 200)}`);
    return;
  }
  if (provider === 'smsir') {
    if (!key) throw new Error('SMS_API_KEY is not set');
    const r = await fetch('https://api.sms.ir/v1/send/bulk', {
      method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ lineNumber: Number(sender), messageText: text, mobiles: [mobile] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.status !== 1) throw new Error(`sms.ir ${r.status}: ${String(j?.message ?? '').slice(0, 200)}`);
    return;
  }
  if (provider === 'melipayamak') {
    const username = Deno.env.get('SMS_USERNAME') ?? ''; const password = Deno.env.get('SMS_PASSWORD') ?? '';
    if (!username || !password) throw new Error('SMS_USERNAME / SMS_PASSWORD are not set');
    const r = await fetch('https://rest.payamak-panel.com/api/SendSMS/SendSMS', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, to: mobile, from: sender, text, isFlash: false }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || String(j?.RetStatus) !== '1') throw new Error(`melipayamak ${r.status}: ${String(j?.StrRetStatus ?? '').slice(0, 200)}`);
    return;
  }
  throw new Error('SMS provider is not configured');
}

/** Reads the SMS settings that are safe to keep in the database (never the API key). */
export async function smsSettings(db: { from: (t: string) => any }) {
  const { data } = await db.from('settings').select('key,value').in('key', ['sms_enabled', 'sms_provider', 'sms_sender', 'store_name']);
  const S = Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])) as Record<string, unknown>;
  return { enabled: S.sms_enabled === true, provider: String(S.sms_provider ?? 'none'), sender: String(S.sms_sender ?? ''), store: String(S.store_name ?? '') };
}
