import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project site: https://sam8913mt.github.io/stor/
export default defineConfig({
  base: '/stor/',
  plugins: [react()],
  build: { sourcemap: false, chunkSizeWarningLimit: 700 },
});
