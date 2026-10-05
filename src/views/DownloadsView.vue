<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { downloadManager, DownloadStatus } from '@/utils/downloadManager.js'
import { useStoragePermission } from '@/composables/useStoragePermission.js'
import DownloadItem from '@/components/download/DownloadItem.vue'
import StoragePermissionGate from '@/components/download/StoragePermissionGate.vue'
import '@/styles/download.css'

const tasks = ref([])
const activeTab = ref('all')
const showPermGate = ref(false)
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
      <span class="dl-empty-icon">📥</span>
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
        @remove="downloadManager.remove($event)"
        @download="handleOpenOutput"
      />
    </div>

    <StoragePermissionGate
      v-if="showPermGate"
      @granted="onPermGranted"
      @cancel="showPermGate = false"
    />
  </div>
</template>
