import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { q } from '../lib/api';
import { supabase } from '../lib/supabase';
import { kickEmailQueue, startPayment } from '../lib/fn';
import { useAuth, useCart, useSettings, useToast } from '../context';
import { useAsync, useTitle } from '../hooks';
import { LANG, lf, tr, SEP, LOC } from '../i18n';
import { errorFa, ONLINE_PROVIDERS, price } from '../lib/format';
import { Empty } from '../components/ui';
import { Placeholder } from '../components/Placeholder';
import type { Address, PaymentProvider } from '../types';

export default function Checkout() {
  useTitle(tr('pCheckout.1', 'ثبت سفارش'));
  const { user, profile, ready } = useAuth();
  const { lines, subtotal, clear } = useCart();
  const { s } = useSettings();
  const toast = useToast();
  const nav = useNavigate();
  const providers = useAsync(() => q<PaymentProvider[]>(supabase.from('payment_providers').select('*').eq('is_enabled', true).order('sort_order')), []);
  const addrs = useAsync(() => (user ? q<Address[]>(supabase.from('addresses').select('*').order('is_default', { ascending: false }).order('created_at')) : Promise.resolve([] as Address[])), [user?.id]);
  const [f, setF] = useState({ full_name: '', phone: '', city: '', address: '', postal_code: '', note: '' });
  const [addrId, setAddrId] = useState<string>('new');
  const [save, setSave] = useState(false);
  const [pay, setPay] = useState('');
  const [code, setCode] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const pick = (a: Address) => { setAddrId(a.id); setF((x) => ({ ...x, full_name: a.full_name, phone: a.phone, city: a.city, address: a.address, postal_code: a.postal_code ?? '' })); };
  useEffect(() => { if (profile && addrId === 'new') setF((x) => ({ ...x, full_name: x.full_name || profile.full_name || '', phone: x.phone || profile.phone || '' })); }, [profile]);
  useEffect(() => { const d = addrs.data?.find((a) => a.is_default) ?? addrs.data?.[0]; if (d && addrId === 'new' && !f.address) pick(d); }, [addrs.data]);
  useEffect(() => { if (!pay && providers.data?.length) setPay(providers.data[0].key); }, [providers.data]);
  useEffect(() => { setCoupon(null); }, [subtotal]);

  if (!ready) return null;
  if (!lines.length) return <div className="wrap"><Empty title={tr('pCheckout.2', 'سبد خرید خالی است')} to="/shop" cta={tr('pCheckout.3', 'مشاهده محصولات')} /></div>;
  if (!user) return (
    <div className="wrap"><Empty title={tr('pCheckout.4', 'برای ثبت سفارش وارد شوید')} text={tr('pCheckout.5', 'سفارش‌ها و پیگیری آن‌ها در حساب کاربری شما نگهداری می‌شود.')} to="/login?next=/checkout" cta={tr('pCheckout.6', 'ورود / ثبت‌نام')} /></div>
  );

  const discount = coupon?.discount ?? 0;
  const free = s.free_shipping_threshold > 0 && subtotal - discount >= s.free_shipping_threshold;
  const ship = free ? 0 : s.shipping_fee;
  const total = subtotal - discount + ship;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); if (k !== 'note') setAddrId('new'); };
  const chosen = providers.data?.find((p) => p.key === pay);

  const applyCoupon = async () => {
    if (!code.trim()) return;
    const { data, error } = await supabase.rpc('validate_coupon', { p_code: code, p_subtotal: subtotal });
    if (error || !data?.valid) { setCoupon(null); toast.push(tr('pCheckout.7', 'کد تخفیف معتبر نیست.'), 'err'); return; }
    setCoupon({ code: data.code, discount: Number(data.discount) });
    toast.push(tr('pCheckout.8', 'کد تخفیف اعمال شد.'));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pay) { setErr(errorFa('BAD_PAYMENT')); return; }
    setErr(''); setBusy(true);
    const { data, error } = await supabase.rpc('place_order', {
      p_items: lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
      p_shipping: { full_name: f.full_name, phone: f.phone, city: f.city, address: f.address, postal_code: f.postal_code },
      p_coupon: coupon?.code ?? null, p_payment: pay, p_note: f.note || null, p_locale: LANG,
    });
    if (error) { setBusy(false); setErr(errorFa(error.message)); return; }
    const order = data as { id: string; order_number: string };
    clear();
    if (save && addrId === 'new') {
      await supabase.from('addresses').insert({ user_id: user.id, full_name: f.full_name, phone: f.phone, city: f.city, address: f.address, postal_code: f.postal_code || null });
    }
    kickEmailQueue();
    if (ONLINE_PROVIDERS.includes(pay)) {
      try { await startPayment(order.id); return; }
      catch (ex) { toast.push(errorFa((ex as Error).message), 'err'); nav('/account/orders?payment=failed', { replace: true }); return; }
    }
    nav(`/order-success/${order.order_number}`, { replace: true });
  };

  return (
    <div className="wrap cart">
      <h1 className="h1">{tr('pCheckout.9', 'ثبت سفارش')}</h1>
      <form className="cart__grid" onSubmit={submit}>
        <div className="form">
          <h2 className="h3">{tr('pCheckout.10', 'اطلاعات تحویل')}</h2>
          {addrs.data?.length ? (
            <fieldset className="addrpick"><legend>{tr('pCheckout.11', 'نشانی‌های ذخیره‌شده')}</legend>
              {addrs.data.map((a) => (
                <label key={a.id} className={`radio${addrId === a.id ? ' is-on' : ''}`}>
                  <input type="radio" name="addr" checked={addrId === a.id} onChange={() => pick(a)} />
                  <span>{a.label ? <strong>{a.label} · </strong> : null}{a.full_name}{SEP}{a.city}{SEP}{a.address}</span>
                </label>
              ))}
              <label className={`radio${addrId === 'new' ? ' is-on' : ''}`}><input type="radio" name="addr" checked={addrId === 'new'} onChange={() => { setAddrId('new'); setF((x) => ({ ...x, address: '', city: '', postal_code: '' })); }} /> {tr('pCheckout.12', 'نشانی جدید')}</label>
            </fieldset>
          ) : null}
          <div className="form__row">
            <label>{tr('pCheckout.13', 'نام و نام خانوادگی')}<input className="input" required value={f.full_name} onChange={set('full_name')} autoComplete="name" /></label>
            <label>{tr('pCheckout.14', 'تلفن همراه')}<input className="input" required dir="ltr" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
          </div>
          <div className="form__row">
            <label>{tr('pCheckout.15', 'شهر')}<input className="input" required value={f.city} onChange={set('city')} autoComplete="address-level2" /></label>
            <label>{tr('pCheckout.16', 'کد پستی')}<input className="input" dir="ltr" inputMode="numeric" value={f.postal_code} onChange={set('postal_code')} autoComplete="postal-code" /></label>
          </div>
          <label>{tr('pCheckout.17', 'نشانی کامل')}<textarea className="textarea" required rows={3} value={f.address} onChange={set('address')} autoComplete="street-address" /></label>
          {addrId === 'new' ? <label className="chk"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> {tr('pCheckout.18', 'ذخیره این نشانی برای دفعات بعد')}</label> : null}
          <label>{tr('pCheckout.19', 'توضیحات سفارش (اختیاری)')}<textarea className="textarea" rows={2} maxLength={500} value={f.note} onChange={set('note')} /></label>

          <h2 className="h3">{tr('pCheckout.20', 'روش پرداخت')}</h2>
          {providers.loading ? <p className="muted">{tr('pCheckout.21', 'در حال بارگذاری…')}</p> : !providers.data?.length ? <p className="note note--err">{tr('pCheckout.22', 'هیچ روش پرداختی فعال نیست. با فروشگاه تماس بگیرید.')}</p> : providers.data.map((m) => (
            <label key={m.key} className={`radio${pay === m.key ? ' is-on' : ''}`}>
              <input type="radio" name="pay" checked={pay === m.key} onChange={() => setPay(m.key)} /> {lf(m, 'label')}
            </label>
          ))}
          {chosen && lf(chosen, 'instructions') ? <p className="note">{lf(chosen, 'instructions')}</p> : null}
          {pay === 'bank_transfer' && s.bank_card_info ? <p className="note">{s.bank_card_info}</p> : null}
          {chosen && ONLINE_PROVIDERS.includes(chosen.key) ? <p className="muted small">{tr('pCheckout.23', 'پس از ثبت سفارش به صفحه‌ی امن درگاه پرداخت منتقل می‌شوید.')}</p> : null}
        </div>

        <aside className="summary">
          <ul className="msum">
            {lines.map((l) => (
              <li key={l.variantId}><div className="msum__img"><Placeholder tone={l.tone} silhouette={l.silhouette} /></div>
                <span>{l.title}<small className="muted"> {l.color} · {l.size} × {l.qty.toLocaleString(LOC)}</small></span><span>{price(l.price * l.qty)}</span></li>
            ))}
          </ul>
          <div className="coupon">
            <input className="input" dir="ltr" placeholder={tr('pCheckout.24', 'کد تخفیف')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label={tr('pCheckout.25', 'کد تخفیف')} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={applyCoupon}>{tr('pCheckout.26', 'اعمال')}</button>
          </div>
          <div className="row"><span>{tr('pCheckout.27', 'جمع کالاها')}</span><span>{price(subtotal)}</span></div>
          {discount ? <div className="row"><span>{tr('pCheckout.28', 'تخفیف (')}{coupon?.code})</span><span>− {price(discount)}</span></div> : null}
          <div className="row"><span>{tr('pCheckout.29', 'هزینه ارسال')}</span><span>{ship ? price(ship) : tr('pCheckout.30', 'رایگان')}</span></div>
          <div className="row row--total"><span>{tr('pCheckout.31', 'مبلغ قابل پرداخت')}</span><span>{price(total)}</span></div>
          <p className="muted small">{tr('pCheckout.32', 'مبلغ نهایی توسط سرور محاسبه و تأیید می‌شود.')}</p>
          {err ? <p className="note note--err" role="alert">{err}</p> : null}
          <button className="btn btn--block" disabled={busy || !pay}>{busy ? tr('pCheckout.33', 'در حال ثبت…') : tr('pCheckout.34', 'ثبت نهایی سفارش')}</button>
          <Link to="/cart" className="link">{tr('pCheckout.35', 'بازگشت به سبد')}</Link>
        </aside>
      </form>
    </div>
  );
}
