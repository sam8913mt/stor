// Sends queued rows of public.email_outbox through the provider chosen in Admin → Email settings.
// Callers: (a) pg_cron / scheduler with header x-cron-secret = CRON_SECRET, (b) any signed-in user (only drains the queue),
// (c) admins with settings.manage for action "test". The provider API key is the EMAIL_API_KEY secret — never stored in the DB.
import { admin, asUser, cors, getUser, json, timingSafeEqual } from '../_shared/lib.ts';

type D = { order_number: string; total: number; status: string; payment_status: string; name?: string };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const STATUS = {
  fa: { pending: 'در انتظار تأیید', confirmed: 'تأیید شده', processing: 'در حال آماده‌سازی', shipped: 'ارسال شده', delivered: 'تحویل داده شد', cancelled: 'لغو شده' },
  en: { pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' },
} as Record<string, Record<string, string>>;

function render(tpl: string, locale: string, d: D, store: string) {
  const en = locale === 'en';
  const total = new Intl.NumberFormat(en ? 'en-US' : 'fa-IR').format(Math.round(d.total)) + (en ? ' Toman' : ' تومان');
  const st = (STATUS[en ? 'en' : 'fa'][d.status] ?? d.status);
  const hi = en ? `Hello ${d.name ?? ''},` : `${d.name ?? ''} عزیز، سلام`;
  const L: Record<string, [string, string]> = {
    order_placed: en ? [`Your order ${d.order_number} has been received`, `Thank you for your order. Total: ${total}. We will update you as it progresses.`] : [`سفارش ${d.order_number} ثبت شد`, `از سفارش شما سپاسگزاریم. مبلغ کل: ${total}. از وضعیت سفارش به شما اطلاع می‌دهیم.`],
    order_status: en ? [`Order ${d.order_number}: ${st}`, `The status of your order is now: ${st}.`] : [`سفارش ${d.order_number}: ${st}`, `وضعیت سفارش شما اکنون «${st}» است.`],
    payment_received: en ? [`Payment received for ${d.order_number}`, `We received your payment of ${total}. Thank you!`] : [`پرداخت سفارش ${d.order_number} دریافت شد`, `پرداخت ${total} با موفقیت ثبت شد. سپاسگزاریم.`],
    admin_new_order: [`New order ${d.order_number} (${total})`, `${d.name ?? ''} placed order ${d.order_number}. Total ${total}. Status: ${d.status}.`],
  };
  const [subject, line] = L[tpl];
  const text = tpl === 'admin_new_order' ? line : `${hi}\n\n${line}\n\n${store}`;
  const dir = en || tpl === 'admin_new_order' ? 'ltr' : 'rtl';
  const html = `<div dir="${dir}" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#35322e;max-width:560px"><p>${tpl === 'admin_new_order' ? '' : esc(hi)}</p><p>${esc(line)}</p><p style="color:#7b7469">${esc(store)}</p></div>`;
  return { subject, text, html };
}

async function send(provider: string, key: string, from: string, fromName: string, to: string, m: { subject: string; text: string; html: string }) {
  if (provider === 'brevo') {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: { email: from, name: fromName || undefined }, to: [{ email: to }], subject: m.subject, htmlContent: m.html, textContent: m.text }) });
    if (!r.ok) throw new Error(`brevo ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return;
  }
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromName ? `${fromName} <${from}>` : from, to: [to], subject: m.subject, html: m.html, text: m.text }) });
  if (!r.ok) throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  const cron = Deno.env.get('CRON_SECRET');
  const viaCron = !!cron && timingSafeEqual(req.headers.get('x-cron-secret') ?? '', cron);
  const user = viaCron ? null : await getUser(req);
  if (!viaCron && !user) return json(req, { error: 'AUTH_REQUIRED' }, 401);

  const body = await req.json().catch(() => ({}));
  const db = admin();
  const { data: rows } = await db.from('settings').select('key,value').in('key', ['email_enabled', 'email_provider', 'email_from', 'email_from_name', 'store_name']);
  const S = Object.fromEntries((rows ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])) as Record<string, unknown>;
  const key = Deno.env.get('EMAIL_API_KEY');
  const provider = String(S.email_provider ?? 'resend'); const from = String(S.email_from ?? ''); const fromName = String(S.email_from_name ?? ''); const store = String(S.store_name ?? '');
  if (S.email_enabled !== true) return json(req, { sent: 0, note: 'EMAIL_DISABLED' });
  if (!key || !from) return json(req, { error: 'NOT_CONFIGURED' }, 503);

  if (body.action === 'test') {
    const { data: ok } = await asUser(req).rpc('has_perm', { p: 'settings.manage' });
    if (!ok) return json(req, { error: 'FORBIDDEN' }, 403);
    const to = String(body.to ?? '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json(req, { error: 'BAD_EMAIL' }, 400);
    try { await send(provider, key, from, fromName, to, { subject: `${store} — test email`, text: 'Email delivery works.', html: '<p>Email delivery works.</p>' }); return json(req, { sent: 1 }); }
    catch (e) { return json(req, { error: 'SEND_FAILED', detail: String(e).slice(0, 300) }, 502); }
  }

  const { data: queue } = await db.from('email_outbox').select('*').eq('status', 'queued').lt('attempts', 5).order('created_at').limit(20);
  let sent = 0;
  for (const row of queue ?? []) {
    // Claim the row (optimistic lock on attempts) so two concurrent runs can't send the same email twice.
    const { data: claimed } = await db.from('email_outbox').update({ attempts: row.attempts + 1 }).eq('id', row.id).eq('attempts', row.attempts).eq('status', 'queued').select('id');
    if (!claimed?.length) continue;
    try {
      await send(provider, key, from, fromName, row.to_email, render(row.template, row.locale, row.data, store));
      await db.from('email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', row.id);
      sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      await db.from('email_outbox').update({ attempts, status: attempts >= 5 ? 'failed' : 'queued', error: String(e).slice(0, 300) }).eq('id', row.id);
    }
  }
  return json(req, { sent, processed: queue?.length ?? 0 });
});
