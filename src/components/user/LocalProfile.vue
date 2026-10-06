<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { localDB } from '@/utils/localDB.js'
import { jmApi } from '@/api/JmcomicApi.js'
import ComicCard from '@/components/latest/ComicCard.vue'

const props = defineProps({ user: { type: Object, required: true } })
const emit = defineEmits(['show-cloud-login'])

const currentTab = ref('favorites')
const favorites = ref([])
const history = ref([])
const loading = ref(false)

// 历史批量删除
const historyEditing = ref(false)
const selectedHistoryIds = ref(new Set())

const DEFAULT_COVER = '/image/cover_default.jpg'

function onImgError(e) {
  if (e.target.src.includes('cover_default')) return
  e.target.onerror = null
  e.target.src = DEFAULT_COVER
}

const initial = computed(() => (props.user.username || '?').slice(0, 1).toUpperCase())
const createdDate = computed(() => {
  if (!props.user.createdAt) return ''
  return new Date(props.user.createdAt).toLocaleDateString('zh-CN')
})

const favoriteComics = computed(() =>
  favorites.value.map((f) => ({
    id: f.comicId,
    name: f.name,
    author: f.author,
  })),
)

const allHistorySelected = computed(
  () => history.value.length > 0 && selectedHistoryIds.value.size === history.value.length,
)

const hasHistorySelection = computed(() => selectedHistoryIds.value.size > 0)

async function loadFavorites() {
  loading.value = true
  try {
    favorites.value = await localDB.getFavorites(props.user.id)
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  loading.value = true
  exitHistoryEditMode()
  try {
    history.value = await localDB.getHistory(props.user.id)
  } finally {
    loading.value = false
  }
}

// ---------- 历史批量操作 ----------

function enterHistoryEditMode() {
  historyEditing.value = true
  selectedHistoryIds.value = new Set()
}

function exitHistoryEditMode() {
  historyEditing.value = false
  selectedHistoryIds.value = new Set()
}

function toggleHistoryEditMode() {
  if (historyEditing.value) exitHistoryEditMode()
  else enterHistoryEditMode()
}

function toggleSelectHistory(item) {
  const set = new Set(selectedHistoryIds.value)
  if (set.has(item.id)) set.delete(item.id)
  else set.add(item.id)
  selectedHistoryIds.value = set
}

function toggleSelectAllHistory() {
  if (allHistorySelected.value) {
    selectedHistoryIds.value = new Set()
  } else {
    selectedHistoryIds.value = new Set(history.value.map((h) => h.id))
  }
}

async function handleDeleteSelectedHistory() {
  const ids = Array.from(selectedHistoryIds.value)
  if (ids.length === 0) return
  if (!confirm(`确定删除选中的 ${ids.length} 条历史记录？`)) return

  try {
    for (const id of ids) {
      const item = history.value.find((h) => h.id === id)
      if (item) await localDB.removeHistory(props.user.id, item.comicId)
    }
    history.value = history.value.filter((h) => !selectedHistoryIds.value.has(h.id))
    exitHistoryEditMode()
  } catch (e) {
    alert('删除失败：' + (e?.message || '未知错误'))
  }
}

function switchTab(tab) {
  if (currentTab.value === tab) return
  currentTab.value = tab
  exitHistoryEditMode()

  if (tab === 'favorites') loadFavorites()
  else if (tab === 'history') loadHistory()
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now - d) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return diffMin + ' 分钟前'
  if (diffMin < 1440) return Math.floor(diffMin / 60) + ' 小时前'
  if (diffMin < 43200) return Math.floor(diffMin / 1440) + ' 天前'
  return d.toLocaleDateString('zh-CN')
}

async function refreshAll() {
  await Promise.all([loadFavorites(), loadHistory()])
}

watch(() => props.user.id, refreshAll)
onMounted(refreshAll)
</script>

