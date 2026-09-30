<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { userApi } from '@/api/UserApi.js'
import { useUser } from '@/composables/useUser.js'
import { useLocalUser } from '@/composables/useLocalUser.js'
import { localDB } from '@/utils/localDB.js'

const props = defineProps({ comicId: { type: [String, Number], required: true } })
const router = useRouter()
const { userInfo, updateUserInfo } = useUser()
const { currentUser } = useLocalUser()

const isFavorite = ref(false)
const isTracking = ref(false)
const isLoading = ref(false)
const toast = ref(null)

const mode = computed(() => {
  if (userInfo.value) return 'cloud'
  if (currentUser.value) return 'local'
  return 'guest'
})

function showToast(msg, type = 'success') {
  toast.value = { msg, type }
  setTimeout(() => {
    toast.value = null
  }, 2000)
}

function checkLogin() {
  if (mode.value === 'guest') {
    router.push('/user')
    return false
  }
  return true
}

/**
 * 泛化解析“追踪状态”返回值
 * 兼容 true / 'true' / 1 / '1' / { state: true } 等
 */
function normalizeTrackingStatus(result) {
  if (result === true || result === 'true') return true
  if (result === false || result === 'false') return false
  if (result === 1 || result === '1') return true
  if (result === 0 || result === '0') return false

  if (result && typeof result === 'object') {
    const keys = [
      'state',
      'status',
      'tracking',
      'is_tracking',
      'isTracking',
      'result',
      'data',
      'value',
    ]
    for (const key of keys) {
      if (result[key] !== undefined) {
        return normalizeTrackingStatus(result[key])
      }
    }
    const values = Object.values(result)
    if (values.length === 1) return normalizeTrackingStatus(values[0])
  }
  return false
}

async function loadInitialStates() {
  if (mode.value === 'guest') return

  // 本地账号：只查本地收藏，追踪不支持
  if (mode.value === 'local') {
    try {
      isFavorite.value = await localDB.isFavorite(currentUser.value.id, props.comicId)
    } catch (e) {
      console.warn('读取本地收藏失败:', e)
    }
    return
  }

  // 云端账号
  try {
    const favList = await userApi.getFavoriteList(1).catch((e) => {
      console.warn('获取收藏列表失败:', e)
      return null
    })

    if (favList && Array.isArray(favList.list)) {
      isFavorite.value = favList.list.some((it) => String(it.id) === String(props.comicId))
    }

    const trackResult = await userApi.getTrackingStatus(props.comicId).catch((e) => {
      console.warn('获取追踪状态失败:', e)
      return false
    })

    isTracking.value = normalizeTrackingStatus(trackResult)
  } catch (e) {
    console.warn('加载初始状态失败:', e)
  }
}

async function toggleFavorite() {
  if (isLoading.value) return
  if (!checkLogin()) return

  isLoading.value = true

  // 本地账号：写 IndexedDB（按 userId 隔离）
  if (mode.value === 'local') {
    const uid = currentUser.value.id
    try {
      if (isFavorite.value) {
        await localDB.removeFavorite(uid, props.comicId)
        isFavorite.value = false
        showToast('已取消收藏')
      } else {
        const album = await fetchAlbumInfo()
        await localDB.addFavorite(uid, album)
        isFavorite.value = true
        showToast('已收藏到本地')
      }
    } catch (e) {
      showToast('操作失败: ' + (e.message || '未知错误'), 'error')
    } finally {
      isLoading.value = false
    }
    return
  }

  // 云端账号
  const wasFavorite = isFavorite.value
  try {
    const result = await userApi.toggleFavorite(props.comicId)
    if (result.type === 'add') isFavorite.value = true
    else if (result.type === 'remove') isFavorite.value = false
    else if (result.msg) isFavorite.value = result.msg.indexOf('添加到') !== -1

    if (wasFavorite !== isFavorite.value) {
      const cur = Number(userInfo.value?.album_favorites) || 0
      updateUserInfo({
        album_favorites: isFavorite.value ? cur + 1 : Math.max(0, cur - 1),
      })
    }
    showToast(isFavorite.value ? '已收藏' : '已取消收藏')
  } catch (e) {
    showToast('操作失败: ' + (e.message || '未知错误'), 'error')
  } finally {
    isLoading.value = false
  }
}

async function fetchAlbumInfo() {
  const { jmApi } = await import('@/api/JmcomicApi.js')
  const album = await jmApi.getComicAlbum(props.comicId)
  return {
    id: album.id,
    name: album.name,
    author: album.author,
  }
}

async function toggleTracking() {
  if (isLoading.value) return
  if (!checkLogin()) return

  if (mode.value === 'local') {
    showToast('本地账号不支持追踪', 'error')
    return
  }

  isLoading.value = true
  try {
    await userApi.toggleTracking(props.comicId)
    const newStatus = await userApi.getTrackingStatus(props.comicId).catch(() => false)
    isTracking.value = normalizeTrackingStatus(newStatus)
    showToast(isTracking.value ? '已开启追踪' : '已取消追踪')
  } catch (e) {
    showToast('操作失败: ' + (e.message || '未知错误'), 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(loadInitialStates)
</script>

<template>
  <div class="action-buttons">
    <button
      class="action-btn favorite-btn"
      :class="{ active: isFavorite, loading: isLoading }"
      :disabled="isLoading"
      @click="toggleFavorite"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="28"
        height="28"
        :fill="isFavorite ? 'currentColor' : 'none'"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" />
      </svg>
      <span>{{ isFavorite ? '已收藏' : '收藏' }}</span>
    </button>
    <button
      class="action-btn tracking-btn"
      :class="{ active: isTracking, loading: isLoading }"
      :disabled="isLoading"
      @click="toggleTracking"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="28"
        height="28"
        :fill="isTracking ? 'currentColor' : 'none'"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2m6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1z"
        />
      </svg>
      <span>{{ isTracking ? '追踪中' : '追踪' }}</span>
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="toast"
      class="toast-message"
      :style="{
        position: 'fixed',
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: toast.type === 'error' ? '#dc3545' : '#28a745',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: '80%',
      }"
    >
      {{ toast.msg }}
    </div>
  </Teleport>
</template>
