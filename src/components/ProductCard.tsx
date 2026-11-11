import { lf, tr } from '../i18n';
import { Link } from 'react-router-dom';
import type { Product } from '../types';
import { colorsOf, imageUrl, minPrice, totalStock } from '../lib/api';
import { price } from '../lib/format';
import { useWishlist } from '../context';
import { Placeholder } from './Placeholder';
import { IconHeart } from './Icons';

export function ProductVisual({ p, view = 0, label }: { p: Product; view?: number; label?: boolean }) {
  const img = p.images?.[view] ?? p.images?.[0];
  if (img) return <div className="ph ph--photo"><img src={imageUrl(img.path)} alt={img.alt ?? lf(p, 'title')} loading="lazy" /></div>;
  return <Placeholder tone={p.tone} silhouette={p.silhouette} view={view} label={label ? p.title_en : undefined} />;
}

export function ProductCard({ p }: { p: Product }) {
  const { has, toggle } = useWishlist();
  const liked = has(p.id);
  const colors = colorsOf(p);
  const sold = totalStock(p) === 0;
  const from = minPrice(p);
  const onSale = p.compare_at_price != null && p.compare_at_price > from;
  return (
    <article className="pcard">
      <Link to={`/product/${p.slug}`} className="pcard__media" aria-label={lf(p, 'title')}>
        <ProductVisual p={p} label />
        {p.is_new && !sold ? <span className="pcard__tag">{tr('cProductCard.1', 'جدید')}</span> : null}
        {sold ? <span className="pcard__tag pcard__tag--muted">{tr('cProductCard.2', 'ناموجود')}</span> : null}
      </Link>
      <button className={`pcard__wish${liked ? ' is-on' : ''}`} onClick={() => void toggle(p.id)}
        aria-pressed={liked} aria-label={liked ? tr('cProductCard.3', 'حذف از علاقه‌مندی‌ها') : tr('cProductCard.4', 'افزودن به علاقه‌مندی‌ها')}>
        <IconHeart />
      </button>
      <div className="pcard__body">
        <Link to={`/product/${p.slug}`} className="pcard__title">{lf(p, 'title')}</Link>
        <p className="pcard__price">
          {onSale ? <s>{price(p.compare_at_price as number)}</s> : null}
          <span>{price(from)}</span>
        </p>
        {colors.length > 1 ? (
          <p className="dots" aria-label={tr('cProductCard.5', '{0} رنگ', [colors.length])}>
            {colors.map((c) => <i key={c.name} style={{ background: c.hex }} title={c.name} />)}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export const ProductGrid = ({ items }: { items: Product[] }) => (
  <div className="pgrid">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
);
