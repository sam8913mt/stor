import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { loadFacets, loadMeta, PAGE_SIZE, searchProducts } from '../lib/api';
import { useAsync, useTitle } from '../hooks';
import { LOC, lf, tr } from '../i18n';
import { ProductGrid } from '../components/ProductCard';
import { Crumbs, Drawer, Empty, ErrorBox, Pager } from '../components/ui';
import { SkeletonGrid } from '../components/Extras';
import { IconClose, IconFilter } from '../components/Icons';

const SORTS: Record<string, string> = { new: tr('pShop.1', 'جدیدترین'), 'price-asc': tr('pShop.2', 'ارزان‌ترین'), 'price-desc': tr('pShop.3', 'گران‌ترین') };
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const sizeRank = (s: string) => (SIZE_ORDER.indexOf(s) + 1) || 99;

/** Shop + collection pages. Filters live in the URL; results are filtered, sorted and paginated on the server. */
export default function Shop({ pinned }: { pinned?: boolean }) {
  const params = useParams();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(false);
  const meta = useAsync(() => loadMeta(), []);
  const facets = useAsync(() => loadFacets(), []);

  const get = (k: string) => sp.get(k) ?? '';
  const list = (k: string) => get(k).split(',').filter(Boolean);
  const set = (k: string, v: string, keepPage = false) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    if (!keepPage) n.delete('page');
    setSp(n, { replace: true });
  };
  const toggleIn = (k: string, v: string) => { const cur = list(k); set(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',')); };

  const colSlug = pinned ? params.slug ?? '' : get('col');
  const col = meta.data?.collections.find((c) => c.slug === colSlug);
  const cat = get('cat');
  const colors = list('color');
  const sizes = list('size');
  const sort = get('sort') || 'new';
  const page = Math.max(1, Number(get('page')) || 1);
  useTitle(col ? lf(col, 'title') : tr('pShop.4', 'فروشگاه'));

  // price inputs are debounced so typing doesn't fire a request per keystroke
  const [minTxt, setMinTxt] = useState(get('min'));
  const [maxTxt, setMaxTxt] = useState(get('max'));
  useEffect(() => {
    const id = setTimeout(() => { if (minTxt !== get('min')) set('min', minTxt); if (maxTxt !== get('max')) set('max', maxTxt); }, 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minTxt, maxTxt]);

  // keep the price inputs in sync when the URL changes from elsewhere (header links, back button)
  useEffect(() => { setMinTxt(get('min')); setMaxTxt(get('max')); }, [sp.get('min'), sp.get('max')]);

  const res = useAsync(() => searchProducts({
    q: get('q'), cat, col: colSlug, colors, sizes, min: Number(get('min')) || 0, max: Number(get('max')) || 0,
    inStock: !!get('stock'), isNew: !!get('new'), sale: !!get('sale'), sort, page,
  }), [sp.toString(), colSlug]);

  const activeCount = [cat, get('q'), get('new'), get('sale'), get('stock'), get('min'), get('max'), colors.length ? 'c' : '', sizes.length ? 's' : ''].filter(Boolean).length;
  const clear = () => { const n = new URLSearchParams(); if (!pinned && colSlug) n.set('col', colSlug); setSp(n, { replace: true }); setMinTxt(''); setMaxTxt(''); };
  const goPage = (p: number) => { set('page', p > 1 ? String(p) : '', true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const total = res.data?.total ?? 0;
  const sortedSizes = [...(facets.data?.sizes ?? [])].sort((a, b) => sizeRank(a) - sizeRank(b));

  const filters = (
    <div className="filters">
      <fieldset><legend>{tr('pShop.5', 'دسته‌بندی')}</legend>
        <button className={`opt${!cat ? ' is-on' : ''}`} aria-pressed={!cat} onClick={() => set('cat', '')}>{tr('pShop.6', 'همه')}</button>
        {meta.data?.categories.filter((c) => c.is_active).map((c) => <button key={c.id} className={`opt${cat === c.slug ? ' is-on' : ''}`} aria-pressed={cat === c.slug} onClick={() => set('cat', c.slug)}>{lf(c, 'name')}</button>)}
      </fieldset>
      {!pinned && meta.data?.collections.length ? (
        <fieldset><legend>{tr('pShop.7', 'مجموعه')}</legend>
          <button className={`opt${!colSlug ? ' is-on' : ''}`} aria-pressed={!colSlug} onClick={() => set('col', '')}>{tr('pShop.8', 'همه')}</button>
          {meta.data.collections.filter((c) => c.is_active).map((c) => <button key={c.id} className={`opt${colSlug === c.slug ? ' is-on' : ''}`} aria-pressed={colSlug === c.slug} onClick={() => set('col', c.slug)}>{lf(c, 'title')}</button>)}
        </fieldset>
      ) : null}
      {facets.data?.colors.length ? (
        <fieldset><legend>{tr('pShop.9', 'رنگ')}</legend>
          <div className="swatches">
            {facets.data.colors.map((c) => <button key={c.name} className={`swatch${colors.includes(c.name) ? ' is-on' : ''}`} style={{ background: c.hex }} title={c.name} aria-label={c.name} aria-pressed={colors.includes(c.name)} onClick={() => toggleIn('color', c.name)} />)}
          </div>
        </fieldset>
      ) : null}
      {sortedSizes.length ? (
        <fieldset><legend>{tr('pShop.10', 'سایز')}</legend>
          {sortedSizes.map((z) => <button key={z} className={`opt opt--sq${sizes.includes(z) ? ' is-on' : ''}`} aria-pressed={sizes.includes(z)} onClick={() => toggleIn('size', z)}>{z}</button>)}
        </fieldset>
      ) : null}
      <fieldset><legend>{tr('pShop.11', 'قیمت (تومان)')}</legend>
        <div className="range">
          <input className="input" inputMode="numeric" dir="ltr" placeholder={tr('pShop.12', 'از')} value={minTxt} onChange={(e) => setMinTxt(e.target.value.replace(/\D/g, ''))} aria-label={tr('pShop.13', 'حداقل قیمت')} />
          <input className="input" inputMode="numeric" dir="ltr" placeholder={tr('pShop.14', 'تا')} value={maxTxt} onChange={(e) => setMaxTxt(e.target.value.replace(/\D/g, ''))} aria-label={tr('pShop.15', 'حداکثر قیمت')} />
        </div>
      </fieldset>
      <label className="chk"><input type="checkbox" checked={!!get('stock')} onChange={(e) => set('stock', e.target.checked ? '1' : '')} /> {tr('pShop.16', 'فقط موجود')}</label>
      <label className="chk"><input type="checkbox" checked={!!get('new')} onChange={(e) => set('new', e.target.checked ? '1' : '')} /> {tr('pShop.17', 'فقط جدید')}</label>
      <label className="chk"><input type="checkbox" checked={!!get('sale')} onChange={(e) => set('sale', e.target.checked ? '1' : '')} /> {tr('pShop.18', 'تخفیف‌دار')}</label>
      {activeCount ? <button className="link" onClick={clear}>{tr('pShop.19', 'پاک کردن فیلترها')}</button> : null}
    </div>
  );

  return (
    <div className="wrap shop">
      <Crumbs items={[{ to: '/', label: tr('pShop.20', 'خانه') }, ...(pinned ? [{ to: '/collections', label: tr('pShop.21', 'مجموعه‌ها') }, { label: col ? lf(col, 'title') : '…' }] : [{ label: tr('pShop.22', 'فروشگاه') }])]} />
      <header className="shop__head">
        <h1 className="h1">{col ? lf(col, 'title') : get('q') ? tr('pShop.23', 'نتایج «{0}»', [get('q')]) : tr('pShop.24', 'همه محصولات')}</h1>
        {col && lf(col, 'description') ? <p className="muted shop__desc">{lf(col, 'description')}</p> : null}
      </header>
      <div className="shop__bar">
        <button className="btn btn--ghost btn--sm shop__fbtn" onClick={() => setOpen(true)}><IconFilter /> {tr('pShop.25', 'فیلتر')}{activeCount ? ` (${activeCount.toLocaleString(LOC)})` : ''}</button>
        <span className="muted" role="status">{total.toLocaleString(LOC)} {tr('pShop.26', 'محصول')}</span>
        <label className="sort">{tr('pShop.27', 'مرتب‌سازی')}
          <select className="select" value={sort} onChange={(e) => set('sort', e.target.value)}>
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <div className="shop__layout">
        <aside className="shop__side" aria-label={tr('pShop.28', 'فیلترها')}>{filters}</aside>
        <div>
          {res.loading && !res.data ? <SkeletonGrid /> : res.error ? <ErrorBox error={res.error} retry={res.reload} /> : res.data && res.data.products.length ? (
            <div className={res.loading ? 'is-busy' : ''} aria-busy={res.loading}>
              <ProductGrid items={res.data.products} />
              <Pager page={page} total={total} size={PAGE_SIZE} onPage={goPage} />
            </div>
          ) : <Empty title={tr('pShop.29', 'محصولی پیدا نشد')} text={activeCount ? tr('pShop.30', 'فیلترها را کمتر کنید یا عبارت دیگری جستجو کنید.') : undefined} />}
        </div>
      </div>
      {open ? (
        <Drawer label={tr('pShop.31', 'فیلترها')} wide onClose={() => setOpen(false)}>
          <div className="drawer__top"><strong>{tr('pShop.32', 'فیلترها')}</strong><button className="icon" aria-label={tr('pShop.33', 'بستن')} onClick={() => setOpen(false)}><IconClose /></button></div>
          {filters}
          <button className="btn btn--block" onClick={() => setOpen(false)}>{tr('pShop.34', 'نمایش')} {total.toLocaleString(LOC)} {tr('pShop.35', 'محصول')}</button>
        </Drawer>
      ) : null}
    </div>
  );
}
