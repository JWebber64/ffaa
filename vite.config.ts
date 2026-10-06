/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vite.dev/config/
const testFirebaseEnv = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'localhost',
  VITE_FIREBASE_PROJECT_ID: 'ffaa-test',
  VITE_FIREBASE_STORAGE_BUCKET: 'ffaa-test.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:test',
} as const;

export default defineConfig(({ mode }) => ({
  plugins: [react(), {
    name: 'football-daily-brief-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (!['/api/daily-brief', '/ff/api/daily-brief'].includes(url.pathname)) { next(); return; }
        const [{ briefResponse }, { footballBrief }, { localBriefStore }] = await Promise.all([
          server.ssrLoadModule('/server/daily-brief/handler.ts'),
          server.ssrLoadModule('/server/daily-brief/footballProvider.ts'),
          server.ssrLoadModule('/server/daily-brief/localStore.ts'),
        ]);
        const headers = new Headers();
        for (const [name, value] of Object.entries(request.headers)) if (typeof value === 'string') headers.set(name, value);
        const result: Response = await briefResponse(new Request(url, { method: request.method ?? 'GET', headers }), { store: () => localBriefStore(), provider: footballBrief });
        response.statusCode = result.status;
        result.headers.forEach((value, name) => response.setHeader(name, value));
        response.end(Buffer.from(await result.arrayBuffer()));
      });
    },
  }],
  define: mode === 'test'
    ? Object.fromEntries(Object.entries(testFirebaseEnv).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]))
    : {},
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
  test: {
    env: testFirebaseEnv,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/espn-nfl-news': {
        target: 'https://www.espn.com',
        changeOrigin: true,
        rewrite: () => '/espn/rss/nfl/news',
      },
      '/ffc-api': {
        target: 'https://fantasyfootballcalculator.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ffc-api/, '/api/v1'),
      },
    },
  },
}));
