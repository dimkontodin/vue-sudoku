import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Most tests are pure logic (src/core, src/composables) and don't need
      // a DOM, so 'node' is the default. Component specs (Phase 4+) opt into
      // jsdom per-file with a `// @vitest-environment jsdom` docblock —
      // this avoids paying jsdom's per-file startup cost everywhere.
      environment: 'node',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
