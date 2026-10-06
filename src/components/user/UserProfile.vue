<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { jmApi } from '@/api/JmcomicApi.js'
import { userApi } from '@/api/UserApi.js'
import { useUser } from '@/composables/useUser.js'
import { localDB } from '@/utils/localDB.js'
import ComicCard from '@/components/latest/ComicCard.vue'
import NotificationList from './NotificationList.vue'

const props = defineProps({ userInfo: { type: Object, required: true } })
const emit = defineEmits(['logged-out'])

const { clearUser, updateUserInfo } = useUser()

const currentTab = ref('favorites')

const loading = ref(false)
const loadingMore = ref(false)
const errorMsg = ref('')
const comics = ref([])
const currentPage = ref(1)
const totalCount = ref(0)
const hasMore = ref(false)
const PAGE_SIZE = 80

const notifType = ref('all')
const notifList = ref([])
const notifTotal = ref(0)
const notifUnread = ref(0)
const notifHasMore = ref(false)

const historyList = ref([])
const historyEditing = ref(false)
const selectedHistoryIds = ref(new Set())

const sentinelRef = ref(null)
let observer = null

let logoutController = null
const isLoggingOut = ref(false)

const DEFAULT_COVER = '/image/cover_default.jpg'

function onImgError(e) {
  if (e.target.src.includes('cover_default')) return
  e.target.onerror = null
  e.target.src = DEFAULT_COVER
}

const avatarUrl = computed(() => {
  if (!props.userInfo.photo) return ''
  return jmApi.getUserPhotoURL(props.userInfo.photo)
})

const favoriteCount = computed(() => Number(props.userInfo.album_favorites) || 0)

const cloudUserId = computed(() => {
  if (props.userInfo.uid) return String(props.userInfo.uid)
  if (props.userInfo.username) return `cloud_${props.userInfo.username}`
  return null
})

const allHistorySelected = computed(
  () => historyList.value.length > 0 && selectedHistoryIds.value.size === historyList.value.length,
)

const hasHistorySelection = computed(() => selectedHistoryIds.value.size > 0)

function resetList() {
  comics.value = []
  currentPage.value = 1
  totalCount.value = 0
  hasMore.value = false
  errorMsg.value = ''
}

// ---------- 收藏 ----------
async function loadFavorites(page = 1) {
  if (page === 1) {
    loading.value = true
    resetList()
  } else {
    loadingMore.value = true
  }

  try {
    const data = await userApi.getFavoriteList(page)
    const list = Array.isArray(data?.list) ? data.list : []

    if (page === 1) comics.value = list
    else comics.value = comics.value.concat(list)

    currentPage.value = page
    const total = Number(data?.total ?? list.length)
    totalCount.value = total
    hasMore.value = comics.value.length < total

    if (page === 1 && data?.total !== undefined) {
      updateUserInfo({ album_favorites: total })
    }
  } catch (err) {
    errorMsg.value = err.message || '加载失败'
  } finally {
    loading.value = false
    loadingMore.value = false
    setupSentinel()
  }
}

// ---------- 追踪 ----------
async function loadTracking(page = 1) {
  if (page === 1) {
    loading.value = true
    resetList()
  } else {
    loadingMore.value = true
  }

  try {
    const data = await userApi.getTrackingList(page)
    const list = Array.isArray(data?.item) ? data.item : []

    if (page === 1) comics.value = list
    else comics.value = comics.value.concat(list)

    currentPage.value = page
    const total = Number(data?.total ?? list.length)
    totalCount.value = total

    if (data?.total !== undefined) {
      hasMore.value = comics.value.length < total
    } else {
      hasMore.value = list.length >= PAGE_SIZE
    }
  } catch (err) {
    errorMsg.value = err.message || '加载失败'
  } finally {
    loading.value = false
    loadingMore.value = false
    setupSentinel()
  }
}

// ---------- 通知 ----------
async function loadNotifications(page = 1) {
  if (page === 1) {
    loading.value = true
    notifList.value = []
  } else {
    loadingMore.value = true
  }

  try {
    const data = await userApi.getNotifications(notifType.value, page)

    let list = [],
      total = 0,
      unread = 0
    if (Array.isArray(data)) {
      list = data
      total = data.length
      unread = data.filter((i) => !i.read && !i.is_read).length
    } else if (data && Array.isArray(data.list)) {
      list = data.list
      total = Number(data.total ?? list.length)
      unread = data.unread ?? 0
    } else if (data && Array.isArray(data.data)) {
      list = data.data
      total = Number(data.total ?? list.length)
      unread = data.unread ?? 0
    }

    if (page === 1) {
      notifList.value = list
      notifTotal.value = total
      notifUnread.value = unread
    } else {
      notifList.value = notifList.value.concat(list)
      if (unread !== undefined) notifUnread.value = unread
    }

    currentPage.value = page

    if (data?.total !== undefined) {
      notifHasMore.value = notifList.value.length < total
    } else {
      notifHasMore.value = list.length >= PAGE_SIZE
    }
  } catch (err) {
    errorMsg.value = err.message || '加载失败'
  } finally {
    loading.value = false
    loadingMore.value = false
    setupSentinel()
  }
}

