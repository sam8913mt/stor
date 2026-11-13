import { useEffect, useState } from 'react';
import { qPage } from '../lib/api';
import { supabase } from '../lib/supabase';
import { invokeFn } from '../lib/fn';
import { useAsync } from '../hooks';
import { LOC } from '../i18n';
import { useToast } from '../context';
import { dateTimeFa, errorFa } from '../lib/format';
import { normalizePhone } from '../lib/phone';
import { ErrorBox, Loading, Pager } from '../components/ui';
import { SMS, SettingsForm } from './SettingsForm';
import { Can, PageHead } from './ui';

interface Row { id: string; to_phone: string; template: string; status: string; attempts: number; error: string | null; created_at: string }
const PER = 20;
const TPL: Record<string, string> = { order_placed: 'ثبت سفارش', order_status: 'تغییر وضعیت', payment_received: 'دریافت پرداخت', admin_new_order: 'اطلاع مدیر', campaign: 'تبلیغاتی' };
const ST: Record<string, string> = { queued: 'در صف', sent: 'ارسال شد', failed: 'ناموفق', skipped: 'رد شد' };

export default function AdminSms() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => setPage(1), [status]);
  const { data, error, loading, reload } = useAsync(() => {
    let qb = supabase.from('sms_outbox').select('*', { count: 'exact' });
    if (status) qb = qb.eq('status', status);
    return qPage<Row>(qb.order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1));
  }, [page, status]);
  const audience = useAsync(async () => { const r = await supabase.from('profiles').select('id', { count: 'exact' }).neq('phone', '').eq('marketing_sms_optin', true).limit(1); return r.count ?? 0; }, []);

  const run = async (kind: 'process' | 'test' | 'campaign') => {
    setBusy(kind);
    try {
      const body = kind === 'test' ? { action: 'test', to: normalizePhone(to) ?? to } : kind === 'campaign' ? { action: 'campaign', message: msg.trim() } : {};
      const r = await invokeFn<{ sent?: number; note?: string }>('process-sms-queue', body);
      toast.push(r.note ? errorFa(r.note) : `${(r.sent ?? 0).toLocaleString(LOC)} پیامک ارسال شد.`, r.note ? 'err' : 'ok');
      if (kind === 'campaign' && !r.note) setMsg('');
      reload();
    } catch (e) { toast.push(errorFa((e as Error).message), 'err'); } finally { setBusy(''); }
  };
  const parts = Math.max(1, Math.ceil(msg.length / 70));
  return (
    <Can perm="settings.manage">
      <PageHead title="پیامک‌ها" />
      <p className="note">
        هنوز سامانه پیامکی ندارید؟ مشکلی نیست: «سامانه پیامکی» را روی «هنوز انتخاب نشده» بگذارید؛ پیامک‌ها در صف می‌مانند و بعد از اتصال ارسال می‌شوند.
        کلید API در این صفحه ذخیره نمی‌شود؛ با <code dir="ltr">supabase secrets set SMS_API_KEY=…</code> ثبت کنید (راهنما: <code dir="ltr">SMS_SETUP.md</code>).
      </p>
      <SettingsForm fields={SMS} />
      <div className="panel form form--inline">
        <h2 className="h4">آزمایش و ارسال صف</h2>
        <div className="actions">
          <input className="input" type="tel" dir="ltr" placeholder="09121234567" value={to} onChange={(e) => setTo(e.target.value)} aria-label="شماره آزمایشی" />
          <button className="btn btn--ghost btn--sm" disabled={!to || !!busy} onClick={() => void run('test')}>ارسال آزمایشی</button>
          <button className="btn btn--sm" disabled={!!busy} onClick={() => void run('process')}>ارسال صف‌شده‌ها</button>
        </div>
      </div>
      <Can perm="marketing.manage">
        <div className="panel form">
          <h2 className="h4">پیامک تبلیغاتی به مشتریان</h2>
          <p className="muted">گیرندگان: {(audience.data ?? 0).toLocaleString(LOC)} مشتری که هنگام ثبت‌نام با دریافت پیامک تبلیغاتی موافقت کرده‌اند (فقط به همین‌ها ارسال می‌شود). از خط تبلیغاتی مجاز استفاده کنید.</p>
          <textarea className="textarea" rows={4} maxLength={500} placeholder="متن پیامک…" value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="متن پیامک" />
          <div className="actions">
            <span className="muted">{msg.length.toLocaleString(LOC)} نویسه · حدود {parts.toLocaleString(LOC)} بخش پیامک برای هر نفر</span>
            <button className="btn btn--sm" disabled={msg.trim().length < 5 || !!busy}
              onClick={() => { if (window.confirm(`این پیام برای ${(audience.data ?? 0).toLocaleString(LOC)} مشتری ارسال شود؟`)) void run('campaign'); }}>ارسال به همه</button>
          </div>
        </div>
      </Can>
      <PageHead title="صف پیامک‌ها">
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="وضعیت"><option value="">همه</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </PageHead>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : (
        <>
          <div className="tablewrap"><table className="table">
            <thead><tr><th>زمان</th><th>گیرنده</th><th>نوع</th><th>وضعیت</th><th>تلاش</th><th>خطا</th></tr></thead>
            <tbody>
              {data?.rows.map((r) => <tr key={r.id}><td>{dateTimeFa(r.created_at)}</td><td dir="ltr">{r.to_phone}</td><td>{TPL[r.template] ?? r.template}</td><td><span className={`pill pill--${r.status === 'sent' ? 'delivered' : r.status === 'failed' ? 'cancelled' : 'pending'}`}>{ST[r.status] ?? r.status}</span></td><td>{r.attempts.toLocaleString(LOC)}</td><td className="muted">{r.error ?? ''}</td></tr>)}
              {!data?.rows.length ? <tr><td colSpan={6} className="muted">پیامکی در صف نیست.</td></tr> : null}
            </tbody>
          </table></div>
          <Pager page={page} total={data?.total ?? 0} size={PER} onPage={setPage} />
        </>
      )}
    </Can>
  );
}
