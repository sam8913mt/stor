/**
 * Virtual fitting room: press the hanger on any product and the garment is put on a mannequin, so shoppers can see how it looks
 * (cut, length, colour) and combine pieces (coat + top + trousers + scarf + bag). Garments are drawn per silhouette in the chosen colour;
 * a product may also carry its own transparent "try-on" photo (products.tryon_url) which is then layered on the mannequin instead.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Product, Silhouette, Tone } from './types';
import { activeVariants, variantPrice } from './lib/api';
import { price } from './lib/format';
import { lf, LOC, tr } from './i18n';
import { useCart, useGate, useToast } from './context';
import { IconClose, IconHanger } from './components/Icons';

export type Slot = 'outer' | 'top' | 'bottom' | 'dress' | 'scarf' | 'bag';
export const SLOT_OF: Record<Silhouette, Slot> = { coat: 'outer', top: 'top', knit: 'top', trousers: 'bottom', skirt: 'bottom', dress: 'dress', scarf: 'scarf', bag: 'bag' };
const SLOT_LABEL: Record<Slot, string> = { outer: 'پالتو / کت', top: 'بالاتنه', bottom: 'پایین‌تنه', dress: 'پیراهن', scarf: 'شال / روسری', bag: 'کیف' };
const TONE_HEX: Record<Tone, string> = { ivory: '#efe6d6', sand: '#e9b9a4', taupe: '#4fa79b', stone: '#5d8d94', mocha: '#d4694b', charcoal: '#2f4a58' };

export interface Worn { product: Product; hex: string; colorName: string; size: string }
type WornMap = Partial<Record<Slot, Worn>>;
interface Ctx { worn: WornMap; open: boolean; setOpen: (v: boolean) => void; isWorn: (id: string) => boolean; toggle: (p: Product) => void; remove: (s: Slot) => void; patch: (s: Slot, w: Partial<Worn>) => void; clear: () => void; count: number }
const FitC = createContext<Ctx>({ worn: {}, open: false, setOpen: () => {}, isWorn: () => false, toggle: () => {}, remove: () => {}, patch: () => {}, clear: () => {}, count: 0 });
export const useFitting = () => useContext(FitC);

const KEY = 'aram.fitting';
const firstColor = (p: Product) => { const v = activeVariants(p).find((x) => x.stock > 0) ?? activeVariants(p)[0]; return { hex: v?.color_hex || TONE_HEX[p.tone], colorName: v?.color_name ?? '' }; };

export function FittingProvider({ children }: { children: ReactNode }) {
  const [worn, setWorn] = useState<WornMap>(() => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as WornMap; } catch { return {}; } });
  const [open, setOpen] = useState(false);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(worn)); } catch { /* storage blocked */ } }, [worn]);
  // on wide screens the page makes room for the panel (like a side dressing-room) instead of being covered
  useEffect(() => { document.body.classList.toggle('fit-open', open); return () => document.body.classList.remove('fit-open'); }, [open]);

  const toggle = useCallback((p: Product) => {
    const slot = SLOT_OF[p.silhouette] ?? 'top';
    setWorn((cur) => {
      if (cur[slot]?.product.id === p.id) { const n = { ...cur }; delete n[slot]; return n; }
      const n: WornMap = { ...cur, [slot]: { product: p, ...firstColor(p), size: '' } };
      if (slot === 'dress') { delete n.top; delete n.bottom; }          // a dress replaces top + bottom
      if (slot === 'top' || slot === 'bottom') delete n.dress;           // and top/bottom replace a dress
      return n;
    });
    setOpen(true);
  }, []);
  const remove = useCallback((s: Slot) => setWorn((cur) => { const n = { ...cur }; delete n[s]; return n; }), []);
  const patch = useCallback((s: Slot, w: Partial<Worn>) => setWorn((cur) => (cur[s] ? { ...cur, [s]: { ...cur[s]!, ...w } } : cur)), []);
  const clear = useCallback(() => setWorn({}), []);
  const isWorn = useCallback((id: string) => Object.values(worn).some((w) => w?.product.id === id), [worn]);
  const value = useMemo<Ctx>(() => ({ worn, open, setOpen, isWorn, toggle, remove, patch, clear, count: Object.keys(worn).length }), [worn, open, isWorn, toggle, remove, patch, clear]);
  return <FitC.Provider value={value}>{children}</FitC.Provider>;
}

