import { useEffect, useState } from 'react';
import { q, qPage, safeTerm } from '../lib/api';
import { supabase } from '../lib/supabase';
import { kickEmailQueue } from '../lib/fn';
import { useAsync, useDebounced } from '../hooks';
import { useToast } from '../context';
import { LOC, tr, SEP } from '../i18n';
import { dateTimeFa, errorFa, ORDER_STATUS, PAY_METHOD, PAY_STATUS, price } from '../lib/format';
import { ErrorBox, Loading, Pager } from '../components/ui';
import { Can, Modal, PageHead } from './ui';
import type { Order, Payment } from '../types';

const PER = 25;

export default function AdminOrders() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [termIn, setTermIn] = useState('');
  const term = useDebounced(termIn);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status, term]);
  const { data, error, loading, reload } = useAsync(() => {
    let qb = supabase.from('orders').select('*, order_items(*)', { count: 'exact' });
    if (status) qb = qb.eq('status', status);
    const t = safeTerm(term);
    if (t) qb = qb.or(`order_number.ilike.*${t}*,shipping->>full_name.ilike.*${t}*,shipping->>phone.ilike.*${t}*`);
    return qPage<Order>(qb.order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1));
  }, [status, term, page]);
  const [sel, setSel] = useState<Order | null>(null);
  const [st, setSt] = useState('');
  const [ps, setPs] = useState('');
  const [busy, setBusy] = useState(false);
  const pays = useAsync(() => (sel ? q<Payment[]>(supabase.from('payments').select('*').eq('order_id', sel.id).order('created_at', { ascending: false })) : Promise.resolve([] as Payment[])), [sel?.id]);
  const open = (o: Order) => { setSel(o); setSt(o.status); setPs(o.payment_status); };

  const save = async () => {
    if (!sel) return; setBusy(true);
    try {
      await q(supabase.from('orders').update({ status: st, payment_status: ps }).eq('id', sel.id));
      toast.push(st === 'cancelled' && sel.status !== 'cancelled' ? tr('aOrders.1', 'سفارش لغو شد و موجودی برگشت داده شد.') : tr('aOrders.2', 'ذخیره شد.')); setSel(null); reload(); kickEmailQueue();
    } catch (e) { toast.push(errorFa((e as Error).message), 'err'); } finally { setBusy(false); }
  };

  return (
    <Can perm="orders.manage">
      <PageHead title={tr('aOrders.3', 'سفارش‌ها')}>
        <input className="input" placeholder={tr('aOrders.4', 'جستجوی شماره، نام، تلفن')} value={termIn} onChange={(e) => setTermIn(e.target.value)} aria-label={tr('aOrders.5', 'جستجو')} />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={tr('aOrders.6', 'وضعیت')}>
          <option value="">{tr('aOrders.7', 'همه وضعیت‌ها')}</option>{Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </PageHead>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : (
        <>
          <div className="tablewrap"><table className="table">
            <thead><tr><th>{tr('aOrders.8', 'شماره')}</th><th>{tr('aOrders.9', 'تاریخ')}</th><th>{tr('aOrders.10', 'مشتری')}</th><th>{tr('aOrders.11', 'مبلغ')}</th><th>{tr('aOrders.12', 'وضعیت')}</th><th>{tr('aOrders.13', 'پرداخت')}</th></tr></thead>
            <tbody>
              {data?.rows.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => open(o)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(o)}>
                  <td dir="ltr">{o.order_number}</td><td>{dateTimeFa(o.created_at)}</td><td>{o.shipping.full_name}</td><td>{price(o.total)}</td>
                  <td><span className={`pill pill--${o.status}`}>{ORDER_STATUS[o.status]}</span></td><td>{PAY_STATUS[o.payment_status]}</td>
                </tr>
              ))}
              {!data?.rows.length ? <tr><td colSpan={6} className="muted">{tr('aOrders.14', 'سفارشی پیدا نشد.')}</td></tr> : null}
            </tbody>
          </table></div>
          <Pager page={page} total={data?.total ?? 0} size={PER} onPage={setPage} />
        </>
      )}
      {sel ? (
        <Modal title={tr('aOrders.15', 'سفارش {0}', [sel.order_number])} onClose={() => setSel(null)} wide>
          <div className="two">
            <div>
              <h3 className="h4">{tr('aOrders.16', 'تحویل')}</h3>
              <p>{sel.shipping.full_name}<br /><span dir="ltr">{sel.shipping.phone}</span><br />{sel.shipping.city}{SEP}{sel.shipping.address}{sel.shipping.postal_code ? tr('aOrders.17', ' — کد پستی {0}', [sel.shipping.postal_code]) : ''}</p>
              {sel.note ? <p className="note">{tr('aOrders.18', 'یادداشت مشتری:')} {sel.note}</p> : null}
              <p className="muted small">{PAY_METHOD[sel.payment_method]}</p>
              {pays.data?.length ? <ul className="small">{pays.data.map((p) => <li key={p.id}>{p.provider} · {p.status === 'paid' ? tr('aOrders.19', 'پرداخت شد') : p.status === 'failed' ? tr('aOrders.20', 'ناموفق') : tr('aOrders.21', 'در انتظار')} · {price(p.amount)}{p.ref_id ? <> · <span dir="ltr">{p.ref_id}</span></> : null}</li>)}</ul> : null}
            </div>
            <div className="form">
              <label>{tr('aOrders.22', 'وضعیت سفارش')}<select className="select" value={st} onChange={(e) => setSt(e.target.value)}>{Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>{tr('aOrders.23', 'وضعیت پرداخت')}<select className="select" value={ps} onChange={(e) => setPs(e.target.value)}>{Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              {st === 'cancelled' && sel.status !== 'cancelled' ? <p className="note">{tr('aOrders.24', 'با لغو سفارش، موجودی کالاها به انبار برمی‌گردد.')}</p> : null}
              {sel.status === 'cancelled' && st !== 'cancelled' ? <p className="note">{tr('aOrders.25', 'با فعال‌سازی دوباره، موجودی دوباره کسر می‌شود؛ اگر موجودی کافی نباشد ذخیره انجام نمی‌شود.')}</p> : null}
              {sel.status === 'cancelled' && sel.payment_status === 'paid' ? <p className="note note--err">{tr('aOrders.26', 'این سفارش پرداخت‌شده لغو شده است؛ بازگشت وجه را دستی انجام دهید و وضعیت پرداخت را «بازگشت وجه» کنید.')}</p> : null}
            </div>
          </div>
          <table className="table"><thead><tr><th>{tr('aOrders.27', 'کالا')}</th><th>SKU</th><th>{tr('aOrders.28', 'تعداد')}</th><th>{tr('aOrders.29', 'قیمت واحد')}</th></tr></thead>
            <tbody>{sel.order_items?.map((i) => <tr key={i.id}><td>{i.title} <small className="muted">{i.color} · {i.size}</small></td><td dir="ltr">{i.sku}</td><td>{i.qty.toLocaleString(LOC)}</td><td>{price(i.unit_price)}</td></tr>)}</tbody></table>
          <div className="totals"><span>{tr('aOrders.30', 'جمع:')} {price(sel.subtotal)}</span>{sel.discount ? <span>{tr('aOrders.31', 'تخفیف (')}{sel.coupon_code}): {price(sel.discount)}</span> : null}<span>{tr('aOrders.32', 'ارسال:')} {price(sel.shipping_fee)}</span><strong>{tr('aOrders.33', 'مبلغ کل:')} {price(sel.total)}</strong></div>
          <div className="form__actions"><button className="btn btn--sm" onClick={save} disabled={busy}>{tr('aOrders.34', 'ذخیره وضعیت')}</button><button className="btn btn--ghost btn--sm" onClick={() => setSel(null)}>{tr('aOrders.35', 'بستن')}</button></div>
        </Modal>
      ) : null}
    </Can>
  );
}
