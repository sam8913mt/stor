import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { isConfigured } from '../lib/supabase';
import { LANG, LOC, setLang, tr } from '../i18n';
import { useDialog } from '../hooks';

export const Loading = ({ label = tr('cui.1', 'در حال بارگذاری…') }: { label?: string }) => (
  <div className="state" role="status"><span className="spinner" aria-hidden="true" />{label}</div>
);

export function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="state state--err" role="alert">
      <p>{error}</p>
      {retry ? <button className="btn btn--ghost btn--sm" onClick={retry}>{tr('cui.2', 'تلاش دوباره')}</button> : null}
    </div>
  );
}

export function Empty({ title, text, to, cta }: { title: string; text?: string; to?: string; cta?: string }) {
  return (
    <div className="state">
      <h2 className="h3">{title}</h2>
      {text ? <p className="muted">{text}</p> : null}
      {to && cta ? <Link to={to} className="btn btn--sm">{cta}</Link> : null}
    </div>
  );
}

/** Shown when Supabase env vars are missing so the failure is explicit, not silent. */
export function SetupNotice() {
  if (isConfigured) return null;
  return (
    <div className="setup" role="alert" dir="ltr">
      Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see README).
    </div>
  );
}

export const Crumbs = ({ items }: { items: { to?: string; label: string }[] }) => (
  <nav className="crumbs" aria-label={tr('cui.3', 'مسیر')}>
    {items.map((c, i) => (
      <span key={i}>{c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</span>
    ))}
  </nav>
);

export const Section = ({ title, link, children }: { title: string; link?: { to: string; label: string }; children: ReactNode }) => (
  <section className="sec wrap">
    <div className="sec__head">
      <h2 className="h2">{title}</h2>
      {link ? <Link className="link" to={link.to}>{link.label}</Link> : null}
    </div>
    {children}
  </section>
);

/** Compact numbered pager: « 1 … 4 5 6 … 12 ». Used by storefront and admin lists. */
export function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  const show = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...show].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <nav className="pager" aria-label={tr('cui.4', 'صفحه‌بندی')}>
      <button className="opt" disabled={page <= 1} onClick={() => onPage(page - 1)}>{tr('cui.5', 'قبلی')}</button>
      {list.map((n, i) => (
        <span key={n} className="pager__item">
          {i > 0 && n - list[i - 1] > 1 ? <span aria-hidden="true">…</span> : null}
          <button className={`opt opt--sq${n === page ? ' is-on' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n.toLocaleString(LOC)}</button>
        </span>
      ))}
      <button className="opt" disabled={page >= pages} onClick={() => onPage(page + 1)}>{tr('cui.6', 'بعدی')}</button>
    </nav>
  );
}

/** Side drawer (mobile menu, filters) with dialog accessibility built in. */
export function Drawer({ label, onClose, wide, children }: { label: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const ref = useDialog(onClose);
  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label={label}>
      <div className="drawer__scrim" onClick={onClose} />
      <div className={`drawer__panel${wide ? ' drawer__panel--wide' : ''}`} ref={ref} tabIndex={-1}>{children}</div>
    </div>
  );
}

export function LangSwitch() {
  return (
    <button className="icon langsw" onClick={() => setLang(LANG === 'fa' ? 'en' : 'fa')} lang={LANG === 'fa' ? 'en' : 'fa'}
      aria-label={LANG === 'fa' ? 'Switch to English' : 'تغییر به فارسی'} title={LANG === 'fa' ? 'English' : 'فارسی'}>
      {LANG === 'fa' ? 'EN' : 'فا'}
    </button>
  );
}
