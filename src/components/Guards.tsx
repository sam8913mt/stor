import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context';
import { Loading } from './ui';
import { IconBag, IconHeart, IconUser } from './Icons';
import { tr } from '../i18n';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

/** Cart / wishlist for guests: instead of the content, a friendly card with Sign in (primary) and Sign up. */
export function LoginGate({ kind, children }: { kind: 'cart' | 'wishlist' | 'account'; children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (user) return <>{children}</>;
  const next = encodeURIComponent(loc.pathname + loc.search);
  const Icon = kind === 'cart' ? IconBag : kind === 'wishlist' ? IconHeart : IconUser;
  return (
    <div className="wrap gate">
      <div className="gate__card">
        <span className="gate__icon"><Icon /></span>
        <h1 className="h2">{kind === 'cart' ? tr('cGate.2', 'برای دیدن سبد خرید وارد شوید') : kind === 'wishlist' ? tr('cGate.3', 'برای دیدن علاقه‌مندی‌ها وارد شوید') : tr('cGate.7', 'برای دیدن حساب کاربری وارد شوید')}</h1>
        <p className="muted">{tr('cGate.4', 'با شماره موبایل خود وارد شوید یا در چند ثانیه حساب بسازید.')}</p>
        <div className="gate__actions">
          <Link className="btn" to={`/login?next=${next}`}><IconUser />{tr('cGate.5', 'ورود')}</Link>
          <Link className="btn btn--ghost" to={`/login?mode=up&next=${next}`}>{tr('cGate.6', 'ثبت‌نام')}</Link>
        </div>
      </div>
    </div>
  );
}
