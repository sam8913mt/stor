import { LANG, lf, tr, LOC } from '../i18n';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activeVariants, fetchProductBySlug, q, searchProducts, variantPrice } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAsync, useTitle } from '../hooks';
import { errorFa, dateFa, price } from '../lib/format';
import { useAuth, useCart, useToast, useWishlist } from '../context';
import { ProductVisual, ProductGrid } from '../components/ProductCard';
import { Crumbs, Empty, ErrorBox, Loading } from '../components/ui';
import { IconHeart, IconMinus, IconPlus } from '../components/Icons';
import type { Review } from '../types';

const Stars = ({ n }: { n: number }) => <span className="stars" role="img" aria-label={tr('pProduct.1', '{0} از ۵', [n])}>{'★'.repeat(n)}<span>{'★'.repeat(5 - n)}</span></span>;

export default function Product() {
  const { slug } = useParams();
  const { data, error, loading, reload } = useAsync(async () => {
    const prod = await fetchProductBySlug(slug ?? '');
    const related = prod ? (await searchProducts({ cat: prod.category?.slug, pageSize: 5 })).products.filter((x) => x.id !== prod.id).slice(0, 4) : [];
    return { prod, related };
  }, [slug]);
  const p = data?.prod;
  const vs = useMemo(() => (p ? activeVariants(p) : []), [p]);
  const colors = useMemo(() => [...new Map(vs.map((v) => [v.color_name, v.color_hex] as [string, string])).entries()], [vs]);
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [view, setView] = useState(0);
  const cart = useCart();
  const wish = useWishlist();
  const toast = useToast();
  useTitle(p ? lf(p, 'title') : tr('pProduct.2', 'محصول'));

  useEffect(() => {
    if (!p) return;
    const firstIn = vs.find((v) => v.stock > 0) ?? vs[0];
    setColor(firstIn?.color_name ?? ''); setSize(''); setQty(1); setView(0);
  }, [p?.id]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!p) return <div className="wrap"><Empty title={tr('pProduct.3', 'محصول پیدا نشد')} to="/shop" cta={tr('pProduct.4', 'بازگشت به فروشگاه')} /></div>;

  const sizesForColor = vs.filter((v) => v.color_name === color);
  const variant = sizesForColor.find((v) => v.size === size) ?? (sizesForColor.length === 1 ? sizesForColor[0] : undefined);
  const shown = variant ? variantPrice(p, variant) : Math.min(...(vs.length ? vs.map((v) => variantPrice(p, v)) : [p.base_price]));
  const liked = wish.has(p.id);
  const views = p.images?.length ? p.images.map((_, i) => i) : [0, 1, 2, 3];
  const related = data?.related ?? [];

  const add = () => {
    if (!variant) { toast.push(tr('pProduct.5', 'ابتدا سایز را انتخاب کنید.'), 'err'); return; }
    if (variant.stock < qty) { toast.push(tr('pProduct.6', 'موجودی کافی نیست.'), 'err'); return; }
    cart.add({ variantId: variant.id, productId: p.id, slug: p.slug, title: lf(p, 'title'), tone: p.tone, silhouette: p.silhouette, color: variant.color_name, size: variant.size, price: variantPrice(p, variant), qty, sku: variant.sku });
    toast.push(tr('pProduct.7', 'به سبد خرید اضافه شد.'));
  };

  return (
    <div className="wrap pdp">
      <Crumbs items={[{ to: '/', label: tr('pProduct.8', 'خانه') }, { to: '/shop', label: tr('pProduct.9', 'فروشگاه') }, ...(p.category ? [{ to: `/shop?cat=${p.category.slug}`, label: lf(p.category, 'name') }] : []), { label: lf(p, 'title') }]} />
      <div className="pdp__grid">
        <div className="pdp__gallery">
          <div className="pdp__main"><ProductVisual p={p} view={view} label /></div>
          <div className="pdp__thumbs">
            {views.map((i) => <button key={i} className={i === view ? 'is-on' : ''} onClick={() => setView(i)} aria-label={tr('pProduct.10', 'نمای {0}', [(i + 1).toLocaleString(LOC)])}><ProductVisual p={p} view={i} /></button>)}
          </div>
        </div>
        <div className="pdp__info">
          {LANG === 'fa' && p.title_en ? <p className="muted">{p.title_en}</p> : null}
          <h1 className="h1">{lf(p, 'title')}</h1>
          <p className="pdp__price">
            {p.compare_at_price && p.compare_at_price > shown ? <s>{price(p.compare_at_price)}</s> : null}
            {price(shown)}
          </p>

          {colors.length ? (
            <div className="pdp__opt">
              <p>{tr('pProduct.11', 'رنگ:')} <strong>{color}</strong></p>
              <div className="swatches">
                {colors.map(([n, h]) => <button key={n} className={`swatch swatch--lg${n === color ? ' is-on' : ''}`} style={{ background: h }} title={n} aria-label={n} aria-pressed={n === color} onClick={() => { setColor(n); setSize(''); }} />)}
              </div>
            </div>
          ) : null}

          <div className="pdp__opt">
            <p>{tr('pProduct.12', 'سایز')}{size ? <>: <strong>{size}</strong></> : null}</p>
            <div className="sizes">
              {sizesForColor.map((v) => (
                <button key={v.id} className={`opt opt--sq${v.size === size ? ' is-on' : ''}`} disabled={v.stock === 0} aria-pressed={v.size === size} onClick={() => setSize(v.size)}>{v.size}</button>
              ))}
            </div>
            {variant && variant.stock > 0 && variant.stock <= 3 ? <p className="note">{tr('pProduct.13', 'فقط')} {variant.stock.toLocaleString(LOC)} {tr('pProduct.14', 'عدد باقی مانده')}</p> : null}
            {!vs.length || vs.every((v) => v.stock === 0) ? <p className="note">{tr('pProduct.15', 'این محصول فعلاً ناموجود است.')}</p> : null}
          </div>

          <div className="pdp__buy">
            <div className="qty" role="group" aria-label={tr('pProduct.16', 'تعداد')}>
              <button onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label={tr('pProduct.17', 'کم کردن')}><IconMinus /></button>
              <span>{qty.toLocaleString(LOC)}</span>
              <button onClick={() => setQty((n) => Math.min(10, n + 1))} aria-label={tr('pProduct.18', 'زیاد کردن')}><IconPlus /></button>
            </div>
            <button className="btn btn--grow" onClick={add} disabled={!vs.length || vs.every((v) => v.stock === 0)}>{tr('pProduct.19', 'افزودن به سبد خرید')}</button>
            <button className={`btn btn--ghost btn--icon${liked ? ' is-on' : ''}`} onClick={() => void wish.toggle(p.id)} aria-pressed={liked} aria-label={tr('pProduct.20', 'علاقه‌مندی')}><IconHeart /></button>
          </div>

          <div className="acc">
            {lf(p, 'description') ? <details open><summary>{tr('pProduct.21', 'توضیحات')}</summary><p>{lf(p, 'description')}</p></details> : null}
            {lf(p, 'material') ? <details><summary>{tr('pProduct.22', 'جنس')}</summary><p>{lf(p, 'material')}</p></details> : null}
            {lf(p, 'care') ? <details><summary>{tr('pProduct.23', 'نگهداری')}</summary><p>{lf(p, 'care')}</p></details> : null}
            <details><summary>{tr('pProduct.24', 'ارسال و بازگشت')}</summary><p>{tr('pProduct.25', 'جزئیات در')} <Link to="/p/shipping-returns" className="link">{tr('pProduct.26', 'صفحه راهنما')}</Link> {tr('pProduct.27', 'آمده است.')}</p></details>
          </div>
        </div>
      </div>

      <Reviews productId={p.id} />
      {related.length ? <section className="sec"><div className="sec__head"><h2 className="h2">{tr('pProduct.28', 'محصولات مرتبط')}</h2></div><ProductGrid items={related} /></section> : null}
    </div>
  );
}

