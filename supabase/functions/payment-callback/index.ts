// Zarinpal redirects the shopper here (GET ?provider=zarinpal&payment=<id>&Authority=…&Status=OK|NOK).
// We never trust the query string: the payment is verified server-to-server against the gateway with the DB amount.
import { admin, redirect } from '../_shared/lib.ts';

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const paymentId = u.searchParams.get('payment') ?? '';
  const db = admin();
  const { data: pay } = await db.from('payments').select('id,order_id,provider,status,amount,authority,orders(order_number)').eq('id', paymentId).maybeSingle();
  if (!pay || pay.provider !== 'zarinpal') return redirect('/account/orders?payment=failed');
  const number = (pay.orders as { order_number: string } | null)?.order_number ?? '';
  if (pay.status === 'paid') return redirect(`/order-success/${number}?paid=1`);

  const authority = u.searchParams.get('Authority');
  if (u.searchParams.get('Status') !== 'OK' || !authority || authority !== pay.authority) {
    await db.from('payments').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', pay.id).eq('status', 'pending');
    return redirect('/account/orders?payment=failed');
  }
  const merchant = Deno.env.get('ZARINPAL_MERCHANT_ID');
  if (!merchant) return redirect('/account/orders?payment=failed');
  const base = Deno.env.get('ZARINPAL_SANDBOX') === 'true' ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
  try {
    const r = await fetch(`${base}/pg/v4/payment/verify.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ merchant_id: merchant, amount: Number(pay.amount) * 10, authority }),
    });
    const j = await r.json();
    if (j?.data?.code === 100 || j?.data?.code === 101) {
      await db.rpc('mark_order_paid', { p_payment_id: pay.id, p_ref: String(j.data.ref_id ?? ''), p_raw: j.data });
      return redirect(`/order-success/${number}?paid=1`);
    }
    await db.from('payments').update({ status: 'failed', raw: j, updated_at: new Date().toISOString() }).eq('id', pay.id).eq('status', 'pending');
  } catch (_e) { /* leave pending; shopper can retry from their orders page */ }
  return redirect('/account/orders?payment=failed');
});
