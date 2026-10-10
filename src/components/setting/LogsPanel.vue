<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { logger } from '@/utils/logger.js'

const emit = defineEmits(['close'])

const logs = ref([])
const fileSize = ref(0)
const exporting = ref(false)
const toast = ref(null)
const autoScroll = ref(true)

const listRef = ref(null)

function showToast(msg, type = 'success') {
  toast.value = { msg, type }
  setTimeout(() => {
    toast.value = null
  }, 2000)
}

function refresh() {
  logs.value = logger.getLogs()
  logger.getFileSize().then((s) => {
    fileSize.value = s
  })
}

async function handleExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    await logger.export()
    showToast('日志已导出')
  } catch (e) {
    if (!/cancel/i.test(e?.message || '')) {
      showToast('导出失败：' + (e?.message || ''), 'error')
    }
  } finally {
    exporting.value = false
  }
}

async function handleClear() {
  if (!confirm('确定清空所有日志吗？')) return
  await logger.clear()
  refresh()
  showToast('日志已清空')
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function levelClass(level) {
  return 'log-line log-' + level
}

let timer = null
onMounted(() => {
  refresh()
  timer = setInterval(refresh, 2000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="logs-overlay" @click.self="emit('close')">
    <div class="logs-panel">
      <div class="logs-header">
        <h3>开发者日志</h3>
        <button class="logs-close" @click="emit('close')">✕</button>
      </div>

      <div class="logs-info">
        <span>{{ logs.length }} 条</span>
        <span>·</span>
        <span>{{ formatSize(fileSize) }}</span>
        <span class="logs-path">{{ logger.getFilePath() }}</span>
      </div>

      <div class="logs-list" ref="listRef">
        <div v-for="(entry, i) in logs" :key="i" :class="levelClass(entry.level)">
          <span class="log-time">{{ entry.time.replace('T', ' ').slice(0, 23) }}</span>
          <span class="log-msg">{{ entry.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="logs-empty">暂无日志</div>
      </div>

      <div class="logs-actions">
        <button class="logs-btn" @click="refresh">刷新</button>
        <button class="logs-btn primary" :disabled="exporting" @click="handleExport">
          <span v-if="!exporting">导出</span>
          <span v-else>导出中...</span>
        </button>
        <button class="logs-btn danger" @click="handleClear">清空</button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="toast"
        :style="{
          position: 'fixed',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'error' ? 'var(--theme-danger-btn)' : 'var(--theme-success)',
          color: 'var(--theme-text-inverse)',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '15px',
          zIndex: 10001,
          boxShadow: '0 4px 12px var(--theme-overlay-soft)',
        }"
      >
        {{ toast.msg }}
      </div>
    </Teleport>
  </div>
</template>
