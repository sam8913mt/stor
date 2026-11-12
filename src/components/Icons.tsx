import type { ReactNode } from 'react';

// Duotone icon set: a rounded 1.7px outline plus a soft tinted body (class "f") that fills in on hover/active (see theme.css).
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const mk = (d: ReactNode) => () => <svg {...base}>{d}</svg>;

export const IconSearch = mk(<><circle className="f" cx="11" cy="11" r="6.5" /><path d="m16.2 16.2 4.3 4.3" /><path d="M8.6 9.4a3.2 3.2 0 0 1 2.4-1.600" strokeWidth="1.300" opacity=".6" /></>);
export const IconUser = mk(<><circle className="f" cx="12" cy="8.200" r="3.900" /><path className="f" d="M4.300 20.200c.6-3.900 3.600-6.200 7.700-6.200s7.100 2.300 7.700 6.200Z" /></>);
export const IconHeart = mk(<><path className="f" d="M12 20.300S3.800 15.300 3.800 9.500A4.600 4.600 0 0 1 12 6.900a4.600 4.600 0 0 1 8.200 2.600c0 5.800-8.200 10.800-8.200 10.800Z" /><path d="M7 9.200a2.300 2.300 0 0 1 1.800-1.500" strokeWidth="1.300" opacity=".55" /></>);
export const IconBag = mk(<><path className="f" d="M5.200 8.200h13.600l1 11.600a1.200 1.200 0 0 1-1.200 1.300H5.400a1.200 1.200 0 0 1-1.200-1.300Z" /><path d="M8.600 8.200V7a3.400 3.400 0 0 1 6.800 0v1.200" /><path d="M9.200 12.600a3 3 0 0 0 5.600 0" strokeWidth="1.400" opacity=".7" /></>);
export const IconMenu = mk(<path d="M4 7.500h16M4 12h11M4 16.500h16" />);
export const IconClose = mk(<path d="m6 6 12 12M18 6 6 18" />);
export const IconPlus = mk(<path d="M12 5v14M5 12h14" />);
export const IconMinus = mk(<path d="M5 12h14" />);
export const IconCheck = mk(<path d="m5 12.500 4.500 4.500L19 7.500" />);
export const IconFilter = mk(<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4" />);
export const IconPhone = mk(<><rect className="f" x="6.500" y="2.800" width="11" height="18.400" rx="3" /><path d="M10.500 18.200h3" /></>);
export const IconLock = mk(<><rect className="f" x="5" y="10.500" width="14" height="10" rx="3" /><path d="M8.200 10.500V8a3.800 3.800 0 0 1 7.600 0v2.500" /><circle cx="12" cy="15.500" r="1.200" fill="currentColor" stroke="none" /></>);
export const IconTruck = mk(<><path className="f" d="M2.800 6.500h11v10.200h-11Z" /><path className="f" d="M13.800 10h4l3 3.200v3.500h-7Z" /><circle cx="7" cy="17.600" r="1.900" fill="var(--cream, #fff)" /><circle cx="17" cy="17.600" r="1.900" fill="var(--cream, #fff)" /></>);
export const IconShield = mk(<><path className="f" d="M12 3 4.800 5.800v5.600c0 4.400 3 8 7.200 9.600 4.200-1.600 7.200-5.200 7.200-9.600V5.800Z" /><path d="m8.800 12 2.200 2.200 4.200-4.400" /></>);
export const IconLeaf = mk(<><path className="f" d="M5 19C4 11 9 5 20 4c0 11-5 16-13 16" /><path d="M5 19c3-5 6-8 10-10" /></>);
