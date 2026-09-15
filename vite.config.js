import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    vue(),
    legacy({
      targets: ['chrome >= 61', 'safari >= 12', 'ios_saf >= 12', 'android >= 7'],
      modernPolyfills: [
        'es.object.has-own',
        'es.array.at',
        'es.array.find-last',
        'es.array.find-last-index',
        'es.promise.with-resolvers',
        'web.structured-clone',
        'web.dom-collections.iterator',
      ],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: { transformer: 'postcss' },
  build: {
    cssMinify: false,
    target: ['es2015', 'safari12', 'chrome61'],
    modulePreload: { polyfill: false },
  },
})