<template>
  <div class="user-profile local-profile">
    <!-- 顶部工具栏 -->
    <div class="local-top-bar">
      <span class="local-top-title">本地账号</span>
      <button class="switch-cloud-btn" @click="emit('show-cloud-login')">登录云端账号</button>
    </div>

    <!-- 用户信息 -->
    <div class="user-header">
      <div class="local-avatar">{{ initial }}</div>
      <div class="user-details">
        <h2>{{ user.username }}</h2>
        <p>创建于 {{ createdDate }}</p>
        <p class="local-tip">数据仅保存在此设备</p>
      </div>
    </div>

    <!-- ★ 只剩 2 个 tab -->
    <div class="user-tabs">
      <span
        class="user-tab"
        :class="{ active: currentTab === 'favorites' }"
        @click="switchTab('favorites')"
      >
        收藏
      </span>
      <span
        class="user-tab"
        :class="{ active: currentTab === 'history' }"
        @click="switchTab('history')"
      >
        历史
      </span>
    </div>

    <div class="user-list-container">
      <div v-if="loading" class="list-loader-container">
        <div class="list-loader-spinner"></div>
        <p class="list-loader-text">加载中...</p>
      </div>

      <!-- 本地收藏 -->
      <template v-else-if="currentTab === 'favorites'">
        <div v-if="favoriteComics.length === 0" class="list-empty-container">
          <p class="list-empty-text">暂无本地收藏</p>
        </div>
        <div v-else class="comics-cr local-comics">
          <ComicCard v-for="c in favoriteComics" :key="c.id" :comic="c" />
        </div>
      </template>

      <!-- 浏览历史 -->
      <template v-else-if="currentTab === 'history'">
        <div v-if="history.length === 0" class="list-empty-container">
          <p class="list-empty-text">暂无浏览记录</p>
        </div>

        <template v-else>
          <div class="history-toolbar">
            <template v-if="!historyEditing">
              <span class="history-count">共 {{ history.length }} 条记录</span>
              <button class="history-tool-btn" @click="toggleHistoryEditMode">编辑</button>
            </template>
            <template v-else>
              <button class="history-select-all" @click="toggleSelectAllHistory">
                <span class="history-checkbox" :class="{ checked: allHistorySelected }">
                  <svg
                    v-if="allHistorySelected"
                    viewBox="0 0 24 24"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span>{{ allHistorySelected ? '取消全选' : '全选' }}</span>
              </button>

              <span class="history-selected-count"> 已选 {{ selectedHistoryIds.size }} 项 </span>

              <div class="history-toolbar-actions">
                <button class="history-tool-btn" @click="toggleHistoryEditMode">取消</button>
                <button
                  class="history-tool-btn danger"
                  :disabled="!hasHistorySelection"
                  @click="handleDeleteSelectedHistory"
                >
                  删除
                </button>
              </div>
            </template>
          </div>

          <div class="history-list">
            <component
              v-for="item in history"
              :key="item.id"
              :is="historyEditing ? 'div' : 'RouterLink'"
              class="history-item"
              :class="{ selected: selectedHistoryIds.has(item.id) }"
              :to="
                historyEditing
                  ? undefined
                  : `/chapter/${item.lastChapterId || item.currentAlbumId || item.comicId}`
              "
              @click="historyEditing ? toggleSelectHistory(item) : null"
            >
              <div v-if="historyEditing" class="history-checkbox-wrap">
                <span
                  class="history-checkbox"
                  :class="{ checked: selectedHistoryIds.has(item.id) }"
                >
                  <svg
                    v-if="selectedHistoryIds.has(item.id)"
                    viewBox="0 0 24 24"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </div>

              <div class="history-cover">
                <img
                  :src="jmApi.getCoverImageURL(item.coverId || item.comicId)"
                  alt="cover"
                  loading="lazy"
                  @error="onImgError"
                />
              </div>
              <div class="history-info">
                <h3 class="history-name">{{ item.name }}</h3>
                <p class="history-author" v-if="item.author">{{ item.author }}</p>
                <p class="history-chapter">
                  上次读到：<strong>{{ item.lastChapterName }}</strong>
                </p>
                <p class="history-time">{{ formatTime(item.lastReadAt) }}</p>
              </div>
            </component>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>
