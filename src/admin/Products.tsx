import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { imageUrl, invalidateCatalog, q, qPage, safeTerm } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAsync, useDebounced } from '../hooks';
import { LOC, tr } from '../i18n';
import { useToast } from '../context';
import { errorFa, price, SIL_LABEL, SILHOUETTES, slugify, TONE_LABEL, TONES } from '../lib/format';
import { ErrorBox, Loading, Pager } from '../components/ui';
import { Can, PageHead } from './ui';
import type { Category, Collection, Product, ProductImage, Variant } from '../types';

type Row = Product & { variants?: Variant[] };

const PER = 25;
export function ProductsList() {
  const [termIn, setTermIn] = useState('');
  const term = useDebounced(termIn);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [term, status]);
  const { data, error, loading, reload } = useAsync(() => {
    let qb = supabase.from('products').select('*, category:categories(name_fa), variants:product_variants(id,stock,is_active)', { count: 'exact' });
    if (status) qb = qb.eq('status', status);
    const t = safeTerm(term);
    if (t) qb = qb.or(`title_fa.ilike.*${t}*,title_en.ilike.*${t}*,slug.ilike.*${t}*`);
    return qPage<Row>(qb.order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1));
  }, [term, status, page]);
  const L = { draft: tr('aProducts.1', 'پیش‌نویس'), active: tr('aProducts.2', 'فعال'), archived: tr('aProducts.3', 'بایگانی') };
  return (
    <Can perm="products.manage">
      <PageHead title={tr('aProducts.4', 'محصولات و موجودی')}>
        <input className="input" placeholder={tr('aProducts.5', 'جستجو')} value={termIn} onChange={(e) => setTermIn(e.target.value)} aria-label={tr('aProducts.6', 'جستجو')} />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={tr('aProducts.7', 'وضعیت')}><option value="">{tr('aProducts.8', 'همه')}</option>{Object.entries(L).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <Link to="/admin/products/new" className="btn btn--sm">{tr('aProducts.9', 'محصول جدید')}</Link>
      </PageHead>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : (
        <>
          <div className="tablewrap"><table className="table">
            <thead><tr><th>{tr('aProducts.10', 'محصول')}</th><th>{tr('aProducts.11', 'دسته')}</th><th>{tr('aProducts.12', 'قیمت پایه')}</th><th>{tr('aProducts.13', 'موجودی')}</th><th>{tr('aProducts.14', 'وضعیت')}</th><th /></tr></thead>
            <tbody>
              {data?.rows.map((p) => {
                const stock = (p.variants ?? []).filter((v) => v.is_active).reduce((s, v) => s + v.stock, 0);
                return <tr key={p.id}><td>{p.title_fa}<br /><small className="muted" dir="ltr">{p.slug}</small></td><td>{p.category?.name_fa ?? '—'}</td><td>{price(p.base_price)}</td>
                  <td className={stock === 0 ? 'bad' : ''}>{stock.toLocaleString(LOC)}</td><td><span className={`pill pill--${p.status}`}>{L[p.status]}</span></td>
                  <td className="actions"><Link className="link" to={`/admin/products/${p.id}`}>{tr('aProducts.15', 'ویرایش')}</Link></td></tr>;
              })}
              {!data?.rows.length ? <tr><td colSpan={6} className="muted">{tr('aProducts.16', 'محصولی پیدا نشد.')}</td></tr> : null}
            </tbody>
          </table></div>
          <Pager page={page} total={data?.total ?? 0} size={PER} onPage={setPage} />
        </>
      )}
    </Can>
  );
}

const blank = (): Partial<Product> => ({ title_fa: '', title_en: '', slug: '', description_fa: '', material_fa: '', care_fa: '', category_id: null, base_price: 0, compare_at_price: null, status: 'draft', is_featured: false, is_new: false, tone: 'sand', silhouette: 'top' });
type VRow = Partial<Variant> & { key: string; _del?: boolean };
const newVariant = (): VRow => ({ key: crypto.randomUUID(), sku: '', color_name: '', color_hex: '#CCCCCC', size: '', price_override: null, stock: 0, is_active: true });

