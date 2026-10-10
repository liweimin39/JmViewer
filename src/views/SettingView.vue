<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import LogsPanel from '@/components/setting/LogsPanel.vue'
import { offlineStorage } from '@/utils/offlineStorage.js'
import { setting } from '@/components/general/Setting.js'
import { setAppIcon, getAppIcon, iconSwitchSupported } from '@/composables/useAppIcon.js'
import '@/styles/setting.css'

const router = useRouter()
const showLogs = ref(false)

// 主题预览色（固定色值，不随当前主题变化，用于色块展示）
const themes = [
  { value: 'pink', label: '粉色', dot: '#ff7aa2' },
  { value: 'blue', label: '蓝色', dot: '#4a97e2' },
  { value: 'green', label: '绿色', dot: '#40b881' },
  { value: 'purple', label: '紫色', dot: '#925ee2' },
  { value: 'gray', label: '灰白', dot: '#8f8f8f' },
  { value: 'dark', label: '深色', dot: '#2a141c' },
]
const currentTheme = computed(() => setting.app_theme)

function chooseTheme(value) {
  setting.setOption('app_theme', value)
}

// 应用图标（渐变预览色与 assets/icon_<theme>.svg 一致）
const icons = [
  { value: 'pink', label: '粉色', dot: 'linear-gradient(135deg,#ffb0cb,#ff5a88)' },
  { value: 'blue', label: '蓝色', dot: 'linear-gradient(135deg,#bcdcf5,#3b8ede)' },
  { value: 'green', label: '绿色', dot: 'linear-gradient(135deg,#bdebd5,#2fae72)' },
  { value: 'purple', label: '紫色', dot: 'linear-gradient(135deg,#d9c6f5,#8a4ede)' },
  { value: 'gray', label: '灰白', dot: 'linear-gradient(135deg,#e0e0e0,#8a8a8a)' },
  { value: 'dark', label: '深色', dot: 'linear-gradient(135deg,#3a2830,#1b1518)' },
]
const currentIcon = computed(() => setting.app_icon)

// 启动时与原生真实图标状态同步
onMounted(async () => {
  if (!iconSwitchSupported) return
  const native = await getAppIcon()
  if (native && native !== setting.app_icon) setting.setOption('app_icon', native)
})

async function chooseIcon(value) {
  if (value === currentIcon.value) return
  const ok = await setAppIcon(value)
  if (ok) setting.setOption('app_icon', value)
  else alert('切换图标失败')
}

async function handleClearTmp() {
  if (!confirm('确定清理临时文件吗？')) return
  try {
    await offlineStorage.clearTmp()
    alert('临时文件已清理')
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
      <!-- 主题配色 -->
      <div class="option option-theme">
        <span class="option-label">主题配色：</span>
        <div class="theme-list">
          <button
            v-for="t in themes"
            :key="t.value"
            class="theme-item"
            :class="{ active: currentTheme === t.value }"
            @click="chooseTheme(t.value)"
          >
            <span class="theme-dot" :style="{ background: t.dot }"></span>
            <span class="theme-name">{{ t.label }}</span>
          </button>
        </div>
      </div>

      <!-- 应用图标（Android / iOS 支持运行时切换） -->
      <div class="option option-theme" v-if="iconSwitchSupported">
        <span class="option-label">应用图标：</span>
        <div class="theme-list">
          <button
            v-for="t in icons"
            :key="t.value"
            class="theme-item"
            :class="{ active: currentIcon === t.value }"
            @click="chooseIcon(t.value)"
          >
            <span class="theme-dot" :style="{ background: t.dot }"></span>
            <span class="theme-name">{{ t.label }}</span>
          </button>
        </div>
      </div>

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

      <!-- 开发者日志 -->
      <div class="option">
        <span class="option-label">开发者日志：</span>
        <button class="setting-action-btn" @click="showLogs = true">查看 / 导出日志</button>
      </div>

      <!-- 临时文件 -->
      <div class="option">
        <span class="option-label">临时文件：</span>
        <button class="setting-action-btn" @click="handleClearTmp">清理临时文件</button>
      </div>
    </div>
  </div>

  <LogsPanel v-if="showLogs" @close="showLogs = false" />
</template>
