import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base + HashRouter => works on any GitHub Pages path without a 404 hack.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { sourcemap: false, chunkSizeWarningLimit: 700 },
});
