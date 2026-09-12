<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { jmApi } from '@/api/JmcomicApi.js'
import { userApi } from '@/api/UserApi.js'
import { useUser } from '@/composables/useUser.js'
import ComicCard from '@/components/latest/ComicCard.vue'
import NotificationList from './NotificationList.vue'

const props = defineProps({ userInfo: { type: Object, required: true } })
const emit = defineEmits(['logged-out'])

const { clearUser, updateUserInfo } = useUser()

const currentTab = ref('favorites')   // favorites | tracking | notifications
const loading = ref(false)
const errorMsg = ref('')
const comics = ref([])

// 通知相关的状态（传给子组件）
const notifType = ref('all')
const notifPage = ref(1)
const notifList = ref([])
const notifTotal = ref(0)
const notifUnread = ref(0)

// 登出请求的 AbortController
let logoutController = null
const isLoggingOut = ref(false)

const avatarUrl = computed(() => {
  if (!props.userInfo.photo) return ''
  return jmApi.getUserPhotoURL(props.userInfo.photo)
})

const favoriteCount = computed(() => Number(props.userInfo.album_favorites) || 0)

// ---------- 收藏 ----------
async function loadFavorites(page = 1) {
  loading.value = true
  errorMsg.value = ''
  comics.value = []
  try {
    const data = await userApi.getFavoriteList(page)
    const list = data.list || []
    comics.value = list
    if (data.total !== undefined) {
      updateUserInfo({ album_favorites: Number(data.total) })
    }
  } catch (err) {
    errorMsg.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// ---------- 追踪 ----------
async function loadTracking(page = 1) {
  loading.value = true
  errorMsg.value = ''
  comics.value = []
  try {
    const data = await userApi.getTrackingList(page)
    comics.value = data.item || []
  } catch (err) {
    errorMsg.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// ---------- 通知 ----------
async function loadNotifications() {
  loading.value = true
  errorMsg.value = ''
  notifList.value = []
  try {
    const data = await userApi.getNotifications(notifType.value, notifPage.value)
    let list = [], total = 0, unread = 0
    if (Array.isArray(data)) {
      list = data
      total = data.length
      unread = data.filter((i) => !i.read && !i.is_read).length
    } else if (data && Array.isArray(data.list)) {
      list = data.list
      total = data.total ?? list.length
      unread = data.unread ?? 0
    } else if (data && Array.isArray(data.data)) {
      list = data.data
      total = data.total ?? list.length
      unread = data.unread ?? 0
    }
    notifList.value = list
    notifTotal.value = total
    notifUnread.value = unread
  } catch (err) {
    errorMsg.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function switchTab(tab) {
  if (currentTab.value === tab) return
  currentTab.value = tab
  if (tab === 'favorites') loadFavorites()
  else if (tab === 'tracking') loadTracking()
  else if (tab === 'notifications') loadNotifications()
}

function onNotifTypeChange(type) {
  if (notifType.value === type) return
  notifType.value = type
  notifPage.value = 1
  loadNotifications()
}

// ---------- 登出 ----------
function handleLogout() {
  if (isLoggingOut.value) return
  isLoggingOut.value = true

  const currentToken = props.userInfo.jwttoken
  const servers = jmApi.servers || []

  // 乐观更新：先清空本地
  clearUser()
  emit('logged-out')

  // 异步通知服务器
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
            'token': jmApi.accessToken.token,
            'tokenParam': jmApi.accessToken.tokenParam,
            'Authorization': `Bearer ${currentToken}`,
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
        // 继续重试
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
    } catch { /* ignore */ }
  }
  document.addEventListener('visibilitychange', visibilityHandler)
}

onMounted(() => {
  loadFavorites()
  bindVisibilityRefresh()
})

onBeforeUnmount(() => {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  if (logoutController) logoutController.abort()
})
</script>

<template>
  <div class="user-profile">
    <div class="user-header">
      <img :src="avatarUrl" alt="头像" class="user-avatar" />
      <div class="user-details">
        <h2>{{ userInfo.username }}</h2>
        <p>等级: {{ userInfo.level_name }} (Lv.{{ userInfo.level }})</p>
        <p>金币: {{ userInfo.coin }}</p>
        <p>经验: {{ userInfo.exp }} / {{ userInfo.nextLevelExp }}</p>
      </div>
      <button class="logout-btn" :disabled="isLoggingOut" @click="handleLogout">
        <span v-show="!isLoggingOut">登出</span>
        <span class="btn-loader" v-show="isLoggingOut"></span>
      </button>
    </div>

    <div class="user-tabs">
      <span class="user-tab" :class="{ active: currentTab === 'favorites' }" @click="switchTab('favorites')">
        收藏 ({{ favoriteCount }})
      </span>
      <span class="user-tab" :class="{ active: currentTab === 'tracking' }" @click="switchTab('tracking')">
        追踪
      </span>
      <span class="user-tab" :class="{ active: currentTab === 'notifications' }" @click="switchTab('notifications')">
        信箱
      </span>
    </div>

    <div id="user-list-container">
      <!-- 加载中 -->
      <div v-if="loading" class="list-loader-container">
        <div class="list-loader-spinner"></div>
        <p class="list-loader-text">加载中...</p>
      </div>

      <!-- 错误 -->
      <div v-else-if="errorMsg" class="list-error-container">
        <span class="list-error-icon">⚠️</span>
        <p class="list-error-text">{{ errorMsg }}</p>
      </div>

      <!-- 通知列表 -->
      <NotificationList
        v-else-if="currentTab === 'notifications'"
        :type="notifType"
        :list="notifList"
        :total="notifTotal"
        :unread="notifUnread"
        @change-type="onNotifTypeChange"
      />

      <!-- 收藏 / 追踪 -->
      <template v-else>
        <div v-if="comics.length === 0" class="list-empty-container">
          <span class="list-empty-icon">📭</span>
          <p class="list-empty-text">{{ currentTab === 'favorites' ? '暂无收藏' : '暂无追踪' }}</p>
        </div>
        <div v-else class="comics-cr user-comics">
          <ComicCard v-for="c in comics" :key="c.id" :comic="c" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ★ 覆盖 ComicCard 在 user 页面的尺寸：user.css 要求 150x200，latest 是 210x270 */
.user-comics :deep(.comic-item) { width: 150px; }
.user-comics :deep(.comic-item .cover) { height: 200px; }
</style>