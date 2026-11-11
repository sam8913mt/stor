import { useState } from 'react';
import { qPage } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAsync } from '../hooks';
import { dateTimeFa } from '../lib/format';
import { ErrorBox, Loading, Pager } from '../components/ui';
import { Can, PageHead } from './ui';
import { tr } from '../i18n';

interface Log { id: number; actor_email: string | null; action: string; entity: string; entity_id: string | null; meta: Record<string, string>; created_at: string }
const ACTION: Record<string, string> = { insert: tr('aLogs.1', 'ایجاد'), update: tr('aLogs.2', 'ویرایش'), delete: tr('aLogs.3', 'حذف') };
const ENTITY: Record<string, string> = {
  products: tr('aLogs.4', 'محصول'), product_variants: tr('aLogs.5', 'تنوع محصول'), categories: tr('aLogs.6', 'دسته‌بندی'), collections: tr('aLogs.7', 'مجموعه'), coupons: tr('aLogs.8', 'کوپن'), reviews: tr('aLogs.9', 'نظر'),
  cms_pages: tr('aLogs.10', 'صفحه'), orders: tr('aLogs.11', 'سفارش'), settings: tr('aLogs.12', 'تنظیم'), admin_roles: tr('aLogs.13', 'نقش'), admin_users: tr('aLogs.14', 'مدیر'), payment_providers: tr('aLogs.15', 'روش پرداخت'),
};

const PER = 30;
export default function Logs() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(() => qPage<Log>(supabase.from('activity_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1)), [page]);
  return (
    <Can perm="logs.view">
      <PageHead title={tr('aLogs.16', 'گزارش فعالیت‌ها')}><button className="btn btn--ghost btn--sm" onClick={reload}>{tr('aLogs.17', 'تازه‌سازی')}</button></PageHead>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : (
        <div className="tablewrap"><table className="table">
          <thead><tr><th>{tr('aLogs.18', 'زمان')}</th><th>{tr('aLogs.19', 'مدیر')}</th><th>{tr('aLogs.20', 'عملیات')}</th><th>{tr('aLogs.21', 'بخش')}</th><th>{tr('aLogs.22', 'جزئیات')}</th></tr></thead>
          <tbody>
            {data?.rows.map((l) => (
              <tr key={l.id}><td>{dateTimeFa(l.created_at)}</td><td dir="ltr">{l.actor_email}</td><td>{ACTION[l.action] ?? l.action}</td><td>{ENTITY[l.entity] ?? l.entity}</td>
                <td>{l.meta.title ?? ''}{l.meta.status ? ` → ${l.meta.status}` : ''}{l.meta.payment_status ? ` / ${l.meta.payment_status}` : ''} <small className="muted" dir="ltr">{l.entity_id?.slice(0, 8)}</small></td></tr>
            ))}
            {!data?.rows.length ? <tr><td colSpan={5} className="muted">{tr('aLogs.23', 'هنوز فعالیتی ثبت نشده است.')}</td></tr> : null}
          </tbody>
        </table></div>
      )}
      <Pager page={page} total={data?.total ?? 0} size={PER} onPage={setPage} />
    </Can>
  );
}
