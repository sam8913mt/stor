import { CrudPage, type FieldDef } from './Crud';
import { Can } from './ui';
import { tr } from '../i18n';

const fields: FieldDef[] = [
  { key: 'key', label: tr('aPayments.1', 'شناسه'), type: 'select', lockOnEdit: true, ltr: true, required: true, options: ['cod', 'bank_transfer', 'zarinpal', 'stripe'].map((v) => ({ value: v, label: v })) },
  { key: 'kind', label: tr('aPayments.2', 'نوع'), type: 'select', lockOnEdit: true, options: [{ value: 'offline', label: tr('aPayments.3', 'دستی') }, { value: 'online', label: tr('aPayments.4', 'آنلاین (درگاه)') }] },
  { key: 'label_fa', label: tr('aPayments.5', 'عنوان فارسی'), required: true },
  { key: 'label_en', label: tr('aPayments.6', 'عنوان انگلیسی'), ltr: true, required: true },
  { key: 'instructions_fa', label: tr('aPayments.7', 'توضیح برای مشتری (فارسی)'), type: 'textarea', hideInTable: true },
  { key: 'instructions_en', label: tr('aPayments.8', 'توضیح برای مشتری (انگلیسی)'), type: 'textarea', ltr: true, hideInTable: true },
  { key: 'sort_order', label: tr('aPayments.9', 'ترتیب'), type: 'number', def: 0 },
  { key: 'is_enabled', label: tr('aPayments.10', 'فعال'), type: 'checkbox' },
];

export default function AdminPayments() {
  return (
    <Can perm="settings.manage">
      <CrudPage title={tr('aPayments.11', 'روش‌های پرداخت')} table="payment_providers" fields={fields} orderBy="sort_order" idKey="key" canCreate={false} canDelete={false}
        intro={tr('aPayments.12', 'درگاه‌های آنلاین (زرین‌پال، Stripe) فقط وقتی کار می‌کنند که کلیدهایشان در Supabase Secrets ثبت و توابع Edge دیپلوی شده باشد (راهنما: EXTERNAL_SETUP.md). تا آن زمان آن‌ها را غیرفعال نگه دارید؛ در غیر این صورت مشتری هنگام پرداخت خطا می‌بیند.')} />
    </Can>
  );
}
