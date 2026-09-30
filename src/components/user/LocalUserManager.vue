<script setup>
import { ref } from 'vue'
import { useLocalUser } from '@/composables/useLocalUser.js'

const props = defineProps({
  currentUserId: { type: String, required: true },
})
const emit = defineEmits(['close', 'changed'])

const { users, createUser, switchUser, deleteUser } = useLocalUser()

const mode = ref('list')
const newUsername = ref('')
const creating = ref(false)
const errorMsg = ref('')

async function handleSwitch(userId) {
  if (userId === props.currentUserId) {
    emit('close')
    return
  }
  await switchUser(userId)
  emit('changed')
  emit('close')
}

async function handleCreate() {
  const name = newUsername.value.trim()
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
  creating.value = true
  errorMsg.value = ''
  try {
    await createUser(name)
    newUsername.value = ''
    mode.value = 'list'
    emit('changed')
  } catch (e) {
    errorMsg.value = e.message || '创建失败'
  } finally {
    creating.value = false
  }
}

async function handleDelete(user) {
  if (users.value.length <= 1) {
    alert('至少保留一个本地账号')
    return
  }
  if (!confirm(`确定删除账号「${user.username}」吗？\n该账号的所有收藏和浏览历史都会被删除。`))
    return

  const wasCurrent = user.id === props.currentUserId
  await deleteUser(user.id)
  emit('changed')
  if (wasCurrent) {
    emit('close')
  }
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="user-manager-overlay" @click.self="emit('close')">
    <div class="user-manager-panel">
      <div class="um-header">
        <h3>{{ mode === 'list' ? '本地账号管理' : '创建新账号' }}</h3>
        <button class="um-close" @click="emit('close')">✕</button>
      </div>

      <!-- 列表 -->
      <div v-if="mode === 'list'" class="um-body">
        <div class="um-list">
          <div
            v-for="u in users"
            :key="u.id"
            class="um-item"
            :class="{ active: u.id === currentUserId }"
          >
            <div class="um-item-avatar">{{ (u.username || '?').slice(0, 1).toUpperCase() }}</div>
            <div class="um-item-info">
              <div class="um-item-name">
                {{ u.username }}
                <span v-if="u.id === currentUserId" class="um-current-tag">当前</span>
              </div>
              <div class="um-item-date">创建于 {{ formatDate(u.createdAt) }}</div>
            </div>
            <div class="um-item-actions">
              <button
                v-if="u.id !== currentUserId"
                class="um-btn-small"
                @click="handleSwitch(u.id)"
              >
                切换
              </button>
              <button v-if="users.length > 1" class="um-btn-small danger" @click="handleDelete(u)">
                删除
              </button>
            </div>
          </div>
        </div>
        <button class="um-create-btn" @click="mode = 'create'">+ 创建新账号</button>
      </div>

      <!-- 创建 -->
      <div v-else class="um-body">
        <p class="um-tip">新账号的数据与现有账号完全独立。</p>
        <input
          type="text"
          v-model="newUsername"
          placeholder="输入用户名"
          maxlength="30"
          class="um-input"
          @keyup.enter="handleCreate"
        />
        <div v-if="errorMsg" class="um-error">{{ errorMsg }}</div>
        <div class="um-create-actions">
          <button class="um-btn" @click="mode = 'list'">取消</button>
          <button class="um-btn primary" :disabled="creating" @click="handleCreate">
            <span v-if="!creating">创建</span>
            <span v-else>创建中...</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
