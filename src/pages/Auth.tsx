import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context';
import { useTitle } from '../hooks';
import { tr } from '../i18n';
import { IconLock, IconPhone, IconUser } from '../components/Icons';

export default function Auth() {
  useTitle(tr('pAuth.1', 'ورود'));
  const { user, permsLoaded, isAdmin, signIn, signUp } = useAuth();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  const [mode, setMode] = useState<'in' | 'up'>(sp.get('mode') === 'up' ? 'up' : 'in');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // signed in: go where the visitor was heading; with no destination, admins land in the admin panel, customers in their account
  if (user) {
    if (!safeNext && !permsLoaded) return null;
    return <Navigate to={safeNext ?? (isAdmin ? '/admin' : '/account')} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const res = mode === 'in' ? await signIn(phone, password) : await signUp(phone, password, name);
    setBusy(false);
    if (res === 'CONFIRM_PHONE') setErr(tr('pAuth.2', 'حساب ساخته شد، ولی «Confirm phone» در Supabase روشن است و پیامک لازم می‌شود. آن را خاموش کنید (Authentication ← Providers ← Phone).'));
    else if (res) setErr(res);
  };

  return (
    <div className="wrap authbox">
      <div className="authcard">
        <span className="authcard__icon"><IconUser /></span>
        <h1 className="h1">{mode === 'in' ? tr('pAuth.3', 'ورود') : tr('pAuth.4', 'ساخت حساب')}</h1>
        <p className="muted">{mode === 'in' ? tr('pAuth.13', 'با شماره موبایل و رمز عبور وارد شوید.') : tr('pAuth.14', 'فقط شماره موبایل و یک رمز عبور لازم است.')}</p>
        <form className="form" onSubmit={submit}>
          {mode === 'up' ? <label>{tr('pAuth.5', 'نام و نام خانوادگی')}<input className="input" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label> : null}
          <label><span className="lbl"><IconPhone />{tr('pAuth.6', 'شماره موبایل')}</span>
            <input className="input" type="tel" inputMode="tel" required dir="ltr" placeholder="09121234567" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </label>
          <label><span className="lbl"><IconLock />{tr('pAuth.7', 'رمز عبور')}</span>
            <input className="input" type="password" required minLength={6} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
          </label>
          {err ? <p className="note note--err" role="alert">{err}</p> : null}
          <button className="btn btn--block" disabled={busy}>{busy ? tr('pAuth.8', 'لطفاً صبر کنید…') : mode === 'in' ? tr('pAuth.9', 'ورود') : tr('pAuth.10', 'ثبت‌نام')}</button>
        </form>
        <button className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}>
          {mode === 'in' ? tr('pAuth.11', 'حساب ندارید؟ ثبت‌نام کنید') : tr('pAuth.12', 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید')}
        </button>
      </div>
    </div>
  );
}
