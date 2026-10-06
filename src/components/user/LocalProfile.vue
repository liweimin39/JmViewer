<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { localDB } from '@/utils/localDB.js'
import { useLocalUser } from '@/composables/useLocalUser.js'
import { jmApi } from '@/api/JmcomicApi.js'
import ComicCard from '@/components/latest/ComicCard.vue'
import LocalDataSettings from './LocalDataSettings.vue'

const props = defineProps({ user: { type: Object, required: true } })
const emit = defineEmits(['logged-out'])

const { logout } = useLocalUser()

const currentTab = ref('favorites')
const favorites = ref([])
const history = ref([])
const loading = ref(false)

// ★ 封面占位图
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

const historyComics = computed(() =>
  history.value.map((h) => ({
    id: h.comicId,
    name: h.name,
    author: h.author,
    _chapterName: h.chapterName,
    _lastReadAt: h.lastReadAt,
  })),
)

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
  try {
    history.value = await localDB.getHistory(props.user.id)
  } finally {
    loading.value = false
  }
}

function switchTab(tab) {
  if (currentTab.value === tab) return
  currentTab.value = tab
  if (tab === 'favorites') loadFavorites()
  else if (tab === 'history') loadHistory()
}

function onLogout() {
  logout()
  emit('logged-out')
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
    <div class="user-header">
      <div class="local-avatar">{{ initial }}</div>
      <div class="user-details">
        <h2>{{ user.username }}</h2>
        <p>本地账号 · 创建于 {{ createdDate }}</p>
        <p class="local-tip">数据仅保存在此设备</p>
      </div>
      <button class="logout-btn" @click="onLogout">登出</button>
    </div>

    <div class="user-tabs">
      <span
        class="user-tab"
        :class="{ active: currentTab === 'favorites' }"
        @click="switchTab('favorites')"
      >
        本地收藏 ({{ favorites.length }})
      </span>
      <span
        class="user-tab"
        :class="{ active: currentTab === 'history' }"
        @click="switchTab('history')"
      >
        浏览历史 ({{ history.length }})
      </span>
      <span
        class="user-tab"
        :class="{ active: currentTab === 'settings' }"
        @click="switchTab('settings')"
      >
        数据管理
      </span>
    </div>

    <div class="user-list-container">
      <div v-if="loading" class="list-loader-container">
        <div class="list-loader-spinner"></div>
        <p class="list-loader-text">加载中...</p>
      </div>

      <template v-else-if="currentTab === 'favorites'">
        <div v-if="favoriteComics.length === 0" class="list-empty-container">
          <p class="list-empty-text">此账号暂无本地收藏</p>
          <button class="empty-action-btn" @click="onLogout">切换到其他账号</button>
        </div>
        <div v-else class="comics-cr local-comics">
          <ComicCard v-for="c in favoriteComics" :key="c.id" :comic="c" />
        </div>
      </template>

      <template v-else-if="currentTab === 'history'">
        <div v-if="historyComics.length === 0" class="list-empty-container">
          <p class="list-empty-text">此账号暂无浏览记录</p>
          <button class="empty-action-btn" @click="onLogout">切换到其他账号</button>
        </div>
        <div v-else class="history-list">
          <RouterLink
            v-for="item in historyComics"
            :key="item.id"
            class="history-item"
            :to="`/chapter/${item.id}`"
          >
            <div class="history-cover">
              <img
                :src="jmApi.getCoverImageURL(item.id)"
                alt="cover"
                loading="lazy"
                @error="onImgError"
              />
            </div>
            <div class="history-info">
              <h3 class="history-name">{{ item.name }}</h3>
              <p class="history-author">{{ item.author }}</p>
              <p class="history-time">{{ formatTime(item._lastReadAt) }}</p>
            </div>
          </RouterLink>
        </div>
      </template>

      <template v-else>
        <LocalDataSettings :user-id="user.id" @imported="refreshAll" />
      </template>
    </div>
  </div>
</template>
