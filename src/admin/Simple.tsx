import { CrudPage, type FieldDef } from './Crud';
import { Can } from './ui';
import { TONES, TONE_LABEL } from '../lib/format';
import { tr } from '../i18n';

const toneOpts = TONES.map((t) => ({ value: t, label: TONE_LABEL[t] }));

const catFields: FieldDef[] = [
  { key: 'name_fa', label: tr('aSimple.1', 'نام فارسی'), required: true },
  { key: 'name_en', label: tr('aSimple.2', 'نام انگلیسی'), ltr: true },
  { key: 'slug', label: tr('aSimple.3', 'نشانی (slug)'), ltr: true, help: tr('aSimple.4', 'فقط حروف انگلیسی کوچک و خط تیره. اگر خالی بماند از نام انگلیسی ساخته می‌شود.') },
  { key: 'sort_order', label: tr('aSimple.5', 'ترتیب'), type: 'number', def: 0 },
  { key: 'is_active', label: tr('aSimple.6', 'فعال'), type: 'checkbox', def: true },
];
export const AdminCategories = () => <Can perm="catalog.manage"><CrudPage title={tr('aSimple.7', 'دسته‌بندی‌ها')} table="categories" fields={catFields} orderBy="sort_order" slugFrom="name_en" touchesCatalog /></Can>;

const colFields: FieldDef[] = [
  { key: 'title_fa', label: tr('aSimple.8', 'عنوان'), required: true },
  { key: 'title_en', label: tr('aSimple.9', 'عنوان انگلیسی'), ltr: true, hideInTable: true },
  { key: 'subtitle_fa', label: tr('aSimple.10', 'زیرعنوان'), hideInTable: true },
  { key: 'subtitle_en', label: tr('aSimple.11', 'زیرعنوان انگلیسی'), ltr: true, hideInTable: true },
  { key: 'description_fa', label: tr('aSimple.12', 'توضیحات'), type: 'textarea', hideInTable: true },
  { key: 'description_en', label: tr('aSimple.13', 'توضیحات انگلیسی'), type: 'textarea', ltr: true, hideInTable: true },
  { key: 'slug', label: tr('aSimple.14', 'نشانی (slug)'), ltr: true, required: true },
  { key: 'tone', label: tr('aSimple.15', 'رنگ پس‌زمینه'), type: 'select', options: toneOpts, def: 'sand', hideInTable: true },
  { key: 'sort_order', label: tr('aSimple.16', 'ترتیب'), type: 'number', def: 0 },
  { key: 'is_featured', label: tr('aSimple.17', 'ویژه (صفحه اصلی)'), type: 'checkbox' },
  { key: 'is_active', label: tr('aSimple.18', 'فعال'), type: 'checkbox', def: true },
];
export const AdminCollections = () => <Can perm="catalog.manage"><CrudPage title={tr('aSimple.19', 'مجموعه‌ها')} table="collections" fields={colFields} orderBy="sort_order" touchesCatalog /></Can>;

const couponFields: FieldDef[] = [
  { key: 'code', label: tr('aSimple.20', 'کد'), ltr: true, required: true, upper: true },
  { key: 'kind', label: tr('aSimple.21', 'نوع'), type: 'select', options: [{ value: 'percent', label: tr('aSimple.22', 'درصدی') }, { value: 'fixed', label: tr('aSimple.23', 'مبلغ ثابت (تومان)') }], def: 'percent', required: true },
  { key: 'value', label: tr('aSimple.24', 'مقدار'), type: 'number', required: true },
  { key: 'min_subtotal', label: tr('aSimple.25', 'حداقل خرید (تومان)'), type: 'number', def: 0 },
  { key: 'max_uses', label: tr('aSimple.26', 'سقف استفاده'), type: 'number', help: tr('aSimple.27', 'خالی = نامحدود') },
  { key: 'used_count', label: tr('aSimple.28', 'استفاده‌شده'), type: 'number', def: 0, hideInTable: false },
  { key: 'starts_at', label: tr('aSimple.29', 'شروع'), type: 'datetime', hideInTable: true },
  { key: 'ends_at', label: tr('aSimple.30', 'پایان'), type: 'datetime' },
  { key: 'is_active', label: tr('aSimple.31', 'فعال'), type: 'checkbox', def: true },
];
export const AdminCoupons = () => <Can perm="marketing.manage"><CrudPage title={tr('aSimple.32', 'کوپن و تخفیف')} table="coupons" fields={couponFields} orderBy="code" /></Can>;

const pageFields: FieldDef[] = [
  { key: 'title_fa', label: tr('aSimple.33', 'عنوان'), required: true },
  { key: 'title_en', label: tr('aSimple.34', 'عنوان انگلیسی'), ltr: true, hideInTable: true },
  { key: 'slug', label: tr('aSimple.35', 'نشانی (slug)'), ltr: true, required: true },
  { key: 'body_en', label: tr('aSimple.36', 'متن انگلیسی'), type: 'textarea', ltr: true, hideInTable: true },
  { key: 'body_fa', label: tr('aSimple.37', 'متن'), type: 'textarea', hideInTable: true, help: tr('aSimple.38', 'پاراگراف‌ها را با یک خط خالی جدا کنید. خطی که با «## » شروع شود تیتر می‌شود. HTML پذیرفته نمی‌شود.') },
  { key: 'is_published', label: tr('aSimple.39', 'منتشر شده'), type: 'checkbox' },
];
export const CmsPages = () => <CrudPage title={tr('aSimple.40', 'صفحات')} table="cms_pages" fields={pageFields} orderBy="slug" />;
