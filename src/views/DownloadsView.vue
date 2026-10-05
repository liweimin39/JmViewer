<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { downloadManager, DownloadStatus } from '@/utils/downloadManager.js'
import DownloadItem from '@/components/download/DownloadItem.vue'
import '@/styles/download.css'

const tasks = ref([])
const activeTab = ref('all') // all | active | completed
let unsubscribe = null

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

async function handleDownloadZip(taskId) {
  try {
    await downloadManager.downloadZip(taskId)
  } catch (e) {
    alert('下载失败：' + (e?.message || '未知错误'))
  }
}

onMounted(async () => {
  await downloadManager.init()
  refresh()
  unsubscribe = downloadManager.addListener(refresh)
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
        @remove="downloadManager.remove($event)"
        @download="handleDownloadZip"
      />
    </div>
  </div>
</template>
