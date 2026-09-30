<script setup>
import { ref, onMounted } from 'vue'
import { localDB } from '@/utils/localDB.js'
import { useLocalUser } from '@/composables/useLocalUser.js'

const emit = defineEmits(['created', 'cancel'])
const { users, createUser, switchUser, deleteUser } = useLocalUser()

// 'list' | 'create'
const mode = ref('list')

// 编辑模式（显示删除按钮）
const editing = ref(false)

const username = ref('')
const loading = ref(false)
const errorMsg = ref('')

// 每个账号的数据量
const userStats = ref({})

async function loadStats() {
  const stats = {}
  for (const u of users.value) {
    const [favs, hist] = await Promise.all([localDB.getFavorites(u.id), localDB.getHistory(u.id)])
    stats[u.id] = { favorites: favs.length, history: hist.length }
  }
  userStats.value = stats
}

function toggleEdit() {
  editing.value = !editing.value
}

async function handleLogin(userId) {
  // 编辑模式下点击卡片不登录
  if (editing.value) return
  await switchUser(userId)
  emit('created')
}

async function handleCreate() {
  if (loading.value) return
  const name = username.value.trim()
  if (!name) {
    errorMsg.value = '请输入用户名'
    return
  }
  if (name.length > 30) {
    errorMsg.value = '用户名不能超过 30 个字符'
    return
  }
  if (users.value.some((u) => u.username === name)) {
    errorMsg.value = '用户名已存在'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    await createUser(name)
    emit('created')
  } catch (e) {
    errorMsg.value = e.message || '创建失败'
  } finally {
    loading.value = false
  }
}

async function handleDelete(user) {
  if (users.value.length <= 1) {
    if (!confirm('这是最后一个本地账号，确定删除吗？删除后将没有本地账号可用。')) return
  } else {
    if (!confirm(`确定删除账号「${user.username}」吗？\n该账号的所有收藏和浏览历史都会被删除。`))
      return
  }

  await deleteUser(user.id)
  await loadStats()

  // 删完只剩 0 个 → 创建模式；只剩 1 个 → 退出编辑模式
  if (users.value.length === 0) {
    mode.value = 'create'
    editing.value = false
  } else if (users.value.length === 1) {
    editing.value = false
  }
}

onMounted(() => {
  loadStats()
  if (users.value.length === 0) {
    mode.value = 'create'
  }
})
</script>

<template>
  <div class="auth-container local-auth">
    <!-- ========== 列表模式 ========== -->
    <template v-if="mode === 'list'">
      <div class="local-header">
        <h2>选择本地账号</h2>
        <!-- 编辑按钮：至少有 2 个账号时才显示 -->
        <button v-if="users.length > 1" class="local-edit-btn" @click="toggleEdit">
          {{ editing ? '完成' : '编辑' }}
        </button>
      </div>
      <p class="local-auth-tip">本地账号仅保存在此设备上，不同账号数据独立</p>

      <div v-if="users.length === 0" class="local-empty">
        <p class="local-empty-text">还没有本地账号</p>
        <button class="local-primary-btn" @click="mode = 'create'">创建第一个账号</button>
      </div>

      <div v-else class="local-user-list">
        <div
          v-for="u in users"
          :key="u.id"
          class="local-user-item"
          :class="{ editing }"
          @click="handleLogin(u.id)"
        >
          <div class="local-user-avatar">
            {{ (u.username || '?').slice(0, 1).toUpperCase() }}
          </div>
          <div class="local-user-info">
            <div class="local-user-name">{{ u.username }}</div>
            <div class="local-user-stats">
              <span class="stat-badge">收藏 {{ userStats[u.id]?.favorites ?? 0 }}</span>
              <span class="stat-badge">历史 {{ userStats[u.id]?.history ?? 0 }}</span>
            </div>
          </div>

          <!-- 编辑模式下显示删除按钮 -->
          <button v-if="editing" class="local-user-delete" @click.stop="handleDelete(u)">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              style="vertical-align: -2px; margin-right: 4px"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            删除
          </button>
        </div>

        <button class="local-create-link" @click="mode = 'create'">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="vertical-align: -2px; margin-right: 4px"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          创建新账号
        </button>
      </div>

      <div class="local-auth-actions">
        <span class="link" @click="emit('cancel')">返回登录</span>
      </div>
    </template>

    <!-- ========== 创建模式 ========== -->
    <template v-else>
      <h2>创建本地账号</h2>
      <p class="local-auth-tip">
        本地账号仅保存在此设备上，<br />
        不连接服务器，无需密码。
      </p>
      <input
        type="text"
        v-model="username"
        placeholder="输入用户名"
        maxlength="30"
        @keyup.enter="handleCreate"
      />
      <button :disabled="loading" @click="handleCreate">
        <span class="btn-text" :style="{ display: loading ? 'none' : 'inline' }">创建并进入</span>
        <span class="btn-loader" :style="{ display: loading ? 'inline-block' : 'none' }"></span>
      </button>
      <div class="msg" style="color: #d9534f; text-align: center">{{ errorMsg }}</div>
      <div class="local-auth-actions">
        <span class="link" @click="users.length > 0 ? (mode = 'list') : emit('cancel')">{{
          users.length > 0 ? '返回列表' : '返回登录'
        }}</span>
      </div>
    </template>
  </div>
</template>
