import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const serverPort = Number(process.env['DECK_PORT'] ?? 7842);

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the same build is also served under `/peer/<id>/` by a paired deck.
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': `http://127.0.0.1:${serverPort}`,
      '/ws': { target: `ws://127.0.0.1:${serverPort}`, ws: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
