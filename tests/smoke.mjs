// End-to-end smoke test with a mocked Supabase (no network, no real data).  Run:  npm install && npx playwright install chromium && npm run test:smoke
// It serves this folder over http, intercepts https://<your-project>.supabase.co/**, and walks the main shopper + admin paths.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const p = decodeURIComponent((req.url || '/').split('?')[0]); let f = join(root, p === '/' ? 'index.html' : p);
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const supabaseUrl = /SUPABASE_URL:\s*"([^"]+)"/.exec(readFileSync(join(root, 'config.js'), 'utf8'))?.[1] ?? 'https://x.supabase.co';

const sil = ['coat', 'knit', 'trousers', 'dress'];
const prods = sil.map((s, i) => ({ id: 'p' + i, slug: 'p' + i, title_fa: 'محصول ' + (i + 1), title_en: s, base_price: 900000 + i * 1e5, compare_at_price: i === 0 ? 1200000 : null, status: 'active', tone: 'sand', silhouette: s, is_new: true, created_at: '2026-01-01', category: { name_fa: 'x', slug: 'x' }, images: [],
  variants: ['S', 'M'].map((sz) => ({ id: `v${i}${sz}`, product_id: 'p' + i, sku: `S${i}${sz}`, color_name: 'عاجی', color_hex: '#e8d3a6', size: sz, stock: 5, is_active: true })) }));

let failed = 0; const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failed++; };
const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await ctx.route(`${supabaseUrl}/**`, async (r) => {
  const req = r.request(); const u = new URL(req.url());
  const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range', 'content-type': 'application/json' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
  if (u.pathname.startsWith('/auth/v1/token') || u.pathname.startsWith('/auth/v1/signup')) return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u1', phone: '989121234567', email: 'a@b.com' } }) });
  if (u.pathname.includes('/rpc/')) return r.fulfill({ status: 200, headers: h, body: JSON.stringify(u.pathname.endsWith('search_products') ? { total: prods.length, ids: prods.map((p) => p.id) } : u.pathname.endsWith('catalog_facets') ? { colors: [], sizes: [] } : u.pathname.endsWith('my_permissions') ? ['*'] : null) });
  const t = u.pathname.split('/').pop(); const rows = t === 'products' ? prods : []; return r.fulfill({ status: 200, headers: { ...h, 'content-range': `0-0/${rows.length}` }, body: req.method() === 'GET' ? JSON.stringify(rows) : '' });
});
const text = async () => (await page.locator('#root').innerText()).replace(/\s+/g, ' ');
const go = async (path) => { await page.goto('about:blank'); await page.goto(base + '#' + path); await page.waitForTimeout(900); };

await go('/'); ok('home renders', (await text()).length > 50);
await go('/shop'); console.log('pcards:', await page.locator('.pcard').count(), (await text()).slice(0,200)); ok('shop lists products', (await page.locator('.pcard').count()) === prods.length);
ok('discount tag shown', (await page.locator('.pcard__tag--sale').count()) === 1);
await page.locator('.pcard__try').nth(0).click(); await page.locator('.pcard__try').nth(1).click(); await page.waitForTimeout(400);
ok('fitting room dresses the mannequin', (await page.locator('.fit__list li').count()) === 2 && (await page.locator('.fit__piece').count()) >= 2);
await go('/product/p0'); ok('product page', (await text()).includes('محصول 1'));
await go('/cart'); ok('cart is locked for guests', (await page.locator('.gate__card').count()) === 1);
await go('/wishlist'); ok('wishlist is locked for guests', (await page.locator('.gate__card').count()) === 1);
await go('/account'); ok('account is locked for guests', (await page.locator('.gate__card').count()) === 1);
await go('/login?mode=up'); ok('signup form has required fields', (await page.locator('.signup input[required]').count()) >= 5);
await go('/admin'); ok('admin asks for email sign-in', (await page.locator('input[type=email]').count()) === 1);
ok('no uncaught errors', errors.length === 0); if (errors.length) console.log(errors);
await browser.close(); server.close(); process.exit(failed ? 1 : 0);
