<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ComicHead from '@/components/chapter/ComicHead.vue'
import ChapterList from '@/components/chapter/ChapterList.vue'
import ComicContent from '@/components/chapter/ComicContent.vue'
import { offlineDB } from '@/utils/offlineDB.js'
import { setting } from '@/components/general/Setting.js'
import '@/styles/chapter.css'

const route = useRoute()
const router = useRouter()

const comicContentRef = ref(null)

const album = ref(null)
const chapter = ref(null)
const loading = ref(true)
const errorMsg = ref('')

const chapterId = computed(() => String(route.params.id))

function addRootClass() {
  const root = document.querySelector('.root')
  if (root) {
    root.classList.add('chapter-page-bg')
    // 复用在线阅读页的 page-chapter 布局规则，保证标题字号等完全一致
    root.classList.add('page-chapter')
  }
}
function removeRootClass() {
  const root = document.querySelector('.root')
  if (root) {
    root.classList.remove('chapter-page-bg')
    root.classList.remove('page-chapter')
  }
}

/** 只读本地 SQLite 与磁盘文件，不做任何在线回退 */
async function loadOffline() {
  loading.value = true
  errorMsg.value = ''
  album.value = null
  chapter.value = null
  try {
    const data = await offlineDB.getOfflineChapter(chapterId.value)
    if (!data) {
      errorMsg.value = '该章节尚未下载，无法离线阅读'
      return
    }
    album.value = data.album
    chapter.value = data.chapter
  } catch (e) {
    errorMsg.value = e.message || '读取离线数据失败'
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (window.history.state && window.history.state.position > 0) {
    router.back()
  } else {
    router.push({ name: 'offline' })
  }
}

function scrollToContent() {
  if (setting.auto_fullscreen_reader === 'on' && comicContentRef.value?.enterReader) {
    comicContentRef.value.enterReader()
    return
  }
  document.querySelector('.comic-content-cr')?.scrollIntoView({ behavior: 'smooth' })
}

watch(chapterId, (newId, oldId) => {
  if (newId === oldId) return
  window.scrollTo({ top: 0 })
  loadOffline()
})

onMounted(() => {
  addRootClass()
  loadOffline()
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

  <div v-else-if="errorMsg" class="chapter-page-error">
    {{ errorMsg }}
    <RouterLink class="back-offline" to="/offline">返回离线库</RouterLink>
  </div>

  <template v-else-if="album && chapter">
    <ComicHead :album="album" offline @read="scrollToContent" />

    <div class="body">
      <div class="body-left">
        <div class="mob-det-info">
          <div class="tags">
            <div v-for="t in album.tags" :key="t" class="tag">{{ t }}</div>
          </div>
          <div class="introduction">{{ album.description }}</div>
        </div>

        <ChapterList
          :series="chapter.series"
          :current-id="chapterId"
          route-prefix="/offline/chapter/"
        />

        <ComicContent ref="comicContentRef" :chapter="chapter" />
      </div>

      <div class="body-right">
        <!-- 进度条 Teleport 落点 -->
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
.back-offline {
  display: inline-block;
  margin-top: 16px;
  font-size: 14px;
  color: var(--theme-accent-main);
  text-decoration: none;
}
</style>
