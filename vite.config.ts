import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-core',
              test: /node_modules[\\/](?:react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              maxSize: 350 * 1024,
              priority: 30,
            },
            {
              name: 'firebase',
              test: /node_modules[\\/](?:@firebase|firebase)[\\/]/,
              maxSize: 350 * 1024,
              priority: 20,
            },
            {
              name: 'player-data',
              test: /src[\\/]data[\\/](?:players-|player-pool-|nfl-schedule-).*\.json$/,
              maxSize: 350 * 1024,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/ffc-api': {
        target: 'https://fantasyfootballcalculator.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ffc-api/, '/api/v1'),
      },
    },
  },
}));
