import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context';
import { tr } from '../i18n';
import { PROVINCES } from '../lib/iran';
import { normalizePhone } from '../lib/phone';
import { digitsOnly, isValidNationalId, isValidPostalCode } from '../lib/validate';
import { IconLock, IconPhone, IconUser } from '../components/Icons';

const blank = { first_name: '', last_name: '', phone: '', password: '', password2: '', national_id: '', birth_date: '', gender: '', province: '', city: '', address: '', postal_code: '', terms: false, marketing: false };

/** Full customer registration: identity + phone/password, optional profile details, optional first delivery address, consents. */
export default function Signup({ onLogin }: { onLogin: () => void }) {
  const { signUp } = useAuth();
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    const fail = (m: string) => { setErr(m); };
    if (f.first_name.trim().length < 2 || f.last_name.trim().length < 2) return fail(tr('pSignup.20', 'نام و نام خانوادگی را کامل وارد کنید.'));
    if (!normalizePhone(f.phone)) return fail(tr('pSignup.21', 'شماره موبایل معتبر نیست. نمونه: 09121234567'));
    if (f.password.length < 8) return fail(tr('pSignup.22', 'رمز عبور باید حداقل ۸ نویسه باشد.'));
    if (f.password !== f.password2) return fail(tr('pSignup.23', 'رمز عبور و تکرار آن یکسان نیستند.'));
    if (f.national_id && !isValidNationalId(f.national_id)) return fail(tr('pSignup.24', 'کد ملی معتبر نیست.'));
    const anyAddr = [f.province, f.city, f.address, f.postal_code].some((v) => v.trim());
    if (anyAddr && (!f.province || !f.city.trim() || f.address.trim().length < 5)) return fail(tr('pSignup.25', 'برای ثبت نشانی، استان، شهر و نشانی کامل را وارد کنید.'));
    if (f.postal_code && !isValidPostalCode(f.postal_code)) return fail(tr('pSignup.26', 'کد پستی باید ۱۰ رقم باشد.'));
    if (!f.terms) return fail(tr('pSignup.27', 'برای ثبت‌نام باید قوانین و مقررات را بپذیرید.'));
    setBusy(true);
    const res = await signUp(f.phone, f.password,
      { first_name: f.first_name.trim(), last_name: f.last_name.trim(), national_id: f.national_id ? digitsOnly(f.national_id) : undefined, birth_date: f.birth_date || undefined, gender: f.gender || undefined, marketing_sms_optin: f.marketing, accepted_terms: true },
      anyAddr ? { province: f.province, city: f.city.trim(), address: f.address.trim(), postal_code: f.postal_code ? digitsOnly(f.postal_code) : undefined } : null);
    setBusy(false);
    if (res === 'CONFIRM_PHONE') fail(tr('pAuth.2', 'حساب ساخته شد، ولی «Confirm phone» در Supabase روشن است و پیامک لازم می‌شود. آن را خاموش کنید (Authentication ← Providers ← Phone).'));
    else if (res) fail(res);
  };

  return (
    <div className="wrap authbox">
      <div className="authcard authcard--wide">
        <span className="authcard__icon"><IconUser /></span>
        <h1 className="h1">{tr('pSignup.1', 'ساخت حساب')}</h1>
        <p className="muted">{tr('pSignup.2', 'با شماره موبایل ثبت‌نام کنید. فقط موارد ستاره‌دار الزامی است.')}</p>
        <form className="form signup" onSubmit={submit} noValidate>
          <fieldset><legend>{tr('pSignup.3', 'اطلاعات حساب')}</legend>
            <div className="form__row">
              <label>{tr('pSignup.4', 'نام')} *<input className="input" required value={f.first_name} onChange={set('first_name')} autoComplete="given-name" maxLength={60} /></label>
              <label>{tr('pSignup.5', 'نام خانوادگی')} *<input className="input" required value={f.last_name} onChange={set('last_name')} autoComplete="family-name" maxLength={60} /></label>
            </div>
            <label><span className="lbl"><IconPhone />{tr('pSignup.6', 'شماره موبایل')} *</span><input className="input" type="tel" inputMode="tel" required dir="ltr" placeholder="09121234567" value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
            <div className="form__row">
              <label><span className="lbl"><IconLock />{tr('pSignup.7', 'رمز عبور')} *</span><input className="input" type="password" required dir="ltr" minLength={8} value={f.password} onChange={set('password')} autoComplete="new-password" /></label>
              <label><span className="lbl"><IconLock />{tr('pSignup.8', 'تکرار رمز عبور')} *</span><input className="input" type="password" required dir="ltr" minLength={8} value={f.password2} onChange={set('password2')} autoComplete="new-password" /></label>
            </div>
          </fieldset>
          <fieldset><legend>{tr('pSignup.9', 'اطلاعات تکمیلی (اختیاری)')}</legend>
            <div className="form__row">
              <label>{tr('pSignup.10', 'کد ملی')}<input className="input" dir="ltr" inputMode="numeric" maxLength={10} value={f.national_id} onChange={set('national_id')} /></label>
              <label>{tr('pSignup.11', 'تاریخ تولد')}<input className="input" type="date" dir="ltr" max={new Date().toISOString().slice(0, 10)} value={f.birth_date} onChange={set('birth_date')} autoComplete="bday" /></label>
            </div>
            <label>{tr('pSignup.12', 'جنسیت')}
              <select className="select" value={f.gender} onChange={set('gender')}>
                <option value="">{tr('pSignup.13', 'ترجیح می‌دهم نگویم')}</option><option value="female">{tr('pSignup.14', 'زن')}</option><option value="male">{tr('pSignup.15', 'مرد')}</option><option value="other">{tr('pSignup.16', 'سایر')}</option>
              </select>
            </label>
          </fieldset>
          <fieldset><legend>{tr('pSignup.17', 'نشانی تحویل (اختیاری؛ در پرداخت هم می‌توانید وارد کنید)')}</legend>
            <div className="form__row">
              <label>{tr('pSignup.18', 'استان')}<select className="select" value={f.province} onChange={set('province')}><option value="">—</option>{PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
              <label>{tr('pSignup.19', 'شهر')}<input className="input" value={f.city} onChange={set('city')} autoComplete="address-level2" maxLength={80} /></label>
            </div>
            <label>{tr('pSignup.28', 'نشانی کامل')}<textarea className="textarea" rows={2} value={f.address} onChange={set('address')} maxLength={500} autoComplete="street-address" /></label>
            <label>{tr('pSignup.29', 'کد پستی')}<input className="input" dir="ltr" inputMode="numeric" maxLength={10} value={f.postal_code} onChange={set('postal_code')} autoComplete="postal-code" /></label>
          </fieldset>
          <label className="chk"><input type="checkbox" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} /> <span>{tr('pSignup.30', 'قوانین و مقررات')} (<Link className="link" to="/p/terms" target="_blank">{tr('pSignup.31', 'مشاهده')}</Link>) {tr('pSignup.32', 'و')} <Link className="link" to="/p/privacy" target="_blank">{tr('pSignup.33', 'حریم خصوصی')}</Link> {tr('pSignup.34', 'را می‌پذیرم.')} *</span></label>
          <label className="chk"><input type="checkbox" checked={f.marketing} onChange={(e) => setF({ ...f, marketing: e.target.checked })} /> <span>{tr('pSignup.35', 'می‌خواهم از تخفیف‌ها و محصولات جدید با پیامک باخبر شوم.')}</span></label>
          {err ? <p className="note note--err" role="alert">{err}</p> : null}
          <button className="btn btn--block" disabled={busy}>{busy ? tr('pAuth.8', 'لطفاً صبر کنید…') : tr('pAuth.10', 'ثبت‌نام')}</button>
        </form>
        <button className="link" onClick={onLogin}>{tr('pAuth.12', 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید')}</button>
      </div>
    </div>
  );
}
