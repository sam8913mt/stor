import { useEffect, useState } from 'react';
import { q, qPage, safeTerm } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAsync, useDebounced } from '../hooks';
import { LOC, tr } from '../i18n';
import { dateFa, price } from '../lib/format';
import { ErrorBox, Loading, Pager } from '../components/ui';
import { Can, PageHead } from './ui';
import { useToast } from '../context';
import { errorFa } from '../lib/format';
import { showPhone } from '../lib/phone';
import type { Profile } from '../types';

const PER = 25;

export default function Customers() {
  const toast = useToast();
  const setPassword = async (id: string, name: string) => {
    const pw = window.prompt(`رمز جدید برای ${name || 'این مشتری'} (حداقل ۸ نویسه). آن را به مشتری اعلام کنید و از او بخواهید در حساب کاربری تغییرش دهد.`);
    if (!pw) return;
    try { await q(supabase.rpc('admin_set_customer_password', { p_user: id, p_password: pw })); toast.push('رمز جدید ثبت شد.'); }
    catch (e) { toast.push(errorFa((e as Error).message), 'err'); }
  };
  const [termIn, setTermIn] = useState('');
  const term = useDebounced(termIn);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [term]);
  const { data, error, loading, reload } = useAsync(async () => {
    let qb = supabase.from('profiles').select('*', { count: 'exact' });
    const t = safeTerm(term);
    if (t) qb = qb.or(`full_name.ilike.*${t}*,email.ilike.*${t}*,phone.ilike.*${t}*`);
    const { rows, total } = await qPage<Profile>(qb.order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1));
    const orders = rows.length ? await q<{ user_id: string; total: number; status: string }[]>(supabase.from('orders').select('user_id,total,status').in('user_id', rows.map((r) => r.id))) : [];
    const agg = new Map<string, { n: number; sum: number }>();
    for (const o of orders) { if (o.status === 'cancelled') continue; const a = agg.get(o.user_id) ?? { n: 0, sum: 0 }; a.n++; a.sum += Number(o.total); agg.set(o.user_id, a); }
    return { total, rows: rows.map((p) => ({ ...p, ...(agg.get(p.id) ?? { n: 0, sum: 0 }) })) };
  }, [term, page]);
  return (
    <Can perm="customers.manage">
      <PageHead title={tr('aCustomers.1', 'مشتریان')}><input className="input" placeholder={tr('aCustomers.2', 'جستجوی نام، ایمیل، تلفن')} value={termIn} onChange={(e) => setTermIn(e.target.value)} aria-label={tr('aCustomers.3', 'جستجو')} /></PageHead>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : (
        <>
          <div className="tablewrap"><table className="table">
            <thead><tr><th>{tr('aCustomers.4', 'نام')}</th><th>{tr('aCustomers.6', 'شماره موبایل')}</th><th>{tr('aCustomers.5', 'ایمیل')}</th><th>{tr('aCustomers.7', 'عضویت')}</th><th>پیامک تبلیغاتی</th><th>{tr('aCustomers.8', 'سفارش‌ها')}</th><th>{tr('aCustomers.9', 'مجموع خرید')}</th><th>رمز</th></tr></thead>
            <tbody>
              {data?.rows.map((p) => <tr key={p.id}><td>{p.full_name || '—'}</td><td dir="ltr">{showPhone(p.phone) || '—'}</td><td dir="ltr">{p.email || '—'}</td><td>{dateFa(p.created_at)}</td><td>{p.marketing_sms_optin ? 'موافق' : '—'}</td><td>{p.n.toLocaleString(LOC)}</td><td>{price(p.sum)}</td><td><button className="link" onClick={() => void setPassword(p.id, p.full_name ?? '')}>رمز جدید</button></td></tr>)}
              {!data?.rows.length ? <tr><td colSpan={8} className="muted">{tr('aCustomers.10', 'مشتری‌ای پیدا نشد.')}</td></tr> : null}
            </tbody>
          </table></div>
          <Pager page={page} total={data?.total ?? 0} size={PER} onPage={setPage} />
        </>
      )}
    </Can>
  );
}
