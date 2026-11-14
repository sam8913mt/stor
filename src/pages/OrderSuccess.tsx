import { Steps } from '../components/Extras';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTitle } from '../hooks';
import { tr } from '../i18n';

export default function OrderSuccess() {
  const { number } = useParams();
  const [sp] = useSearchParams();
  const paid = sp.get('paid');
  useTitle(tr('pOrderSuccess.1', 'سفارش ثبت شد'));
  return (
    <div className="wrap state state--tall">
      <Steps current={3} />
      <h1 className="h1">{tr('pOrderSuccess.2', 'سفارش شما ثبت شد')}</h1>
      <p>{tr('pOrderSuccess.3', 'شماره سفارش:')} <strong dir="ltr">{number}</strong></p>
      {paid === '1' ? <p className="note" role="status">{tr('pOrderSuccess.4', 'پرداخت شما با موفقیت تأیید شد.')}</p> : null}
      {paid === 'pending' ? <p className="note" role="status">{tr('pOrderSuccess.5', 'پرداخت در حال تأیید است؛ وضعیت را در حساب کاربری ببینید.')}</p> : null}
      <p className="muted">{tr('pOrderSuccess.6', 'وضعیت سفارش را در حساب کاربری دنبال کنید.')}</p>
      <div className="hero__cta"><Link to="/account/orders" className="btn">{tr('pOrderSuccess.7', 'سفارش‌های من')}</Link><Link to="/shop" className="link">{tr('pOrderSuccess.8', 'ادامه خرید')}</Link></div>
    </div>
  );
}
