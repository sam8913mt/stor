/**
 * Tiny Supabase client (REST/PostgREST, GoTrue auth, Storage, Edge Functions) — zero dependencies.
 * Implements exactly the API surface this store uses; the wire protocol is Supabase's public HTTP API.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface User { id: string; email?: string; user_metadata?: Record<string, any>; [k: string]: any }
export interface Session { access_token: string; refresh_token: string; expires_at: number; expires_in?: number; token_type?: string; user: User }
export interface DbError { message: string; code?: string; details?: string; hint?: string; status?: number; context?: Response }
export interface Result { data: any; error: DbError | null; count: number | null }

const enc = encodeURIComponent;
const asMsg = (b: any, fallback: string) => (b && (b.message || b.msg || b.error_description || (typeof b.error === 'string' ? b.error : '') || b.hint)) || fallback;
async function readJson(r: Response): Promise<any> { const t = await r.text(); if (!t) return null; try { return JSON.parse(t); } catch { return t; } }
const pgValue = (v: unknown) => { const s = String(v); return /[,()"\\\s]/.test(s) ? `"${s.replace(/(["\\])/g, '\\$1')}"` : s; };

class Core {
  session: Session | null = null;
  private listeners = new Set<(event: string, s: Session | null) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refreshing: Promise<void> | null = null;
  readonly storeKey: string;
  /** false = keep the session only in this tab (sessionStorage): closing the tab signs the user out. */
  remember = true;
  constructor(readonly url: string, readonly key: string, private persist: boolean, private autoRefresh: boolean) {
    this.storeKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
    if (persist) {
      try {
        // a tab-only session (admin sign-in) wins over a remembered one
        const raw = sessionStorage.getItem(this.storeKey) ?? localStorage.getItem(this.storeKey);
        if (raw) this.session = JSON.parse(raw) as Session;
        this.remember = sessionStorage.getItem(this.storeKey) === null;
      } catch { /* ignore */ }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== this.storeKey) return;
        try { this.session = e.newValue ? (JSON.parse(e.newValue) as Session) : null; } catch { this.session = null; }
        this.emit(this.session ? 'TOKEN_REFRESHED' : 'SIGNED_OUT');
      });
    }
    this.schedule();
  }
  on(cb: (event: string, s: Session | null) => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
  private emit(event: string) { this.listeners.forEach((cb) => { try { cb(event, this.session); } catch { /* listener error */ } }); }
  setSession(s: Session | null, event: string) {
    this.session = s;
    if (this.persist) {
      try {
        const keep = this.remember ? localStorage : sessionStorage, other = this.remember ? sessionStorage : localStorage;
        if (s) { keep.setItem(this.storeKey, JSON.stringify(s)); other.removeItem(this.storeKey); }
        else { localStorage.removeItem(this.storeKey); sessionStorage.removeItem(this.storeKey); }
      } catch { /* storage blocked */ }
    }
    this.schedule(); this.emit(event);
  }
  private schedule() {
    clearTimeout(this.timer);
    if (!this.autoRefresh || !this.session) return;
    const ms = Math.max(5_000, (this.session.expires_at - 60) * 1000 - Date.now());
    this.timer = setTimeout(() => { void this.refresh(); }, Math.min(ms, 2_000_000_000));
  }
  private expired() { return !!this.session && this.session.expires_at * 1000 - Date.now() < 15_000; }
  refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    const rt = this.session?.refresh_token;
    if (!rt) return Promise.resolve();
    this.refreshing = (async () => {
      try {
        const r = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: this.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt }) });
        const b = await readJson(r);
        if (r.ok && b?.access_token) this.setSession(normalise(b), 'TOKEN_REFRESHED');
        else if (r.status === 400 || r.status === 401 || r.status === 403) this.setSession(null, 'SIGNED_OUT');   // refresh token is dead
      } catch { /* offline: keep the session, retry later */ this.schedule(); }
      finally { this.refreshing = null; }
    })();
    return this.refreshing;
  }
  async token(): Promise<string> {
    if (this.expired()) await this.refresh();
    return this.session?.access_token ?? this.key;
  }
  async headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    return { apikey: this.key, Authorization: `Bearer ${await this.token()}`, ...extra };
  }
}

function normalise(b: any): Session {
  const expires_in = Number(b.expires_in) || 3600;
  return { access_token: b.access_token, refresh_token: b.refresh_token, token_type: b.token_type ?? 'bearer', expires_in, expires_at: Number(b.expires_at) || Math.floor(Date.now() / 1000) + expires_in, user: b.user };
}

