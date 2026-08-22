import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Production CSP hardening: the static meta CSP in index.html keeps
    // 'unsafe-inline' (required by the @vitejs/plugin-react dev preamble) and
    // localhost entries for HMR. Neither belongs in the packaged app, where
    // all scripts are external — strip both at build time only.
    {
      name: 'strict-csp-production',
      apply: 'build',
      transformIndexHtml(html) {
        return html
          .replace("script-src 'self' 'unsafe-inline'", "script-src 'self'")
          .replace(' http://localhost:* ws://localhost:*', '');
      },
    },
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
