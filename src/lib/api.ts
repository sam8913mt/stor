import { supabase } from './supabase';
import type { Category, Collection, Product, Variant } from '../types';

/** Unwraps a Supabase response, throwing on error so callers can use try/catch or useAsync. */
export async function q<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export const imageUrl = (path: string) => supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;

export const PRODUCT_SELECT =
  '*, category:categories(name_fa,name_en,slug), variants:product_variants(*), images:product_images(*)';

/** Like q() but for list queries that request `{ count: 'exact' }`. */
export async function qPage<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null; count: number | null }>): Promise<{ rows: T[]; total: number }> {
  const { data, error, count } = await p;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as T[], total: count ?? 0 };
}

/** Strips characters that have meaning inside PostgREST `or=(…)` filters. */
export const safeTerm = (s: string) => s.replace(/[,()*%\\:"]/g, ' ').trim();

export interface Meta { categories: Category[]; collections: Collection[] }
let metaCache: { t: number; p: Promise<Meta> } | null = null;
export function invalidateCatalog() { metaCache = null; }

/** Categories + collections (small, cached 60s). Products are always fetched server-side, page by page. */
export function loadMeta(): Promise<Meta> {
  if (metaCache && Date.now() - metaCache.t < 60_000) return metaCache.p;
  const p = (async () => {
    const [categories, collections] = await Promise.all([
      q<Category[]>(supabase.from('categories').select('*').order('sort_order')),
      q<Collection[]>(supabase.from('collections').select('*').order('sort_order')),
    ]);
    return { categories, collections };
  })();
  metaCache = { t: Date.now(), p };
  p.catch(() => { metaCache = null; });
  return p;
}

export interface Filters {
  q?: string; cat?: string; col?: string; colors?: string[]; sizes?: string[]; min?: number; max?: number;
  inStock?: boolean; isNew?: boolean; sale?: boolean; featured?: boolean; sort?: string; page?: number; pageSize?: number;
}
export const PAGE_SIZE = 24;

function sortVariants(p: Product): Product {
  p.variants = (p.variants ?? []).sort((a, b) => a.sku.localeCompare(b.sku));
  p.images = (p.images ?? []).sort((a, b) => a.sort_order - b.sort_order);
  return p;
}

export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const rows = await q<Product[]>(supabase.from('products').select(PRODUCT_SELECT).in('id', ids).eq('status', 'active'));
  const byId = new Map(rows.map((r) => [r.id, sortVariants(r)]));
  return ids.map((i) => byId.get(i)).filter(Boolean) as Product[];
}

/** Server-side filtered, sorted and paginated search (see search_products() in 0005_features.sql). */
export async function searchProducts(f: Filters): Promise<{ products: Product[]; total: number }> {
  const size = f.pageSize ?? PAGE_SIZE;
  const res = await q<{ total: number; ids: string[] }>(supabase.rpc('search_products', {
    p_q: f.q || null, p_cat: f.cat || null, p_col: f.col || null,
    p_colors: f.colors?.length ? f.colors : null, p_sizes: f.sizes?.length ? f.sizes : null,
    p_min: f.min || null, p_max: f.max || null, p_in_stock: !!f.inStock, p_new: !!f.isNew, p_sale: !!f.sale, p_featured: !!f.featured,
    p_sort: f.sort || 'new', p_limit: size, p_offset: ((f.page ?? 1) - 1) * size,
  }));
  return { total: Number(res.total), products: await fetchProductsByIds(res.ids) };
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const rows = await q<Product[]>(supabase.from('products').select(PRODUCT_SELECT).eq('slug', slug).eq('status', 'active').limit(1));
  return rows[0] ? sortVariants(rows[0]) : null;
}

export const loadFacets = () => q<{ colors: { name: string; hex: string }[]; sizes: string[] }>(supabase.rpc('catalog_facets'));

export const variantPrice = (p: Product, v?: Variant | null) => (v?.price_override ?? p.base_price);
export const activeVariants = (p: Product) => (p.variants ?? []).filter((v) => v.is_active);
export const minPrice = (p: Product) => {
  const vs = activeVariants(p);
  return vs.length ? Math.min(...vs.map((v) => variantPrice(p, v))) : p.base_price;
};
export const totalStock = (p: Product) => activeVariants(p).reduce((s, v) => s + v.stock, 0);
export const colorsOf = (p: Product) => {
  const m = new Map<string, string>();
  activeVariants(p).forEach((v) => m.set(v.color_name, v.color_hex));
  return [...m].map(([name, hex]) => ({ name, hex }));
};
