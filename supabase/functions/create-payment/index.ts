// POST { order_id } (signed-in customer) → { url } to redirect the browser to the provider's hosted payment page.
// Amount always comes from the database order, never from the client.
import { admin, cors, getUser, json, SITE_URL, SUPABASE_URL } from '../_shared/lib.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'METHOD' }, 405);
  const user = await getUser(req);
  if (!user) return json(req, { error: 'AUTH_REQUIRED' }, 401);
  if (SITE_URL === '/') return json(req, { error: 'NOT_CONFIGURED', detail: 'SITE_URL secret missing' }, 500);

  const { order_id } = await req.json().catch(() => ({}));
  const db = admin();
  const { data: order } = await db.from('orders').select('id,order_number,user_id,total,status,payment_status,payment_method').eq('id', order_id ?? '').maybeSingle();
  if (!order || order.user_id !== user.id) return json(req, { error: 'NOT_FOUND' }, 404);
  if (order.status === 'cancelled' || order.payment_status !== 'unpaid') return json(req, { error: 'NOT_PAYABLE' }, 409);
  const { data: prov } = await db.from('payment_providers').select('key,kind,is_enabled').eq('key', order.payment_method).maybeSingle();
  if (!prov || prov.kind !== 'online' || !prov.is_enabled) return json(req, { error: 'BAD_PROVIDER' }, 400);

  const { data: pay, error: perr } = await db.from('payments').insert({ order_id: order.id, provider: prov.key, amount: order.total }).select('id').single();
  if (perr || !pay) return json(req, { error: 'DB', detail: perr?.message }, 500);
  const fail = async (code: string, detail?: unknown, status = 502) => {
    await db.from('payments').update({ status: 'failed', raw: { error: code, detail } }).eq('id', pay.id);
    return json(req, { error: code }, status);
  };

  try {
    if (prov.key === 'zarinpal') {
      const merchant = Deno.env.get('ZARINPAL_MERCHANT_ID');
      if (!merchant) return await fail('PROVIDER_NOT_CONFIGURED', undefined, 503);
      const base = Deno.env.get('ZARINPAL_SANDBOX') === 'true' ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
      const r = await fetch(`${base}/pg/v4/payment/request.json`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          merchant_id: merchant, amount: Number(order.total) * 10, // store prices are Toman; Zarinpal expects Rial
          callback_url: `${SUPABASE_URL}/functions/v1/payment-callback?provider=zarinpal&payment=${pay.id}`,
          description: `Order ${order.order_number}`, metadata: { email: user.email ?? undefined },
        }),
      });
      const j = await r.json();
      if (j?.data?.code !== 100 || !j.data.authority) return await fail('PROVIDER_ERROR', j?.errors ?? j);
      await db.from('payments').update({ authority: j.data.authority }).eq('id', pay.id);
      return json(req, { url: `${base}/pg/StartPay/${j.data.authority}` });
    }
    if (prov.key === 'stripe') {
      const key = Deno.env.get('STRIPE_SECRET_KEY');
      if (!key) return await fail('PROVIDER_NOT_CONFIGURED', undefined, 503);
      const currency = (Deno.env.get('STRIPE_CURRENCY') ?? 'usd').toLowerCase();
      const rate = Number(Deno.env.get('STRIPE_RATE') ?? '1') || 1; // store-currency units per 1 major Stripe unit
      const minor = Math.round((Number(order.total) / rate) * 100);
      const form = new URLSearchParams({
        mode: 'payment', client_reference_id: order.id, 'metadata[payment_id]': pay.id,
        success_url: `${SITE_URL}#/order-success/${order.order_number}?paid=pending`, cancel_url: `${SITE_URL}#/account/orders?payment=cancelled`,
        'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': currency,
        'line_items[0][price_data][unit_amount]': String(minor), 'line_items[0][price_data][product_data][name]': `Order ${order.order_number}`,
      });
      if (user.email) form.set('customer_email', user.email);
      const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      const j = await r.json();
      if (!r.ok || !j.url) return await fail('PROVIDER_ERROR', j?.error?.message);
      await db.from('payments').update({ authority: j.id, raw: { minor, currency } }).eq('id', pay.id);
      return json(req, { url: j.url });
    }
    return await fail('BAD_PROVIDER', undefined, 400);
  } catch (e) {
    return await fail('PROVIDER_UNREACHABLE', String(e));
  }
});
