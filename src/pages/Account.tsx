import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Route, Routes, useSearchParams } from 'react-router-dom';
import { q } from '../lib/api';
import { supabase } from '../lib/supabase';
import { startPayment } from '../lib/fn';
import { useAsync, useTitle } from '../hooks';
import { useAuth, useToast } from '../context';
import { LOC, tr, SEP } from '../i18n';
import { dateTimeFa, errorFa, ONLINE_PROVIDERS, ORDER_STATUS, PAY_METHOD, PAY_STATUS, price } from '../lib/format';
import { Empty, ErrorBox, Loading } from '../components/ui';
import type { Address, Order } from '../types';

function ProfileForm() {
  const { profile, user, refreshProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  useEffect(() => { setName(profile?.full_name ?? ''); setPhone(profile?.phone ?? ''); }, [profile]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try { await q(supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() }).eq('id', user!.id)); await refreshProfile(); toast.push(tr('pAccount.1', 'ذخیره شد.')); }
    catch (err) { toast.push(errorFa((err as Error).message), 'err'); }
  };
  return (
    <form className="form form--narrow" onSubmit={save}>
      <label>{tr('pAccount.2', 'ایمیل')}<input className="input" dir="ltr" value={user?.email ?? ''} disabled /></label>
      <label>{tr('pAccount.3', 'نام و نام خانوادگی')}<input className="input" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>{tr('pAccount.4', 'تلفن همراه')}<input className="input" dir="ltr" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <button className="btn btn--sm">{tr('pAccount.5', 'ذخیره تغییرات')}</button>
    </form>
  );
}

const blank = { label: '', full_name: '', phone: '', city: '', address: '', postal_code: '', is_default: false };

