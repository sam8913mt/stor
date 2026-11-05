import { useParams } from 'react-router-dom';
import { q } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAsync, useTitle } from '../hooks';
import { lf, tr } from '../i18n';
import { Empty, ErrorBox, Loading } from '../components/ui';

/** Renders plain text only (no raw HTML) — "## " lines become headings, blank lines split paragraphs. */
export default function CmsPage() {
  const { slug } = useParams();
  const { data, error, loading, reload } = useAsync(() => q<{ title_fa: string; body_fa: string; title_en: string | null; body_en: string | null }[]>(supabase.from('cms_pages').select('title_fa,body_fa,title_en,body_en').eq('slug', slug ?? '').eq('is_published', true)), [slug]);
  const page = data?.[0];
  useTitle(page ? lf(page, 'title') : '');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!page) return <div className="wrap"><Empty title={tr('pCmsPage.1', 'صفحه پیدا نشد')} to="/" cta={tr('pCmsPage.2', 'بازگشت به خانه')} /></div>;
  return (
    <article className="wrap prose">
      <h1 className="h1">{lf(page, 'title')}</h1>
      {lf(page, 'body').split(/\n{2,}/).map((blk, i) => blk.startsWith('## ')
        ? <h2 key={i} className="h3">{blk.slice(3)}</h2>
        : <p key={i}>{blk}</p>)}
    </article>
  );
}
