import { Link } from 'react-router-dom';
import { useCart, useSettings } from '../context';
import { useTitle } from '../hooks';
import { price } from '../lib/format';
import { Placeholder } from '../components/Placeholder';
import { Empty } from '../components/ui';
import { IconClose, IconMinus, IconPlus } from '../components/Icons';
import { tr, LOC } from '../i18n';

export default function Cart() {
  useTitle(tr('pCart.1', 'سبد خرید'));
  const { lines, subtotal, setQty, remove } = useCart();
  const { s } = useSettings();
  if (!lines.length) return <div className="wrap"><Empty title={tr('pCart.2', 'سبد خرید خالی است')} text={tr('pCart.3', 'محصول مورد علاقه‌تان را پیدا کنید.')} to="/shop" cta={tr('pCart.4', 'مشاهده محصولات')} /></div>;
  const free = s.free_shipping_threshold > 0 && subtotal >= s.free_shipping_threshold;
  return (
    <div className="wrap cart">
      <h1 className="h1">{tr('pCart.5', 'سبد خرید')}</h1>
      <div className="cart__grid">
        <ul className="cart__lines">
          {lines.map((l) => (
            <li key={l.variantId} className="cline">
              <Link to={`/product/${l.slug}`} className="cline__img"><Placeholder tone={l.tone} silhouette={l.silhouette} /></Link>
              <div className="cline__info">
                <Link to={`/product/${l.slug}`} className="cline__title">{l.title}</Link>
                <p className="muted">{l.color} · {l.size}</p>
                <div className="qty qty--sm" role="group" aria-label={tr('pCart.6', 'تعداد')}>
                  <button onClick={() => setQty(l.variantId, l.qty - 1)} aria-label={tr('pCart.7', 'کم کردن')}><IconMinus /></button>
                  <span>{l.qty.toLocaleString(LOC)}</span>
                  <button onClick={() => setQty(l.variantId, l.qty + 1)} aria-label={tr('pCart.8', 'زیاد کردن')}><IconPlus /></button>
                </div>
              </div>
              <div className="cline__price">{price(l.price * l.qty)}</div>
              <button className="icon" onClick={() => remove(l.variantId)} aria-label={tr('pCart.9', 'حذف {0}', [l.title])}><IconClose /></button>
            </li>
          ))}
        </ul>
        <aside className="summary">
          <div className="row"><span>{tr('pCart.10', 'جمع کالاها')}</span><span>{price(subtotal)}</span></div>
          <div className="row"><span>{tr('pCart.11', 'هزینه ارسال')}</span><span>{free ? tr('pCart.12', 'رایگان') : tr('pCart.13', 'در مرحله بعد')}</span></div>
          <p className="muted small">{tr('pCart.14', 'قیمت‌ها و موجودی هنگام ثبت سفارش دوباره بررسی می‌شود.')}</p>
          <Link to="/checkout" className="btn btn--block">{tr('pCart.15', 'ادامه و ثبت سفارش')}</Link>
          <Link to="/shop" className="link">{tr('pCart.16', 'ادامه خرید')}</Link>
        </aside>
      </div>
    </div>
  );
}
