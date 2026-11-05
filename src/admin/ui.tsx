import type { ReactNode } from 'react';
import { useAuth } from '../context';
import { useDialog } from '../hooks';
import { IconClose } from '../components/Icons';
import { tr } from '../i18n';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useDialog(onClose);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal__scrim" onClick={onClose} />
      <div className={`modal__box${wide ? ' modal__box--wide' : ''}`} ref={ref} tabIndex={-1}>
        <div className="modal__top"><h2 className="h3">{title}</h2><button className="icon" aria-label={tr('aui.1', 'بستن')} onClick={onClose}><IconClose /></button></div>
        {children}
      </div>
    </div>
  );
}

/** Hides children unless the signed-in admin has the permission. UI only — RLS is the real enforcement. */
export function Can({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  return can(perm) ? <>{children}</> : <p className="state">{tr('aui.2', 'دسترسی به این بخش برای نقش شما فعال نیست.')}</p>;
}

export const PageHead = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="ahead"><h1 className="h2">{title}</h1><div className="ahead__tools">{children}</div></div>
);

export const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
