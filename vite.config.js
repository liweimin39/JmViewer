import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    transformer: 'postcss',    // 用 PostCSS 处理 CSS
  },
  build: {
    cssMinify: false,          // ★ 关键：不压缩 CSS，避免 Lightning CSS 升级语法
  },
})