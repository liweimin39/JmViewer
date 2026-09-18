<script setup>
import { ref } from 'vue'
import { localDB } from '@/utils/localDB.js'
import { exportAsFile, importFromJSON } from '@/utils/dataExport.js'
import { useLocalUser } from '@/composables/useLocalUser.js'

const emit = defineEmits(['imported'])
const { destroy } = useLocalUser()

const toast = ref(null)
const importing = ref(false)
const fileInputRef = ref(null)

const stats = ref({ favorites: 0, history: 0 })
const exporting = ref(false)

function showToast(msg, type = 'success') {
  toast.value = { msg, type }
  setTimeout(() => {
    toast.value = null
  }, 2200)
}

async function refreshStats() {
  const [favs, hist] = await Promise.all([localDB.getFavorites(), localDB.getHistory()])
  stats.value = { favorites: favs.length, history: hist.length }
}
refreshStats()

async function handleExportDownload() {
  if (exporting.value) return
  exporting.value = true
  try {
    await exportAsFile()
    showToast('已导出备份')
  } catch (e) {
    const msg = e?.message || ''
    if (!/cancel/i.test(msg)) {
      showToast('导出失败：' + msg, 'error')
    }
  } finally {
    exporting.value = false
  }
}

function handlePickFile() {
  fileInputRef.value?.click()
}

async function handleFileChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  importing.value = true
  try {
    const text = await file.text()
    const result = await importFromJSON(text)
    showToast(`导入成功：${result.favorites} 个收藏 / ${result.history} 条历史`)
    await refreshStats()
    emit('imported')
  } catch (err) {
    showToast('导入失败：' + err.message, 'error')
  } finally {
    importing.value = false
  }
}

async function handleClearHistory() {
  if (!confirm('确定要清空所有浏览历史吗？此操作不可恢复。')) return
  await localDB.clearHistory()
  await refreshStats()
  showToast('历史已清空')
  emit('imported')
}

async function handleClearFavorites() {
  if (!confirm('确定要清空所有本地收藏吗？此操作不可恢复。')) return
  const list = await localDB.getFavorites()
  for (const item of list) {
    await localDB.removeFavorite(item.comicId)
  }
  await refreshStats()
  showToast('收藏已清空')
  emit('imported')
}

async function handleDestroy() {
  if (!confirm('确定要删除本地账号及所有数据吗？此操作不可恢复。')) return
  if (!confirm('再次确认：所有收藏、历史、账号信息都会被永久删除。')) return
  await destroy()
  showToast('本地账号已删除')
  emit('imported')
}
</script>

<template>
  <div class="local-settings">
    <div class="settings-section">
      <h3>数据概览</h3>
      <p class="stats-line">
        本地收藏：<strong>{{ stats.favorites }}</strong> 个 · 浏览历史：<strong>{{
          stats.history
        }}</strong>
        条
      </p>
    </div>

    <div class="settings-section">
      <h3>导出数据</h3>
      <p class="section-tip">将本地收藏和历史导出为 JSON，可用于备份或迁移到其他设备。</p>
      <div class="btn-row">
        <button class="settings-btn primary" :disabled="exporting" @click="handleExportDownload">
          <span v-if="!exporting">导出备份文件</span>
          <span v-else>导出中...</span>
        </button>
      </div>
    </div>

    <div class="settings-section">
      <h3>导入数据</h3>
      <p class="section-tip">从之前导出的 JSON 文件恢复数据。同名数据会被覆盖。</p>
      <div class="btn-row">
        <button class="settings-btn" :disabled="importing" @click="handlePickFile">
          <span v-if="!importing">选择文件导入</span>
          <span v-else>导入中...</span>
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          style="display: none"
          @change="handleFileChange"
        />
      </div>
    </div>

    <div class="settings-section danger">
      <h3>危险操作</h3>
      <div class="btn-row">
        <button class="settings-btn danger-btn" @click="handleClearHistory">清空历史</button>
        <button class="settings-btn danger-btn" @click="handleClearFavorites">清空收藏</button>
      </div>
      <div class="btn-row">
        <button class="settings-btn danger-btn full" @click="handleDestroy">
          删除本地账号及全部数据
        </button>
      </div>
    </div>
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
