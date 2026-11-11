import { useState } from 'react';
import { q } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAsync } from '../hooks';
import { useToast } from '../context';
import { dateFa, errorFa } from '../lib/format';
import { ErrorBox, Loading } from '../components/ui';
import { Can, PageHead } from './ui';
import type { Review } from '../types';
import { tr } from '../i18n';

type R = Review & { product?: { title_fa: string } | null };
const LABEL = { pending: tr('aReviews.1', 'در انتظار'), approved: tr('aReviews.2', 'تأیید شده'), rejected: tr('aReviews.3', 'رد شده') };

export default function AdminReviews() {
  const toast = useToast();
  const [f, setF] = useState('pending');
  const { data, error, loading, reload } = useAsync(() => q<R[]>(supabase.from('reviews').select('*, product:products(title_fa)').order('created_at', { ascending: false }).limit(300)), []);
  const rows = (data ?? []).filter((r) => !f || r.status === f);
  const setStatus = async (id: string, status: string) => {
    try { await q(supabase.from('reviews').update({ status }).eq('id', id)); toast.push(tr('aReviews.4', 'ذخیره شد.')); reload(); } catch (e) { toast.push(errorFa((e as Error).message), 'err'); }
  };
  const del = async (id: string) => {
    if (!window.confirm(tr('aReviews.5', 'این نظر حذف شود؟'))) return;
    try { await q(supabase.from('reviews').delete().eq('id', id)); reload(); } catch (e) { toast.push(errorFa((e as Error).message), 'err'); }
  };
  return (
    <Can perm="reviews.manage">
      <PageHead title={tr('aReviews.6', 'نظرات')}><select className="select" value={f} onChange={(e) => setF(e.target.value)} aria-label={tr('aReviews.7', 'وضعیت')}><option value="">{tr('aReviews.8', 'همه')}</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></PageHead>
      {loading ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : rows.length ? rows.map((r) => (
        <article key={r.id} className="panel">
          <p><strong>{r.product?.title_fa}</strong> <span className="stars">{'★'.repeat(r.rating)}</span> <span className={`pill pill--${r.status}`}>{LABEL[r.status]}</span></p>
          {r.title ? <h3 className="h4">{r.title}</h3> : null}{r.body ? <p>{r.body}</p> : null}
          <small className="muted">{r.author_name} · {dateFa(r.created_at)}</small>
          <div className="actions">
            {r.status !== 'approved' ? <button className="btn btn--sm" onClick={() => void setStatus(r.id, 'approved')}>{tr('aReviews.9', 'تأیید')}</button> : null}
            {r.status !== 'rejected' ? <button className="btn btn--ghost btn--sm" onClick={() => void setStatus(r.id, 'rejected')}>{tr('aReviews.10', 'رد')}</button> : null}
            <button className="link link--danger" onClick={() => void del(r.id)}>{tr('aReviews.11', 'حذف')}</button>
          </div>
        </article>
      )) : <p className="state">{tr('aReviews.12', 'نظری در این وضعیت نیست.')}</p>}
    </Can>
  );
}
