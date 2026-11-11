import { useState, type FormEvent } from 'react';
import { q, invalidateCatalog } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAsync } from '../hooks';
import { useToast } from '../context';
import { errorFa, slugify } from '../lib/format';
import { ErrorBox, Loading } from '../components/ui';
import { Modal, PageHead, fromLocalInput, toLocalInput } from './ui';
import { tr, LOC } from '../i18n';

export interface FieldDef {
  key: string; label: string;
  type?: 'text' | 'number' | 'textarea' | 'checkbox' | 'select' | 'datetime';
  options?: { value: string; label: string }[];
  required?: boolean; ltr?: boolean; lockOnEdit?: boolean; hideInTable?: boolean; def?: unknown; help?: string; upper?: boolean;
}
type Row = Record<string, unknown>;

interface Props { title: string; table: string; fields: FieldDef[]; orderBy: string; ascending?: boolean; slugFrom?: string; touchesCatalog?: boolean; idKey?: string; canCreate?: boolean; canDelete?: boolean; intro?: string }

/** Generic list + create/edit/delete screen for simple tables. All writes go through RLS. */
export function CrudPage({ title, table, fields, orderBy, ascending = true, slugFrom, touchesCatalog, idKey = 'id', canCreate = true, canDelete = true, intro }: Props) {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => q<Row[]>(supabase.from(table).select('*').order(orderBy, { ascending })), [table]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = (row?: Row) => {
    setIsNew(!row);
    setEdit(row ? { ...row } : Object.fromEntries(fields.map((f) => [f.key, f.def ?? (f.type === 'checkbox' ? false : f.type === 'number' ? null : '')])));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const payload: Row = {};
    for (const f of fields) {
      let v = edit[f.key];
      if (f.type === 'number') v = v === '' || v == null ? null : Number(v);
      if (f.type === 'datetime') v = typeof v === 'string' ? fromLocalInput(v) : v;
      if (f.upper && typeof v === 'string') v = v.trim().toUpperCase();
      if (typeof v === 'string' && !f.required && v === '' && f.type !== 'text' && f.type !== 'textarea') v = null;
      payload[f.key] = v;
    }
    if (slugFrom && !payload.slug) payload.slug = slugify(String(edit[slugFrom] ?? ''));
    setBusy(true);
    try {
      if (isNew) await q(supabase.from(table).insert(payload));
      else await q(supabase.from(table).update(payload).eq(idKey, edit[idKey] as string));
      if (touchesCatalog) invalidateCatalog();
      toast.push(isNew ? tr('aCrud.1', 'ایجاد شد.') : tr('aCrud.2', 'ذخیره شد.')); setEdit(null); reload();
    } catch (err) { toast.push(errorFa((err as Error).message), 'err'); } finally { setBusy(false); }
  };

  const del = async (row: Row) => {
    if (!window.confirm(tr('aCrud.3', 'این مورد حذف شود؟ این کار قابل بازگشت نیست.'))) return;
    try { await q(supabase.from(table).delete().eq(idKey, row[idKey] as string)); if (touchesCatalog) invalidateCatalog(); toast.push(tr('aCrud.4', 'حذف شد.')); reload(); }
    catch (err) { toast.push(errorFa((err as Error).message), 'err'); }
  };

  const cols = fields.filter((f) => !f.hideInTable);
  const show = (f: FieldDef, v: unknown) => {
    if (f.type === 'checkbox') return v ? tr('aCrud.5', 'بله') : '—';
    if (f.type === 'select') return f.options?.find((o) => o.value === v)?.label ?? String(v ?? '');
    if (f.type === 'datetime') return v ? new Date(String(v)).toLocaleString(LOC) : '—';
    if (f.type === 'number' && v != null) return Number(v).toLocaleString(LOC);
    return v == null || v === '' ? '—' : String(v);
  };

  return (
    <>
      <PageHead title={title}>{canCreate ? <button className="btn btn--sm" onClick={() => open()}>{tr('aCrud.6', 'افزودن')}</button> : null}</PageHead>
      {intro ? <p className="note">{intro}</p> : null}
      {loading ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : (
        <div className="tablewrap">
          <table className="table">
            <thead><tr>{cols.map((f) => <th key={f.key}>{f.label}</th>)}<th /></tr></thead>
            <tbody>
              {data?.map((row) => (
                <tr key={String(row[idKey])}>
                  {cols.map((f) => <td key={f.key} dir={f.ltr ? 'ltr' : undefined}>{show(f, row[f.key])}</td>)}
                  <td className="actions"><button className="link" onClick={() => open(row)}>{tr('aCrud.7', 'ویرایش')}</button>{canDelete ? <button className="link link--danger" onClick={() => void del(row)}>{tr('aCrud.8', 'حذف')}</button> : null}</td>
                </tr>
              ))}
              {!data?.length ? <tr><td colSpan={cols.length + 1} className="muted">{tr('aCrud.9', 'موردی ثبت نشده است.')}</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
      {edit ? (
        <Modal title={isNew ? tr('aCrud.10', '{0} — جدید', [title]) : tr('aCrud.11', '{0} — ویرایش', [title])} onClose={() => setEdit(null)}>
          <form className="form" onSubmit={save}>
            {fields.map((f) => (
              <label key={f.key} className={f.type === 'checkbox' ? 'chk' : undefined}>
                {f.type === 'checkbox' ? null : f.label}
                {f.type === 'textarea' ? <textarea className="textarea" rows={6} required={f.required} disabled={!isNew && !!f.lockOnEdit} value={String(edit[f.key] ?? '')} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
                  : f.type === 'select' ? <select className="select" required={f.required} disabled={!isNew && !!f.lockOnEdit} value={String(edit[f.key] ?? '')} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                  : f.type === 'checkbox' ? <><input type="checkbox" checked={Boolean(edit[f.key])} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.checked })} /> {f.label}</>
                  : f.type === 'datetime' ? <input className="input" type="datetime-local" dir="ltr" value={toLocalInput(edit[f.key] as string | null)} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
                  : <input className="input" type={f.type === 'number' ? 'number' : 'text'} dir={f.ltr || f.type === 'number' ? 'ltr' : undefined} required={f.required} disabled={!isNew && !!f.lockOnEdit} value={String(edit[f.key] ?? '')} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />}
                {f.help ? <small className="muted">{f.help}</small> : null}
              </label>
            ))}
            <div className="form__actions"><button className="btn btn--sm" disabled={busy}>{busy ? tr('aCrud.12', 'در حال ذخیره…') : tr('aCrud.13', 'ذخیره')}</button><button type="button" className="btn btn--ghost btn--sm" onClick={() => setEdit(null)}>{tr('aCrud.14', 'انصراف')}</button></div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