/* ───────── PostgREST query builder (thenable) ───────── */
class Query implements PromiseLike<Result> {
  private method = 'GET';
  private params: [string, string][] = [];
  private orders: string[] = [];
  private body: unknown;
  private prefer: string[] = [];
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private wantCount = false;
  private wantRows = false;
  constructor(private core: Core, private path: string, private rpcArgs?: unknown) {
    if (rpcArgs !== undefined) { this.method = 'POST'; this.body = rpcArgs; }
  }
  select(cols = '*', opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    this.params = this.params.filter(([k]) => k !== 'select');
    this.params.push(['select', cols.replace(/\s+/g, '')]);
    if (this.method !== 'GET' && this.rpcArgs === undefined) this.wantRows = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }
  insert(values: unknown) { this.method = 'POST'; this.body = values; return this; }
  upsert(values: unknown, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.method = 'POST'; this.body = values;
    this.prefer.push(`resolution=${opts?.ignoreDuplicates ? 'ignore' : 'merge'}-duplicates`);
    if (opts?.onConflict) this.params.push(['on_conflict', opts.onConflict]);
    return this;
  }
  update(values: unknown) { this.method = 'PATCH'; this.body = values; return this; }
  delete() { this.method = 'DELETE'; return this; }
  private f(col: string, op: string, v: unknown) { this.params.push([col, `${op}.${v}`]); return this; }
  eq(col: string, v: unknown) { return this.f(col, 'eq', v); }
  neq(col: string, v: unknown) { return this.f(col, 'neq', v); }
  gt(col: string, v: unknown) { return this.f(col, 'gt', v); }
  gte(col: string, v: unknown) { return this.f(col, 'gte', v); }
  lt(col: string, v: unknown) { return this.f(col, 'lt', v); }
  lte(col: string, v: unknown) { return this.f(col, 'lte', v); }
  ilike(col: string, pattern: string) { return this.f(col, 'ilike', pattern); }
  in(col: string, values: unknown[]) { this.params.push([col, `in.(${values.map(pgValue).join(',')})`]); return this; }
  or(expr: string) { this.params.push(['or', `(${expr})`]); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push(`${col}.${opts?.ascending === false ? 'desc' : 'asc'}`); return this; }
  limit(n: number) { this.params.push(['limit', String(n)]); return this; }
  range(from: number, to: number) { this.params.push(['offset', String(from)], ['limit', String(to - from + 1)]); return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  private async run(): Promise<Result> {
    const qs = [...this.params, ...(this.orders.length ? [['order', this.orders.join(',')] as [string, string]] : [])].map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&');
    const prefer = [...this.prefer];
    if (this.method !== 'GET' && this.rpcArgs === undefined) prefer.push(this.wantRows ? 'return=representation' : 'return=minimal');
    if (this.wantCount) prefer.push('count=exact');
    const h: Record<string, string> = {};
    if (this.body !== undefined) h['Content-Type'] = 'application/json';
    if (prefer.length) h.Prefer = prefer.join(',');
    if (this.mode === 'single') h.Accept = 'application/vnd.pgrst.object+json';
    try {
      const res = await fetch(`${this.core.url}/rest/v1/${this.path}${qs ? `?${qs}` : ''}`, { method: this.method, headers: await this.core.headers(h), body: this.body !== undefined ? JSON.stringify(this.body) : undefined });
      const json = await readJson(res);
      if (!res.ok) return { data: null, count: null, error: { message: asMsg(json, res.statusText || 'Request failed'), code: json?.code, details: json?.details, hint: json?.hint, status: res.status } };
      const cr = res.headers.get('content-range');
      const total = cr && /\/(\d+)$/.test(cr) ? Number(cr.split('/')[1]) : null;
      let data = json;
      if (this.mode === 'maybe') data = Array.isArray(json) ? (json[0] ?? null) : json;
      return { data, error: null, count: total };
    } catch (e) {
      return { data: null, count: null, error: { message: e instanceof Error ? e.message : 'Failed to fetch' } };
    }
  }
  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, ko?: ((r: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> { return this.run().then(ok, ko); }
}

/* ───────── client ───────── */
export function createClient(url: string, key: string, opts?: { auth?: { persistSession?: boolean; autoRefreshToken?: boolean; detectSessionInUrl?: boolean } }) {
  const core = new Core(url.replace(/\/+$/, ''), key, opts?.auth?.persistSession !== false, opts?.auth?.autoRefreshToken !== false);

  const authCall = async (path: string, body: unknown): Promise<{ ok: boolean; json: any; status: number }> => {
    const r = await fetch(`${core.url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: core.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, json: await readJson(r), status: r.status };
  };
  const authErr = (j: any, status: number) => ({ message: asMsg(j, 'Authentication failed'), status });
  const netErr = (e: unknown) => ({ message: e instanceof Error ? e.message : 'Failed to fetch' });

  const auth = {
    async getSession() {
      if (core.session && core.session.expires_at * 1000 - Date.now() < 15_000) await core.refresh();
      return { data: { session: core.session }, error: null };
    },
    onAuthStateChange(cb: (event: string, session: Session | null) => void) {
      const off = core.on(cb);
      return { data: { subscription: { unsubscribe: off } } };
    },
    async signInWithPassword(c: { email?: string; phone?: string; password: string }, o?: { remember?: boolean }) {
      core.remember = o?.remember !== false;
      try {
        const r = await authCall('token?grant_type=password', { email: c.email, phone: c.phone, password: c.password });
        if (!r.ok || !r.json?.access_token) return { data: { user: null, session: null }, error: authErr(r.json, r.status) };
        const s = normalise(r.json); core.setSession(s, 'SIGNED_IN');
        return { data: { user: s.user, session: s }, error: null };
      } catch (e) { return { data: { user: null, session: null }, error: netErr(e) }; }
    },
    async signUp(c: { email?: string; phone?: string; password: string; options?: { data?: Record<string, unknown> } }) {
      try {
        const r = await authCall('signup', { ...(c.phone ? { phone: c.phone } : { email: c.email }), password: c.password, data: c.options?.data ?? {} });
        if (!r.ok) return { data: { user: null, session: null }, error: authErr(r.json, r.status) };
        if (r.json?.access_token) { const s = normalise(r.json); core.setSession(s, 'SIGNED_IN'); return { data: { user: s.user, session: s }, error: null }; }
        return { data: { user: r.json?.user ?? r.json, session: null }, error: null };
      } catch (e) { return { data: { user: null, session: null }, error: netErr(e) }; }
    },
    /** Sends a one-time code by SMS (needs the Supabase "Send SMS" hook / provider). */
    async signInWithOtp(c: { phone: string }) {
      try {
        const r = await authCall('otp', { phone: c.phone, create_user: true });
        return r.ok ? { data: {}, error: null } : { data: {}, error: authErr(r.json, r.status) };
      } catch (e) { return { data: {}, error: netErr(e) }; }
    },
    async verifyOtp(c: { phone: string; token: string; type?: string }) {
      try {
        core.remember = true;
        const r = await authCall('verify', { type: c.type ?? 'sms', phone: c.phone, token: c.token });
        if (!r.ok || !r.json?.access_token) return { data: { user: null, session: null }, error: authErr(r.json, r.status) };
        const s = normalise(r.json); core.setSession(s, 'SIGNED_IN');
        return { data: { user: s.user, session: s }, error: null };
      } catch (e) { return { data: { user: null, session: null }, error: netErr(e) }; }
    },
    async signOut() {
      const tok = core.session?.access_token;
      core.setSession(null, 'SIGNED_OUT');
      if (tok) { try { await fetch(`${core.url}/auth/v1/logout`, { method: 'POST', headers: { apikey: core.key, Authorization: `Bearer ${tok}` } }); } catch { /* already signed out locally */ } }
      return { error: null };
    },
  };

  const storage = {
    from(bucket: string) {
      const objPath = (p: string) => p.split('/').map(enc).join('/');
      return {
        getPublicUrl: (path: string) => ({ data: { publicUrl: `${core.url}/storage/v1/object/public/${enc(bucket)}/${objPath(path)}` } }),
        async upload(path: string, file: Blob, o?: { contentType?: string; upsert?: boolean }) {
          try {
            const r = await fetch(`${core.url}/storage/v1/object/${enc(bucket)}/${objPath(path)}`, { method: 'POST', headers: await core.headers({ 'Content-Type': o?.contentType || (file as File).type || 'application/octet-stream', 'x-upsert': String(!!o?.upsert) }), body: file });
            const j = await readJson(r);
            return r.ok ? { data: { path }, error: null } : { data: null, error: { message: asMsg(j, 'Upload failed'), status: r.status } };
          } catch (e) { return { data: null, error: netErr(e) }; }
        },
        async remove(paths: string[]) {
          try {
            const r = await fetch(`${core.url}/storage/v1/object/${enc(bucket)}`, { method: 'DELETE', headers: await core.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: paths }) });
            const j = await readJson(r);
            return r.ok ? { data: j, error: null } : { data: null, error: { message: asMsg(j, 'Delete failed'), status: r.status } };
          } catch (e) { return { data: null, error: netErr(e) }; }
        },
      };
    },
  };

  const functions = {
    async invoke(name: string, o?: { body?: Record<string, unknown> }) {
      try {
        const r = await fetch(`${core.url}/functions/v1/${enc(name)}`, { method: 'POST', headers: await core.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(o?.body ?? {}) });
        if (!r.ok) return { data: null, error: { message: 'Edge Function returned a non-2xx status code', context: r } as DbError };
        return { data: await readJson(r), error: null };
      } catch (e) { return { data: null, error: netErr(e) as DbError }; }
    },
  };

  return {
    auth, storage, functions,
    from: (table: string) => new Query(core, enc(table)),
    rpc: (fn: string, args: Record<string, unknown> = {}) => new Query(core, `rpc/${enc(fn)}`, args),
  };
}
