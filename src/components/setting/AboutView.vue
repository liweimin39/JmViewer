<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import pkg from '../../../package.json'
import '@/styles/setting.css'

const router = useRouter()

const appName = ref('JmViewer')
// Web 端没有原生包信息，回退到 package.json 中的版本号
const version = ref(pkg.version)

onMounted(async () => {
  if (!Capacitor.isNativePlatform()) return
  try {
    const info = await App.getInfo()
    if (info?.name) appName.value = info.name
    if (info?.version) version.value = info.version
  } catch {
    // 获取失败时保留 package.json 版本
  }
})

function goBack() {
  if (window.history.state && window.history.state.position > 0) {
    router.back()
  } else {
    router.push({ name: 'setting' })
  }
}
</script>

<template>
  <div class="setting-body">
    <div class="page-back-bar">
      <button class="page-back-btn" @click="goBack" aria-label="返回">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>返回</span>
      </button>
    </div>

    <h1 class="title">关于</h1>

    <div class="options">
      <div class="about-head">
        <img class="about-logo" src="/icon.png" alt="JmViewer" />
        <div class="about-meta">
          <div class="about-name">{{ appName }}</div>
          <div class="about-version">版本 {{ version }}</div>
        </div>
      </div>

      <div class="option">
        <span class="option-label">应用简介：</span>
        <p class="about-text">
          基于 Jmcomic-webUI 重构的跨平台漫画阅读器，支持 Web / Android / iOS，并提供离线下载与本地阅读。
        </p>
      </div>

      <div class="option">
        <span class="option-label">项目地址：</span>
        <a
          class="option-link"
          href="https://github.com/liweimin39/JmViewer/"
          target="_blank"
          rel="noopener"
          >liweimin39/JmViewer</a
        >
      </div>

      <div class="option">
        <span class="option-label">源项目：</span>
        <a
          class="option-link"
          href="https://github.com/zrhcdy/Jmcomic-webUI"
          target="_blank"
          rel="noopener"
          >zrhcdy/Jmcomic-webUI</a
        >
      </div>

      <div class="option">
        <span class="option-label">技术栈：</span>
        <span class="about-inline">Vue 3 · Vite · Capacitor</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px 20px;
}
.about-logo {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  flex-shrink: 0;
}
.about-name {
  font-size: 22px;
  color: var(--theme-text-title);
}
.about-version {
  margin-top: 6px;
  font-size: 14px;
  color: var(--theme-text-weak);
}
.about-text {
  flex-basis: 100%;
  margin: 0;
  font-size: 15px;
  line-height: 1.7;
  color: var(--theme-text-option);
}
.about-inline {
  font-size: 15px;
  color: var(--theme-text-option);
}
</style>
