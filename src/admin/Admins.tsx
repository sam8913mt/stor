import { useState, type FormEvent } from 'react';
import { q } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAsync } from '../hooks';
import { useAuth, useToast } from '../context';
import { errorFa } from '../lib/format';
import { ErrorBox, Loading } from '../components/ui';
import { Can, Modal, PageHead } from './ui';
import { tr } from '../i18n';

export const PERMS: Record<string, string> = {
  'products.manage': tr('aAdmins.1', 'محصولات و موجودی'), 'catalog.manage': tr('aAdmins.2', 'دسته‌بندی و مجموعه'), 'orders.manage': tr('aAdmins.3', 'سفارش‌ها'), 'customers.manage': tr('aAdmins.4', 'مشتریان'),
  'marketing.manage': tr('aAdmins.5', 'کوپن‌ها'), 'reviews.manage': tr('aAdmins.6', 'نظرات'), 'cms.manage': tr('aAdmins.7', 'محتوا'), 'settings.manage': tr('aAdmins.8', 'تنظیمات'), 'analytics.view': tr('aAdmins.9', 'آمار'), 'logs.view': tr('aAdmins.10', 'گزارش فعالیت‌ها'), 'admins.manage': tr('aAdmins.11', 'مدیران و نقش‌ها'),
};
interface Role { id: string; name: string; label_fa: string; permissions: string[] }
interface AdminRow { user_id: string; role_id: string; profile?: { email: string | null; full_name: string | null } | null; role?: { label_fa: string } | null }

export default function Admins() {
  const toast = useToast();
  const { user } = useAuth();
  const roles = useAsync(() => q<Role[]>(supabase.from('admin_roles').select('*').order('name')), []);
  const admins = useAsync(() => q<AdminRow[]>(supabase.from('admin_users').select('user_id, role_id, profile:profiles(email,full_name), role:admin_roles(label_fa)')), []);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [edit, setEdit] = useState<Role | null>(null);

  const grant = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const found = await q<{ id: string }[]>(supabase.from('profiles').select('id').ilike('email', email.trim().replace(/[\\%_]/g, (c) => `\\${c}`)));
      if (!found.length) { toast.push(tr('aAdmins.12', 'کاربری با این ایمیل ثبت‌نام نکرده است. ابتدا باید در فروشگاه ثبت‌نام کند.'), 'err'); return; }
      await q(supabase.from('admin_users').upsert({ user_id: found[0].id, role_id: roleId || roles.data?.[0]?.id }, { onConflict: 'user_id' }));
      toast.push(tr('aAdmins.13', 'دسترسی ثبت شد.')); setEmail(''); admins.reload();
    } catch (err) { toast.push(errorFa((err as Error).message), 'err'); }
  };
  const revoke = async (id: string) => {
    if (id === user?.id) { toast.push(tr('aAdmins.14', 'نمی‌توانید دسترسی خودتان را حذف کنید.'), 'err'); return; }
    if (!window.confirm(tr('aAdmins.15', 'دسترسی این مدیر حذف شود؟'))) return;
    try { await q(supabase.from('admin_users').delete().eq('user_id', id)); admins.reload(); } catch (err) { toast.push(errorFa((err as Error).message), 'err'); }
  };
  const saveRole = async () => {
    if (!edit) return;
    try { await q(supabase.from('admin_roles').update({ label_fa: edit.label_fa, permissions: edit.permissions }).eq('id', edit.id)); toast.push(tr('aAdmins.16', 'نقش ذخیره شد.')); setEdit(null); roles.reload(); }
    catch (err) { toast.push(errorFa((err as Error).message), 'err'); }
  };

  return (
    <Can perm="admins.manage">
      <PageHead title={tr('aAdmins.17', 'مدیران و نقش‌ها')} />
      {admins.loading || roles.loading ? <Loading /> : admins.error || roles.error ? <ErrorBox error={(admins.error ?? roles.error) as string} /> : (
        <>
          <div className="tablewrap"><table className="table">
            <thead><tr><th>{tr('aAdmins.18', 'مدیر')}</th><th>{tr('aAdmins.19', 'ایمیل')}</th><th>{tr('aAdmins.20', 'نقش')}</th><th /></tr></thead>
            <tbody>{admins.data?.map((a) => <tr key={a.user_id}><td>{a.profile?.full_name || '—'}</td><td dir="ltr">{a.profile?.email}</td><td>{a.role?.label_fa}</td><td className="actions"><button className="link link--danger" onClick={() => void revoke(a.user_id)}>{tr('aAdmins.21', 'حذف دسترسی')}</button></td></tr>)}</tbody>
          </table></div>
          <form className="panel form form--inline" onSubmit={grant}>
            <h2 className="h4">{tr('aAdmins.22', 'افزودن مدیر')}</h2>
            <input className="input" type="email" required dir="ltr" placeholder={tr('aAdmins.23', 'ایمیل کاربر ثبت‌نام‌شده')} value={email} onChange={(e) => setEmail(e.target.value)} aria-label={tr('aAdmins.24', 'ایمیل')} />
            <select className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)} aria-label={tr('aAdmins.25', 'نقش')}>{roles.data?.map((r) => <option key={r.id} value={r.id}>{r.label_fa}</option>)}</select>
            <button className="btn btn--sm">{tr('aAdmins.26', 'افزودن')}</button>
          </form>
          <h2 className="h3">{tr('aAdmins.27', 'نقش‌ها و مجوزها')}</h2>
          <div className="tablewrap"><table className="table">
            <thead><tr><th>{tr('aAdmins.28', 'نقش')}</th><th>{tr('aAdmins.29', 'مجوزها')}</th><th /></tr></thead>
            <tbody>{roles.data?.map((r) => <tr key={r.id}><td>{r.label_fa}</td><td>{r.permissions.includes('*') ? tr('aAdmins.30', 'دسترسی کامل') : r.permissions.map((p) => PERMS[p] ?? p).join('، ')}</td>
              <td className="actions">{r.permissions.includes('*') ? null : <button className="link" onClick={() => setEdit({ ...r })}>{tr('aAdmins.31', 'ویرایش')}</button>}</td></tr>)}</tbody>
          </table></div>
        </>
      )}
      {edit ? (
        <Modal title={tr('aAdmins.32', 'نقش «{0}»', [edit.label_fa])} onClose={() => setEdit(null)}>
          <div className="form">
            <label>{tr('aAdmins.33', 'عنوان')}<input className="input" value={edit.label_fa} onChange={(e) => setEdit({ ...edit, label_fa: e.target.value })} /></label>
            {Object.entries(PERMS).map(([k, v]) => (
              <label key={k} className="chk"><input type="checkbox" checked={edit.permissions.includes(k)} onChange={(e) => setEdit({ ...edit, permissions: e.target.checked ? [...edit.permissions, k] : edit.permissions.filter((x) => x !== k) })} /> {v}</label>
            ))}
            <div className="form__actions"><button className="btn btn--sm" onClick={() => void saveRole()}>{tr('aAdmins.34', 'ذخیره')}</button><button className="btn btn--ghost btn--sm" onClick={() => setEdit(null)}>{tr('aAdmins.35', 'انصراف')}</button></div>
          </div>
        </Modal>
      ) : null}
    </Can>
  );
}
