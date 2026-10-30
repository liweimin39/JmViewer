<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { jmApi } from '@/api/JmcomicApi.js'
import ComicHead from '@/components/chapter/ComicHead.vue'
import EvaluationBar from '@/components/chapter/EvaluationBar.vue'
import CommentList from '@/components/chapter/CommentList.vue'
import ChapterList from '@/components/chapter/ChapterList.vue'
import RecommendedComics from '@/components/chapter/RecommendedComics.vue'
import ComicContent from '@/components/chapter/ComicContent.vue'
import { useLocalUser } from '@/composables/useLocalUser.js'
import { useUser } from '@/composables/useUser.js'
import { localDB } from '@/utils/localDB.js'
import { setting } from '@/components/general/Setting.js'
import '@/styles/chapter.css'

const route = useRoute()
const router = useRouter()

const comicContentRef = ref(null)

const album = ref(null)
const chapter = ref(null)
const loading = ref(true)
const errorMsg = ref('')

const { currentUser } = useLocalUser()
const { userInfo } = useUser()

const comicId = computed(() => String(route.params.id))

const seriesNameCache = new Map()

function getCurrentUserId() {
  if (userInfo.value?.uid) return String(userInfo.value.uid)
  if (userInfo.value?.username) return `cloud_${userInfo.value.username}`
  if (currentUser.value?.id) return currentUser.value.id
  return null
}

function isValidId(id) {
  if (id == null) return false
  const s = String(id).trim()
  if (!s) return false
  if (s === '0' || s === 'null' || s === 'undefined' || s === 'NaN') return false
  return true
}

function resolveSeriesKey(a) {
  if (isValidId(a.series_id)) return String(a.series_id)
  return String(a.id)
}

async function extractSeriesInfo(a) {
  const seriesKey = resolveSeriesKey(a)

  if (seriesNameCache.has(seriesKey)) {
    const cached = seriesNameCache.get(seriesKey)
    return { seriesKey, seriesName: cached.name, coverId: cached.coverId }
  }

  let seriesName = a.name || ''
  let coverId = seriesKey

  if (Array.isArray(a.series) && a.series.length > 0) {
    let first = a.series[0]
    for (const s of a.series) {
      if (s?.sort != null && first?.sort != null) {
        if (Number(s.sort) < Number(first.sort)) first = s
      } else if (s?.id != null && first?.id != null) {
        if (Number(s.id) < Number(first.id)) first = s
      }
    }

    if (first && isValidId(first.id)) {
      coverId = String(first.id)

      if (first.name && first.name.trim()) {
        seriesName = first.name
      } else if (String(first.id) !== String(a.id)) {
        try {
          const firstAlbum = await jmApi.getComicAlbum(first.id)
          if (firstAlbum?.name) seriesName = firstAlbum.name
        } catch (e) {
          console.warn('[History] 获取系列首话失败:', e)
        }
      }
    }
  }

  seriesNameCache.set(seriesKey, { name: seriesName, coverId })

  return { seriesKey, seriesName, coverId }
}

function addRootClass() {
  const root = document.querySelector('.root')
  if (root) root.classList.add('chapter-page-bg')
}
function removeRootClass() {
  const root = document.querySelector('.root')
  if (root) root.classList.remove('chapter-page-bg')
}

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  album.value = null
  chapter.value = null
  try {
    // 在线阅读页只用在线数据；已下载内容走 /offline/chapter/:id
    const [a, c] = await Promise.all([
      jmApi.getComicAlbum(comicId.value),
      jmApi.getComicChapter(comicId.value),
    ])

    album.value = a
    chapter.value = c

    const userId = getCurrentUserId()
    if (userId && a && c) {
      try {
        const { seriesKey, seriesName, coverId } = await extractSeriesInfo(a)

        await localDB.addHistory(userId, {
          comicId: seriesKey,
          name: seriesName,
          author: a.author,
          coverId,
          chapterId: c.id,
          chapterName: c.name || `第${c.id}章`,
          currentAlbumId: a.id,
        })
      } catch (e) {
        console.warn('记录历史失败:', e)
      }
    }
  } catch (e) {
    console.error(e)
    errorMsg.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (window.history.state && window.history.state.position > 0) {
    router.back()
  } else {
    router.push({ name: 'home' })
  }
}

function scrollToContent() {
  if (setting.auto_fullscreen_reader === 'on' && comicContentRef.value?.enterReader) {
    comicContentRef.value.enterReader()
    return
  }
  document.querySelector('.comic-content-cr')?.scrollIntoView({ behavior: 'smooth' })
}

function onDownloadAll() {
  if (!album.value) return
  router.push(`/download/${album.value.id}`)
}

function onDownloadChapter(chapterItem) {
  if (!album.value) return
  router.push(`/download/${album.value.id}?preselect=${chapterItem.id}`)
}

watch(comicId, (newId, oldId) => {
  if (newId === oldId) return
  window.scrollTo({ top: 0 })
  loadAll()
})

onMounted(() => {
  addRootClass()
  if (!/^\d+$/.test(comicId.value)) {
    errorMsg.value = 'ID 无效'
    loading.value = false
    return
  }
  loadAll()
})

onBeforeUnmount(() => {
  removeRootClass()
})
</script>

<template>
  <!-- 返回栏 -->
  <div class="reader-back-bar">
    <button class="reader-back-btn" @click="goBack" aria-label="返回">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="20"
        height="20"
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

  <div v-if="loading" class="chapter-page-loading">
    <div class="loading-icon"></div>
  </div>
  <div v-else-if="errorMsg" class="chapter-page-error">{{ errorMsg }}</div>

  <template v-else-if="album && chapter">
    <ComicHead :album="album" @read="scrollToContent" @download-all="onDownloadAll" />

    <div class="body">
      <div class="body-left">
        <div class="mob-det-info">
          <div class="tags">
            <div v-for="t in album.tags" :key="t" class="tag">{{ t }}</div>
          </div>
          <div class="introduction">{{ album.description }}</div>
        </div>

        <EvaluationBar :album="album" />

        <CommentList :album="album" />

        <ChapterList
          :series="chapter.series"
          :current-id="comicId"
          :album-id="album.id"
          @download="onDownloadChapter"
        />

        <ComicContent ref="comicContentRef" :chapter="chapter" />
      </div>

      <div class="body-right">
        <RecommendedComics :list="album.related_list || []" />
        <!-- 进度条 + 装饰图 Teleport 落点 -->
        <div class="progress-slot"></div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.chapter-page-loading {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chapter-page-error {
  padding: 100px 20px;
  text-align: center;
  color: #d9534f;
  font-size: 18px;
}
</style>
