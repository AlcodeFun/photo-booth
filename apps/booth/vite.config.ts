import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

const rendererPort = Number(process.env.VITE_PORT || 5173);

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'renderer/src'),
    },
  },
  server: {
    port: rendererPort,
    strictPort: true,
    host: '0.0.0.0',
  },
});
