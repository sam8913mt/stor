import { Empty } from '../components/ui';
import { tr } from '../i18n';
export default function NotFound() { return <div className="wrap"><Empty title={tr('pNotFound.1', 'صفحه پیدا نشد')} text={tr('pNotFound.2', 'نشانی را بررسی کنید.')} to="/" cta={tr('pNotFound.3', 'بازگشت به خانه')} /></div>; }
