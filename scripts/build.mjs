// Build:  node scripts/build.mjs          → assets/app.js + assets/app.css   (index.html loads them; no CDN, no runtime dependencies)
// Watch:  node scripts/build.mjs --watch  → rebuild on save (open index.html with VS Code "Live Server")
import { build, context } from 'esbuild';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WATCH = process.argv.includes('--watch');
const options = {
  entryPoints: { app: join(root, 'src/main.tsx') },
  outdir: join(root, 'assets'),
  bundle: true,
  format: 'iife',
  target: 'es2019',
  platform: 'browser',
  minify: !WATCH,
  sourcemap: WATCH,
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  inject: [join(root, 'scripts/react-shim.js')],
  define: { 'process.env.NODE_ENV': WATCH ? '"development"' : '"production"' },
  alias: {
    'react-router-dom': join(root, 'src/vendor/router.tsx'),
    '@supabase/supabase-js': join(root, 'src/vendor/supabase.ts'),
  },
  legalComments: 'none',
  logLevel: 'info',
};
if (WATCH) { const ctx = await context(options); await ctx.watch(); console.log('Watching… open index.html with Live Server.'); }
else await build(options);