export function ProductEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const toast = useToast();
  const meta = useAsync(async () => {
    const [cats, cols] = await Promise.all([q<Category[]>(supabase.from('categories').select('*').order('sort_order')), q<Collection[]>(supabase.from('collections').select('*').order('sort_order'))]);
    return { cats, cols };
  }, []);
  const [p, setP] = useState<Partial<Product>>(blank());
  const [vars, setVars] = useState<VRow[]>([]);
  const [colIds, setColIds] = useState<string[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useAsync(async () => {
    if (isNew) return null;
    const [prod, v, c, im] = await Promise.all([
      q<Product>(supabase.from('products').select('*').eq('id', id as string).single()),
      q<Variant[]>(supabase.from('product_variants').select('*').eq('product_id', id as string).order('sku')),
      q<{ collection_id: string }[]>(supabase.from('collection_products').select('collection_id').eq('product_id', id as string)),
      q<ProductImage[]>(supabase.from('product_images').select('*').eq('product_id', id as string).order('sort_order')),
    ]);
    return { prod, v, c, im };
  }, [id]);

  useEffect(() => {
    if (isNew) { setP(blank()); setVars([newVariant()]); setColIds([]); setImages([]); return; }
    if (load.data) { setP(load.data.prod); setVars(load.data.v.map((v) => ({ ...v, key: v.id }))); setColIds(load.data.c.map((x) => x.collection_id)); setImages(load.data.im); }
  }, [load.data, isNew]);

  const set = <K extends keyof Product>(k: K, v: Product[K] | null) => setP((x) => ({ ...x, [k]: v }));
  const setV = (key: string, patch: Partial<VRow>) => setVars((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const live = vars.filter((v) => !v._del);
    const skus = live.map((v) => (v.sku ?? '').trim().toUpperCase());
    if (new Set(skus).size !== skus.length) { toast.push(tr('aProducts.17', 'SKU تنوع‌ها باید یکتا باشد.'), 'err'); return; }
    if (live.some((v) => !v.sku?.trim() || !v.color_name?.trim() || !v.size?.trim())) { toast.push(tr('aProducts.18', 'SKU، رنگ و سایز همه‌ی تنوع‌ها را وارد کنید.'), 'err'); return; }
    setBusy(true);
    try {
      const body = {
        title_fa: p.title_fa?.trim(), title_en: p.title_en?.trim() ?? '', slug: (p.slug || slugify(p.title_en ?? '')).trim(),
        description_fa: p.description_fa || null, material_fa: p.material_fa || null, care_fa: p.care_fa || null,
        description_en: p.description_en || null, material_en: p.material_en || null, care_en: p.care_en || null,
        category_id: p.category_id || null, base_price: Number(p.base_price) || 0,
        compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
        status: p.status, is_featured: !!p.is_featured, is_new: !!p.is_new, tone: p.tone, silhouette: p.silhouette,
      };
      if (!body.slug) throw new Error(tr('aProducts.19', 'نشانی (slug) انگلیسی لازم است.'));
      let pid = id as string;
      if (isNew) pid = (await q<{ id: string }>(supabase.from('products').insert(body).select('id').single())).id;
      else await q(supabase.from('products').update(body).eq('id', pid));

      const del = vars.filter((v) => v._del && v.id).map((v) => v.id as string);
      if (del.length) await q(supabase.from('product_variants').delete().in('id', del));
      for (const v of live) {
        const row = { product_id: pid, sku: v.sku!.trim().toUpperCase(), color_name: v.color_name!.trim(), color_hex: v.color_hex || '#CCCCCC', size: v.size!.trim(), price_override: v.price_override ? Number(v.price_override) : null, stock: Math.max(0, Math.floor(Number(v.stock) || 0)), is_active: v.is_active !== false };
        if (v.id) await q(supabase.from('product_variants').update(row).eq('id', v.id));
        else await q(supabase.from('product_variants').insert(row));
      }
      await q(supabase.from('collection_products').delete().eq('product_id', pid));
      if (colIds.length) await q(supabase.from('collection_products').insert(colIds.map((collection_id) => ({ collection_id, product_id: pid }))));
      invalidateCatalog();
      toast.push(tr('aProducts.20', 'محصول ذخیره شد.'));
      if (isNew) nav(`/admin/products/${pid}`, { replace: true }); else load.reload();
    } catch (err) { toast.push(errorFa((err as Error).message), 'err'); } finally { setBusy(false); }
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); e.target.value = '';
    if (!files.length || isNew) return;
    for (const f of files) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(f.type) || f.size > 3 * 1024 * 1024) { toast.push(tr('aProducts.21', '«{0}» نامعتبر است (فقط JPG/PNG/WebP/AVIF تا ۳ مگابایت).', [f.name]), 'err'); continue; }
      const path = `${id}/${crypto.randomUUID()}.${f.type.split('/')[1]}`;
      try {
        const up = await supabase.storage.from('product-images').upload(path, f, { contentType: f.type, upsert: false });
        if (up.error) throw up.error;
        await q(supabase.from('product_images').insert({ product_id: id, path, alt: p.title_fa, sort_order: images.length }));
      } catch (err) { toast.push(errorFa((err as Error).message), 'err'); }
    }
    invalidateCatalog(); load.reload();
  };
  const rmImage = async (im: ProductImage) => {
    if (!window.confirm(tr('aProducts.22', 'این تصویر حذف شود؟'))) return;
    try { await supabase.storage.from('product-images').remove([im.path]); await q(supabase.from('product_images').delete().eq('id', im.id)); invalidateCatalog(); load.reload(); }
    catch (err) { toast.push(errorFa((err as Error).message), 'err'); }
  };
  const remove = async () => {
    if (!window.confirm(tr('aProducts.23', 'محصول و تمام تنوع‌هایش حذف شود؟ (برای حفظ سوابق بهتر است بایگانی کنید)'))) return;
    try { await q(supabase.from('products').delete().eq('id', id as string)); invalidateCatalog(); nav('/admin/products'); } catch (err) { toast.push(errorFa((err as Error).message), 'err'); }
  };

  if (!isNew && load.loading) return <Loading />;
  if (load.error) return <ErrorBox error={load.error} retry={load.reload} />;

  return (
    <Can perm="products.manage">
      <PageHead title={isNew ? tr('aProducts.24', 'محصول جدید') : (p.title_fa || tr('aProducts.25', 'ویرایش محصول'))}><Link to="/admin/products" className="link">{tr('aProducts.26', 'بازگشت به فهرست')}</Link></PageHead>
      <form className="form pedit" onSubmit={save}>
        <div className="panel form">
          <div className="form__row">
            <label>{tr('aProducts.27', 'عنوان فارسی')}<input className="input" required value={p.title_fa ?? ''} onChange={(e) => set('title_fa', e.target.value)} /></label>
            <label>{tr('aProducts.28', 'عنوان انگلیسی')}<input className="input" dir="ltr" value={p.title_en ?? ''} onChange={(e) => set('title_en', e.target.value)} /></label>
          </div>
          <div className="form__row">
            <label>{tr('aProducts.29', 'نشانی (slug)')}<input className="input" dir="ltr" value={p.slug ?? ''} placeholder={slugify(p.title_en ?? '')} onChange={(e) => set('slug', e.target.value.toLowerCase())} pattern="[a-z0-9\-]*" /></label>
            <label>{tr('aProducts.30', 'دسته‌بندی')}<select className="select" value={p.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)}><option value="">{tr('aProducts.31', '— بدون دسته —')}</option>{meta.data?.cats.map((c) => <option key={c.id} value={c.id}>{c.name_fa}</option>)}</select></label>
          </div>
          <div className="form__row">
            <label>{tr('aProducts.32', 'قیمت پایه (تومان)')}<input className="input" type="number" min={0} required dir="ltr" value={p.base_price ?? 0} onChange={(e) => set('base_price', Number(e.target.value))} /></label>
            <label>{tr('aProducts.33', 'قیمت قبل از تخفیف')}<input className="input" type="number" min={0} dir="ltr" value={p.compare_at_price ?? ''} onChange={(e) => set('compare_at_price', e.target.value ? Number(e.target.value) : null)} /></label>
          </div>
          <label>{tr('aProducts.34', 'توضیحات')}<textarea className="textarea" rows={3} value={p.description_fa ?? ''} onChange={(e) => set('description_fa', e.target.value)} /></label>
          <div className="form__row">
            <label>{tr('aProducts.35', 'توضیحات انگلیسی')}<textarea className="textarea" dir="ltr" rows={2} value={p.description_en ?? ''} onChange={(e) => set('description_en', e.target.value)} /></label>
            <label>{tr('aProducts.36', 'جنس / نگهداری (انگلیسی)')}<input className="input" dir="ltr" placeholder="Material" value={p.material_en ?? ''} onChange={(e) => set('material_en', e.target.value)} /><input className="input" dir="ltr" placeholder="Care" value={p.care_en ?? ''} onChange={(e) => set('care_en', e.target.value)} /></label>
          </div>
          <div className="form__row">
            <label>{tr('aProducts.37', 'جنس')}<input className="input" value={p.material_fa ?? ''} onChange={(e) => set('material_fa', e.target.value)} /></label>
            <label>{tr('aProducts.38', 'نگهداری')}<input className="input" value={p.care_fa ?? ''} onChange={(e) => set('care_fa', e.target.value)} /></label>
          </div>
          <div className="form__row">
            <label>{tr('aProducts.39', 'وضعیت')}<select className="select" value={p.status} onChange={(e) => set('status', e.target.value as Product['status'])}><option value="draft">{tr('aProducts.40', 'پیش‌نویس (مخفی)')}</option><option value="active">{tr('aProducts.41', 'فعال')}</option><option value="archived">{tr('aProducts.42', 'بایگانی')}</option></select></label>
            <label>{tr('aProducts.43', 'رنگ جایگزین تصویر')}<select className="select" value={p.tone} onChange={(e) => set('tone', e.target.value as Product['tone'])}>{TONES.map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}</select></label>
            <label>{tr('aProducts.44', 'طرح جایگزین تصویر')}<select className="select" value={p.silhouette} onChange={(e) => set('silhouette', e.target.value as Product['silhouette'])}>{SILHOUETTES.map((t) => <option key={t} value={t}>{SIL_LABEL[t]}</option>)}</select></label>
          </div>
          <div className="form__row">
            <label className="chk"><input type="checkbox" checked={!!p.is_new} onChange={(e) => set('is_new', e.target.checked)} /> {tr('aProducts.45', 'برچسب «جدید»')}</label>
            <label className="chk"><input type="checkbox" checked={!!p.is_featured} onChange={(e) => set('is_featured', e.target.checked)} /> {tr('aProducts.46', 'منتخب (صفحه اصلی)')}</label>
          </div>
          {meta.data?.cols.length ? <fieldset><legend>{tr('aProducts.47', 'مجموعه‌ها')}</legend>{meta.data.cols.map((c) => <label key={c.id} className="chk"><input type="checkbox" checked={colIds.includes(c.id)} onChange={(e) => setColIds(e.target.checked ? [...colIds, c.id] : colIds.filter((x) => x !== c.id))} /> {c.title_fa}</label>)}</fieldset> : null}
        </div>

        <div className="panel">
          <div className="ahead"><h2 className="h4">{tr('aProducts.48', 'تنوع‌ها و موجودی')}</h2><button type="button" className="btn btn--ghost btn--sm" onClick={() => setVars((v) => [...v, newVariant()])}>{tr('aProducts.49', 'افزودن تنوع')}</button></div>
          <div className="tablewrap"><table className="table table--vars">
            <thead><tr><th>SKU</th><th>{tr('aProducts.50', 'رنگ')}</th><th>{tr('aProducts.51', 'کد رنگ')}</th><th>{tr('aProducts.52', 'سایز')}</th><th>{tr('aProducts.53', 'قیمت ویژه')}</th><th>{tr('aProducts.54', 'موجودی')}</th><th>{tr('aProducts.55', 'فعال')}</th><th /></tr></thead>
            <tbody>
              {vars.filter((v) => !v._del).map((v) => (
                <tr key={v.key}>
                  <td><input className="input" dir="ltr" value={v.sku ?? ''} onChange={(e) => setV(v.key, { sku: e.target.value })} aria-label="SKU" /></td>
                  <td><input className="input" value={v.color_name ?? ''} onChange={(e) => setV(v.key, { color_name: e.target.value })} aria-label={tr('aProducts.56', 'رنگ')} /></td>
                  <td><input type="color" value={v.color_hex ?? '#cccccc'} onChange={(e) => setV(v.key, { color_hex: e.target.value })} aria-label={tr('aProducts.57', 'کد رنگ')} /></td>
                  <td><input className="input" value={v.size ?? ''} onChange={(e) => setV(v.key, { size: e.target.value })} aria-label={tr('aProducts.58', 'سایز')} /></td>
                  <td><input className="input" type="number" min={0} dir="ltr" value={v.price_override ?? ''} onChange={(e) => setV(v.key, { price_override: e.target.value ? Number(e.target.value) : null })} aria-label={tr('aProducts.59', 'قیمت ویژه')} /></td>
                  <td><input className="input" type="number" min={0} dir="ltr" value={v.stock ?? 0} onChange={(e) => setV(v.key, { stock: Number(e.target.value) })} aria-label={tr('aProducts.60', 'موجودی')} /></td>
                  <td><input type="checkbox" checked={v.is_active !== false} onChange={(e) => setV(v.key, { is_active: e.target.checked })} aria-label={tr('aProducts.61', 'فعال')} /></td>
                  <td><button type="button" className="link link--danger" onClick={() => setV(v.key, { _del: true })}>{tr('aProducts.62', 'حذف')}</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>

        <div className="panel">
          <h2 className="h4">{tr('aProducts.63', 'تصاویر')}</h2>
          {isNew ? <p className="muted">{tr('aProducts.64', 'ابتدا محصول را ذخیره کنید، سپس تصویر اضافه کنید. تا آن زمان طرح جایگزین نمایش داده می‌شود.')}</p> : (
            <>
              <div className="imgs">{images.map((im) => <figure key={im.id}><img src={imageUrl(im.path)} alt={im.alt ?? ''} /><button type="button" className="link link--danger" onClick={() => void rmImage(im)}>{tr('aProducts.65', 'حذف')}</button></figure>)}</div>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={upload} aria-label={tr('aProducts.66', 'آپلود تصویر')} />
              <p className="muted small">{tr('aProducts.67', 'JPG/PNG/WebP/AVIF، حداکثر ۳ مگابایت. تصویر اول در کارت محصول نمایش داده می‌شود.')}</p>
            </>
          )}
        </div>

        <div className="form__actions">
          <button className="btn" disabled={busy}>{busy ? tr('aProducts.68', 'در حال ذخیره…') : tr('aProducts.69', 'ذخیره محصول')}</button>
          {!isNew ? <button type="button" className="link link--danger" onClick={() => void remove()}>{tr('aProducts.70', 'حذف محصول')}</button> : null}
        </div>
      </form>
    </Can>
  );
}
