import { lf, tr, LOC } from '../i18n';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { loadMeta, q } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAsync } from '../hooks';
import { useAuth, useCart, useSettings, useWishlist } from '../context';
import { IconBag, IconClose, IconHeart, IconMenu, IconSearch, IconUser } from './Icons';
import { Drawer, LangSwitch, SetupNotice } from './ui';

export function Layout() {
  const { s } = useSettings();
  const { count } = useCart();
  const wish = useWishlist();
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [term, setTerm] = useState('');
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const cat = useAsync(() => loadMeta(), []);
  const pages = useAsync(() => q<{ slug: string; title_fa: string; title_en: string | null }[]>(supabase.from('cms_pages').select('slug,title_fa,title_en').eq('is_published', true).order('title_fa')), []);

  useEffect(() => { setMenu(false); setSearch(false); window.scrollTo(0, 0); }, [loc.pathname]);

  const cats = cat.data?.categories.filter((c) => c.is_active).slice(0, 6) ?? [];
  const submit = (e: FormEvent) => { e.preventDefault(); nav(`/shop?q=${encodeURIComponent(term.trim())}`); setTerm(''); };

  const links = (
    <>
      <NavLink to="/shop?new=1">{tr('cLayout.1', 'جدیدترین‌ها')}</NavLink>
      {cats.map((c) => <NavLink key={c.id} to={`/shop?cat=${c.slug}`}>{lf(c, 'name')}</NavLink>)}
      <NavLink to="/collections">{tr('cLayout.2', 'مجموعه‌ها')}</NavLink>
    </>
  );

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{tr('cLayout.3', 'رفتن به محتوا')}</a>
      <SetupNotice />
      {s.announcement ? <div className="announce">{s.announcement}</div> : null}
      <header className={`hdr${scrolled ? ' is-scrolled' : ''}`}>
        <div className="hdr__in wrap">
          <div className="hdr__start">
            <button className="icon hdr__burger" aria-label={tr('cLayout.4', 'منو')} onClick={() => setMenu(true)}><IconMenu /></button>
            <LangSwitch />
            <button className="icon" aria-label={tr('cLayout.6', 'جستجو')} aria-expanded={search} onClick={() => setSearch((v) => !v)}><IconSearch /></button>
          </div>
          <Link to="/" className="logo" aria-label={s.store_name}>ARAM</Link>
          <div className="hdr__tools">
            <Link className="icon hide-sm" to={user ? '/account' : '/login'} aria-label={tr('cLayout.7', 'حساب کاربری')}><IconUser /></Link>
            <Link className="icon badge-wrap" to="/wishlist" aria-label={tr('cLayout.8', 'علاقه‌مندی‌ها')}><IconHeart />{wish.ids.length ? <b className="badge">{wish.ids.length.toLocaleString(LOC)}</b> : null}</Link>
            <Link className="icon badge-wrap" to="/cart" aria-label={tr('cLayout.9', 'سبد خرید')}><IconBag />{count ? <b className="badge">{count.toLocaleString(LOC)}</b> : null}</Link>
          </div>
        </div>
        <div className="hdr__bar"><nav className="hdr__nav" aria-label={tr('cLayout.5', 'اصلی')}>{links}</nav></div>
        {search ? (
          <form className="searchbar wrap" onSubmit={submit} role="search">
            <input autoFocus className="input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={tr('cLayout.10', 'جستجوی محصول، رنگ یا دسته…')} aria-label={tr('cLayout.11', 'جستجو')} />
            <button className="btn btn--sm">{tr('cLayout.12', 'جستجو')}</button>
          </form>
        ) : null}
      </header>

      {menu ? (
        <Drawer label={tr('cLayout.13', 'منو')} onClose={() => setMenu(false)}>
          <button className="icon" aria-label={tr('cLayout.14', 'بستن')} onClick={() => setMenu(false)}><IconClose /></button>
          <nav className="drawer__nav">
            {links}
            <NavLink to={user ? '/account' : '/login'}>{user ? tr('cLayout.15', 'حساب کاربری') : tr('cLayout.16', 'ورود / ثبت‌نام')}</NavLink>
          </nav>
        </Drawer>
      ) : null}

      <main id="main" tabIndex={-1}><Outlet /></main>

      <footer className="ftr">
        <div className="wrap ftr__grid">
          <div>
            <p className="logo logo--sm">ARAM</p>
            <p className="muted">{s.tagline || s.store_name}</p>
          </div>
          <div>
            <h3 className="ftr__h">{tr('cLayout.17', 'فروشگاه')}</h3>
            <Link to="/shop">{tr('cLayout.18', 'همه محصولات')}</Link>
            <Link to="/collections">{tr('cLayout.19', 'مجموعه‌ها')}</Link>
            <Link to="/wishlist">{tr('cLayout.20', 'علاقه‌مندی‌ها')}</Link>
          </div>
          <div>
            <h3 className="ftr__h">{tr('cLayout.21', 'راهنما')}</h3>
            {(pages.data ?? []).map((p) => <Link key={p.slug} to={`/p/${p.slug}`}>{lf(p, 'title')}</Link>)}
            <Link to={user ? '/account/orders' : '/login'}>{tr('cLayout.22', 'پیگیری سفارش')}</Link>
          </div>
          <div>
            <h3 className="ftr__h">{tr('cLayout.23', 'تماس')}</h3>
            {s.contact_phone ? <a href={`tel:${s.contact_phone}`} dir="ltr">{s.contact_phone}</a> : null}
            {s.contact_email ? <a href={`mailto:${s.contact_email}`} dir="ltr">{s.contact_email}</a> : null}
            {s.instagram ? <a href={s.instagram.startsWith('http') ? s.instagram : `https://instagram.com/${s.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">{tr('cLayout.24', 'اینستاگرام')}</a> : null}
            {!s.contact_phone && !s.contact_email && !s.instagram ? <p className="muted">{tr('cLayout.25', 'اطلاعات تماس را در تنظیمات فروشگاه وارد کنید.')}</p> : null}
          </div>
        </div>
        <div className="wrap ftr__base"><span>© {new Date().getFullYear().toLocaleString(LOC, { useGrouping: false })} {s.store_name}</span></div>
      </footer>
    </>
  );
}
