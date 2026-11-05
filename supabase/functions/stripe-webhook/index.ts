// Stripe → POST webhook (event: checkout.session.completed). Signature is verified with STRIPE_WEBHOOK_SECRET.
import { admin, timingSafeEqual } from '../_shared/lib.ts';

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function verify(body: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts.t; const sig = parts.v1;
  if (!t || !sig || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return timingSafeEqual(hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`))), sig);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return new Response('not configured', { status: 503 });
  const body = await req.text();
  if (!(await verify(body, req.headers.get('stripe-signature') ?? '', secret))) return new Response('bad signature', { status: 400 });

  const event = JSON.parse(body);
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object;
    if (s.payment_status === 'paid') {
      const db = admin();
      const { data: pay } = await db.from('payments').select('id,status,raw').eq('provider', 'stripe').eq('authority', s.id).maybeSingle();
      const expected = (pay?.raw as { minor?: number } | null)?.minor;
      if (pay && pay.status !== 'paid' && expected === s.amount_total) {
        await db.rpc('mark_order_paid', { p_payment_id: pay.id, p_ref: String(s.payment_intent ?? s.id), p_raw: { session: s.id, amount_total: s.amount_total } });
      }
    }
  }
  return new Response('ok');
});
