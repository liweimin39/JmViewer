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
import { localDB } from '@/utils/localDB.js'
import '@/styles/chapter.css'

const route = useRoute()
const router = useRouter()

const album = ref(null)
const chapter = ref(null)
const loading = ref(true)
const errorMsg = ref('')

const { currentUser } = useLocalUser()

const comicId = computed(() => String(route.params.id))

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

    if (currentUser.value && a && c) {
      try {
        await localDB.addHistory(currentUser.value.id, {
          comicId: a.id,
          name: a.name,
          author: a.author,
          chapterId: c.id,
          chapterName: c.name || `第${c.id}章`,
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

// ============ 下载 → 跳转独立页面 ============

/** ComicHead 的"下载"按钮 → 跳转下载页（无预选） */
function onDownloadAll() {
  if (!album.value) return
  router.push(`/download/${album.value.id}`)
}

/** 章节列表某一章的"下载"按钮 → 跳转下载页并预选该章 */
function onDownloadChapter(chapterItem) {
  if (!album.value) return
  router.push(`/download/${album.value.id}?preselect=${chapterItem.id}`)
}

// ==========================================

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
  color: #d9534f;
  font-size: 18px;
}
</style>
