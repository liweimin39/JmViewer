<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { jmApi } from '@/api/JmcomicApi.js'
import { InfinityScrollContainer } from '@/components/general/InfinityScrollContainer.js'
import ComicCard from '@/components/latest/ComicCard.vue'
import '@/styles/search.css'

const route = useRoute()

const searchQuery = computed(() => String(route.query.sq || '').trim())

// 顺序和原 HTML 里 sort-item 的顺序一致
const modes = [
  { key: 'mostViews', label: '搜索模式：按观看量', value: 'mv' },
  { key: 'addTime',   label: '搜索模式：按时间',   value: '' },
  { key: 'mostLikes', label: '搜索模式：按点赞量', value: 'tf' },
  { key: 'day',       label: '搜索模式：按日排行', value: 'mv_t' },
]
const currentModeIndex = ref(0)
const comics = ref([])
const loading = ref(false)

let scrollContainer = null

async function loadContent(page) {
  loading.value = true
  try {
    // 原代码特殊逻辑：如果搜索词是大于 10 的整数，先当漫画 ID 查一次
    if (page === 1 && Number.isInteger(+searchQuery.value) && +searchQuery.value > 10) {
      try {
        const album = await jmApi.getComicAlbum(searchQuery.value)
        if (album && album.name) {
          comics.value = comics.value.concat([album])
        }
      } catch (err) {
        console.error('通过 ID 获取漫画失败:', err)
      }
    }

    const list = await jmApi.getSearchResults(
      searchQuery.value,
      page,
      modes[currentModeIndex.value].value
    )
    if (list && Array.isArray(list.content)) {
      comics.value = comics.value.concat(list.content)
      if (list.total !== undefined && scrollContainer) {
        scrollContainer.maxPageIndex = Math.ceil(list.total / 80)
      }
    }
  } finally {
    loading.value = false
  }
}

function initPage() {
  if (scrollContainer) {
    scrollContainer.destroy()
    scrollContainer = null
  }
  comics.value = []
  loading.value = false

  if (!searchQuery.value) return

  scrollContainer = new InfinityScrollContainer({
    threshold: 100,
    coolingTime: 500,
    loadContent: (page) => loadContent(page),
  })
  scrollContainer.pageIndex = 1
  loadContent(1)
  scrollContainer.init()
}

// 切换排序模式：重置列表 + 重新搜索
function research() {
  if (!scrollContainer) return
  comics.value = []
  scrollContainer.pageIndex = 1
  scrollContainer.maxPageIndex = 10000
  loadContent(1)
}

function nextMode() {
  currentModeIndex.value = (currentModeIndex.value + 1) % modes.length
  research()
}

onMounted(initPage)

onBeforeUnmount(() => {
  if (scrollContainer) {
    scrollContainer.destroy()
    scrollContainer = null
  }
})

// ★ 关键：URL 里的搜索词变化时重新初始化
//   因为用户可能在 search 页里再用顶栏搜索框搜一次
watch(searchQuery, () => {
  currentModeIndex.value = 0
  initPage()
})
</script>

<template>
  <div class="body">
    <h1 class="b-title">搜索“{{ searchQuery }}”结果</h1>
    <div class="sort">
      <div
        class="sort-item"
        :style="{ display: 'block' }"
        @click="nextMode"
      >{{ modes[currentModeIndex].label }}</div>
    </div>
    <div class="search-cr">
      <div class="comics-cr">
        <ComicCard v-for="c in comics" :key="c.id" :comic="c" />
      </div>
      <div v-if="loading && comics.length === 0" class="loading-icon"></div>
    </div>
  </div>
</template>