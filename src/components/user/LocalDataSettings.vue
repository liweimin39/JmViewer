<script setup>
import { ref } from 'vue'
import { localDB } from '@/utils/localDB.js'
import { exportAsFile, importFromJSON } from '@/utils/dataExport.js'

const props = defineProps({
  userId: { type: String, required: true },
  username: { type: String, default: '用户' },
})
const emit = defineEmits(['imported', 'username-updated'])

const toast = ref(null)
const importing = ref(false)
const fileInputRef = ref(null)
const stats = ref({ favorites: 0, history: 0 })
const exporting = ref(false)

// 改名相关
const editingName = ref(false)
const nameInput = ref('')

function showToast(msg, type = 'success') {
  toast.value = { msg, type }
  setTimeout(() => {
    toast.value = null
  }, 2200)
}

async function refreshStats() {
  const [favs, hist] = await Promise.all([
    localDB.getFavorites(props.userId),
    localDB.getHistory(props.userId),
  ])
  stats.value = { favorites: favs.length, history: hist.length }
}
refreshStats()

// ---------- 改名 ----------
function startEditName() {
  nameInput.value = props.username
  editingName.value = true
}

function cancelEditName() {
  editingName.value = false
  nameInput.value = ''
}

async function handleSaveName() {
  const name = nameInput.value.trim()
  if (!name) {
    showToast('用户名不能为空', 'error')
    return
  }
  if (name.length > 30) {
    showToast('用户名不能超过 30 个字符', 'error')
    return
  }
  try {
    const user = await localDB.updateLocalUsername(name)
    if (user) {
      emit('username-updated', user.username)
      showToast('用户名已更新')
      editingName.value = false
    }
  } catch (e) {
    showToast('保存失败：' + (e?.message || ''), 'error')
  }
}

// ---------- 导出 ----------
async function handleExportDownload() {
  if (exporting.value) return
  exporting.value = true
  try {
    await exportAsFile(props.userId)
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

// ---------- 导入 ----------
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
    const result = await importFromJSON(props.userId, text)
    showToast(`导入成功：${result.favorites} 个收藏 / ${result.history} 条历史`)
    await refreshStats()
    emit('imported')
  } catch (err) {
    showToast('导入失败：' + err.message, 'error')
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="local-settings">
    <!-- 账号信息 -->
    <div class="settings-section">
      <h3>本地账号</h3>

      <div v-if="!editingName" class="username-row">
        <span class="username-label">用户名：</span>
        <strong class="username-value">{{ username }}</strong>
        <button class="edit-name-btn" @click="startEditName">修改</button>
      </div>

      <div v-else class="username-edit-row">
        <input
          type="text"
          v-model="nameInput"
          maxlength="30"
          placeholder="输入新用户名"
          class="username-input"
          @keyup.enter="handleSaveName"
        />
        <div class="username-edit-actions">
          <button class="settings-btn" @click="cancelEditName">取消</button>
          <button class="settings-btn primary" @click="handleSaveName">保存</button>
        </div>
      </div>
    </div>

    <!-- 数据概览 -->
    <div class="settings-section">
      <h3>数据概览</h3>
      <p class="stats-line">
        本地收藏：<strong>{{ stats.favorites }}</strong> 个 · 浏览历史：<strong>{{
          stats.history
        }}</strong>
        条
      </p>
      <p class="section-tip" style="margin-top: 8px">浏览历史是本地账号和云端账号共享的</p>
    </div>

    <!-- 导出 -->
    <div class="settings-section">
      <h3>导出数据</h3>
      <p class="section-tip">将本地收藏和历史导出为 JSON，可用于备份或迁移。</p>
      <div class="btn-row">
        <button class="settings-btn primary" :disabled="exporting" @click="handleExportDownload">
          <span v-if="!exporting">导出备份文件</span>
          <span v-else>导出中...</span>
        </button>
      </div>
    </div>

    <!-- 导入 -->
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
        background: toast.type === 'error' ? 'var(--theme-danger-btn)' : 'var(--theme-success)',
        color: 'var(--theme-text-inverse)',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        zIndex: 1000,
        boxShadow: '0 4px 12px var(--theme-overlay-soft)',
        maxWidth: '80%',
      }"
    >
      {{ toast.msg }}
    </div>
  </Teleport>
</template>
