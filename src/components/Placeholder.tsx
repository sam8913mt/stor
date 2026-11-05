import type { Silhouette, Tone } from '../types';
import { tr } from '../i18n';

// Line-art garment silhouettes (viewBox 0 0 100 130). Pure vector — no photographs needed.
const PATHS: Record<Silhouette, string> = {
  coat: 'M38 12 50 20 62 12 86 26 90 72 78 74 76 120H24L22 74 10 72 14 26ZM50 20v100',
  top: 'M36 14Q50 24 64 14L88 30 80 52 70 46V112H30V46L20 52 12 30Z',
  knit: 'M36 14Q50 24 64 14L88 30 80 52 70 46V112H30V46L20 52 12 30ZM30 104h40M30 98h40',
  trousers: 'M30 14h40l6 104H56L50 48l-6 70H24Z',
  skirt: 'M38 14h24l20 104H18ZM38 14Q50 22 62 14M44 24 38 118M56 24l6 94',
  dress: 'M40 12 44 26 36 62 22 120H78L64 62 56 26 60 12Q50 22 40 12ZM36 62h28',
  bag: 'M26 52h48l6 60H20ZM36 52V40Q50 22 64 40V52M26 66h48',
  scarf: 'M40 10h20l2 110H38ZM38 98h24M38 106h24M38 114h24',
};

interface Props { tone: Tone; silhouette: Silhouette; label?: string; view?: number }

/** CSS/SVG product stand-in. `view` (0-3) changes crop so a gallery feels like multiple shots. */
export function Placeholder({ tone, silhouette, label, view = 0 }: Props) {
  return (
    <div className={`ph ph--${tone}`} data-v={view} role="img" aria-label={label ?? tr('cPlaceholder.1', 'تصویر محصول')}>
      <svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path d={PATHS[silhouette]} vectorEffect="non-scaling-stroke" />
      </svg>
      {label ? <span className="ph__label" aria-hidden="true">{label}</span> : null}
    </div>
  );
}