function Reviews({ productId }: { productId: string }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const list = useAsync(() => q<Review[]>(supabase.from('reviews').select('*').eq('product_id', productId).eq('status', 'approved').order('created_at', { ascending: false })), [productId]);
  const mine = useAsync(async () => {
    if (!user) return { bought: false, review: null as Review | null };
    const [o, r] = await Promise.all([
      q<{ id: string }[]>(supabase.from('order_items').select('id').eq('product_id', productId).limit(1)),
      q<Review[]>(supabase.from('reviews').select('*').eq('product_id', productId).eq('user_id', user.id)),
    ]);
    return { bought: o.length > 0, review: r[0] ?? null };
  }, [productId, user?.id]);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const rs = list.data ?? [];
  const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await q(supabase.from('reviews').insert({ product_id: productId, user_id: user.id, author_name: profile?.full_name || tr('pProduct.29', 'مشتری'), rating, title: title.trim() || null, body: body.trim() || null }));
      toast.push(tr('pProduct.30', 'نظر شما پس از تأیید منتشر می‌شود.')); mine.reload();
    } catch (err) { toast.push(errorFa((err as Error).message), 'err'); } finally { setBusy(false); }
  };

  return (
    <section className="sec reviews">
      <div className="sec__head"><h2 className="h2">{tr('pProduct.31', 'نظرات')}</h2>{rs.length ? <span className="muted"><Stars n={Math.round(avg)} /> {avg.toLocaleString(LOC, { maximumFractionDigits: 1 })} {tr('pProduct.32', 'از')} {rs.length.toLocaleString(LOC)} {tr('pProduct.33', 'نظر')}</span> : null}</div>
      {rs.length ? rs.map((r) => (
        <article key={r.id} className="review">
          <Stars n={r.rating} />
          {r.title ? <h3 className="h4">{r.title}</h3> : null}
          {r.body ? <p>{r.body}</p> : null}
          <small className="muted">{r.author_name} · {dateFa(r.created_at)}</small>
        </article>
      )) : <p className="muted">{tr('pProduct.34', 'هنوز نظری ثبت نشده است.')}</p>}

      {!user ? <p><Link className="link" to="/login">{tr('pProduct.35', 'وارد شوید')}</Link> {tr('pProduct.36', 'تا پس از خرید نظر بدهید.')}</p>
        : mine.data?.review ? <p className="muted">{tr('pProduct.37', 'نظر شما ثبت شده است (')}{mine.data.review.status === 'pending' ? tr('pProduct.38', 'در انتظار تأیید') : mine.data.review.status === 'approved' ? tr('pProduct.39', 'منتشر شده') : tr('pProduct.40', 'رد شده')}).</p>
        : mine.data?.bought ? (
          <form className="form review__form" onSubmit={submit}>
            <h3 className="h4">{tr('pProduct.41', 'نظر خود را بنویسید')}</h3>
            <div className="rate" role="radiogroup" aria-label={tr('pProduct.42', 'امتیاز')}>
              {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={rating === n} className={n <= rating ? 'is-on' : ''} onClick={() => setRating(n)} aria-label={tr('pProduct.43', '{0} ستاره', [n])}>★</button>)}
            </div>
            <input className="input" placeholder={tr('pProduct.44', 'عنوان (اختیاری)')} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="textarea" placeholder={tr('pProduct.45', 'تجربه‌ی شما از جنس، سایز و کیفیت…')} maxLength={2000} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            <button className="btn btn--sm" disabled={busy}>{busy ? tr('pProduct.46', 'در حال ارسال…') : tr('pProduct.47', 'ارسال نظر')}</button>
          </form>
        ) : <p className="muted">{tr('pProduct.48', 'فقط خریداران این محصول می‌توانند نظر بدهند.')}</p>}
    </section>
  );
}
