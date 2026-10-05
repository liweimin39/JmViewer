<script setup>
import { ref } from 'vue'
import LogsPanel from '@/components/setting/LogsPanel.vue'
import { offlineStorage } from '@/utils/offlineStorage.js'
import { logger } from '@/utils/logger.js'
import '@/styles/setting.css'

const showLogs = ref(false)

async function handleClearTmp() {
  if (!confirm('确定清理临时文件吗？')) return
  try {
    await offlineStorage.clearTmp()
    alert('临时文件已清理')
  } catch (e) {
    alert('清理失败：' + e.message)
  }
}
</script>

<template>
  <div class="setting-body">
    <h1 class="title">设置</h1>

    <div class="options">
      <!-- 本项目 GitHub -->
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

      <!-- 源项目 GitHub -->
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

      <!-- 开发者日志 -->
      <div class="option">
        <span class="option-label">开发者日志：</span>
        <button class="setting-action-btn" @click="showLogs = true">查看 / 导出日志</button>
      </div>

      <div class="option">
        <span>临时文件：</span>
        <button class="setting-action-btn" @click="handleClearTmp">清理临时文件</button>
      </div>
    </div>
  </div>

  <LogsPanel v-if="showLogs" @close="showLogs = false" />
</template>
