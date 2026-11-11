/**
 * Minimal hash router (HashRouter API subset of react-router-dom v6) — zero dependencies.
 * Supports: nested + layout + index routes, `:params`, trailing `*` splat, descendant <Routes>, Link/NavLink/Navigate,
 * useLocation / useNavigate / useParams / useSearchParams.
 */
import { Children, createContext, isValidElement, useContext, useEffect, useMemo, useSyncExternalStore, type AnchorHTMLAttributes, type ReactElement, type ReactNode } from 'react';

/* ───────── location (the part after “#”) ───────── */
const readHash = () => window.location.hash.slice(1) || '/';
const subscribe = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };

export interface Location { pathname: string; search: string }
function parseLocation(raw: string): Location {
  const i = raw.indexOf('?');
  let pathname = i < 0 ? raw : raw.slice(0, i);
  const search = i < 0 ? '' : raw.slice(i);
  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  return { pathname: pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname, search };
}

export interface NavigateOptions { replace?: boolean }
function go(to: string | number, opts?: NavigateOptions) {
  if (typeof to === 'number') { window.history.go(to); return; }
  const target = to.startsWith('/') ? to : '/' + to;
  if (opts?.replace) window.location.replace(`${window.location.pathname}${window.location.search}#${target}`);
  else window.location.hash = target;
}

export function HashRouter({ children }: { children?: ReactNode }) {
  useSyncExternalStore(subscribe, readHash);
  return <>{children}</>;
}

export function useLocation(): Location {
  const raw = useSyncExternalStore(subscribe, readHash);
  return useMemo(() => parseLocation(raw), [raw]);
}
export function useNavigate() { return go; }

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string>, opts?: NavigateOptions) => void] {
  const { pathname, search } = useLocation();
  const sp = useMemo(() => new URLSearchParams(search), [search]);
  const set = (next: URLSearchParams | Record<string, string>, opts?: NavigateOptions) => {
    const s = new URLSearchParams(next as URLSearchParams).toString();
    go(pathname + (s ? `?${s}` : ''), opts);
  };
  return [sp, set];
}

/* ───────── route matching ───────── */
export interface RouteProps { path?: string; index?: boolean; element?: ReactNode; children?: ReactNode }
export function Route(_props: RouteProps): null { return null; }

interface Def { path?: string; index: boolean; element: ReactNode; children: Def[] }
function toDefs(children: ReactNode): Def[] {
  const out: Def[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const p = (c as ReactElement<RouteProps>).props;
    out.push({ path: p.path, index: !!p.index, element: p.element, children: toDefs(p.children) });
  });
  return out;
}
interface Hit { def: Def; params: Record<string, string>; base: string }

const segs = (s: string) => s.split('/').filter(Boolean);
const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

function matchList(defs: Def[], rest: string[], base: string, params: Record<string, string>): Hit[] | null {
  const ordered = [...defs.filter((d) => d.path !== '*'), ...defs.filter((d) => d.path === '*')];
  for (const d of ordered) {
    if (d.index) { if (rest.length === 0) return [{ def: d, params, base }]; continue; }
    if (d.path === undefined) {                                   // layout route: no path of its own
      const sub = matchList(d.children, rest, base, params);
      if (sub) return [{ def: d, params, base }, ...sub];
      continue;
    }
    const pat = segs(d.path);
    const splat = pat[pat.length - 1] === '*';
    const fixed = splat ? pat.slice(0, -1) : pat;
    if (rest.length < fixed.length) continue;
    const p2 = { ...params };
    let ok = true;
    fixed.forEach((s, i) => { if (s.startsWith(':')) p2[s.slice(1)] = dec(rest[i]); else if (s !== rest[i]) ok = false; });
    if (!ok) continue;
    const left = rest.slice(fixed.length);
    const nextBase = base + (fixed.length ? '/' + rest.slice(0, fixed.length).join('/') : '');
    if (splat) return [{ def: d, params: p2, base: nextBase }];
    if (d.children.length) {
      const sub = matchList(d.children, left, nextBase, p2);
      if (sub) return [{ def: d, params: p2, base: nextBase }, ...sub];
      continue;
    }
    if (left.length === 0) return [{ def: d, params: p2, base: nextBase }];
  }
  return null;
}

const OutletC = createContext<ReactNode>(null);
const ParamsC = createContext<Record<string, string>>({});
const BaseC = createContext('');

export function Routes({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const base = useContext(BaseC);
  const parentParams = useContext(ParamsC);
  const defs = useMemo(() => toDefs(children), [children]);
  if (base && pathname !== base && !pathname.startsWith(base + '/')) return null;
  const rest = segs(pathname.slice(base.length));
  const hits = matchList(defs, rest, base, parentParams);
  if (!hits) return null;
  let el: ReactNode = null;
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    el = (
      <ParamsC.Provider value={h.params}>
        <BaseC.Provider value={h.base}>
          <OutletC.Provider value={el}>{h.def.element ?? <Outlet />}</OutletC.Provider>
        </BaseC.Provider>
      </ParamsC.Provider>
    );
  }
  return <>{el}</>;
}

export function Outlet() { return <>{useContext(OutletC)}</>; }
export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T { return useContext(ParamsC) as T; }

/* ───────── links ───────── */
type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };
export function Link({ to, children, ...rest }: LinkProps) {
  return <a href={`#${to.startsWith('/') ? to : '/' + to}`} {...rest}>{children}</a>;
}

export function NavLink({ to, end, className, children, ...rest }: LinkProps & { end?: boolean }) {
  const { pathname } = useLocation();
  const target = parseLocation(to).pathname;
  const active = end || target === '/' ? pathname === target : pathname === target || pathname.startsWith(target + '/');
  const cls = [typeof className === 'string' ? className : '', active ? 'active' : ''].filter(Boolean).join(' ') || undefined;
  return <Link to={to} className={cls} aria-current={active ? 'page' : undefined} {...rest}>{children}</Link>;
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  useEffect(() => { go(to, { replace }); }, [to, replace]);
  return null;
}