/* ───────────── mannequin ───────────── */
const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * (amt < 0 ? v : 255 - v))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${300 - Number(x)} ${y}`);

const TRYON_BOX: Record<Slot, [number, number, number, number]> = { outer: [38, 98, 224, 392], top: [54, 100, 192, 214], bottom: [78, 282, 144, 338], dress: [48, 100, 204, 430], scarf: [98, 92, 104, 156], bag: [30, 304, 84, 112] };

function Piece({ slot, w }: { slot: Slot; w: Worn }) {
  const { hex } = w; const dark = shade(hex, -0.28); const light = shade(hex, 0.22);
  const tryon = (w.product as Product & { tryon_url?: string | null }).tryon_url;
  if (tryon) { const [x, y, wd, h] = TRYON_BOX[slot]; return <image className="fit__piece" href={tryon} x={x} y={y} width={wd} height={h} preserveAspectRatio="xMidYMid meet" />; }
  const fill = { fill: hex, stroke: dark, strokeWidth: 1.2, strokeLinejoin: 'round' as const };
  const gloss = <path d="M0 0" />;
  void gloss;
  switch (slot) {
    case 'top': {
      const long = w.product.silhouette === 'knit';
      const sleeveL = long ? 'M93 120 C76 140 64 200 58 300 L 80 304 C 86 250 96 200 106 160 Z' : 'M93 120 L 64 188 L 88 204 L 106 160 Z';
      return (
        <g className="fit__piece">
          <path d={sleeveL} {...fill} /><path d={mirror(sleeveL)} {...fill} />
          <path d="M92 118 C108 106 192 106 208 118 L 204 190 C 202 232 204 270 206 298 C 180 308 120 308 94 298 C 96 270 98 232 96 190 Z" {...fill} />
          <path d="M126 108 Q150 134 174 108" fill="none" stroke={dark} strokeWidth="2" />
          <path d="M96 290 C120 300 180 300 204 290" fill="none" stroke={dark} strokeWidth="2" opacity=".5" />
          {long ? <g stroke={dark} strokeWidth="1" opacity=".35">{[130, 150, 170].map((y) => <path key={y} d={`M100 ${y} L 200 ${y}`} />)}</g> : null}
          <path d="M104 126 C112 150 110 200 108 250" fill="none" stroke={light} strokeWidth="6" opacity=".25" strokeLinecap="round" />
        </g>
      );
    }
    case 'outer': {
      const sleeve = 'M93 118 C74 138 62 210 54 330 L 80 334 C 86 270 96 210 108 160 Z';
      return (
        <g className="fit__piece">
          <path d={sleeve} {...fill} /><path d={mirror(sleeve)} {...fill} />
          <path d="M90 116 C104 102 196 102 210 116 L 206 200 L 214 478 L 86 478 L 94 200 Z" {...fill} />
          <path d="M150 118 L 150 478" stroke={dark} strokeWidth="2" />
          <path d="M126 106 L 150 190 L 138 112 Z" fill={light} stroke={dark} strokeWidth="1.2" /><path d="M174 106 L 150 190 L 162 112 Z" fill={light} stroke={dark} strokeWidth="1.2" />
          <path d="M92 300 C120 312 180 312 208 300" fill="none" stroke={dark} strokeWidth="1.6" opacity=".6" />
          <g fill={dark} opacity=".8"><circle cx="156" cy="230" r="3.4" /><circle cx="156" cy="290" r="3.4" /><circle cx="156" cy="350" r="3.4" /></g>
          <path d="M100 130 C108 200 104 330 102 470" fill="none" stroke={light} strokeWidth="7" opacity=".22" strokeLinecap="round" />
        </g>
      );
    }
    case 'bottom': {
      if (w.product.silhouette === 'skirt') {
        return (
          <g className="fit__piece">
            <path d="M99 292 L 201 292 L 236 476 C 200 486 100 486 64 476 Z" {...fill} />
            <rect x="99" y="288" width="102" height="14" rx="3" fill={dark} opacity=".55" />
            <g stroke={dark} strokeWidth="1.1" opacity=".4">{[118, 134, 150, 166, 182].map((x, i) => <path key={x} d={`M${x} 304 L ${x + (i - 2) * 9} 480`} />)}</g>
          </g>
        );
      }
      const L = 'M98 292 L 150 292 L 152 348 L 146 606 L 114 606 L 112 440 L 98 348 Z';
      return (
        <g className="fit__piece">
          <path d={L} {...fill} /><path d={mirror(L)} {...fill} />
          <rect x="98" y="288" width="104" height="14" rx="3" fill={dark} opacity=".55" />
          <path d="M150 302 L 150 350" stroke={dark} strokeWidth="1.6" />
          <path d="M124 304 C128 400 128 520 130 600" fill="none" stroke={light} strokeWidth="6" opacity=".22" strokeLinecap="round" />
        </g>
      );
    }
    case 'dress':
      return (
        <g className="fit__piece">
          <path d="M104 120 C120 106 180 106 196 120 L 192 190 C 190 232 186 262 192 296 L 240 524 C 200 536 100 536 60 524 L 108 296 C 114 262 110 232 108 190 Z" {...fill} />
          <path d="M126 110 Q150 138 174 110" fill="none" stroke={dark} strokeWidth="2" />
          <path d="M106 262 C130 274 170 274 194 262" fill="none" stroke={dark} strokeWidth="2" opacity=".55" />
          <g stroke={dark} strokeWidth="1.1" opacity=".35">{[120, 140, 160, 180].map((x, i) => <path key={x} d={`M${x} 280 L ${x + (i - 1.5) * 14} 528`} />)}</g>
          <path d="M112 130 C118 190 116 250 112 290" fill="none" stroke={light} strokeWidth="6" opacity=".25" strokeLinecap="round" />
        </g>
      );
    case 'scarf':
      return (
        <g className="fit__piece">
          <path d="M138 126 L 164 126 L 176 250 L 146 258 Z" {...fill} />
          <path d="M116 98 C 134 122 166 122 184 98 L 192 122 C 166 148 134 148 108 122 Z" {...fill} />
          <g stroke={dark} strokeWidth="1" opacity=".4"><path d="M146 150 L 168 148" /><path d="M147 190 L 170 188" /></g>
        </g>
      );
    case 'bag':
      return (
        <g className="fit__piece">
          <path d="M60 324 C58 292 88 292 88 324" fill="none" stroke={dark} strokeWidth="4" strokeLinecap="round" />
          <path d="M42 322 L 106 322 L 100 404 C 82 410 64 410 48 404 Z" {...fill} />
          <path d="M42 336 L 106 336" stroke={dark} strokeWidth="1.2" opacity=".6" />
        </g>
      );
  }
}

const ORDER: Slot[] = ['bottom', 'dress', 'top', 'outer', 'scarf', 'bag'];

export function Mannequin({ worn }: { worn: WornMap }) {
  return (
    <svg viewBox="0 0 300 660" className="fit__svg" role="img" aria-label={tr('cFit.1', 'مانکن اتاق پرو')}>
      <defs>
        <linearGradient id="fit-body" x1="0" x2="1"><stop offset="0" stopColor="#cfc6b8" /><stop offset=".5" stopColor="#ece5d9" /><stop offset="1" stopColor="#c8bfb1" /></linearGradient>
        <radialGradient id="fit-floor" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="rgba(38,70,83,.28)" /><stop offset="1" stopColor="rgba(38,70,83,0)" /></radialGradient>
      </defs>
      <ellipse cx="150" cy="640" rx="96" ry="14" fill="url(#fit-floor)" />
      <g fill="url(#fit-body)" stroke="#b5ab9b" strokeWidth="1">
        <ellipse cx="150" cy="54" rx="25" ry="32" /><rect x="139" y="80" width="22" height="30" rx="6" />
        <path d="M96 118 C110 106 190 106 204 118 L 198 190 C 196 220 190 238 188 258 C 190 290 206 312 208 340 L 92 340 C 94 312 110 290 112 258 C 110 238 104 220 102 190 Z" />
        <path d="M96 118 C78 126 70 150 68 190 L 62 292 C 60 312 66 326 74 328 C 82 326 84 312 84 292 L 92 196 C 94 170 98 140 100 126 Z" />
        <path d="M204 118 C222 126 230 150 232 190 L 238 292 C 240 312 234 326 226 328 C 218 326 216 312 216 292 L 208 196 C 206 170 202 140 200 126 Z" />
        <path d="M106 338 L 150 338 L 146 520 C 145 560 144 590 144 612 L 112 612 C 112 590 113 560 114 520 Z" />
        <path d="M194 338 L 150 338 L 154 520 C 155 560 156 590 156 612 L 188 612 C 188 590 187 560 186 520 Z" />
        <ellipse cx="128" cy="620" rx="20" ry="8" /><ellipse cx="172" cy="620" rx="20" ry="8" />
      </g>
      {ORDER.map((s) => (worn[s] ? <Piece key={`${s}-${worn[s]!.product.id}-${worn[s]!.hex}`} slot={s} w={worn[s]!} /> : null))}
    </svg>
  );
}

/* ───────────── panel ───────────── */
export function FittingRoom() {
  const { worn, open, setOpen, remove, patch, clear, count } = useFitting();
  const cart = useCart(); const gate = useGate(); const toast = useToast();
  const entries = (Object.keys(worn) as Slot[]).map((s) => [s, worn[s]!] as const).sort((a, b) => ORDER.indexOf(b[0]) - ORDER.indexOf(a[0]));
  const total = entries.reduce((sum, [, w]) => { const v = activeVariants(w.product).find((x) => x.color_name === w.colorName && x.size === w.size); return sum + variantPrice(w.product, v); }, 0);

  const addAll = () => gate(() => {
    let added = 0;
    for (const [, w] of entries) {
      const v = activeVariants(w.product).find((x) => x.color_name === w.colorName && x.size === w.size);
      if (!v) { toast.push(tr('cFit.2', 'برای «{0}» سایز را انتخاب کنید.', [lf(w.product, 'title')]), 'err'); return; }
      if (v.stock < 1) { toast.push(tr('cFit.3', '«{0}» در این سایز موجود نیست.', [lf(w.product, 'title')]), 'err'); return; }
    }
    for (const [, w] of entries) {
      const v = activeVariants(w.product).find((x) => x.color_name === w.colorName && x.size === w.size)!;
      cart.add({ variantId: v.id, productId: w.product.id, slug: w.product.slug, title: lf(w.product, 'title'), tone: w.product.tone, silhouette: w.product.silhouette, color: v.color_name, size: v.size, price: variantPrice(w.product, v), qty: 1, sku: v.sku });
      added++;
    }
    toast.push(tr('cFit.4', '{0} محصول به سبد خرید اضافه شد.', [added.toLocaleString(LOC)]));
  });

  return (
    <>
      <button className={`fitfab${count ? ' has' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="fitting-panel">
        <IconHanger /><span>{tr('cFit.5', 'اتاق پرو')}</span>{count ? <b>{count.toLocaleString(LOC)}</b> : null}
      </button>
      {open ? (
        <aside id="fitting-panel" className="fitpanel" role="dialog" aria-label={tr('cFit.5', 'اتاق پرو')}>
          <header>
            <h2>{tr('cFit.5', 'اتاق پرو')}</h2>
            <button className="icon" onClick={() => setOpen(false)} aria-label={tr('cFit.6', 'بستن')}><IconClose /></button>
          </header>
          <p className="muted fitpanel__hint">{count ? tr('cFit.7', 'رنگ و سایز را عوض کنید و حالت پوشیدن را ببینید.') : tr('cFit.8', 'روی چوب‌لباسی هر محصول بزنید تا روی مانکن بپوشد.')}</p>
          <div className="fit__stage"><Mannequin worn={worn} /></div>
          {entries.length ? (
            <ul className="fit__list">
              {entries.map(([slot, w]) => {
                const vs = activeVariants(w.product);
                const colors = [...new Map(vs.map((v) => [v.color_name, v.color_hex] as [string, string])).entries()];
                const sizes = vs.filter((v) => v.color_name === w.colorName);
                return (
                  <li key={slot}>
                    <div className="fit__row"><Link to={`/product/${w.product.slug}`} onClick={() => setOpen(false)}><small>{SLOT_LABEL[slot]}</small><strong>{lf(w.product, 'title')}</strong></Link>
                      <button className="link link--danger" onClick={() => remove(slot)} aria-label={tr('cFit.9', 'درآوردن')}><IconClose /></button></div>
                    <div className="fit__opts">
                      <span className="swatches">{colors.map(([n, h]) => <button key={n} className={`swatch${n === w.colorName ? ' is-on' : ''}`} style={{ background: h }} title={n} aria-label={n} onClick={() => patch(slot, { colorName: n, hex: h, size: '' })} />)}</span>
                      <select className="select select--sm" value={w.size} onChange={(e) => patch(slot, { size: e.target.value })} aria-label={tr('cFit.10', 'سایز')}>
                        <option value="">{tr('cFit.10', 'سایز')}</option>{sizes.map((v) => <option key={v.id} value={v.size} disabled={v.stock === 0}>{v.size}</option>)}
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {entries.length ? (
            <footer>
              <p className="fit__total"><span>{tr('cFit.11', 'جمع این ست')}</span><strong>{price(total)}</strong></p>
              <div className="fit__actions"><button className="btn btn--sm" onClick={addAll}>{tr('cFit.12', 'افزودن همه به سبد')}</button><button className="btn btn--ghost btn--sm" onClick={clear}>{tr('cFit.13', 'پاک کردن')}</button></div>
            </footer>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
