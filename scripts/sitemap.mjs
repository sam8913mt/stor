// Generates sitemap.xml + robots.txt for the deployed site.
//   node scripts/sitemap.mjs dist            (env: SITE_URL=https://example.com/shop/  — must end with "/")
// Reads the public Supabase URL/key from <dir>/config.js, lists active products, categories and CMS pages.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'dist';
const site = (process.env.SITE_URL || '').replace(/\/?$/, '/');
if (!/^https?:\/\//.test(site)) { console.log('sitemap: SITE_URL not set, skipped.'); process.exit(0); }
const cfg = readFileSync(join(dir, 'config.js'), 'utf8');
const url = /SUPABASE_URL:\s*"([^"]+)"/.exec(cfg)?.[1]; const key = /SUPABASE_ANON_KEY:\s*"([^"]+)"/.exec(cfg)?.[1];
const get = async (path) => { const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); };

const urls = ['', 'shop', 'collections'];
try {
  for (const p of await get('products?select=slug&status=eq.active&limit=5000')) urls.push(`product/${p.slug}`);
  for (const c of await get('categories?select=slug&is_active=eq.true')) urls.push(`shop?cat=${c.slug}`);
  for (const c of await get('collections?select=slug&is_active=eq.true')) urls.push(`collections/${c.slug}`);
  for (const p of await get('cms_pages?select=slug&is_published=eq.true')) urls.push(`p/${p.slug}`);
} catch (e) { console.log('sitemap: could not read the catalogue (' + e.message + '), writing the static pages only.'); }

const esc = (s) => s.replace(/&/g, '&amp;');
writeFileSync(join(dir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(site + u)}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(dir, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /checkout\nSitemap: ${site}sitemap.xml\n`);
console.log(`sitemap: ${urls.length} urls written to ${dir}/sitemap.xml`);
