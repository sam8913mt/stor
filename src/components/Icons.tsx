import type { ReactNode } from 'react';

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const mk = (d: ReactNode) => () => <svg {...base}>{d}</svg>;

export const IconSearch = mk(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>);
export const IconUser = mk(<><circle cx="12" cy="8" r="4" /><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.700 2 7.500 6" /></>);
export const IconHeart = mk(<path d="M12 20s-7.500-4.600-7.500-10.200A4.300 4.300 0 0 1 12 7.300a4.300 4.300 0 0 1 7.500 2.500C19.500 15.400 12 20 12 20Z" />);
export const IconBag = mk(<><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6.500a3 3 0 0 1 6 0V8" /></>);
export const IconMenu = mk(<path d="M4 8h16M4 16h16" />);
export const IconClose = mk(<path d="m6 6 12 12M18 6 6 18" />);
export const IconPlus = mk(<path d="M12 5v14M5 12h14" />);
export const IconMinus = mk(<path d="M5 12h14" />);
export const IconCheck = mk(<path d="m5 12.500 4.500 4.500L19 7.500" />);
export const IconFilter = mk(<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4" />);
