import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    // ★ 关键：为旧 WebView 生成兼容代码
    legacy({
      targets: [
        'Chrome >= 61', // Android 9 出厂 WebView 约 Chrome 66-69
        'Android >= 7',
        'iOS >= 12',
        'Safari >= 12',
        'not dead',
      ],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
      modernPolyfills: true,
      polyfills: true,
    }),
  ],
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
    // ★ 让现代包的最低目标也是 es2015，避免输出过于激进的语法
    target: ['es2015', 'chrome61', 'safari12'],
  },
})
