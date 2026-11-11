import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { q } from '../lib/api';
import { useAsync } from '../hooks';
import { fmt, ORDER_STATUS, price } from '../lib/format';
import { ErrorBox, Loading } from '../components/ui';
import { Can, PageHead } from './ui';
import { tr } from '../i18n';

interface Stats {
  revenue: number; orders: number; pending: number; new_customers: number; total_customers: number;
  by_day: { day: string; revenue: number; orders: number }[];
  top_products: { title: string; qty: number; revenue: number }[];
  status_counts: Record<string, number>;
  low_stock: { sku: string; title: string; stock: number }[];
}

function Bars({ data }: { data: Stats['by_day'] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const w = 100 / Math.max(1, data.length);
  return (
    <svg className="bars" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={tr('aDashboard.1', 'نمودار فروش روزانه')}>
      {data.map((d, i) => {
        const h = (d.revenue / max) * 36;
        return <rect key={d.day} x={i * w + w * 0.15} y={40 - h} width={w * 0.7} height={Math.max(h, 0.4)}><title>{tr('aDashboard.2', '{0}: {1} تومان', [d.day, fmt(d.revenue)])}</title></rect>;
      })}
    </svg>
  );
}

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useAsync(() => q<Stats>(supabase.rpc('admin_stats', { p_days: days })), [days]);
  return (
    <Can perm="analytics.view">
      <PageHead title={tr('aDashboard.3', 'داشبورد')}>
        <select className="select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={tr('aDashboard.4', 'بازه')}>
          <option value={7}>{tr('aDashboard.5', '۷ روز اخیر')}</option><option value={30}>{tr('aDashboard.6', '۳۰ روز اخیر')}</option><option value={90}>{tr('aDashboard.7', '۹۰ روز اخیر')}</option>
        </select>
      </PageHead>
      {loading ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : data ? (
        <>
          <div className="kpis">
            <div><span className="muted">{tr('aDashboard.8', 'فروش (بدون لغوشده‌ها)')}</span><strong>{price(data.revenue)}</strong></div>
            <div><span className="muted">{tr('aDashboard.9', 'سفارش‌ها')}</span><strong>{fmt(data.orders)}</strong></div>
            <div><span className="muted">{tr('aDashboard.10', 'در انتظار تأیید')}</span><strong>{fmt(data.pending)}</strong></div>
            <div><span className="muted">{tr('aDashboard.11', 'مشتریان جدید')}</span><strong>{fmt(data.new_customers)}</strong><small className="muted">{tr('aDashboard.12', 'از')} {fmt(data.total_customers)} {tr('aDashboard.13', 'کل')}</small></div>
          </div>
          <div className="panel"><h2 className="h4">{tr('aDashboard.14', 'فروش روزانه')}</h2><Bars data={data.by_day} /></div>
          <div className="two">
            <div className="panel"><h2 className="h4">{tr('aDashboard.15', 'پرفروش‌ترین‌ها')}</h2>
              {data.top_products.length ? <table className="table"><tbody>{data.top_products.map((t) => <tr key={t.title}><td>{t.title}</td><td>{fmt(t.qty)} {tr('aDashboard.16', 'عدد')}</td><td>{price(t.revenue)}</td></tr>)}</tbody></table> : <p className="muted">{tr('aDashboard.17', 'هنوز فروشی ثبت نشده است.')}</p>}
            </div>
            <div className="panel"><h2 className="h4">{tr('aDashboard.18', 'وضعیت سفارش‌ها')}</h2>
              {Object.keys(data.status_counts).length ? <table className="table"><tbody>{Object.entries(data.status_counts).map(([k, v]) => <tr key={k}><td>{ORDER_STATUS[k] ?? k}</td><td>{fmt(v)}</td></tr>)}</tbody></table> : <p className="muted">{tr('aDashboard.19', 'سفارشی در این بازه نیست.')}</p>}
            </div>
          </div>
          <div className="panel"><h2 className="h4">{tr('aDashboard.20', 'موجودی کم (۳ عدد یا کمتر)')}</h2>
            {data.low_stock.length ? <table className="table"><tbody>{data.low_stock.map((l) => <tr key={l.sku}><td>{l.title}</td><td dir="ltr">{l.sku}</td><td>{fmt(l.stock)}</td></tr>)}</tbody></table> : <p className="muted">{tr('aDashboard.21', 'همه‌ی تنوع‌ها موجودی کافی دارند.')}</p>}
          </div>
        </>
      ) : null}
    </Can>
  );
}
