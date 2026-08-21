import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Honour the port the harness assigns via PORT, falling back to Vite's
    // default when run directly.
    port: Number(process.env.PORT) || 5173,
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/assets/variables" as *;`,
      },
    },
  },
})
