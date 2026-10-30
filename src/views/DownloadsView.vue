<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Capacitor } from '@capacitor/core'
import { downloadManager, DownloadStatus } from '@/utils/downloadManager.js'
import { useStoragePermission } from '@/composables/useStoragePermission.js'
import DownloadItem from '@/components/download/DownloadItem.vue'
import StoragePermissionGate from '@/components/download/StoragePermissionGate.vue'
import '@/styles/download.css'

const tasks = ref([])
const activeTab = ref('all')
const showPermGate = ref(false)
const removeTarget = ref(null)
const removing = ref(false)
let unsubscribe = null

const { check: checkPerm, platform } = useStoragePermission()

const filteredTasks = computed(() => {
  if (activeTab.value === 'active') {
    return tasks.value.filter((t) =>
      [
        DownloadStatus.DOWNLOADING,
        DownloadStatus.PENDING,
        DownloadStatus.PACKAGING,
        DownloadStatus.PAUSED,
      ].includes(t.status),
    )
  }
  if (activeTab.value === 'completed') {
    return tasks.value.filter((t) => t.status === DownloadStatus.COMPLETED)
  }
  return tasks.value
})

const activeCount = computed(
  () =>
    tasks.value.filter((t) =>
      [DownloadStatus.DOWNLOADING, DownloadStatus.PENDING, DownloadStatus.PACKAGING].includes(
        t.status,
      ),
    ).length,
)

function refresh() {
  tasks.value = downloadManager.getTasks()
}

/** ★ 已完成任务点击：原生打开文件夹，Web 下载 ZIP */
async function handleOpenOutput(taskId) {
  try {
    await downloadManager.openOutput(taskId)
  } catch (e) {
    alert('操作失败：' + (e?.message || '未知错误'))
  }
}

/**
 * 删除下载任务
 * 原生已完成任务：弹窗让用户选择「仅删除记录」或「删除记录和本地文件」
 * Web / 已取消任务：本地文件不归应用管理，只能删除记录
 */
function handleRemove(taskId) {
  const task = tasks.value.find((t) => t.id === taskId)
  if (!task) return

  const canDeleteFiles =
    Capacitor.isNativePlatform() && task.status === DownloadStatus.COMPLETED && task.albumId

  if (canDeleteFiles) {
    removeTarget.value = task
    return
  }

  const tip =
    Capacitor.isNativePlatform() && task.status === DownloadStatus.COMPLETED
      ? '删除该下载记录？（本地文件仍保留）'
      : '删除该下载记录？'
  if (window.confirm(tip)) doRemove(taskId, false)
}

async function doRemove(taskId, deleteFiles) {
  if (removing.value) return
  removing.value = true
  try {
    await downloadManager.remove(taskId, { deleteFiles })
    removeTarget.value = null
  } catch (e) {
    alert('删除失败：' + (e?.message || '未知错误'))
  } finally {
    removing.value = false
  }
}

async function initDownloadManager() {
  await downloadManager.init()
  refresh()
  if (unsubscribe) unsubscribe()
  unsubscribe = downloadManager.addListener(refresh)
}

function onPermGranted() {
  showPermGate.value = false
  initDownloadManager()
}

onMounted(async () => {
  // 仅 Android 需要权限
  if (platform.value === 'android') {
    const ok = await checkPerm()
    if (!ok) {
      showPermGate.value = true
      return
    }
  }

  await initDownloadManager()
})

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe()
})
</script>

<template>
  <div class="downloads-page">
    <h1 class="dl-title">我的下载</h1>

    <div class="dl-tabs">
      <span class="dl-tab" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">
        全部 ({{ tasks.length }})
      </span>
      <span
        class="dl-tab"
        :class="{ active: activeTab === 'active' }"
        @click="activeTab = 'active'"
      >
        下载中 ({{ activeCount }})
      </span>
      <span
        class="dl-tab"
        :class="{ active: activeTab === 'completed' }"
        @click="activeTab = 'completed'"
      >
        已完成
      </span>
    </div>

    <div v-if="filteredTasks.length === 0" class="dl-empty">
      <p>暂无下载任务</p>
    </div>

    <div v-else class="dl-list">
      <DownloadItem
        v-for="task in filteredTasks"
        :key="task.id"
        :task="task"
        @pause="downloadManager.pause($event)"
        @resume="downloadManager.resume($event)"
        @cancel="downloadManager.cancel($event)"
        @remove="handleRemove"
        @download="handleOpenOutput"
      />
    </div>

    <StoragePermissionGate
      v-if="showPermGate"
      @granted="onPermGranted"
      @cancel="showPermGate = false"
    />

    <!-- 删除方式选择 -->
    <div v-if="removeTarget" class="dl-modal-overlay" @click.self="removeTarget = null">
      <div class="dl-modal">
        <h3 class="dl-modal-title">删除「{{ removeTarget.albumName || '该任务' }}」</h3>
        <p class="dl-modal-desc">
          仅删除记录时，已下载的图片仍保留，可在离线库继续阅读；删除本地文件后不可恢复。
        </p>
        <div class="dl-modal-actions">
          <button class="dl-modal-btn record" :disabled="removing" @click="doRemove(removeTarget.id, false)">
            仅删除下载记录
          </button>
          <button class="dl-modal-btn files" :disabled="removing" @click="doRemove(removeTarget.id, true)">
            删除记录和本地文件
          </button>
        </div>
        <button class="dl-modal-cancel" :disabled="removing" @click="removeTarget = null">取消</button>
      </div>
    </div>
  </div>
</template>
