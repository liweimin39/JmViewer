<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { jmApi } from '@/api/JmcomicApi.js'
import { downloadManager } from '@/utils/downloadManager.js'
import '@/styles/download.css'

const route = useRoute()
const router = useRouter()

const album = ref(null)
const chapter = ref(null)
const loading = ref(true)
const errorMsg = ref('')

const selectedIds = ref(new Set())
const preparing = ref(false)

const albumId = computed(() => String(route.params.albumId))

// series 为空时用 album 自身构造单章
const series = computed(() => {
  if (!chapter.value || !album.value) return []

  const s = chapter.value.series
  if (Array.isArray(s) && s.length > 0) {
    return s
  }

  return [
    {
      id: album.value.id,
      name: album.value.name || '全一话',
    },
  ]
})

const coverUrl = computed(() => (album.value ? jmApi.getCoverImageURL(album.value.id) : ''))
const authorText = computed(() => {
  if (!album.value?.author) return ''
  return Array.isArray(album.value.author) ? album.value.author.join(' & ') : album.value.author
})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [a, c] = await Promise.all([
      jmApi.getComicAlbum(albumId.value),
      jmApi.getComicChapter(albumId.value),
    ])
    album.value = a
    chapter.value = c

    // 预选
    const preselect = route.query.preselect
    if (preselect) {
      const set = new Set()
      const found = (series.value || []).find((ch) => String(ch.id) === String(preselect))
      if (found) set.add(found.id)
      selectedIds.value = set
    } else {
      // 单章漫画：默认选中
      if (!Array.isArray(c.series) || c.series.length === 0) {
        selectedIds.value = new Set([a.id])
      }
    }
  } catch (e) {
    console.error(e)
    errorMsg.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function toggle(chapterId) {
  const set = new Set(selectedIds.value)
  if (set.has(chapterId)) set.delete(chapterId)
  else set.add(chapterId)
  selectedIds.value = set
}

function selectAll() {
  const set = new Set(selectedIds.value)
  for (const ch of series.value) set.add(ch.id)
  selectedIds.value = set
}

function deselectAll() {
  selectedIds.value = new Set()
}

function invertSelection() {
  const set = new Set()
  for (const ch of series.value) {
    if (!selectedIds.value.has(ch.id)) set.add(ch.id)
  }
  selectedIds.value = set
}

/** 并发拉取选中章节的完整数据（含 images） */
async function fetchChapterData(ids, concurrency = 3) {
  const results = []
  let idx = 0
  const total = ids.length

  async function worker() {
    while (idx < total) {
      const i = idx++
      const id = ids[i]
      try {
        const data = await jmApi.getComicChapter(id)
        const src = series.value.find((s) => String(s.id) === String(id))
        results.push({
          id,
          name: src?.name || data.name || `第${i + 1}章`,
          images: data.images || [],
        })
      } catch (e) {
        console.warn(`拉取章节 ${id} 失败:`, e)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker())
  await Promise.all(workers)

  const orderMap = new Map(ids.map((id, i) => [String(id), i]))
  results.sort((a, b) => orderMap.get(String(a.id)) - orderMap.get(String(b.id)))
  return results
}

async function startDownload() {
  if (preparing.value) return
  const selected = series.value.filter((ch) => selectedIds.value.has(ch.id))
  if (selected.length === 0) {
    alert('请至少选择一个章节')
    return
  }

  preparing.value = true
  try {
    const ids = selected.map((ch) => ch.id)
    const fullChapters = await fetchChapterData(ids)

    const validChapters = fullChapters.filter((c) => c.images && c.images.length > 0)
    if (validChapters.length === 0) {
      alert('章节数据拉取失败或没有图片')
      return
    }

    await downloadManager.addTask(album.value, validChapters)
    alert(`已添加下载任务：${validChapters.length} 章`)
    router.push('/downloads')
  } catch (e) {
    alert(e?.message || '添加下载失败')
  } finally {
    preparing.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="dl-detail-page">
    <div v-if="loading" class="dl-detail-loading">
      <div class="loading-icon"></div>
    </div>

    <div v-else-if="errorMsg" class="dl-detail-error">{{ errorMsg }}</div>

    <template v-else-if="album && chapter">
      <!-- 返回栏 -->
      <div class="dl-detail-nav">
        <button class="dl-back-btn" @click="router.back()">
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
          返回
        </button>
        <h1 class="dl-page-title">下载漫画</h1>
      </div>

      <!-- 上部：漫画信息 -->
      <div class="dl-detail-header">
        <div class="dl-detail-cover">
          <img :src="coverUrl" alt="cover" />
        </div>
        <div class="dl-detail-info">
          <h1 class="dl-detail-title">{{ album.name }}</h1>
          <h2 class="dl-detail-author">{{ authorText }}</h2>
          <div class="dl-detail-tags" v-if="album.tags?.length">
            <span v-for="t in album.tags.slice(0, 6)" :key="t" class="dl-tag">{{ t }}</span>
          </div>
          <p class="dl-detail-desc" v-if="album.description">{{ album.description }}</p>
        </div>
      </div>

      <!-- 中部：工具栏（去掉搜索框） -->
      <div class="dl-toolbar">
        <div class="dl-toolbar-actions">
          <button class="dl-tool-btn" @click="selectAll">全选</button>
          <button class="dl-tool-btn" @click="deselectAll">全不选</button>
          <button class="dl-tool-btn" @click="invertSelection">反选</button>
        </div>
      </div>

      <!-- 下部：章节列表 -->
      <div class="dl-chapter-list">
        <div v-if="series.length === 0" class="dl-no-chapter">没有找到章节</div>
        <div
          v-for="(ch, i) in series"
          :key="ch.id"
          class="dl-chapter-item"
          :class="{ selected: selectedIds.has(ch.id) }"
          @click="toggle(ch.id)"
        >
          <div class="dl-checkbox">
            <svg
              v-if="selectedIds.has(ch.id)"
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div class="dl-chapter-name">{{ ch.name || `第${i + 1}章` }}</div>
        </div>
      </div>

      <!-- 底部固定栏 -->
      <div class="dl-footer">
        <div class="dl-footer-info">
          <div class="dl-selected-count">
            已选 <strong>{{ selectedIds.size }}</strong> / {{ series.length }} 章
          </div>
          <div class="dl-hint">下载后可导出为 ZIP</div>
        </div>
        <button
          class="dl-start-btn"
          :disabled="selectedIds.size === 0 || preparing"
          @click="startDownload"
        >
          <span v-if="!preparing">开始下载 ({{ selectedIds.size }})</span>
          <span v-else>准备中...</span>
        </button>
      </div>
    </template>
  </div>
</template>
