import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: { '@shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)) } },
  server: { proxy: { '/api': 'http://127.0.0.1:8090' } },
  build: { chunkSizeWarningLimit: 1500 }
});
