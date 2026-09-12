<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { jmApi } from '@/api/JmcomicApi.js'
import { InfinityScrollContainer } from '@/components/general/InfinityScrollContainer.js'
import ComicCard from '@/components/latest/ComicCard.vue'
import '@/styles/categories.css'

const loading = ref(true)
const loadingMore = ref(false)
const categories = ref([])
const comics = ref([])

const currentFirstIndex = ref(-1)
const currentSubSlugMap = ref({})
const currentSortMode = ref('mostViews')

const sortModes = [
  { key: 'mostViews', label: '按观看量', value: 'mv'  },
  { key: 'addTime',   label: '按时间',   value: ''    },
  { key: 'mostLikes', label: '按点赞量', value: 'tf'  },
  { key: 'day',       label: '按日排行', value: 'mv_t'},
]

let scrollContainer = null
let requestGen = 0   // 请求代号，用于丢弃过期请求

function buildCategoryParam() {
  const c = categories.value[currentFirstIndex.value]
  if (!c) return ''
  const parentSlug = c.slug || ''
  if (!parentSlug) return ''
  const subSlug = currentSubSlugMap.value[parentSlug]
  if (!subSlug) return parentSlug
  return `${parentSlug}_${subSlug}`
}

async function loadContent(page, gen = requestGen) {
  if (comics.value.length === 0) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  const c = buildCategoryParam()
  const o = sortModes.find((m) => m.key === currentSortMode.value)?.value ?? 'mv'

  try {
    const list = await jmApi.getCategoriesFilter(c, page, o)
    if (gen !== requestGen) return   // ★ 过期请求丢弃
    if (list && Array.isArray(list.content)) {
      comics.value = comics.value.concat(list.content)
      if (list.total !== undefined && scrollContainer) {
        scrollContainer.maxPageIndex = Math.ceil(list.total / 80)
      }
    }
  } catch (e) {
    console.error('加载分类内容失败:', e)
  } finally {
    if (gen === requestGen) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function research() {
  if (!scrollContainer) return
  requestGen++                       // ★ 让之前飞出去的请求作废
  const gen = requestGen
  comics.value = []
  loadingMore.value = false
  loading.value = true
  scrollContainer.pageIndex = 1
  scrollContainer.maxPageIndex = 10000
  loadContent(1, gen)
}

function selectFirst(index) {
  if (currentFirstIndex.value === index) return
  currentFirstIndex.value = index
  research()
}

function selectSub(parentSlug, subSlug) {
  if (currentSubSlugMap.value[parentSlug] === subSlug) return
  currentSubSlugMap.value = { ...currentSubSlugMap.value, [parentSlug]: subSlug }
  research()
}

function selectSort(key) {
  if (currentSortMode.value === key) return
  currentSortMode.value = key
  research()
}

function isSubVisible(parentSlug) {
  const c = categories.value[currentFirstIndex.value]
  return c && c.slug === parentSlug
}

onMounted(async () => {
  try {
    const data = await jmApi.getCategories()
    categories.value = data.categories || []
    if (categories.value.length > 0) {
      currentFirstIndex.value = 0
    }

    scrollContainer = new InfinityScrollContainer({
      threshold: 100,
      coolingTime: 500,
      loadContent: (page) => loadContent(page),
    })
    scrollContainer.pageIndex = 1
    loadContent(1)
    scrollContainer.init()
  } catch (e) {
    console.error('分类初始化失败:', e)
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (scrollContainer) {
    scrollContainer.destroy()
    scrollContainer = null
  }
})
</script>

<template>
  <div class="categories-head">
    <div class="tags-section">
      <div class="tags-container-1">
        <div
          v-for="(c, i) in categories"
          :key="'f-' + i"
          class="tag"
          :class="{ active: currentFirstIndex === i }"
          @click="selectFirst(i)"
        >{{ c.name }}</div>
      </div>
      <div class="tags-inner">
        <template v-for="(c, i) in categories" :key="'s-' + i">
          <div
            v-if="c.type === 'slug' && c.sub_categories"
            class="tags-container-2"
            :data-parentslug="c.slug"
            :style="{ display: isSubVisible(c.slug) ? 'flex' : 'none' }"
          >
            <div
              v-for="sub in c.sub_categories"
              :key="sub.CID || sub.slug"
              class="tag"
              :class="{ active: currentSubSlugMap[c.slug] === sub.slug }"
              @click="selectSub(c.slug, sub.slug)"
            >{{ sub.name }}</div>
          </div>
        </template>
      </div>
    </div>

    <div class="sort">
      <div
        v-for="m in sortModes"
        :key="m.key"
        class="sort-item"
        :class="{ active: currentSortMode === m.key }"
        @click="selectSort(m.key)"
      >{{ m.label }}</div>
    </div>
  </div>

  <div class="categories-body">
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
</template>

<style scoped>
.comics-loading {
  position: relative;
  min-height: 320px;
}
.comics-loading.more {
  min-height: 100px;
}
</style>