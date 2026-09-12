<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { jmApi } from '@/api/JmcomicApi.js'
import { InfinityScrollContainer } from '@/components/general/InfinityScrollContainer.js'
import ComicCard from '@/components/latest/ComicCard.vue'
import '@/styles/latest.css'

const comics = ref([])
const loading = ref(true)        // 首次加载
const loadingMore = ref(false)   // 翻页加载

let scrollContainer = null

async function loadContent(page) {
  // ★ 区分首次加载和翻页加载，避免翻页时大 loading 闪烁
  if (comics.value.length === 0) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const list = await jmApi.getLatestContent(page)
    if (Array.isArray(list)) {
      comics.value = comics.value.concat(list)
    } else if (list && Array.isArray(list.content)) {
      comics.value = comics.value.concat(list.content)
      if (list.total !== undefined && scrollContainer) {
        scrollContainer.maxPageIndex = Math.ceil(list.total / 80)
      }
    }
  } catch (e) {
    console.error('加载最新内容失败:', e)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

onMounted(() => {
  scrollContainer = new InfinityScrollContainer({
    threshold: 100,
    coolingTime: 500,
    loadContent: (page) => loadContent(page),
  })
  scrollContainer.pageIndex = 1
  loadContent(1)
  scrollContainer.init()
})

onBeforeUnmount(() => {
  if (scrollContainer) {
    scrollContainer.destroy()
    scrollContainer = null
  }
})
</script>

<template>
  <div class="body">
    <h1 class="b-title">查看最新的作品</h1>
    <div class="latest-cr">
      <!-- 首次加载：居中 loading -->
      <div v-if="loading && comics.length === 0" class="comics-loading">
        <div class="loading-icon"></div>
      </div>

      <!-- 列表 -->
      <div v-else class="comics-cr">
        <ComicCard v-for="c in comics" :key="c.id" :comic="c" />
      </div>

      <!-- 翻页加载：底部 loading -->
      <div v-if="loadingMore" class="comics-loading more">
        <div class="loading-icon"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 给 .loading-icon (position: absolute) 提供定位容器 */
.comics-loading {
  position: relative;
  min-height: 320px;
}
.comics-loading.more {
  min-height: 100px;
}
</style>