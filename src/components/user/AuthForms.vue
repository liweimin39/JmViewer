<script setup>
import { ref, reactive } from 'vue'
import { userApi } from '@/api/UserApi.js'
import { useUser } from '@/composables/useUser.js'
import LocalAuthForm from './LocalAuthForm.vue'

const showLocalAuth = ref(false)

const emit = defineEmits(['logged-in'])
const { setUser } = useUser()

const activeTab = ref('login')

const loginForm = reactive({ username: '', password: '' })
const loginState = reactive({ loading: false, msg: '', color: '' })

const regForm = reactive({ username: '', email: '', password: '', confirm: '', gender: '' })
const regState = reactive({ loading: false, msg: '', color: '' })

const forgotForm = reactive({ email: '' })
const forgotState = reactive({ loading: false, msg: '', color: '' })

async function handleLogin() {
  if (loginState.loading) return
  if (!loginForm.username || !loginForm.password) {
    loginState.msg = '请填写完整信息'
    loginState.color = '#d9534f'
    return
  }
  loginState.loading = true
  loginState.msg = ''
  loginState.color = ''
  try {
    const result = await userApi.login(loginForm.username, loginForm.password)
    setUser(result)
    emit('logged-in')
  } catch (err) {
    loginState.msg = err.message || '登录失败'
    loginState.color = '#d9534f'
  } finally {
    loginState.loading = false
  }
}

async function handleRegister() {
  if (regState.loading) return
  const { username, email, password, confirm, gender } = regForm
  if (!username || !email || !password || !confirm) {
    regState.msg = '请填写所有必填项'
    regState.color = '#d9534f'
    return
  }
  if (password !== confirm) {
    regState.msg = '两次密码输入不一致'
    regState.color = '#d9534f'
    return
  }
  regState.loading = true
  regState.msg = ''
  regState.color = ''
  try {
    const result = await userApi.register(username, email, password, confirm, gender)
    regState.msg = result.msg || '注册成功，请查收邮件验证'
    regState.color = 'green'
  } catch (err) {
    regState.msg = err.message || '注册失败'
    regState.color = '#d9534f'
  } finally {
    regState.loading = false
  }
}

async function handleForgot() {
  if (forgotState.loading) return
  if (!forgotForm.email) {
    forgotState.msg = '请输入邮箱'
    forgotState.color = '#d9534f'
    return
  }
  forgotState.loading = true
  forgotState.msg = ''
  forgotState.color = ''
  try {
    const result = await userApi.forgotPassword(forgotForm.email)
    forgotState.msg = result.msg || '重置邮件已发送，请查收'
    forgotState.color = 'green'
  } catch (err) {
    forgotState.msg = err.message || '发送失败'
    forgotState.color = '#d9534f'
  } finally {
    forgotState.loading = false
  }
}
</script>

<template>
  <LocalAuthForm
    v-if="showLocalAuth"
    @created="$emit('logged-in')"
    @cancel="showLocalAuth = false"
  />

  <div v-else class="auth-container">
    <div class="auth-tabs">
      <span class="auth-tab" :class="{ active: activeTab === 'login' }" @click="activeTab = 'login'"
        >登录</span
      >
      <span
        class="auth-tab"
        :class="{ active: activeTab === 'register' }"
        @click="activeTab = 'register'"
        >注册</span
      >
      <span
        class="auth-tab"
        :class="{ active: activeTab === 'forgot' }"
        @click="activeTab = 'forgot'"
        >忘记密码</span
      >
    </div>

    <!-- 登录 -->
    <div class="auth-form" v-show="activeTab === 'login'">
      <h2>登录</h2>
      <input type="text" v-model="loginForm.username" placeholder="用户名" />
      <input
        type="password"
        v-model="loginForm.password"
        placeholder="密码"
        @keyup.enter="handleLogin"
      />
      <button :disabled="loginState.loading" @click="handleLogin">
        <span class="btn-text" :style="{ display: loginState.loading ? 'none' : 'inline' }"
          >登录</span
        >
        <span
          class="btn-loader"
          :style="{ display: loginState.loading ? 'inline-block' : 'none' }"
        ></span>
      </button>
      <div class="msg" :style="{ color: loginState.color }">{{ loginState.msg }}</div>
    </div>

    <!-- 注册 -->
    <div class="auth-form" v-show="activeTab === 'register'">
      <h2>注册</h2>
      <input type="text" v-model="regForm.username" placeholder="用户名" />
      <input type="email" v-model="regForm.email" placeholder="邮箱" />
      <input type="password" v-model="regForm.password" placeholder="密码" />
      <input type="password" v-model="regForm.confirm" placeholder="确认密码" />
      <select v-model="regForm.gender">
        <option value="">性别（可选）</option>
        <option value="Male">男</option>
        <option value="Female">女</option>
      </select>
      <button :disabled="regState.loading" @click="handleRegister">
        <span class="btn-text" :style="{ display: regState.loading ? 'none' : 'inline' }"
          >注册</span
        >
        <span
          class="btn-loader"
          :style="{ display: regState.loading ? 'inline-block' : 'none' }"
        ></span>
      </button>
      <div class="msg" :style="{ color: regState.color }">{{ regState.msg }}</div>
    </div>

    <!-- 忘记密码 -->
    <div class="auth-form" v-show="activeTab === 'forgot'">
      <h2>重置密码</h2>
      <input
        type="email"
        v-model="forgotForm.email"
        placeholder="注册邮箱"
        @keyup.enter="handleForgot"
      />
      <button :disabled="forgotState.loading" @click="handleForgot">
        <span class="btn-text" :style="{ display: forgotState.loading ? 'none' : 'inline' }"
          >发送重置邮件</span
        >
        <span
          class="btn-loader"
          :style="{ display: forgotState.loading ? 'inline-block' : 'none' }"
        ></span>
      </button>
      <div class="msg" :style="{ color: forgotState.color }">{{ forgotState.msg }}</div>
    </div>

    <!-- ★ 挪到三个表单之外，常驻显示 -->
    <div class="local-entry">
      <span class="local-entry-divider">或</span>
      <button class="local-entry-btn" @click="showLocalAuth = true">
        使用本地账号（离线使用）
      </button>
    </div>
  </div>
</template>
