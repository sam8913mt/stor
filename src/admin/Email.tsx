import { useEffect, useState } from 'react';
import { qPage } from '../lib/api';
import { supabase } from '../lib/supabase';
import { invokeFn } from '../lib/fn';
import { useAsync } from '../hooks';
import { LOC, tr } from '../i18n';
import { useToast } from '../context';
import { dateTimeFa, errorFa } from '../lib/format';
import { ErrorBox, Loading, Pager } from '../components/ui';
import { EMAIL, SettingsForm } from './SettingsForm';
import { Can, PageHead } from './ui';

interface Row { id: string; to_email: string; template: string; status: string; attempts: number; error: string | null; created_at: string }
const PER = 20;
const TPL: Record<string, string> = { order_placed: tr('aEmail.1', 'ثبت سفارش'), order_status: tr('aEmail.2', 'تغییر وضعیت'), payment_received: tr('aEmail.3', 'دریافت پرداخت'), admin_new_order: tr('aEmail.4', 'اطلاع مدیر') };
const ST: Record<string, string> = { queued: tr('aEmail.5', 'در صف'), sent: tr('aEmail.6', 'ارسال شد'), failed: tr('aEmail.7', 'ناموفق'), skipped: tr('aEmail.8', 'رد شد') };

export default function AdminEmail() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => setPage(1), [status]);
  const { data, error, loading, reload } = useAsync(() => {
    let qb = supabase.from('email_outbox').select('*', { count: 'exact' });
    if (status) qb = qb.eq('status', status);
    return qPage<Row>(qb.order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1));
  }, [page, status]);

  const run = async (kind: 'process' | 'test') => {
    setBusy(kind);
    try {
      const r = await invokeFn<{ sent?: number; note?: string }>('process-email-queue', kind === 'test' ? { action: 'test', to } : {});
      toast.push(r.note ? errorFa(r.note) : tr('aEmail.9', '{0} ایمیل ارسال شد.', [(r.sent ?? 0).toLocaleString(LOC)]), r.note ? 'err' : 'ok'); reload();
    } catch (e) { toast.push(errorFa((e as Error).message), 'err'); } finally { setBusy(''); }
  };
  return (
    <Can perm="settings.manage">
      <PageHead title={tr('aEmail.10', 'اعلان‌های ایمیلی')} />
      <p className="note">{tr('aEmail.11', 'کلید API ارائه‌دهنده در تنظیمات این صفحه ذخیره نمی‌شود؛ باید با')} <code dir="ltr">supabase secrets set EMAIL_API_KEY=…</code> {tr('aEmail.12', 'ثبت شود (راهنما: EXTERNAL_SETUP.md).')}</p>
      <SettingsForm fields={EMAIL} />
      <div className="panel form form--inline">
        <h2 className="h4">{tr('aEmail.13', 'آزمایش و ارسال')}</h2>
        <div className="actions">
          <input className="input" type="email" dir="ltr" placeholder={tr('aEmail.14', 'ایمیل گیرنده‌ی آزمایشی')} value={to} onChange={(e) => setTo(e.target.value)} aria-label={tr('aEmail.15', 'ایمیل آزمایشی')} />
          <button className="btn btn--ghost btn--sm" disabled={!to || !!busy} onClick={() => void run('test')}>{tr('aEmail.16', 'ارسال آزمایشی')}</button>
          <button className="btn btn--sm" disabled={!!busy} onClick={() => void run('process')}>{tr('aEmail.17', 'ارسال صف‌شده‌ها')}</button>
        </div>
      </div>
      <PageHead title={tr('aEmail.18', 'صف ایمیل‌ها')}>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={tr('aEmail.19', 'وضعیت')}><option value="">{tr('aEmail.20', 'همه')}</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </PageHead>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : (
        <>
          <div className="tablewrap"><table className="table">
            <thead><tr><th>{tr('aEmail.21', 'زمان')}</th><th>{tr('aEmail.22', 'گیرنده')}</th><th>{tr('aEmail.23', 'نوع')}</th><th>{tr('aEmail.24', 'وضعیت')}</th><th>{tr('aEmail.25', 'تلاش')}</th><th>{tr('aEmail.26', 'خطا')}</th></tr></thead>
            <tbody>
              {data?.rows.map((r) => <tr key={r.id}><td>{dateTimeFa(r.created_at)}</td><td dir="ltr">{r.to_email}</td><td>{TPL[r.template] ?? r.template}</td><td><span className={`pill pill--${r.status === 'sent' ? 'delivered' : r.status === 'failed' ? 'cancelled' : 'pending'}`}>{ST[r.status]}</span></td><td>{r.attempts}</td><td dir="ltr"><small>{r.error ?? ''}</small></td></tr>)}
              {!data?.rows.length ? <tr><td colSpan={6} className="muted">{tr('aEmail.27', 'ایمیلی در صف نیست.')}</td></tr> : null}
            </tbody>
          </table></div>
          <Pager page={page} total={data?.total ?? 0} size={PER} onPage={setPage} />
        </>
      )}
    </Can>
  );
}