function Addresses() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => q<Address[]>(supabase.from('addresses').select('*').order('is_default', { ascending: false }).order('created_at')), []);
  const [f, setF] = useState<(typeof blank & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF((x) => (x ? { ...x, [k]: e.target.value } : x));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f || !user) return;
    setBusy(true);
    const row = { label: f.label.trim() || null, full_name: f.full_name.trim(), phone: f.phone.trim(), city: f.city.trim(), address: f.address.trim(), postal_code: f.postal_code.trim() || null, is_default: f.is_default };
    try {
      if (f.id) await q(supabase.from('addresses').update(row).eq('id', f.id));
      else await q(supabase.from('addresses').insert({ ...row, user_id: user.id }));
      toast.push(tr('pAccount.6', 'ذخیره شد.')); setF(null); reload();
    } catch (err) { toast.push(errorFa((err as Error).message), 'err'); } finally { setBusy(false); }
  };
  const del = async (id: string) => {
    if (!window.confirm(tr('pAccount.7', 'این نشانی حذف شود؟'))) return;
    try { await q(supabase.from('addresses').delete().eq('id', id)); reload(); } catch (err) { toast.push(errorFa((err as Error).message), 'err'); }
  };
  const makeDefault = async (id: string) => {
    try { await q(supabase.from('addresses').update({ is_default: true }).eq('id', id)); reload(); } catch (err) { toast.push(errorFa((err as Error).message), 'err'); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  return (
    <div className="addresses">
      {data?.length ? (
        <ul className="addrlist">
          {data.map((a) => (
            <li key={a.id} className="addr">
              <p>{a.label ? <strong>{a.label}</strong> : null}{a.is_default ? <span className="pill">{tr('pAccount.8', 'پیش‌فرض')}</span> : null}</p>
              <p>{a.full_name} · <span dir="ltr">{a.phone}</span></p>
              <p className="muted">{a.city}{SEP}{a.address}{a.postal_code ? ` — ${a.postal_code}` : ''}</p>
              <p className="actions">
                <button className="link" onClick={() => setF({ ...a, label: a.label ?? '', postal_code: a.postal_code ?? '' })}>{tr('pAccount.9', 'ویرایش')}</button>
                {!a.is_default ? <button className="link" onClick={() => void makeDefault(a.id)}>{tr('pAccount.10', 'پیش‌فرض کن')}</button> : null}
                <button className="link link--danger" onClick={() => void del(a.id)}>{tr('pAccount.11', 'حذف')}</button>
              </p>
            </li>
          ))}
        </ul>
      ) : !f ? <Empty title={tr('pAccount.12', 'نشانی ذخیره‌شده‌ای ندارید')} text={tr('pAccount.13', 'نشانی‌ها در مرحله‌ی ثبت سفارش سریع‌تر پر می‌شوند.')} /> : null}
      {f ? (
        <form className="form form--narrow" onSubmit={save}>
          <h2 className="h3">{f.id ? tr('pAccount.14', 'ویرایش نشانی') : tr('pAccount.15', 'نشانی جدید')}</h2>
          <label>{tr('pAccount.16', 'عنوان (مثلاً خانه)')}<input className="input" maxLength={60} value={f.label} onChange={set('label')} /></label>
          <div className="form__row">
            <label>{tr('pAccount.17', 'نام گیرنده')}<input className="input" required maxLength={120} value={f.full_name} onChange={set('full_name')} /></label>
            <label>{tr('pAccount.18', 'تلفن')}<input className="input" required dir="ltr" maxLength={30} value={f.phone} onChange={set('phone')} /></label>
          </div>
          <div className="form__row">
            <label>{tr('pAccount.19', 'شهر')}<input className="input" required maxLength={80} value={f.city} onChange={set('city')} /></label>
            <label>{tr('pAccount.20', 'کد پستی')}<input className="input" dir="ltr" maxLength={20} value={f.postal_code} onChange={set('postal_code')} /></label>
          </div>
          <label>{tr('pAccount.21', 'نشانی کامل')}<textarea className="textarea" required rows={3} maxLength={500} value={f.address} onChange={set('address')} /></label>
          <label className="chk"><input type="checkbox" checked={f.is_default} onChange={(e) => setF({ ...f, is_default: e.target.checked })} /> {tr('pAccount.22', 'نشانی پیش‌فرض')}</label>
          <div className="form__actions"><button className="btn btn--sm" disabled={busy}>{tr('pAccount.23', 'ذخیره')}</button><button type="button" className="btn btn--ghost btn--sm" onClick={() => setF(null)}>{tr('pAccount.24', 'انصراف')}</button></div>
        </form>
      ) : <button className="btn btn--sm" onClick={() => setF({ ...blank })}>{tr('pAccount.25', 'افزودن نشانی')}</button>}
    </div>
  );
}

function Orders() {
  const toast = useToast();
  const [sp] = useSearchParams();
  const { data, error, loading, reload } = useAsync(() => q<Order[]>(supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(100)), []);
  const [busy, setBusy] = useState('');
  const pay = async (id: string) => { setBusy(id); try { await startPayment(id); } catch (e) { toast.push(errorFa((e as Error).message), 'err'); setBusy(''); } };
  const cancel = async (id: string) => {
    if (!window.confirm(tr('pAccount.26', 'این سفارش لغو شود؟ کالاها به انبار بازمی‌گردند.'))) return;
    setBusy(id);
    try { await q(supabase.rpc('cancel_my_order', { p_order_id: id })); toast.push(tr('pAccount.27', 'سفارش لغو شد.')); reload(); }
    catch (e) { toast.push(errorFa((e as Error).message), 'err'); } finally { setBusy(''); }
  };
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  return (
    <div className="orders">
      {sp.get('payment') ? <p className="note note--err" role="alert">{tr('pAccount.28', 'پرداخت انجام نشد یا لغو شد. می‌توانید دوباره پرداخت کنید.')}</p> : null}
      {!data?.length ? <Empty title={tr('pAccount.29', 'هنوز سفارشی ثبت نکرده‌اید')} to="/shop" cta={tr('pAccount.30', 'شروع خرید')} /> : data.map((o) => {
        const canPay = ONLINE_PROVIDERS.includes(o.payment_method) && o.payment_status === 'unpaid' && o.status !== 'cancelled';
        const canCancel = ['pending', 'confirmed'].includes(o.status) && o.payment_status === 'unpaid';
        return (
          <details key={o.id} className="order">
            <summary>
              <strong dir="ltr">{o.order_number}</strong><span>{dateTimeFa(o.created_at)}</span>
              <span className={`pill pill--${o.status}`}>{ORDER_STATUS[o.status]}</span><span>{price(o.total)}</span>
            </summary>
            <ul>{o.order_items?.map((i) => <li key={i.id}><span>{i.title} <small className="muted">{i.color} · {i.size} × {i.qty.toLocaleString(LOC)}</small></span><span>{price(i.unit_price * i.qty)}</span></li>)}</ul>
            <p className="muted small">{PAY_METHOD[o.payment_method]} · {PAY_STATUS[o.payment_status]}{o.discount ? tr('pAccount.31', ' · تخفیف {0}', [price(o.discount)]) : ''} {tr('pAccount.32', '· ارسال')} {o.shipping_fee ? price(o.shipping_fee) : tr('pAccount.33', 'رایگان')}</p>
            <p className="muted small">{tr('pAccount.34', 'تحویل به:')} {o.shipping.full_name}{SEP}{o.shipping.city}{SEP}{o.shipping.address}</p>
            {canPay || canCancel ? (
              <p className="actions">
                {canPay ? <button className="btn btn--sm" disabled={busy === o.id} onClick={() => void pay(o.id)}>{tr('pAccount.35', 'پرداخت آنلاین')}</button> : null}
                {canCancel ? <button className="btn btn--ghost btn--sm" disabled={busy === o.id} onClick={() => void cancel(o.id)}>{tr('pAccount.36', 'لغو سفارش')}</button> : null}
              </p>
            ) : o.payment_status === 'paid' && ['pending', 'confirmed'].includes(o.status) ? <p className="muted small">{tr('pAccount.37', 'برای لغو سفارش پرداخت‌شده با پشتیبانی تماس بگیرید.')}</p> : null}
          </details>
        );
      })}
    </div>
  );
}

export default function Account() {
  useTitle(tr('pAccount.38', 'حساب کاربری'));
  const { signOut, isAdmin } = useAuth();
  return (
    <div className="wrap account">
      <h1 className="h1">{tr('pAccount.39', 'حساب کاربری')}</h1>
      <nav className="tabs" aria-label={tr('pAccount.40', 'حساب کاربری')}>
        <NavLink to="/account" end>{tr('pAccount.41', 'پروفایل')}</NavLink>
        <NavLink to="/account/addresses">{tr('pAccount.42', 'نشانی‌ها')}</NavLink>
        <NavLink to="/account/orders">{tr('pAccount.43', 'سفارش‌ها')}</NavLink>
        <Link to="/wishlist">{tr('pAccount.44', 'علاقه‌مندی‌ها')}</Link>
        {isAdmin ? <Link to="/admin">{tr('pAccount.45', 'پنل مدیریت')}</Link> : null}
        <button className="link" onClick={() => void signOut()}>{tr('pAccount.46', 'خروج')}</button>
      </nav>
      <Routes><Route index element={<ProfileForm />} /><Route path="addresses" element={<Addresses />} /><Route path="orders" element={<Orders />} /></Routes>
    </div>
  );
}
