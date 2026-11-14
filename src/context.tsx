import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isConfigured } from './lib/supabase';
import { errorFa } from './lib/format';
import { latinDigits, normalizePhone } from './lib/phone';
import { useLocation, useNavigate } from 'react-router-dom';
import { LANG, tr } from './i18n';
import type { CartLine, Profile } from './types';

/* ───────────── Toast ───────────── */
interface ToastCtx { push: (msg: string, kind?: 'ok' | 'err') => void }
const ToastC = createContext<ToastCtx>({ push: () => {} });
export const useToast = () => useContext(ToastC);

function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: 'ok' | 'err' }[]>([]);
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastC.Provider value={{ push }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast toast--${t.kind}`}>{t.msg}</div>)}
      </div>
    </ToastC.Provider>
  );
}

/* ───────────── Auth ───────────── */
interface AuthCtx {
  user: User | null; session: Session | null; profile: Profile | null; perms: string[]; ready: boolean; permsLoaded: boolean;
  isAdmin: boolean; can: (p: string) => boolean;
  /** identifier = phone number (or an email, for accounts created by email) */
  signIn: (identifier: string, password: string, opts?: { remember?: boolean }) => Promise<string | null>;
  signUp: (phone: string, password: string, data: SignupData, address?: SignupAddress | null) => Promise<string | null>;
  changePassword: (password: string) => Promise<string | null>;
  sendOtp: (phone: string) => Promise<string | null>;
  verifyOtp: (phone: string, code: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
const AuthC = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(AuthC);

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [ready, setReady] = useState(!isConfigured);
  const [permsLoaded, setPermsLoaded] = useState(false);
  const uid = session?.user.id;

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => { /* offline or storage blocked: continue as a guest */ })
      .finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async (id: string) => {
    try {
      const [p, perm] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
        supabase.rpc('my_permissions'),
      ]);
      setProfile((p.data as Profile) ?? null);
      setPerms(Array.isArray(perm.data) ? (perm.data as string[]) : []);
    } catch { /* network failure: treat as no admin rights; the user can reload */ } finally { setPermsLoaded(true); }
  }, []);

  useEffect(() => {
    if (!uid) { setProfile(null); setPerms([]); setPermsLoaded(false); return; }
    setPermsLoaded(false);
    void load(uid);
  }, [uid, load]);

  const value = useMemo<AuthCtx>(() => ({
    user: session?.user ?? null, session, profile, perms, ready, permsLoaded,
    isAdmin: perms.length > 0,
    can: (p) => perms.includes('*') || perms.includes(p),
    signIn: async (identifier, password, opts) => {
      const id = identifier.trim();
      if (id.includes('@')) { const { error } = await supabase.auth.signInWithPassword({ email: id, password }, opts); return error ? errorFa(error.message) : null; }
      const phone = normalizePhone(id);
      if (!phone) return 'شماره موبایل معتبر نیست. نمونه: 09121234567';
      const { error } = await supabase.auth.signInWithPassword({ phone, password });
      return error ? errorFa(error.message) : null;
    },
    sendOtp: async (phoneInput) => {
      const phone = normalizePhone(phoneInput);
      if (!phone) return 'شماره موبایل معتبر نیست. نمونه: 09121234567';
      const { error } = await supabase.auth.signInWithOtp({ phone });
      return error ? errorFa(error.message) : null;
    },
    verifyOtp: async (phoneInput, code) => {
      const phone = normalizePhone(phoneInput);
      if (!phone) return 'شماره موبایل معتبر نیست.';
      const { error } = await supabase.auth.verifyOtp({ phone, token: latinDigits(code).replace(/\D/g, ''), type: 'sms' });
      return error ? errorFa(error.message) : null;
    },
    signUp: async (phoneInput, password, d, addr) => {
      const phone = normalizePhone(phoneInput);
      if (!phone) return 'شماره موبایل معتبر نیست. نمونه: 09121234567';
      const { data, error } = await supabase.auth.signUp({ phone, password, options: { data: { ...d, full_name: `${d.first_name} ${d.last_name}`.trim() } } });
      if (error) return errorFa(error.message);
      if (!data.session) return 'CONFIRM_PHONE';
      if (addr) {   // first delivery address, saved as default (best effort: the account exists either way)
        await supabase.from('addresses').insert({ user_id: data.session.user.id, label: 'خانه', full_name: `${d.first_name} ${d.last_name}`.trim(), phone: phone.replace(/^\+98/, '0'), province: addr.province, city: addr.city, address: addr.address, postal_code: addr.postal_code || null, is_default: true });
      }
      return null;
    },
    changePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      return error ? errorFa(error.message) : null;
    },
    signOut: async () => { await supabase.auth.signOut(); },
    refreshProfile: async () => { if (uid) await load(uid); },
  }), [session, profile, perms, ready, permsLoaded, uid, load]);

  return <AuthC.Provider value={value}>{children}</AuthC.Provider>;
}

/* ───────────── Cart (localStorage; prices re-validated server-side at checkout) ───────────── */
interface CartCtx {
  lines: CartLine[]; count: number; subtotal: number;
  add: (l: CartLine) => void; setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void; clear: () => void;
}
const CartC = createContext<CartCtx>(null as unknown as CartCtx);
export const useCart = () => useContext(CartC);
const CART_KEY = 'aram.cart.v1';

function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try { const raw = localStorage.getItem(CART_KEY); return raw ? (JSON.parse(raw) as CartLine[]) : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(lines)); } catch { /* storage unavailable */ } }, [lines]);
  const value = useMemo<CartCtx>(() => ({
    lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    subtotal: lines.reduce((s, l) => s + l.qty * l.price, 0),
    add: (l) => { setTimeout(() => window.dispatchEvent(new Event('aram:cart-added')), 0); setLines((cur) => {
      const hit = cur.find((x) => x.variantId === l.variantId);
      return hit ? cur.map((x) => x.variantId === l.variantId ? { ...x, qty: Math.min(10, x.qty + l.qty), price: l.price } : x) : [...cur, l];
    }); },
    setQty: (id, qty) => setLines((cur) => cur.map((x) => x.variantId === id ? { ...x, qty: Math.max(1, Math.min(10, qty)) } : x)),
    remove: (id) => setLines((cur) => cur.filter((x) => x.variantId !== id)),
    clear: () => setLines([]),
  }), [lines]);
  return <CartC.Provider value={value}>{children}</CartC.Provider>;
}

/* ───────────── Wishlist (guest: localStorage; signed-in: DB, guest items merged on login) ───────────── */
interface WishCtx { ids: string[]; has: (id: string) => boolean; toggle: (id: string) => Promise<void> }
const WishC = createContext<WishCtx>(null as unknown as WishCtx);
export const useWishlist = () => useContext(WishC);
const WISH_KEY = 'aram.wishlist.v1';

function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id;
  const [ids, setIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(WISH_KEY) ?? '[]') as string[]; } catch { return []; }
  });
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    if (!uid) { try { setIds(JSON.parse(localStorage.getItem(WISH_KEY) ?? '[]') as string[]); } catch { setIds([]); } return; }
    (async () => {
      const guest = idsRef.current;
      if (guest.length) {
        await supabase.from('wishlist_items').upsert(guest.map((product_id) => ({ user_id: uid, product_id })), { onConflict: 'user_id,product_id', ignoreDuplicates: true });
        try { localStorage.removeItem(WISH_KEY); } catch { /* ignore */ }
      }
      const { data } = await supabase.from('wishlist_items').select('product_id').eq('user_id', uid);
      setIds((data ?? []).map((r: { product_id: string }) => r.product_id));
    })();
  }, [uid]);

  const toggle = useCallback(async (id: string) => {
    const prev = idsRef.current;
    const has = prev.includes(id);
    const next = has ? idsRef.current.filter((x) => x !== id) : [...idsRef.current, id];
    setIds(next);
    if (uid) {
      const res = has
        ? await supabase.from('wishlist_items').delete().eq('user_id', uid).eq('product_id', id)
        : await supabase.from('wishlist_items').insert({ user_id: uid, product_id: id });
      if (res.error) setIds(prev);
    } else {
      try { localStorage.setItem(WISH_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
  }, [uid]);

  const value = useMemo<WishCtx>(() => ({ ids, has: (id) => ids.includes(id), toggle }), [ids, toggle]);
  return <WishC.Provider value={value}>{children}</WishC.Provider>;
}

export interface SignupData { first_name: string; last_name: string; national_id?: string; birth_date?: string; gender?: string; marketing_sms_optin: boolean; accepted_terms: boolean }
export interface SignupAddress { province: string; city: string; address: string; postal_code?: string }

/* ───────────── Public settings ───────────── */
export interface StoreSettings {
  store_name: string; tagline: string; announcement: string; shipping_fee: number; free_shipping_threshold: number;
  contact_email: string; contact_phone: string; instagram: string; bank_card_info: string;
  hero_title: string; hero_subtitle: string; hero_cta_label: string; hero_cta_link: string; statement: string;
  /** true once an SMS gateway is connected and the Supabase "Send SMS" hook is on: the login page then offers one-time codes */
  sms_otp_enabled: boolean;
  /** optional size table, one row per line: S|86|68|94 */
  size_guide: string;
}
const DEFAULTS: StoreSettings = {
  store_name: tr('context.1', 'آرام'), tagline: '', announcement: '', shipping_fee: 0, free_shipping_threshold: 0,
  contact_email: '', contact_phone: '', instagram: '', bank_card_info: '',
  hero_title: tr('context.2', 'سکوت، زیباترین لباس است'), hero_subtitle: '', hero_cta_label: tr('context.3', 'مشاهده محصولات'), hero_cta_link: '/shop', statement: '', sms_otp_enabled: false, size_guide: '',
};
const SettingsC = createContext<{ s: StoreSettings; reload: () => void }>({ s: DEFAULTS, reload: () => {} });
export const useSettings = () => useContext(SettingsC);

function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<StoreSettings>(DEFAULTS);
  const [tick, setTick] = useState(0);
  const { user } = useAuth();
  const settingsUid = user?.id;
  useEffect(() => {
    if (!isConfigured) return;
    supabase.from('settings').select('key,value').then(({ data }) => {
      if (!Array.isArray(data)) return;
      const next: Record<string, unknown> = { ...DEFAULTS };
      for (const r of data as { key: string; value: unknown }[]) next[r.key] = r.value;
      if (LANG === 'en') {
        for (const k of Object.keys(next)) {
          const en = next[`${k}_en`];
          if (!k.endsWith('_en') && typeof en === 'string' && en.trim() && typeof next[k] === 'string') next[k] = en;
        }
      }
      setS(next as unknown as StoreSettings);
    });
  }, [tick, settingsUid]); // re-read after login: signed-in shoppers can also see bank-transfer details
  const value = useMemo(() => ({ s, reload: () => setTick((t) => t + 1) }), [s]);
  return <SettingsC.Provider value={value}>{children}</SettingsC.Provider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider><AuthProvider><SettingsProvider><CartProvider><WishlistProvider>{children}</WishlistProvider></CartProvider></SettingsProvider></AuthProvider></ToastProvider>
  );
}


/** Wrap actions that need an account (add to cart, wishlist): guests are sent to the sign-in page and come back afterwards. */
export function useGate() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { push } = useToast();
  return useCallback((action: () => void) => {
    if (user) { action(); return; }
    push(tr('cGate.1', 'برای ادامه ابتدا وارد حساب خود شوید.'));
    nav(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`);
  }, [user, nav, loc.pathname, loc.search, push]);
}