// ---------- 历史 ----------
async function loadHistory() {
  loading.value = true
  errorMsg.value = ''
  historyList.value = []
  exitHistoryEditMode()

  try {
    const userId = cloudUserId.value
    if (!userId) {
      historyList.value = []
      return
    }

    const list = await localDB.getHistory(userId)
    historyList.value = Array.isArray(list) ? list : []
  } catch (err) {
    errorMsg.value = err.message || '加载失败'
  } finally {
    loading.value = false
    hasMore.value = false
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
    selectedHistoryIds.value = new Set(historyList.value.map((h) => h.id))
  }
}

async function handleDeleteSelectedHistory() {
  const ids = Array.from(selectedHistoryIds.value)
  if (ids.length === 0) return
  if (!confirm(`确定删除选中的 ${ids.length} 条历史记录？`)) return

  const userId = cloudUserId.value
  if (!userId) return

  try {
    for (const id of ids) {
      const item = historyList.value.find((h) => h.id === id)
      if (item) await localDB.removeHistory(userId, item.comicId)
    }
    historyList.value = historyList.value.filter((h) => !selectedHistoryIds.value.has(h.id))
    exitHistoryEditMode()
  } catch (e) {
    alert('删除失败：' + (e?.message || '未知错误'))
  }
}

// ---------- 分派 ----------
function loadPage(page = 1) {
  if (currentTab.value === 'favorites') return loadFavorites(page)
  if (currentTab.value === 'tracking') return loadTracking(page)
  if (currentTab.value === 'notifications') return loadNotifications(page)
}

function setupSentinel() {
  if (observer) {
    observer.disconnect()
    observer = null
  }

  if (currentTab.value === 'history') return

  const more = currentTab.value === 'notifications' ? notifHasMore.value : hasMore.value
  if (!more) return

  nextTick(() => {
    const el = sentinelRef.value
    if (!el) return

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (loading.value || loadingMore.value) continue

          const stillMore =
            currentTab.value === 'notifications' ? notifHasMore.value : hasMore.value
          if (!stillMore) {
            observer?.disconnect()
            return
          }

          loadPage(currentPage.value + 1)
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
  })
}

function switchTab(tab) {
  if (currentTab.value === tab) return
  currentTab.value = tab
  resetList()
  exitHistoryEditMode()

  if (tab === 'favorites') loadFavorites(1)
  else if (tab === 'tracking') loadTracking(1)
  else if (tab === 'notifications') loadNotifications(1)
  else if (tab === 'history') loadHistory()
}

function onNotifTypeChange(type) {
  if (notifType.value === type) return
  notifType.value = type
  notifList.value = []
  notifTotal.value = 0
  notifUnread.value = 0
  notifHasMore.value = false
  loadNotifications(1)
}

