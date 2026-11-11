import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context';
import { LangSwitch, Loading } from '../components/ui';
import { IconClose, IconMenu } from '../components/Icons';
import { tr } from '../i18n';

const NAV: { to: string; label: string; perm: string; end?: boolean }[] = [
  { to: '/admin', label: tr('aAdminLayout.1', 'داشبورد'), perm: 'analytics.view', end: true },
  { to: '/admin/orders', label: tr('aAdminLayout.2', 'سفارش‌ها'), perm: 'orders.manage' },
  { to: '/admin/products', label: tr('aAdminLayout.3', 'محصولات و موجودی'), perm: 'products.manage' },
  { to: '/admin/categories', label: tr('aAdminLayout.4', 'دسته‌بندی‌ها'), perm: 'catalog.manage' },
  { to: '/admin/collections', label: tr('aAdminLayout.5', 'مجموعه‌ها'), perm: 'catalog.manage' },
  { to: '/admin/coupons', label: tr('aAdminLayout.6', 'کوپن و تخفیف'), perm: 'marketing.manage' },
  { to: '/admin/reviews', label: tr('aAdminLayout.7', 'نظرات'), perm: 'reviews.manage' },
  { to: '/admin/customers', label: tr('aAdminLayout.8', 'مشتریان'), perm: 'customers.manage' },
  { to: '/admin/cms', label: tr('aAdminLayout.9', 'محتوا (CMS)'), perm: 'cms.manage' },
  { to: '/admin/settings', label: tr('aAdminLayout.10', 'تنظیمات فروشگاه'), perm: 'settings.manage' },
  { to: '/admin/payments', label: tr('aAdminLayout.11', 'روش‌های پرداخت'), perm: 'settings.manage' },
  { to: '/admin/email', label: tr('aAdminLayout.12', 'اعلان‌های ایمیلی'), perm: 'settings.manage' },
  { to: '/admin/admins', label: tr('aAdminLayout.13', 'مدیران و نقش‌ها'), perm: 'admins.manage' },
  { to: '/admin/logs', label: tr('aAdminLayout.14', 'گزارش فعالیت‌ها'), perm: 'logs.view' },
];

export function AdminLayout() {
  const { user, ready, permsLoaded, isAdmin, can, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (!permsLoaded) return <Loading />;
  if (!isAdmin) return <div className="wrap state state--tall"><h1 className="h2">{tr('aAdminLayout.15', 'دسترسی ندارید')}</h1><p className="muted">{tr('aAdminLayout.16', 'این حساب نقش مدیریتی ندارد.')}</p><Link to="/" className="btn btn--sm">{tr('aAdminLayout.17', 'بازگشت به فروشگاه')}</Link></div>;

  return (
    <div className="admin">
      <header className="admin__bar">
        <button className="icon admin__burger" aria-label={tr('aAdminLayout.18', 'منو')} onClick={() => setOpen(!open)}>{open ? <IconClose /> : <IconMenu />}</button>
        <strong className="logo logo--sm">{tr('aAdminLayout.19', 'ARAM · مدیریت')}</strong>
        <span className="muted admin__who">{profile?.email}</span>
        <LangSwitch />
        <Link className="link" to="/">{tr('aAdminLayout.20', 'مشاهده فروشگاه')}</Link>
        <button className="link" onClick={() => void signOut()}>{tr('aAdminLayout.21', 'خروج')}</button>
      </header>
      <div className="admin__body">
        <nav className={`admin__nav${open ? ' is-open' : ''}`} onClick={() => setOpen(false)} aria-label={tr('aAdminLayout.22', 'مدیریت')}>
          {NAV.filter((n) => can(n.perm)).map((n) => <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>)}
        </nav>
        <section className="admin__main"><Outlet /></section>
      </div>
    </div>
  );
}
