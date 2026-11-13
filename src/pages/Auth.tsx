import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth, useSettings } from '../context';
import { useTitle } from '../hooks';
import { tr } from '../i18n';
import { IconLock, IconPhone, IconUser } from '../components/Icons';
import Signup from './Signup';

export default function Auth() {
  useTitle(tr('pAuth.1', 'ورود'));
  const { user, permsLoaded, isAdmin, signIn, sendOtp, verifyOtp } = useAuth();
  const { s } = useSettings();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  // administrators sign in with their email (/login?next=/admin…); customers use their mobile number
  const adminMode = !!safeNext && safeNext.startsWith('/admin');
  const [mode, setMode] = useState<'in' | 'up'>(!adminMode && sp.get('mode') === 'up' ? 'up' : 'in');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // customers can sign in with a password or (once an SMS gateway is connected) a one-time code sent by SMS
  const [method, setMethod] = useState<'password' | 'code'>('password');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const useCode = !adminMode && mode === 'in' && s.sms_otp_enabled && method === 'code';

  // signed in: go where the visitor was heading; with no destination, admins land in the admin panel, customers in their account
  if (user) {
    if (!safeNext && !permsLoaded) return null;
    return <Navigate to={safeNext ?? (isAdmin ? '/admin' : '/account')} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (useCode) {
      setBusy(true);
      const res = codeSent ? await verifyOtp(phone, code) : await sendOtp(phone);
      setBusy(false);
      if (res) setErr(res); else if (!codeSent) setCodeSent(true);
      return;
    }
    if (adminMode && !phone.includes('@')) { setErr(tr('pAuth.15', 'ورود مدیران با ایمیل (جیمیل) انجام می‌شود.')); return; }
    if (!adminMode && phone.includes('@')) { setErr(tr('pAuth.16', 'ورود مشتریان با شماره موبایل است. ایمیل مخصوص مدیران است.')); return; }
    setBusy(true);
    const res = await signIn(phone, password, { remember: !adminMode });
    setBusy(false);
    if (res === 'CONFIRM_PHONE') setErr(tr('pAuth.2', 'حساب ساخته شد، ولی «Confirm phone» در Supabase روشن است و پیامک لازم می‌شود. آن را خاموش کنید (Authentication ← Providers ← Phone).'));
    else if (res) setErr(adminMode ? res.replace('شماره', 'ایمیل') : res);
  };

  if (mode === 'up' && !adminMode) return <Signup onLogin={() => { setMode('in'); setErr(''); }} />;

  return (
    <div className="wrap authbox">
      <div className="authcard">
        <span className="authcard__icon"><IconUser /></span>
        <h1 className="h1">{adminMode ? tr('pAuth.17', 'ورود مدیران') : mode === 'in' ? tr('pAuth.3', 'ورود') : tr('pAuth.4', 'ساخت حساب')}</h1>
        <p className="muted">{adminMode ? tr('pAuth.18', 'با ایمیل و رمز عبور مدیر وارد شوید.') : mode === 'in' ? tr('pAuth.13', 'با شماره موبایل و رمز عبور وارد شوید.') : tr('pAuth.14', 'فقط شماره موبایل و یک رمز عبور لازم است.')}</p>
        <form className="form" onSubmit={submit}>
          {!adminMode && mode === 'in' && s.sms_otp_enabled ? (
            <div className="seg" role="tablist" aria-label={tr('pAuth.21', 'روش ورود')}>
              <button type="button" role="tab" aria-selected={method === 'password'} className={method === 'password' ? 'is-on' : ''} onClick={() => { setMethod('password'); setErr(''); }}>{tr('pAuth.22', 'رمز عبور')}</button>
              <button type="button" role="tab" aria-selected={method === 'code'} className={method === 'code' ? 'is-on' : ''} onClick={() => { setMethod('code'); setErr(''); }}>{tr('pAuth.23', 'کد پیامکی')}</button>
            </div>
          ) : null}
          {adminMode ? (
            <label><span className="lbl"><IconUser />{tr('pAuth.19', 'ایمیل')}</span>
              <input className="input" type="email" required dir="ltr" placeholder="name@gmail.com" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="email" />
            </label>
          ) : (
            <label><span className="lbl"><IconPhone />{tr('pAuth.6', 'شماره موبایل')}</span>
              <input className="input" type="tel" inputMode="tel" required dir="ltr" placeholder="09121234567" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </label>
          )}
          {useCode ? (codeSent ? (
            <label><span className="lbl"><IconLock />{tr('pAuth.24', 'کد ارسال‌شده به موبایل')}</span>
              <input className="input" inputMode="numeric" autoComplete="one-time-code" required dir="ltr" placeholder="• • • • • •" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
          ) : null) : (
            <label><span className="lbl"><IconLock />{tr('pAuth.7', 'رمز عبور')}</span>
              <input className="input" type="password" required minLength={6} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
            </label>
          )}
          {err ? <p className="note note--err" role="alert">{err}</p> : null}
          <button className="btn btn--block" disabled={busy}>{busy ? tr('pAuth.8', 'لطفاً صبر کنید…') : useCode ? (codeSent ? tr('pAuth.25', 'تأیید و ورود') : tr('pAuth.26', 'ارسال کد')) : mode === 'in' ? tr('pAuth.9', 'ورود') : tr('pAuth.10', 'ثبت‌نام')}</button>
        </form>
        {adminMode ? <Link className="link" to="/login">{tr('pAuth.20', 'ورود مشتریان با شماره موبایل')}</Link> : (
          <>
            <button className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}>
              {mode === 'in' ? tr('pAuth.11', 'حساب ندارید؟ ثبت‌نام کنید') : tr('pAuth.12', 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
