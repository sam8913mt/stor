import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchProducts, minPrice } from '../lib/api';
import { useDebounced } from '../hooks';
import { lf, tr } from '../i18n';
import { price } from '../lib/format';
import type { Product } from '../types';
import { ProductVisual } from './ProductCard';

/** Search field with live suggestions (image + name + price) after 2 characters. */
export function SearchBox({ onDone }: { onDone: () => void }) {
  const nav = useNavigate();
  const [term, setTerm] = useState('');
  const t = useDebounced(term.trim(), 250);
  const [hits, setHits] = useState<Product[] | null>(null);
  useEffect(() => {
    let live = true;
    if (t.length < 2) { setHits(null); return; }
    searchProducts({ q: t, pageSize: 5 }).then((r) => { if (live) setHits(r.products); }).catch(() => { if (live) setHits([]); });
    return () => { live = false; };
  }, [t]);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!term.trim()) return; nav(`/shop?q=${encodeURIComponent(term.trim())}`); onDone(); };
  return (
    <form className="searchbar wrap" onSubmit={submit} role="search">
      <input autoFocus className="input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={tr('cLayout.10', 'جستجوی محصول، رنگ یا دسته…')} aria-label={tr('cLayout.11', 'جستجو')} autoComplete="off" />
      <button className="btn btn--sm">{tr('cLayout.12', 'جستجو')}</button>
      {hits ? (
        <ul className="suggest" role="listbox">
          {hits.length ? hits.map((p) => (
            <li key={p.id} role="option" aria-selected="false">
              <Link to={`/product/${p.slug}`} onClick={onDone}><span className="suggest__img"><ProductVisual p={p} /></span><span>{lf(p, 'title')}</span><b>{price(minPrice(p))}</b></Link>
            </li>
          )) : <li className="muted suggest__empty">{tr('cLayout.26', 'محصولی پیدا نشد.')}</li>}
        </ul>
      ) : null}
    </form>
  );
}
