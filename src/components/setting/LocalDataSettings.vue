<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { localDB } from '@/utils/localDB.js'
import { exportAsFile, importFromJSON } from '@/utils/dataExport.js'
import { useLocalUser } from '@/composables/useLocalUser.js'
import '@/styles/setting.css'

const router = useRouter()
const { currentUser, ready, updateUsername } = useLocalUser()

const toast = ref(null)
const importing = ref(false)
const fileInputRef = ref(null)
const stats = ref({ favorites: 0, history: 0 })
const exporting = ref(false)

// 改名
const editingName = ref(false)
const nameInput = ref('')

function showToast(msg, type = 'success') {
  toast.value = { msg, type }
  setTimeout(() => {
    toast.value = null
  }, 2200)
}

async function refreshStats() {
  if (!currentUser.value) return
  const [favs, hist] = await Promise.all([
    localDB.getFavorites(currentUser.value.id),
    localDB.getHistory(currentUser.value.id),
  ])
  stats.value = { favorites: favs.length, history: hist.length }
}

// ---------- 返回 ----------
function goBack() {
  if (window.history.state && window.history.state.position > 0) {
    router.back()
  } else {
    router.push({ name: 'setting' })
  }
}

// ---------- 改名 ----------
function startEditName() {
  nameInput.value = currentUser.value?.username || ''
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
      updateUsername(user.username)
      showToast('用户名已更新')
      editingName.value = false
    }
  } catch (e) {
    showToast('保存失败：' + (e?.message || ''), 'error')
  }
}

// ---------- 导出 ----------
async function handleExportDownload() {
  if (exporting.value || !currentUser.value) return
  exporting.value = true
  try {
    await exportAsFile(currentUser.value.id)
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
  if (!file || !currentUser.value) return
  importing.value = true
  try {
    const text = await file.text()
    const result = await importFromJSON(currentUser.value.id, text)
    showToast(`导入成功：${result.favorites} 个收藏 / ${result.history} 条历史`)
    await refreshStats()
  } catch (err) {
    showToast('导入失败：' + err.message, 'error')
  } finally {
    importing.value = false
  }
}

onMounted(() => {
  if (ready.value && currentUser.value) {
    refreshStats()
  }
})
</script>

<template>
  <div class="setting-body">
    <!-- 返回栏 -->
    <div class="page-back-bar">
      <button class="page-back-btn" @click="goBack" aria-label="返回">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>返回</span>
      </button>
    </div>

    <h1 class="title">本地数据管理</h1>

    <div v-if="ready && currentUser" class="options">
      <!-- 账号信息 -->
      <div class="option option-block">
        <div class="block-title">本地账号</div>
        <div v-if="!editingName" class="username-row">
          <span class="username-label">用户名：</span>
          <strong class="username-value">{{ currentUser.username }}</strong>
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
      <div class="option option-block">
        <div class="block-title">数据概览</div>
        <p class="stats-line">
          本地收藏：<strong>{{ stats.favorites }}</strong> 个 · 浏览历史：<strong>{{
            stats.history
          }}</strong>
          条
        </p>
        <p class="section-tip">浏览历史是本地账号和云端账号共享的</p>
      </div>

      <!-- 导出 -->
      <div class="option option-block">
        <div class="block-title">导出数据</div>
        <p class="section-tip">将本地收藏和历史导出为 JSON，可用于备份或迁移。</p>
        <div class="btn-row">
          <button class="settings-btn primary" :disabled="exporting" @click="handleExportDownload">
            <span v-if="!exporting">导出备份文件</span>
            <span v-else>导出中...</span>
          </button>
        </div>
      </div>

      <!-- 导入 -->
      <div class="option option-block">
        <div class="block-title">导入数据</div>
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

    <div v-else-if="ready" class="list-empty-container">
      <p class="list-empty-text">本地账号未就绪</p>
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
