import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import { cloudflare } from '@cloudflare/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    hmr: {
      host: 'localhost',
      // HMR crashes with ENOENT when deleting SVG asset with Vite + Tailwind v4
      // https://github.com/vitejs/vite/issues/19786
      overlay: false,
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    vue(),
    cloudflare({
      /* デバッガのポート番号を指定する場合は、コメントを外す
      inspectorPort: 19229,
      */
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
