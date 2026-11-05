import { Link } from 'react-router-dom';
import { q } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAsync, useTitle } from '../hooks';
import { lf, tr } from '../i18n';
import { Placeholder } from '../components/Placeholder';
import { Crumbs, Empty, ErrorBox, Loading } from '../components/ui';
import type { Collection, Silhouette } from '../types';

type Row = Collection & { collection_products: { product: { silhouette: Silhouette } | null }[] };

export default function Collections() {
  useTitle(tr('pCollections.1', 'مجموعه‌ها'));
  const { data, error, loading, reload } = useAsync(() => q<Row[]>(supabase.from('collections').select('*, collection_products(product:products(silhouette))').eq('is_active', true).order('sort_order')), []);
  return (
    <div className="wrap shop">
      <Crumbs items={[{ to: '/', label: tr('pCollections.2', 'خانه') }, { label: tr('pCollections.3', 'مجموعه‌ها') }]} />
      <h1 className="h1">{tr('pCollections.4', 'مجموعه‌ها')}</h1>
      {loading ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : !data?.length ? <Empty title={tr('pCollections.5', 'هنوز مجموعه‌ای ثبت نشده است')} /> : (
        <div className="colgrid">
          {data.map((c) => (
            <Link key={c.id} to={`/collections/${c.slug}`} className="colcard">
              <Placeholder tone={c.tone} silhouette={c.collection_products[0]?.product?.silhouette ?? 'coat'} />
              <div><h2 className="h3">{lf(c, 'title')}</h2><p className="muted">{lf(c, 'subtitle')}</p></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
