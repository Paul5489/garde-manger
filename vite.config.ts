/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Chemin de l'archive sur le Mac (jamais copiée dans le projet ni dans le build). */
const ARCHIVE_MAC = resolve(import.meta.dirname, '../archive-recettes/donnees/archive_complete.json');

/**
 * Développement uniquement (`apply: 'serve'`) : sert l'archive du Mac pour tester
 * sur l'iPhone sans passer par iCloud. Ce plugin n'existe pas pendant `vite build`.
 */
function archiveDuMac(): Plugin {
  return {
    name: 'archive-du-mac',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__archive-dev/archive_complete.json', (_req, res) => {
        if (!existsSync(ARCHIVE_MAC)) {
          res.statusCode = 404;
          res.end('Archive introuvable sur le Mac');
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        createReadStream(ARCHIVE_MAC).pipe(res);
      });
      // http://<IP du Mac>:5180/archive dans Safari sur l'iPhone : télécharge le fichier
      // dans Fichiers › Téléchargements (réseau Wi-Fi de la maison uniquement, sans iCloud).
      server.middlewares.use('/archive', (req, res, suite) => {
        if (req.url !== '/' && req.url !== '') return suite();
        if (!existsSync(ARCHIVE_MAC)) {
          res.statusCode = 404;
          res.end('Archive introuvable sur le Mac');
          return;
        }
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="archive_complete.json"');
        res.setHeader('Cache-Control', 'no-store');
        createReadStream(ARCHIVE_MAC).pipe(res);
      });
    },
  };
}

const { version } = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string };
const dateBuild = new Date().toISOString().slice(0, 10);

export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  define: { __VERSION__: JSON.stringify(`${version} (${dateBuild})`) },
  server: { host: true, port: 5180, strictPort: true },
  preview: { host: true, port: 4180, strictPort: true },
  plugins: [
    svelte(),
    archiveDuMac(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icone.svg'],
      manifest: {
        id: './',
        name: 'Garde-manger',
        short_name: 'Garde-manger',
        description: 'Mes recettes, techniques, courses et fermentations — hors ligne.',
        lang: 'fr',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#ae441e',
        background_color: '#f7f3ec',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Uniquement le code de l'application : jamais de données JSON.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest,mp4}'],
        globIgnores: ['**/*.json'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: { format: 'es' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
