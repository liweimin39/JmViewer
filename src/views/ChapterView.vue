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
import '@/styles/chapter.css'

const route = useRoute()
const router = useRouter()

const album = ref(null)
const chapter = ref(null)
const loading = ref(true)
const errorMsg = ref('')

const { currentUser } = useLocalUser()
const { userInfo } = useUser()

const comicId = computed(() => String(route.params.id))

// 系列名缓存（内存级，避免重复请求）
const seriesNameCache = new Map()

/**
 * 获取当前用户 ID
 * ★ 云端优先：登录云端时，历史记到云端账号下
 * ★ 云端未登录时，回退到本地账号
 */
function getCurrentUserId() {
  // 云端优先
  if (userInfo.value?.uid) return String(userInfo.value.uid)
  if (userInfo.value?.username) return `cloud_${userInfo.value.username}`
  // 回退到本地
  if (currentUser.value?.id) return currentUser.value.id
  return null
}

/**
 * 判断 id 是否有效
 * "0" / "" / "null" / "undefined" / "NaN" 都视为无效
 */
function isValidId(id) {
  if (id == null) return false
  const s = String(id).trim()
  if (!s) return false
  if (s === '0' || s === 'null' || s === 'undefined' || s === 'NaN') return false
  return true
}

/**
 * 计算系列 key
 * - series_id 有效 → 用它（多章节漫画）
 * - series_id 无效（null / "" / 0 / "0"）→ 用 a.id（单章节漫画）
 */
function resolveSeriesKey(a) {
  if (isValidId(a.series_id)) return String(a.series_id)
  return String(a.id)
}

/**
 * 提取系列信息
 *
 * 三种情况：
 * 1. 多章节漫画：series_id 有效 + series 数组有内容
 * 2. 单章节漫画：series_id 无效 → seriesKey = a.id，直接用 a.name
 * 3. 首次请求（series[0].name 为空）→ 请求第一话专辑拿名字
 */
async function extractSeriesInfo(a) {
  const seriesKey = resolveSeriesKey(a)

  // 命中缓存
  if (seriesNameCache.has(seriesKey)) {
    const cached = seriesNameCache.get(seriesKey)
    return { seriesKey, seriesName: cached.name, coverId: cached.coverId }
  }

  let seriesName = a.name || ''
  let coverId = seriesKey

  if (Array.isArray(a.series) && a.series.length > 0) {
    // 找第一话：sort 优先，其次 id 数字大小
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
        // 第一话自带名字
        seriesName = first.name
      } else if (String(first.id) !== String(a.id)) {
        // 第一话名字为空且当前不是第一话 → 请求第一话专辑
        try {
          const firstAlbum = await jmApi.getComicAlbum(first.id)
          if (firstAlbum?.name) seriesName = firstAlbum.name
        } catch (e) {
          console.warn('[History] 获取系列首话失败:', e)
        }
      }
      // 当前就是第一话 → 直接用 a.name
    }
  }
  // else: 单章节漫画，series 为空 → 保持 a.name

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
    const [a, c] = await Promise.all([
      jmApi.getComicAlbum(comicId.value),
      jmApi.getComicChapter(comicId.value),
    ])
    album.value = a
    chapter.value = c

    // 记录浏览历史（云端优先，未登录云端时用本地）
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

function scrollToContent() {
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

        <ComicContent :chapter="chapter" />
      </div>

      <div class="body-right">
        <RecommendedComics :list="album.related_list || []" />
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
  color: var(--theme-danger-soft);
  font-size: 18px;
}
</style>
