<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { userApi } from '@/api/UserApi.js'
import { useUser } from '@/composables/useUser.js'

const props = defineProps({ comicId: { type: [String, Number], required: true } })
const router = useRouter()
const { userInfo, updateUserInfo } = useUser()

const isFavorite = ref(false)
const isTracking = ref(false)
const isLoading = ref(false)
const toast = ref(null)

function showToast(msg, type = 'success') {
  toast.value = { msg, type }
  setTimeout(() => { toast.value = null }, 2000)
}

function checkLogin() {
  if (!userInfo.value) {
    router.push('/user')
    return false
  }
  return true
}

async function loadInitialStates() {
  if (!userInfo.value) return
  try {
    const [favList, trackResult] = await Promise.all([
      userApi.getFavoriteList(1).catch(() => null),
      userApi.getTrackingStatus(props.comicId).catch(() => false),
    ])
    if (favList && Array.isArray(favList.list)) {
      isFavorite.value = favList.list.some((it) => String(it.id) === String(props.comicId))
    }
    isTracking.value = trackResult === true || trackResult === 'true'
  } catch (e) {
    console.warn('加载初始状态失败:', e)
  }
}

async function toggleFavorite() {
  if (isLoading.value) return
  if (!checkLogin()) return
  isLoading.value = true
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

async function toggleTracking() {
  if (isLoading.value) return
  if (!checkLogin()) return
  isLoading.value = true
  try {
    await userApi.toggleTracking(props.comicId)
    const newStatus = await userApi.getTrackingStatus(props.comicId).catch(() => false)
    isTracking.value = newStatus === true || newStatus === 'true'
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
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"
        :fill="isFavorite ? 'currentColor' : 'none'"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
      </svg>
      <span>{{ isFavorite ? '已收藏' : '收藏' }}</span>
    </button>
    <button
      class="action-btn tracking-btn"
      :class="{ active: isTracking, loading: isLoading }"
      :disabled="isLoading"
      @click="toggleTracking"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"
        :fill="isTracking ? 'currentColor' : 'none'"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2m6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1z"/>
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
    >{{ toast.msg }}</div>
  </Teleport>
</template>