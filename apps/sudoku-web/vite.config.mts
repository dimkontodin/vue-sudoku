/// <reference types='vitest' />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/sudoku-web',
  server:{
    port: Number(process.env.PORT) || 4200,
    host: 'localhost',
  },
  preview:{
    port: 4300,
    host: 'localhost',
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    conditions: ['@sudoku-web/source'],
  },
  css: {
    preprocessorOptions: {
      scss: { additionalData: `@use "@/assets/variables" as *;` },
    },
  },
  plugins: [vue(), vueDevTools()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: '@sudoku-web/sudoku-web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    }
  },
}));
