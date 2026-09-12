import './styles/basic.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { setting } from '@/components/general/Setting.js'
import { jmApi } from '@/api/JmcomicApi.js'


async function bootstrap() {
  setting.init()
  try {
    await jmApi.init()
  } catch (e) {
    console.error('jmApi 初始化失败（可能是网络问题，页面仍会挂载）:', e)
  }
  createApp(App).use(router).mount('#app')
}

bootstrap()