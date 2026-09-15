import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    transformer: 'postcss',
  },
  build: {
    cssMinify: false,
    // 目标降到 Safari 14（含 iOS 14），语法转换由 esbuild 负责
    target: ['es2015', 'safari14', 'chrome61'],
    // 关掉 modulepreload polyfill，iOS WKWebView 有已知问题
    modulePreload: { polyfill: false },
  },
})
