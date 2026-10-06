<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import LogsPanel from '@/components/setting/LogsPanel.vue'
import { offlineStorage } from '@/utils/offlineStorage.js'
import '@/styles/setting.css'

const router = useRouter()
const showLogs = ref(false)

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
      <!-- GitHub 链接 -->
      <div class="option">
        <span class="option-label">前往此项目的 github：</span>
        <a
          class="option-link"
          href="https://github.com/liweimin39/Jmcomic-webUI"
          target="_blank"
          rel="noopener"
          >https://github.com/liweimin39/Jmcomic-webUI</a
        >
      </div>
      <div class="option">
        <span class="option-label">前往源项目的 github：</span>
        <a
          class="option-link"
          href="https://github.com/zrhcdy/Jmcomic-webUI"
          target="_blank"
          rel="noopener"
          >https://github.com/zrhcdy/Jmcomic-webUI</a
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
