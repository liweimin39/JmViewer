<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import LogsPanel from '@/components/setting/LogsPanel.vue'
import { offlineStorage } from '@/utils/offlineStorage.js'
import { setting } from '@/components/general/Setting.js'
import '@/styles/setting.css'

const router = useRouter()
const showLogs = ref(false)

// 主题配色：取值与色卡照搬原项目 Jmcomic-webUI
const theme = ref(setting.app_theme)
const themeOptions = [
  { value: 'pink', name: '粉色', color: '#f8bbd0' },
  { value: 'blue', name: '蓝色', color: '#bcdcf5' },
  { value: 'green', name: '绿色', color: '#bdebd5' },
  { value: 'purple', name: '紫色', color: '#d9c6f5' },
  { value: 'gray', name: '灰白', color: '#b8b8b8' },
  { value: 'dark', name: '深色', color: '#3a2830' },
]

function pickTheme(value) {
  setting.setTheme(value)
  theme.value = value
}

// 漫画图片加载方式：direct = 原实现，blob = 先取字节再用 blob 渲染
const loadMode = ref(setting.img_load_mode)
const loadModes = [
  { value: 'direct', name: '原图直链' },
  { value: 'blob', name: 'Blob 加载' },
]

function pickLoadMode(value) {
  setting.setOption('img_load_mode', value)
  loadMode.value = value
}

async function handleClearTmp() {
  if (!confirm('确定清理临时文件吗？将同时清理网页缓存的图片')) return
  try {
    const { failed } = await offlineStorage.clearTmp()
    const { supported, cleared } = await offlineStorage.clearImageCache()

    const notes = [
      failed > 0 ? `临时文件清理完成，但有 ${failed} 项删除失败` : '临时文件已清理',
    ]
    if (cleared) notes.push('网页图片缓存已清理')
    else if (supported) notes.push('网页图片缓存清理失败')
    else notes.push('当前平台无法清理浏览器图片缓存')
    alert(notes.join('\n'))
  } catch (e) {
    alert('清理失败：' + (e?.message || '未知错误'))
  }
}

function goLocalData() {
  router.push({ name: 'setting-local-data' })
}
</script>

<template>
  <div class="setting-body">
    <h1 class="title">设置</h1>

    <div class="options">
      <!-- GitHub 链接 -->
      <div class="option">
        <span class="option-label">前往此项目的 github：</span>
        <a
          class="option-link"
          href="https://github.com/liweimin39/JmViewer/"
          target="_blank"
          rel="noopener"
          >liweimin39/JmViewer/</a
        >
      </div>
      <div class="option">
        <span class="option-label">前往源项目的 github：</span>
        <a
          class="option-link"
          href="https://github.com/zrhcdy/Jmcomic-webUI"
          target="_blank"
          rel="noopener"
          >zrhcdy/Jmcomic-webUI</a
        >
      </div>

      <!-- ★ 本地数据管理（可点击，进入独立页面） -->
      <div class="option option-clickable" @click="goLocalData">
        <span class="option-label">本地数据管理</span>
        <svg
          class="option-arrow"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      <!-- 主题配色 -->
      <div class="option">
        <span class="option-label">主题配色：</span>
        <div class="theme-list">
          <button
            v-for="t in themeOptions"
            :key="t.value"
            class="theme-item"
            :class="{ active: theme === t.value }"
            @click="pickTheme(t.value)"
          >
            <span class="theme-dot" :style="{ background: t.color }"></span>
            <span>{{ t.name }}</span>
          </button>
        </div>
      </div>

      <!-- 图片加载方式 -->
      <div class="option">
        <span class="option-label">图片加载方式：</span>
        <div class="theme-list">
          <button
            v-for="m in loadModes"
            :key="m.value"
            class="theme-item"
            :class="{ active: loadMode === m.value }"
            @click="pickLoadMode(m.value)"
          >
            <span>{{ m.name }}</span>
          </button>
        </div>
        <p class="section-tip">
          Blob 加载：先取图片字节再渲染，可避免解密失败与 base64 内存膨胀；切换后重新进入章节生效
        </p>
      </div>

      <!-- 开发者日志 -->
      <div class="option">
        <span class="option-label">开发者日志：</span>
        <button class="setting-action-btn" @click="showLogs = true">查看 / 导出日志</button>
      </div>

      <!-- 临时文件 + 网页图片缓存 -->
      <div class="option">
        <span class="option-label">临时文件：</span>
        <button class="setting-action-btn" @click="handleClearTmp">清理临时文件</button>
        <p class="section-tip">
          同时清理网页缓存的图片（Android / iOS 清理 WebView 缓存，Web 端由浏览器管理）
        </p>
      </div>
    </div>
  </div>

  <LogsPanel v-if="showLogs" @close="showLogs = false" />
</template>
