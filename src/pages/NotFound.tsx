import { Empty } from '../components/ui';
import { useTitle } from '../hooks';
import { tr } from '../i18n';
export default function NotFound() {
  useTitle(tr('pNotFound.1', 'صفحه پیدا نشد'));
  return <div className="wrap"><Empty page title={tr('pNotFound.1', 'صفحه پیدا نشد')} text={tr('pNotFound.2', 'نشانی را بررسی کنید.')} to="/" cta={tr('pNotFound.3', 'بازگشت به خانه')} /></div>;
}
