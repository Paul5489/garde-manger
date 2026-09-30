import { defineConfig } from '@vite-pwa/assets-generator/config';

// Icône pleine (fond terracotta) : pas de marge, iOS arrondit lui-même les coins.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0 },
    apple: { sizes: [180], padding: 0 },
  },
  images: ['public/icone.svg'],
});
