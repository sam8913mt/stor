import { Link } from 'react-router-dom';
import { loadMeta, searchProducts } from '../lib/api';
import { useAsync, useTitle } from '../hooks';
import { LOC, lf, tr } from '../i18n';
import { useSettings } from '../context';
import { ProductGrid } from '../components/ProductCard';
import { Placeholder } from '../components/Placeholder';
import { IconLeaf, IconShield, IconTruck } from '../components/Icons';
import { ErrorBox, Loading, Section } from '../components/ui';
import { price } from '../lib/format';
import type { Tone } from '../types';

export default function Home() {
  const { s } = useSettings();
  useTitle(`${s.store_name} — ${s.tagline || tr('pHome.1', 'فروشگاه آنلاین')}`);
  const { data, error, loading, reload } = useAsync(async () => {
    const meta = await loadMeta();
    const hero = meta.collections.find((c) => c.is_featured && c.is_active) ?? meta.collections.find((c) => c.is_active);
    const [fresh, featured, heroItems] = await Promise.all([
      searchProducts({ isNew: true, pageSize: 4 }), searchProducts({ featured: true, pageSize: 4 }),
      hero ? searchProducts({ col: hero.slug, pageSize: 3 }) : Promise.resolve({ products: [], total: 0 }),
    ]);
    return { meta, hero, fresh: fresh.products, featured: featured.products, heroItems: heroItems.products };
  }, []);
  const tones: Tone[] = ['taupe', 'sand', 'stone'];
  const hero = data?.hero;

  return (
    <>
      <section className="hero wrap">
        <div className="hero__text">
          <h1 className="hero__title">{s.hero_title}</h1>
          {s.hero_subtitle ? <p className="hero__sub">{s.hero_subtitle}</p> : null}
          <div className="hero__cta">
            <Link to={s.hero_cta_link.startsWith('/') && !s.hero_cta_link.startsWith('//') ? s.hero_cta_link : '/shop'} className="btn">{s.hero_cta_label}</Link>
            <Link to="/collections" className="link">{tr('pHome.2', 'همه مجموعه‌ها')}</Link>
          </div>
          <ul className="trust">
            <li><IconTruck /><span>{s.free_shipping_threshold ? tr('pHome.20', 'ارسال رایگان بالای {0}', [price(s.free_shipping_threshold)]) : tr('pHome.21', 'ارسال به سراسر ایران')}</span></li>
            <li><IconShield /><span>{tr('pHome.22', 'پرداخت امن')}</span></li>
            <li><IconLeaf /><span>{tr('pHome.23', 'بسته‌بندی پایدار')}</span></li>
          </ul>
        </div>
        <div className="hero__panels" aria-hidden="true">
          {tones.map((t, i) => (
            <div key={t} className={`hero__panel hero__panel--${i}`}><Placeholder tone={t} silhouette={(['coat', 'dress', 'knit'] as const)[i]} /></div>
          ))}
        </div>
      </section>

      {loading ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : data ? (
        <>
          {data.meta.categories.length ? (
            <nav className="catline wrap" aria-label={tr('pHome.3', 'دسته‌بندی‌ها')}>
              {data.meta.categories.filter((c) => c.is_active).map((c) => <Link key={c.id} to={`/shop?cat=${c.slug}`}>{lf(c, 'name')}</Link>)}
            </nav>
          ) : null}

          {data.fresh.length ? <Section title={tr('pHome.4', 'تازه‌ها')} link={{ to: '/shop?new=1', label: tr('pHome.5', 'مشاهده همه') }}><ProductGrid items={data.fresh} /></Section> : null}

          {hero ? (
            <section className="feature wrap">
              <div className="feature__text">
                <p className="muted">{lf(hero, 'subtitle')}</p>
                <h2 className="h1">{lf(hero, 'title')}</h2>
                <p>{lf(hero, 'description')}</p>
                <Link to={`/collections/${hero.slug}`} className="btn btn--ghost">{tr('pHome.6', 'مشاهده مجموعه')}</Link>
              </div>
              <div className="feature__strip">
                {data.heroItems.map((p) => (
                  <Link key={p.id} to={`/product/${p.slug}`} className="feature__item">
                    <Placeholder tone={p.tone} silhouette={p.silhouette} />
                    <span>{lf(p, 'title')}</span><small>{price(p.base_price)}</small>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {s.statement ? <section className="statement wrap"><p>{s.statement}</p></section> : null}

          {data.featured.length ? <Section title={tr('pHome.7', 'منتخب آرام')} link={{ to: '/shop', label: tr('pHome.8', 'همه محصولات') }}><ProductGrid items={data.featured} /></Section> : null}
          {!data.fresh.length && !data.featured.length ? <div className="state"><h2 className="h3">{tr('pHome.9', 'هنوز محصولی منتشر نشده است')}</h2><p className="muted">{tr('pHome.10', 'از پنل مدیریت محصول اضافه کنید.')}</p></div> : null}
        </>
      ) : null}

      <section className="services wrap">
        <div><h3>{tr('pHome.11', 'ارسال')}</h3><p className="muted">{s.free_shipping_threshold ? tr('pHome.12', 'ارسال رایگان برای سفارش‌های بالای {0}', [price(s.free_shipping_threshold)]) : tr('pHome.13', 'هزینه ارسال هنگام ثبت سفارش نمایش داده می‌شود.')}</p></div>
        <div><h3>{tr('pHome.14', 'بسته‌بندی')}</h3><p className="muted">{tr('pHome.15', 'هر سفارش با کاغذ بازیافتی و بدون پلاستیک اضافه بسته‌بندی می‌شود.')}</p></div>
        <div><h3>{tr('pHome.16', 'پشتیبانی')}</h3><p className="muted">{tr('pHome.17', 'برای سایز و شرایط بازگشت از بخش راهنما کمک بگیرید.')}</p></div>
      </section>
    </>
  );
}
