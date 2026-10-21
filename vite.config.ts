/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/, so CI sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['bapu/*.webp'],
      manifest: {
        name: 'ApeChess',
        short_name: 'ApeChess',
        description: 'Learn chess the clever way: Bapu the ape shows you why every move works.',
        theme_color: '#1F4E4A',
        background_color: '#F6EBD9',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'bapu/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'bapu/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'bapu/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,webp,png,svg,woff2,json,wasm}'],
      },
    }),
  ],
  server: { host: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'content/**/*.test.ts'],
  },
});
