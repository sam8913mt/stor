// Sends queued rows of public.sms_outbox through the provider chosen in Admin → SMS.
// Callers: (a) pg_cron / scheduler with header x-cron-secret = CRON_SECRET, (b) any signed-in user (only drains the queue),
// (c) admins: action "test" (settings.manage) and action "campaign" (marketing.manage).
import { admin, asUser, cors, getUser, json, timingSafeEqual } from '../_shared/lib.ts';
import { sendSms, smsSettings } from '../_shared/sms.ts';

type D = { order_number: string; total: number; status: string; name?: string; tracking_code?: string | null; carrier?: string | null; title?: string };
const STATUS: Record<string, Record<string, string>> = {
  fa: { pending: 'در انتظار تأیید', confirmed: 'تأیید شد', processing: 'در حال آماده‌سازی', shipped: 'ارسال شد', delivered: 'تحویل داده شد', cancelled: 'لغو شد' },
  en: { pending: 'pending', confirmed: 'confirmed', processing: 'processing', shipped: 'shipped', delivered: 'delivered', cancelled: 'cancelled' },
};
function render(tpl: string, locale: string, d: D, store: string, body: string | null): string {
  if (tpl === 'campaign') return body ?? '';
  const en = locale === 'en';
  const total = new Intl.NumberFormat(en ? 'en-US' : 'fa-IR').format(Math.round(d.total)) + (en ? ' Toman' : ' تومان');
  const st = STATUS[en ? 'en' : 'fa'][d.status] ?? d.status;
  switch (tpl) {
    case 'order_placed': return en ? `${store}: order ${d.order_number} received. Total ${total}. Thank you!` : `${store}: سفارش ${d.order_number} ثبت شد. مبلغ کل ${total}. سپاس از خرید شما.`;
    case 'order_status': {
      const track = d.tracking_code ? (en ? ` Tracking${d.carrier ? ` (${d.carrier})` : ''}: ${d.tracking_code}.` : ` کد رهگیری${d.carrier ? ` (${d.carrier})` : ''}: ${d.tracking_code}`) : '';
      return en ? `${store}: order ${d.order_number} is now ${st}.${track}` : `${store}: وضعیت سفارش ${d.order_number}: ${st}.${track}`;
    }
    case 'payment_received': return en ? `${store}: payment of ${total} received for order ${d.order_number}.` : `${store}: پرداخت ${total} برای سفارش ${d.order_number} دریافت شد.`;
    case 'back_in_stock': return `${store}: «${d.title ?? ''}» دوباره موجود شد. زود سفارش دهید!`;
    case 'admin_new_order': return `${store}: سفارش جدید ${d.order_number} — ${total} — ${d.name ?? ''}`;
    default: return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  const cron = Deno.env.get('CRON_SECRET');
  const viaCron = !!cron && timingSafeEqual(req.headers.get('x-cron-secret') ?? '', cron);
  const user = viaCron ? null : await getUser(req);
  if (!viaCron && !user) return json(req, { error: 'AUTH_REQUIRED' }, 401);

  const body = await req.json().catch(() => ({}));
  const db = admin();
  const S = await smsSettings(db);
  if (!S.enabled || S.provider === 'none') return json(req, { sent: 0, note: 'SMS_DISABLED' });

  if (body.action === 'test') {
    const { data: ok } = await asUser(req).rpc('has_perm', { p: 'settings.manage' });
    if (!ok) return json(req, { error: 'FORBIDDEN' }, 403);
    const { data: to } = await db.rpc('norm_phone', { p: String(body.to ?? '') });
    if (!to) return json(req, { error: 'BAD_PHONE' }, 400);
    try { await sendSms(S.provider, to, `${S.store}: پیامک آزمایشی — ارسال پیامک درست کار می‌کند.`, S.sender); return json(req, { sent: 1 }); }
    catch (e) { return json(req, { error: 'SEND_FAILED', detail: String(e).slice(0, 300) }, 502); }
  }

  let limit = 20;
  if (body.action === 'campaign') {
    const { data: ok } = await asUser(req).rpc('has_perm', { p: 'marketing.manage' });
    if (!ok) return json(req, { error: 'FORBIDDEN' }, 403);
    const message = String(body.message ?? '').trim();
    if (message.length < 5 || message.length > 500) return json(req, { error: 'BAD_MESSAGE' }, 400);
    const { data: people } = await db.from('profiles').select('phone').neq('phone', '').eq('marketing_sms_optin', true).limit(5000);
    const seen = new Set<string>(); const rows: Record<string, unknown>[] = [];
    for (const p of people ?? []) {
      const { data: n } = await db.rpc('norm_phone', { p: p.phone });
      if (n && !seen.has(n)) { seen.add(n); rows.push({ to_phone: n, template: 'campaign', locale: 'fa', body: message }); }
    }
    for (let i = 0; i < rows.length; i += 500) await db.from('sms_outbox').insert(rows.slice(i, i + 500));
    limit = 100;
  }

  const { data: queue } = await db.from('sms_outbox').select('*').eq('status', 'queued').lt('attempts', 5).order('created_at').limit(limit);
  let sent = 0;
  for (const row of queue ?? []) {
    // optimistic lock on attempts: two concurrent runs can never send the same SMS twice
    const { data: claimed } = await db.from('sms_outbox').update({ attempts: row.attempts + 1 }).eq('id', row.id).eq('attempts', row.attempts).eq('status', 'queued').select('id');
    if (!claimed?.length) continue;
    try {
      await sendSms(S.provider, row.to_phone, render(row.template, row.locale, row.data, S.store, row.body), S.sender);
      await db.from('sms_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', row.id);
      sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      await db.from('sms_outbox').update({ attempts, status: attempts >= 5 ? 'failed' : 'queued', error: String(e).slice(0, 300) }).eq('id', row.id);
    }
  }
  const { count } = await db.from('sms_outbox').select('id', { count: 'exact', head: true }).eq('status', 'queued');
  return json(req, { sent, processed: queue?.length ?? 0, queued: count ?? 0 });
});
