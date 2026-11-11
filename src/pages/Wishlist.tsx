import { fetchProductsByIds } from '../lib/api';
import { useAsync, useTitle } from '../hooks';
import { useWishlist } from '../context';
import { ProductGrid } from '../components/ProductCard';
import { Empty, ErrorBox, Loading } from '../components/ui';
import { tr } from '../i18n';

export default function Wishlist() {
  useTitle(tr('pWishlist.1', 'علاقه‌مندی‌ها'));
  const { ids } = useWishlist();
  const key = [...ids].sort().join(',');
  const { data, error, loading, reload } = useAsync(() => fetchProductsByIds(ids.slice(0, 60)), [key]);
  return (
    <div className="wrap shop">
      <h1 className="h1">{tr('pWishlist.2', 'علاقه‌مندی‌ها')}</h1>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : data?.length ? <ProductGrid items={data} /> : <Empty title={tr('pWishlist.3', 'فهرست علاقه‌مندی‌ها خالی است')} text={tr('pWishlist.4', 'روی قلب کنار هر محصول بزنید تا اینجا ذخیره شود.')} to="/shop" cta={tr('pWishlist.5', 'مشاهده محصولات')} />}
    </div>
  );
}
