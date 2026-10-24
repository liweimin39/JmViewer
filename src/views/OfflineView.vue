<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { jmApi } from '@/api/JmcomicApi.js'
import { offlineDB } from '@/utils/offlineDB.js'
import { offlineStorage } from '@/utils/offlineStorage.js'
import { downloadManager, DownloadStatus } from '@/utils/downloadManager.js'
import '@/styles/offline.css'

const router = useRouter()

const DEFAULT_COVER = '/image/cover_default.jpg'
const isNative = Capacitor.isNativePlatform()

const albums = ref([])
const loading = ref(true)
const expandedId = ref(null)
const chapters = ref([])
const chapterLoading = ref(false)

const totalBytes = computed(() => albums.value.reduce((sum, a) => sum + (a.bytes || 0), 0))

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

function coverSrc(album) {
  if (album.coverUri) return Capacitor.convertFileSrc(album.coverUri)
  if (album.id) return jmApi.getCoverImageURL(album.id)
  return DEFAULT_COVER
}

function onCoverError(e) {
  if (e.target.src.includes('cover_default')) return
  e.target.onerror = null
  e.target.src = DEFAULT_COVER
}

async function loadAlbums() {
  loading.value = true
  try {
    albums.value = await offlineDB.listAlbums()
  } catch (e) {
    console.warn('[Offline] 读取离线库失败:', e)
    albums.value = []
  } finally {
    loading.value = false
  }
}

async function toggleAlbum(album) {
  if (expandedId.value === album.id) {
    expandedId.value = null
    return
  }

  expandedId.value = album.id
  chapters.value = []
  chapterLoading.value = true
  try {
    chapters.value = await offlineDB.listChapters(album.id)
  } catch (e) {
    console.warn('[Offline] 读取章节失败:', e)
  } finally {
    chapterLoading.value = false
  }
}

function openChapter(chapter) {
  // 离线阅读走独立页面，不与在线阅读页混用
  router.push({ name: 'offline-chapter', params: { id: chapter.id } })
}

async function removeAlbum(album) {
  if (!confirm(`删除「${album.name}」的全部离线文件？`)) return

  try {
    const task = downloadManager
      .getTasks()
      .find(
        (t) =>
          String(t.albumId) === String(album.id) && t.status === DownloadStatus.COMPLETED,
      )

    if (task) {
      // 同步删除文件、数据库记录与下载任务
      await downloadManager.remove(task.id)
    } else {
      await offlineStorage.remove(offlineStorage.decodedAlbumPath(album.id))
      await offlineDB.deleteAlbum(album.id)
    }

    if (expandedId.value === album.id) expandedId.value = null
    await loadAlbums()
  } catch (e) {
    alert('删除失败：' + (e?.message || '未知错误'))
  }
}

onMounted(async () => {
  if (!isNative) {
    loading.value = false
    return
  }
  // 初始化下载管理器，删除时才能复用其文件清理逻辑
  try {
    await downloadManager.init()
  } catch {}
  await loadAlbums()
})
</script>

<template>
  <div class="offline-page">
    <h1 class="off-title">离线漫画</h1>

    <div v-if="albums.length > 0" class="off-summary">
      共 {{ albums.length }} 部 · 占用 {{ formatSize(totalBytes) }}
    </div>

    <div v-if="!isNative" class="off-notice">
      离线库依赖本地数据库，仅在 Android / iOS 客户端可用。
    </div>

    <div v-if="loading" class="off-empty">加载中...</div>

    <div v-else-if="isNative && albums.length === 0" class="off-empty">
      <p>暂无离线漫画</p>
      <p class="off-empty-hint">在漫画详情页选择章节下载，完成后即可离线阅读</p>
    </div>

    <div v-else-if="isNative" class="off-list">
      <div v-for="album in albums" :key="album.id" class="off-card">
        <div class="off-card-main" @click="toggleAlbum(album)">
          <div class="off-cover">
            <img :src="coverSrc(album)" :alt="album.name" @error="onCoverError" />
          </div>

          <div class="off-info">
            <div class="off-name">{{ album.name }}</div>
            <div v-if="album.author" class="off-author">{{ album.author }}</div>
            <div class="off-meta">
              <span class="off-badge">已离线</span>
              <span>{{ album.chapterCount }} 章</span>
              <span>{{ formatSize(album.bytes) }}</span>
            </div>
          </div>

          <div class="off-actions">
            <span class="off-chevron" :class="{ open: expandedId === album.id }">›</span>
            <button class="off-del" title="删除离线文件" @click.stop="removeAlbum(album)">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="expandedId === album.id" class="off-chapters">
          <div v-if="chapterLoading" class="off-chapter-hint">加载中...</div>
          <div v-else-if="chapters.length === 0" class="off-chapter-hint">暂无已下载章节</div>
          <div
            v-else
            v-for="chapter in chapters"
            :key="chapter.id"
            class="off-chapter"
            @click="openChapter(chapter)"
          >
            <span class="off-ch-name">{{ chapter.name || `第 ${chapter.idx + 1} 章` }}</span>
            <span class="off-ch-meta">{{ chapter.imageCount }} 张 · {{ formatSize(chapter.bytes) }}</span>
            <span class="off-ch-arrow">›</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
