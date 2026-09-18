<script setup>
import { ref } from 'vue'
import { useLocalUser } from '@/composables/useLocalUser.js'

const emit = defineEmits(['created', 'cancel'])
const { register } = useLocalUser()

const username = ref('')
const loading = ref(false)
const errorMsg = ref('')

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
  loading.value = true
  errorMsg.value = ''
  try {
    await register(name)
    emit('created')
  } catch (e) {
    errorMsg.value = e.message || '创建失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-container local-auth">
    <h2>使用本地账号</h2>
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
      <span class="btn-text" :style="{ display: loading ? 'none' : 'inline' }">创建本地账号</span>
      <span class="btn-loader" :style="{ display: loading ? 'inline-block' : 'none' }"></span>
    </button>
    <div class="msg" style="color: #d9534f">{{ errorMsg }}</div>
    <div class="local-auth-actions">
      <span class="link" @click="emit('cancel')">返回登录</span>
    </div>
  </div>
</template>
