import { useEffect, useState, type FormEvent } from 'react';
import { q } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAsync } from '../hooks';
import { useSettings, useToast } from '../context';
import { errorFa } from '../lib/format';
import { ErrorBox, Loading } from '../components/ui';
import { Can, PageHead } from './ui';
import { tr } from '../i18n';

export interface SettingField {
  key: string; label: string; type?: 'text' | 'number' | 'textarea' | 'bool' | 'select';
  ltr?: boolean; help?: string; options?: { value: string; label: string }[];
  /** private → stored with is_public=false (never readable by visitors). */
  private?: boolean;
}

/** Edits rows of the key/value `settings` table (jsonb: string, number or boolean). */
export function SettingsForm({ fields }: { fields: SettingField[] }) {
  const toast = useToast();
  const { reload: reloadPublic } = useSettings();
  const { data, error, loading, reload } = useAsync(() => q<{ key: string; value: unknown }[]>(supabase.from('settings').select('key,value')), []);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    const m: Record<string, string> = {};
    for (const f of fields) { const row = data.find((r) => r.key === f.key); m[f.key] = row ? String(row.value ?? '') : f.type === 'select' ? (f.options?.[0]?.value ?? '') : ''; }
    setVals(m);
  }, [data]);

  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const rows = fields.map((f) => ({
        key: f.key, is_public: !f.private,
        value: f.type === 'number' ? Number(vals[f.key] || 0) : f.type === 'bool' ? vals[f.key] === 'true' : vals[f.key] ?? '',
      }));
      await q(supabase.from('settings').upsert(rows, { onConflict: 'key' }));
      toast.push(tr('aSettingsForm.1', 'ذخیره شد.')); reload(); reloadPublic();
    } catch (err) { toast.push(errorFa((err as Error).message), 'err'); } finally { setBusy(false); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const set = (k: string) => (e: { target: { value: string } }) => setVals({ ...vals, [k]: e.target.value });
  return (
    <form className="form form--narrow" onSubmit={save}>
      {fields.map((f) => (
        <label key={f.key} className={f.type === 'bool' ? 'chk' : undefined}>
          {f.type === 'bool'
            ? <><input type="checkbox" checked={vals[f.key] === 'true'} onChange={(e) => setVals({ ...vals, [f.key]: String(e.target.checked) })} /> {f.label}</>
            : <>{f.label}
              {f.type === 'textarea' ? <textarea className="textarea" rows={3} dir={f.ltr ? 'ltr' : undefined} value={vals[f.key] ?? ''} onChange={set(f.key)} />
                : f.type === 'select' ? <select className="select" value={vals[f.key] ?? ''} onChange={set(f.key)}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                : <input className="input" type={f.type === 'number' ? 'number' : 'text'} dir={f.ltr || f.type === 'number' ? 'ltr' : undefined} value={vals[f.key] ?? ''} onChange={set(f.key)} />}</>}
          {f.help ? <small className="muted">{f.help}</small> : null}
        </label>
      ))}
      <div className="form__actions"><button className="btn btn--sm" disabled={busy}>{busy ? tr('aSettingsForm.2', 'در حال ذخیره…') : tr('aSettingsForm.3', 'ذخیره تغییرات')}</button></div>
    </form>
  );
}

const STORE: SettingField[] = [
  { key: 'store_name', label: tr('aSettingsForm.4', 'نام فروشگاه') },
  { key: 'tagline', label: tr('aSettingsForm.5', 'شعار کوتاه') },
  { key: 'tagline_en', label: tr('aSettingsForm.6', 'شعار کوتاه (انگلیسی)'), ltr: true },
  { key: 'announcement', label: tr('aSettingsForm.7', 'نوار اعلان بالای سایت'), help: tr('aSettingsForm.8', 'خالی = مخفی') },
  { key: 'announcement_en', label: tr('aSettingsForm.9', 'نوار اعلان (انگلیسی)'), ltr: true },
  { key: 'shipping_fee', label: tr('aSettingsForm.10', 'هزینه ارسال (تومان)'), type: 'number' },
  { key: 'free_shipping_threshold', label: tr('aSettingsForm.11', 'ارسال رایگان از مبلغ (تومان)'), type: 'number', help: tr('aSettingsForm.12', '۰ = غیرفعال') },
  { key: 'bank_card_info', label: tr('aSettingsForm.13', 'اطلاعات کارت/حساب برای پرداخت بانکی'), type: 'textarea', private: true, help: tr('aSettingsForm.14', 'فقط برای کاربران واردشده در مرحله‌ی پرداخت نمایش داده می‌شود.') },
  { key: 'contact_phone', label: tr('aSettingsForm.15', 'تلفن تماس'), ltr: true },
  { key: 'contact_email', label: tr('aSettingsForm.16', 'ایمیل تماس'), ltr: true },
  { key: 'instagram', label: tr('aSettingsForm.17', 'اینستاگرام (نام کاربری یا نشانی)'), ltr: true },
];
export const AdminSettings = () => <Can perm="settings.manage"><PageHead title={tr('aSettingsForm.18', 'تنظیمات فروشگاه')} /><SettingsForm fields={STORE} /></Can>;

export const HOME: SettingField[] = [
  { key: 'hero_title', label: tr('aSettingsForm.19', 'تیتر اصلی صفحه اول') },
  { key: 'hero_title_en', label: tr('aSettingsForm.20', 'تیتر اصلی (انگلیسی)'), ltr: true },
  { key: 'hero_subtitle', label: tr('aSettingsForm.21', 'متن زیر تیتر'), type: 'textarea' },
  { key: 'hero_subtitle_en', label: tr('aSettingsForm.22', 'متن زیر تیتر (انگلیسی)'), type: 'textarea', ltr: true },
  { key: 'hero_cta_label', label: tr('aSettingsForm.23', 'متن دکمه') },
  { key: 'hero_cta_label_en', label: tr('aSettingsForm.24', 'متن دکمه (انگلیسی)'), ltr: true },
  { key: 'hero_cta_link', label: tr('aSettingsForm.25', 'مسیر دکمه'), ltr: true, help: tr('aSettingsForm.26', 'مسیر داخلی، مثل /shop?new=1 یا /collections/essentials') },
  { key: 'statement', label: tr('aSettingsForm.27', 'جمله‌ی وسط صفحه'), help: tr('aSettingsForm.28', 'خالی = مخفی') },
  { key: 'statement_en', label: tr('aSettingsForm.29', 'جمله‌ی وسط صفحه (انگلیسی)'), ltr: true },
];

export const EMAIL: SettingField[] = [
  { key: 'email_enabled', label: tr('aSettingsForm.30', 'ارسال ایمیل فعال باشد'), type: 'bool', private: true },
  { key: 'email_provider', label: tr('aSettingsForm.31', 'ارائه‌دهنده'), type: 'select', private: true, options: [{ value: 'resend', label: 'Resend' }, { value: 'brevo', label: 'Brevo' }] },
  { key: 'email_from', label: tr('aSettingsForm.32', 'ایمیل فرستنده (دامنه باید در ارائه‌دهنده تأیید شده باشد)'), ltr: true, private: true },
  { key: 'email_from_name', label: tr('aSettingsForm.33', 'نام فرستنده'), private: true },
  { key: 'email_admin_notify', label: tr('aSettingsForm.34', 'ایمیل اطلاع‌رسانی سفارش جدید به مدیر'), ltr: true, private: true, help: tr('aSettingsForm.35', 'خالی = ارسال نشود') },
];
