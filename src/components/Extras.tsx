import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart, useSettings } from '../context';
import { Drawer } from './ui';
import { IconBag, IconClose } from './Icons';
import { Placeholder } from './Placeholder';
import { LOC, tr } from '../i18n';
import { price } from '../lib/format';

/* ───────── checkout progress ───────── */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const items = [tr('cSteps.1', 'سبد خرید'), tr('cSteps.2', 'نشانی و پرداخت'), tr('cSteps.3', 'تکمیل سفارش')];
  return (
    <ol className="steps" aria-label={tr('cSteps.4', 'مراحل خرید')}>
      {items.map((t, i) => <li key={t} className={i + 1 < current ? 'is-done' : i + 1 === current ? 'is-now' : ''} aria-current={i + 1 === current ? 'step' : undefined}><b>{(i + 1).toLocaleString(LOC)}</b><span>{t}</span></li>)}
    </ol>
  );
}

/* ───────── loading skeletons ───────── */
export const SkeletonGrid = ({ n = 8 }: { n?: number }) => (
  <div className="pgrid" aria-busy="true" aria-label={tr('cui.1', 'در حال بارگذاری…')}>
    {Array.from({ length: n }, (_, i) => <div key={i} className="pcard skel"><div className="skel__img" /><div className="skel__line" /><div className="skel__line skel__line--s" /></div>)}
  </div>
);

/* ───────── size guide (default table, override in Admin → settings → size_guide: one row per line "S|86|68|94") ───────── */
const DEFAULT_ROWS = ['XS|80|62|88', 'S|84|66|92', 'M|88|70|96', 'L|92|74|100', 'XL|96|78|104'];
export function SizeGuide({ onClose }: { onClose: () => void }) {
  const { s } = useSettings();
  const lines = (s.size_guide || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const rows = (lines.length ? lines : DEFAULT_ROWS).map((l) => l.split('|').map((c) => c.trim()));
  return (
    <Drawer label={tr('cSize.1', 'راهنمای سایز')} onClose={onClose}>
      <div className="sizeguide">
        <header><h2>{tr('cSize.1', 'راهنمای سایز')}</h2><button className="icon" onClick={onClose} aria-label={tr('cFit.6', 'بستن')}><IconClose /></button></header>
        <p className="muted">{tr('cSize.2', 'اندازه‌ها به سانتی‌متر است. اگر بین دو سایز بودید، سایز بزرگ‌تر را انتخاب کنید.')}</p>
        <div className="tablewrap"><table className="table">
          <thead><tr><th>{tr('cSize.3', 'سایز')}</th><th>{tr('cSize.4', 'دور سینه')}</th><th>{tr('cSize.5', 'دور کمر')}</th><th>{tr('cSize.6', 'دور باسن')}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r[0]}><td><strong>{r[0]}</strong></td>{[1, 2, 3].map((i) => <td key={i}>{(r[i] ?? '—')}</td>)}</tr>)}</tbody>
        </table></div>
        <h3 className="h4">{tr('cSize.7', 'اندازه‌گیری درست')}</h3>
        <ul className="sizeguide__tips">
          <li>{tr('cSize.8', 'دور سینه: پهن‌ترین قسمت سینه، متر موازی زمین.')}</li>
          <li>{tr('cSize.9', 'دور کمر: باریک‌ترین قسمت تنه، بالای ناف.')}</li>
          <li>{tr('cSize.10', 'دور باسن: برجسته‌ترین قسمت باسن.')}</li>
        </ul>
      </div>
    </Drawer>
  );
}

/* ───────── mini cart: opens after "add to cart" ───────── */
export function MiniCart() {
  const [open, setOpen] = useState(false);
  const { lines, subtotal } = useCart();
  useEffect(() => { const on = () => setOpen(true); window.addEventListener('aram:cart-added', on); return () => window.removeEventListener('aram:cart-added', on); }, []);
  if (!open) return null;
  const recent = [...lines].slice(-3).reverse();
  return (
    <Drawer label={tr('cMini.1', 'سبد خرید')} onClose={() => setOpen(false)}>
      <div className="minicart">
        <header><h2><IconBag />{tr('cMini.2', 'به سبد اضافه شد')}</h2><button className="icon" onClick={() => setOpen(false)} aria-label={tr('cFit.6', 'بستن')}><IconClose /></button></header>
        <ul>
          {recent.map((l) => (
            <li key={l.variantId}>
              <div className="minicart__img"><Placeholder tone={l.tone} silhouette={l.silhouette} /></div>
              <div><strong>{l.title}</strong><small className="muted">{l.color} · {l.size} × {l.qty.toLocaleString(LOC)}</small></div>
              <span>{price(l.price * l.qty)}</span>
            </li>
          ))}
        </ul>
        <p className="minicart__sum"><span>{tr('cMini.3', 'جمع سبد')}</span><strong>{price(subtotal)}</strong></p>
        <div className="minicart__actions">
          <Link className="btn" to="/checkout" onClick={() => setOpen(false)}>{tr('cMini.4', 'ادامه و پرداخت')}</Link>
          <Link className="btn btn--ghost" to="/cart" onClick={() => setOpen(false)}>{tr('cMini.5', 'دیدن سبد')}</Link>
        </div>
        <button className="link" onClick={() => setOpen(false)}>{tr('cMini.6', 'ادامه خرید')}</button>
      </div>
    </Drawer>
  );
}
