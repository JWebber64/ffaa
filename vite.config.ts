import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/ffc-api': {
        target: 'https://fantasyfootballcalculator.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ffc-api/, '/api/v1'),
      },
    },
  },
}));
