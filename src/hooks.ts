import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> { data?: T; error?: string; loading: boolean; reload: () => void }

/** Minimal data-fetching hook: re-runs when deps change or reload() is called. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fnRef.current()
      .then((data) => { if (alive) setState({ data, loading: false }); })
      .catch((e: unknown) => { if (alive) setState({ error: e instanceof Error ? e.message : String(e), loading: false }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useTitle(title: string) {
  useEffect(() => { document.title = title; }, [title]);
}

/** Dialog behaviour: Escape closes, Tab stays inside, focus moves in on open and returns on close, page scroll locks. */
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    (node?.querySelector<HTMLElement>(sel) ?? node)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(sel)];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, []);
  return ref;
}

export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}


/** Per-page SEO: meta description, Open Graph tags and optional JSON-LD (e.g. schema.org Product). */
export function useSeo(o: { description?: string; image?: string; jsonLd?: Record<string, unknown> | null }) {
  const json = o.jsonLd ? JSON.stringify(o.jsonLd) : '';
  useEffect(() => {
    const meta = (attr: 'name' | 'property', key: string, content?: string) => {
      if (!content) return;
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    const desc = o.description?.replace(/\s+/g, ' ').trim().slice(0, 300);
    meta('name', 'description', desc);
    meta('property', 'og:title', document.title);
    meta('property', 'og:description', desc);
    meta('property', 'og:image', o.image);
    meta('property', 'og:type', json ? 'product' : 'website');
    let ld = document.getElementById('ld-json');
    if (json) { if (!ld) { ld = document.createElement('script'); ld.id = 'ld-json'; ld.setAttribute('type', 'application/ld+json'); document.head.appendChild(ld); } ld.textContent = json; }
    else ld?.remove();
    return () => { document.getElementById('ld-json')?.remove(); };
  }, [o.description, o.image, json]);
}
