/// <reference types='vitest' />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import * as path from 'path'

export default defineConfig(({ mode }) => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/sudoku-core',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    vue(),
    dts({ entryRoot: 'src', tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json') }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    sourcemap: mode !== 'production',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: '@vue-sudoku/sudoku-core',
      fileName: 'index',
      formats: ['es' as const],
    },
    rolldownOptions: {
      external: ['vue'],
    },
  },
  test: {
    name: '@vue-sudoku/sudoku-core',
    watch: false,
    globals: true,
    environment: 'jsdom',
    // Several solver specs generate dozens of random puzzles; that is well under 5s on a
    // fast desktop but not on a shared CI runner.
    testTimeout: 30_000,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}))
