import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context';
import { useTitle } from '../hooks';
import { tr } from '../i18n';

export default function Auth() {
  useTitle(tr('pAuth.1', 'ورود'));
  const { user, signIn, signUp } = useAuth();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const next = sp.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={safeNext} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    const res = mode === 'in' ? await signIn(email, password) : await signUp(email, password, name);
    setBusy(false);
    if (res === 'CONFIRM_EMAIL') { setMsg(tr('pAuth.2', 'ایمیل تأیید برای شما ارسال شد. پس از تأیید وارد شوید.')); setMode('in'); }
    else if (res) setErr(res);
    else nav(safeNext, { replace: true });
  };

  return (
    <div className="wrap authbox">
      <h1 className="h1">{mode === 'in' ? tr('pAuth.3', 'ورود') : tr('pAuth.4', 'ساخت حساب')}</h1>
      <form className="form" onSubmit={submit}>
        {mode === 'up' ? <label>{tr('pAuth.5', 'نام و نام خانوادگی')}<input className="input" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label> : null}
        <label>{tr('pAuth.6', 'ایمیل')}<input className="input" type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>{tr('pAuth.7', 'رمز عبور')}<input className="input" type="password" required minLength={6} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
        {err ? <p className="note note--err" role="alert">{err}</p> : null}
        {msg ? <p className="note" role="status">{msg}</p> : null}
        <button className="btn btn--block" disabled={busy}>{busy ? tr('pAuth.8', 'لطفاً صبر کنید…') : mode === 'in' ? tr('pAuth.9', 'ورود') : tr('pAuth.10', 'ثبت‌نام')}</button>
      </form>
      <button className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}>
        {mode === 'in' ? tr('pAuth.11', 'حساب ندارید؟ ثبت‌نام کنید') : tr('pAuth.12', 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید')}
      </button>
    </div>
  );
}