function onNotificationUpdated({ id, read }) {
  const idx = notifList.value.findIndex((n) => {
    const nid = n?.id ?? n?.notificationId ?? n?.nid
    return String(nid) === String(id)
  })
  if (idx === -1) return

  const item = notifList.value[idx]
  const wasRead = !!(item.read || item.is_read)
  if (wasRead === read) return

  notifList.value = notifList.value.map((n, i) => {
    if (i !== idx) return n
    return { ...n, read: read ? 1 : 0, is_read: read }
  })

  if (read) {
    notifUnread.value = Math.max(0, notifUnread.value - 1)
  } else {
    notifUnread.value = notifUnread.value + 1
  }
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

// ---------- 登出 ----------
function handleLogout() {
  if (isLoggingOut.value) return
  if (!confirm('确定要退出登录吗？')) return

  isLoggingOut.value = true

  const currentToken = props.userInfo.jwttoken
  const servers = jmApi.servers || []

  clearUser()
  emit('logged-out')

  if (logoutController) logoutController.abort()
  logoutController = new AbortController()
  const signal = logoutController.signal

  const performLogout = async () => {
    if (!currentToken || servers.length === 0) return
    const maxRetries = Math.min(servers.length, 3)
    for (let i = 0; i < maxRetries; i++) {
      if (signal.aborted) throw new DOMException('cancelled', 'AbortError')
      const server = servers[i % servers.length]
      try {
        const resp = await fetch(`https://${server}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            token: jmApi.accessToken.token,
            tokenParam: jmApi.accessToken.tokenParam,
            Authorization: `Bearer ${currentToken}`,
          },
          body: '',
          signal,
        })
        if (!resp.ok) {
          if (resp.status === 401 || resp.status === 403) return
          throw new Error(`HTTP ${resp.status}`)
        }
        return
      } catch (err) {
        if (err.name === 'AbortError') throw err
      }
    }
  }

  Promise.race([
    performLogout(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
  ])
    .catch((err) => {
      if (err.name !== 'AbortError') {
        console.warn('登出接口失败（已本地登出）:', err.message)
      }
    })
    .finally(() => {
      logoutController = null
      isLoggingOut.value = false
    })
}

// ---------- visibilitychange 同步收藏数 ----------
let visibilityHandler = null
function bindVisibilityRefresh() {
  visibilityHandler = () => {
    if (document.visibilityState !== 'visible') return
    const raw = localStorage.getItem('userInfo')
    if (!raw) return
    try {
      const info = JSON.parse(raw)
      if (Number(info.album_favorites) !== Number(props.userInfo.album_favorites)) {
        updateUserInfo({ album_favorites: info.album_favorites })
      }
    } catch {}
  }
  document.addEventListener('visibilitychange', visibilityHandler)
}

onMounted(() => {
  loadFavorites(1)
  bindVisibilityRefresh()
})

onBeforeUnmount(() => {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  if (logoutController) logoutController.abort()
  if (observer) {
    observer.disconnect()
    observer = null
  }
})
</script>

<template>
  <div class="user-profile cloud-profile">
    <!-- 顶部工具栏 -->
    <div class="local-top-bar">
      <span class="local-top-title">云端账号</span>
      <button class="logout-btn" :disabled="isLoggingOut" @click="handleLogout">
        <span v-show="!isLoggingOut">退出登录</span>
        <span class="btn-loader" v-show="isLoggingOut"></span>
      </button>
    </div>

    <!-- 用户信息 -->
    <div class="user-header">
      <img :src="avatarUrl" alt="头像" class="user-avatar" />
      <div class="user-details">
        <h2>{{ userInfo.username }}</h2>
        <p>等级: {{ userInfo.level_name }} (Lv.{{ userInfo.level }})</p>
        <p>金币: {{ userInfo.coin }}</p>
        <p>经验: {{ userInfo.exp }} / {{ userInfo.nextLevelExp }}</p>
      </div>
    </div>

    <!-- ★ Tab 顺序：收藏 → 追踪 → 历史 → 信箱 -->
    <div class="user-tabs">
      <span
        class="user-tab"
        :class="{ active: currentTab === 'favorites' }"
        @click="switchTab('favorites')"
      >
        收藏 ({{ favoriteCount }})
      </span>
      <span
        class="user-tab"
        :class="{ active: currentTab === 'tracking' }"
        @click="switchTab('tracking')"
      >
        追踪
      </span>
      <span
        class="user-tab"
        :class="{ active: currentTab === 'history' }"
        @click="switchTab('history')"
      >
        历史
      </span>
      <span
        class="user-tab"
        :class="{ active: currentTab === 'notifications' }"
        @click="switchTab('notifications')"
      >
        信箱
      </span>
    </div>

    <div id="user-list-container">
      <div v-if="loading" class="list-loader-container">
        <div class="list-loader-spinner"></div>
        <p class="list-loader-text">加载中...</p>
      </div>

      <div v-else-if="errorMsg" class="list-error-container">
        <p class="list-error-text">{{ errorMsg }}</p>
      </div>

      <NotificationList
        v-else-if="currentTab === 'notifications'"
        :type="notifType"
        :list="notifList"
        :total="notifTotal"
        :unread="notifUnread"
        @change-type="onNotifTypeChange"
        @updated="onNotificationUpdated"
      />

      <!-- 历史 tab -->
      <template v-else-if="currentTab === 'history'">
        <div v-if="historyList.length === 0" class="list-empty-container">
          <p class="list-empty-text">暂无浏览记录</p>
        </div>

        <template v-else>
          <div class="history-toolbar">
            <template v-if="!historyEditing">
              <span class="history-count">共 {{ historyList.length }} 条记录</span>
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
              v-for="item in historyList"
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

      <!-- 收藏 / 追踪 -->
      <template v-else>
        <div v-if="comics.length === 0" class="list-empty-container">
          <p class="list-empty-text">{{ currentTab === 'favorites' ? '暂无收藏' : '暂无追踪' }}</p>
        </div>
        <div v-else class="comics-cr user-comics">
          <ComicCard v-for="c in comics" :key="c.id" :comic="c" />
        </div>
      </template>

      <div v-if="loadingMore" class="list-more-loading">
        <div class="list-loader-spinner small"></div>
      </div>

      <div
        v-else-if="
          !loading &&
          !errorMsg &&
          currentTab !== 'history' &&
          (currentTab === 'notifications' ? !notifHasMore : !hasMore) &&
          (currentTab === 'notifications' ? notifList.length > 0 : comics.length > 0)
        "
        class="list-end-tip"
      >
        — 已经到底了 —
      </div>

      <div ref="sentinelRef" class="list-sentinel"></div>
    </div>
  </div>
</template>

<style scoped>
.user-comics :deep(.comic-item) {
  width: 150px;
}
.user-comics :deep(.comic-item .cover) {
  height: 200px;
}
</style>
