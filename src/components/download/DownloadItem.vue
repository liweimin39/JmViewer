<script setup>
import { computed } from 'vue'
import { DownloadStatus } from '@/utils/downloadManager.js'

const props = defineProps({
  task: { type: Object, required: true },
})

const emit = defineEmits(['pause', 'resume', 'cancel', 'remove', 'download'])

const statusLabel = computed(() => {
  const map = {
    [DownloadStatus.PENDING]: '等待中',
    [DownloadStatus.DOWNLOADING]: '下载中',
    [DownloadStatus.PACKAGING]: '打包中',
    [DownloadStatus.COMPLETED]: '已完成',
    [DownloadStatus.FAILED]: '失败',
    [DownloadStatus.PAUSED]: '已暂停',
    [DownloadStatus.CANCELLED]: '已取消',
  }
  return map[props.task.status] || props.task.status
})

const statusClass = computed(() => {
  if (props.task.status === DownloadStatus.COMPLETED) return 'success'
  if (props.task.status === DownloadStatus.FAILED) return 'error'
  if (props.task.status === DownloadStatus.PAUSED || props.task.status === DownloadStatus.CANCELLED)
    return 'muted'
  return 'active'
})

const isActive = computed(() =>
  [DownloadStatus.DOWNLOADING, DownloadStatus.PENDING, DownloadStatus.PACKAGING].includes(
    props.task.status,
  ),
)

const isPaused = computed(() =>
  [DownloadStatus.PAUSED, DownloadStatus.FAILED].includes(props.task.status),
)

const isDownloading = computed(() => props.task.status === DownloadStatus.DOWNLOADING)
const isPackaging = computed(() => props.task.status === DownloadStatus.PACKAGING)
const isPending = computed(() => props.task.status === DownloadStatus.PENDING)
const isCompleted = computed(() => props.task.status === DownloadStatus.COMPLETED)

const chapterProgress = computed(() => {
  const cur = props.task.currentChapterIndex || 0
  const total = props.task.totalChapters || props.task.chapterIds?.length || 0
  if (!total) return ''
  return `第 ${cur}/${total} 章`
})

const imageProgress = computed(() => {
  const cur = props.task.currentChapterImageIndex || 0
  const total = props.task.currentChapterImageTotal || 0
  if (!total) return ''
  return `第 ${cur}/${total} 张`
})

const overallProgress = computed(() => {
  const done = props.task.downloadedImages || 0
  const total = props.task.totalImages || 0
  if (!total) return ''
  return `共 ${done}/${total} 张`
})

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div class="download-item" :class="statusClass">
    <div class="di-info">
      <div class="di-title">{{ task.albumName }}</div>

      <div class="di-meta">
        <span class="di-status">{{ statusLabel }}</span>
        <span class="di-chapters">{{ task.chapterIds?.length || 0 }} 章</span>
        <span v-if="task.fileSize" class="di-size">{{ formatSize(task.fileSize) }}</span>
        <span class="di-time">{{ formatTime(task.createdAt) }}</span>
      </div>

      <!-- 下载中 -->
      <template v-if="isDownloading">
        <div class="di-progress-detail">
          <span class="di-chapter-progress">{{ chapterProgress }}</span>
          <span v-if="task.currentChapterName" class="di-chapter-name">
            · {{ task.currentChapterName }}
          </span>
        </div>
        <div class="di-image-progress">
          <span class="di-image-current">{{ imageProgress }}</span>
          <span class="di-image-total">{{ task.progress }}% · {{ overallProgress }}</span>
        </div>
        <div class="di-progress-bar">
          <div class="di-progress-fill" :style="{ width: task.progress + '%' }"></div>
        </div>
      </template>

      <!-- 打包中 -->
      <template v-else-if="isPackaging">
        <div class="di-message">{{ task.message || '正在打包 ZIP...' }}</div>
        <div class="di-progress-bar">
          <div class="di-progress-fill" :style="{ width: task.progress + '%' }"></div>
        </div>
      </template>

      <!-- 等待中 -->
      <template v-else-if="isPending">
        <div class="di-message">{{ task.message || '排队等待中...' }}</div>
      </template>

      <!-- 已完成 -->
      <template v-else-if="isCompleted">
        <div class="di-message success-msg">已完成 · {{ formatSize(task.fileSize) }}</div>
      </template>

      <!-- 其他状态 -->
      <template v-else>
        <div v-if="task.message" class="di-message">{{ task.message }}</div>
        <div v-if="task.status === DownloadStatus.FAILED" class="di-error">
          {{ task.error }}
        </div>
      </template>
    </div>

    <div class="di-actions">
      <!-- 已完成：下载 -->
      <button
        v-if="isCompleted"
        class="di-btn download"
        @click="emit('download', task.id)"
        title="下载 ZIP"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      <!-- 进行中：暂停 -->
      <button v-if="isActive" class="di-btn pause" @click="emit('pause', task.id)" title="暂停">
        ⏸
      </button>

      <!-- 已暂停/失败：继续 -->
      <button v-if="isPaused" class="di-btn resume" @click="emit('resume', task.id)" title="继续">
        ▶
      </button>

      <!-- 进行中/已暂停：取消 -->
      <button
        v-if="isActive || isPaused"
        class="di-btn cancel"
        @click="emit('cancel', task.id)"
        title="取消"
      >
        ✕
      </button>

      <!-- 已完成/已取消：删除 -->
      <button
        v-if="isCompleted || task.status === DownloadStatus.CANCELLED"
        class="di-btn remove"
        @click="emit('remove', task.id)"
        title="删除"
      >
        🗑
      </button>
    </div>
  </div>
</template>
