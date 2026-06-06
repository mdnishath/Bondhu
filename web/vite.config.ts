import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies API + socket to the backend on :3050.
// Production build outputs to dist/, served by the backend.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3050',
      '/socket.io': { target: 'http://localhost:3050', ws: true },
    },
  },
});
