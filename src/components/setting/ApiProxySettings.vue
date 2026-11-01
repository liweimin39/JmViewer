<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { setting } from '@/components/general/Setting.js'
import { normalizeProxyBase } from '@/api/JmcomicApi.js'
import '@/styles/setting.css'

const router = useRouter()

// ---------- 返回 ----------
function goBack() {
  if (window.history.state && window.history.state.position > 0) {
    router.back()
  } else {
    router.push({ name: 'setting' })
  }
}

// ---------- 表单状态 ----------
const enabled = ref(setting.api_proxy_enabled === 'on')
const urlInput = ref(setting.api_proxy_url)
const keyInput = ref(setting.api_proxy_key)
const showKey = ref(false)

// 已落盘的值（用于状态显示，随保存 / 开关变化刷新）
const savedUrl = ref(setting.api_proxy_url)
const savedKey = ref(setting.api_proxy_key)

const testing = ref(false)
const testResult = ref(null)

const toast = ref(null)
let toastTimer = null

function showToast(msg, type = 'success') {
  toast.value = { msg, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = null
  }, 2200)
}

const proxyActive = computed(() => enabled.value && !!savedUrl.value && !!savedKey.value)
const activeText = computed(() => (proxyActive.value ? '已启用' : '未启用'))
const activeTip = computed(() =>
  proxyActive.value
    ? '当前所有接口与图片都经代理转发'
    : enabled.value
      ? '开关已打开，但地址或密钥缺失，暂时仍走直连'
      : '当前为直连模式（本地生成令牌并解密）',
)

// ---------- 校验与保存 ----------
function validateURL(raw) {
  if (!raw) return '请填写代理地址'
  if (!/^https?:\/\//i.test(raw)) return '代理地址需要以 http:// 或 https:// 开头'
  try {
    // eslint-disable-next-line no-new
    new URL(raw)
  } catch {
    return '代理地址格式不正确'
  }
  return ''
}

/** 把输入框写进本地设置；silent = 不弹提示 */
function persist(silent = false) {
  const url = normalizeProxyBase(urlInput.value)
  const key = keyInput.value.trim()

  if (url) {
    const err = validateURL(url)
    if (err) {
      showToast(err, 'error')
      return false
    }
  }

  setting.setText('api_proxy_url', url)
  setting.setText('api_proxy_key', key)
  urlInput.value = url
  keyInput.value = key
  savedUrl.value = setting.api_proxy_url
  savedKey.value = setting.api_proxy_key

  if (!silent) showToast('已保存')
  return true
}

function handleSave() {
  persist()
}

// ---------- 开关 ----------
function pickEnabled(value) {
  if (value === 'on') {
    if (!persist(true)) return
    if (!setting.api_proxy_url) {
      showToast('请先填写代理地址', 'error')
      return
    }
    if (!setting.api_proxy_key) {
      showToast('请先填写代理密钥', 'error')
      return
    }
    setting.setOption('api_proxy_enabled', 'on')
    enabled.value = true
    showToast('已开启 API 代理')
  } else {
    setting.setOption('api_proxy_enabled', 'off')
    enabled.value = false
    showToast('已关闭，恢复直连')
  }
  testResult.value = null
}

// ---------- 测试连接 ----------
async function handleTest() {
  if (testing.value) return

  const url = normalizeProxyBase(urlInput.value)
  const key = keyInput.value.trim()
  const err = validateURL(url)
  if (err) {
    showToast(err, 'error')
    return
  }

  testing.value = true
  testResult.value = null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    // 1. 健康检查（免鉴权，确认地址可达）
    const healthResp = await fetch(`${url}/health`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!healthResp.ok) throw new Error(`健康检查失败 (HTTP ${healthResp.status})`)
    const health = await healthResp.json().catch(() => null)
    if (!health || health.ok !== true) throw new Error('健康检查返回内容异常')

    if (!key) {
      testResult.value = { ok: true, msg: '服务可达，但未填写密钥，接口调用会被拒绝' }
      return
    }

    // 2. /servers 需要鉴权：顺便验证密钥是否正确
    const serversResp = await fetch(`${url}/servers`, {
      headers: { 'X-Api-Key': key },
      cache: 'no-store',
      signal: controller.signal,
    })
    const body = await serversResp.json().catch(() => null)

    if (serversResp.status === 401) throw new Error('密钥无效，与服务端 API_KEY 不一致')

    if (serversResp.ok && body && body.ok === true) {
      const count = Array.isArray(body.data?.Server) ? body.data.Server.length : 0
      testResult.value = { ok: true, msg: `连接正常 · 上游服务器 ${count} 个` }
    } else {
      testResult.value = {
        ok: true,
        msg: `服务可达，密钥已通过，但上游暂不可用：${(body && body.error) || `HTTP ${serversResp.status}`}`,
      }
    }
  } catch (e) {
    const msg = e?.name === 'AbortError' ? '请求超时' : e?.message || '连接失败'
    testResult.value = { ok: false, msg }
  } finally {
    clearTimeout(timer)
    testing.value = false
  }
}

// ---------- 清空 ----------
function handleClear() {
  if (!confirm('确定清空代理地址和密钥吗？将同时关闭代理开关。')) return
  setting.setText('api_proxy_url', '')
  setting.setText('api_proxy_key', '')
  setting.setOption('api_proxy_enabled', 'off')
  urlInput.value = ''
  keyInput.value = ''
  savedUrl.value = ''
  savedKey.value = ''
  enabled.value = false
  testResult.value = null
  showToast('已清空并恢复直连')
}
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

    <h1 class="title">API 代理</h1>

    <div class="options">
      <!-- 当前状态 -->
      <div class="option option-block">
        <div class="block-title">当前状态</div>
        <p class="proxy-status-line">
          接口请求：<strong :class="{ on: proxyActive }">{{ activeText }}</strong>
        </p>
        <p class="section-tip">{{ activeTip }}</p>
        <p class="section-tip">
          代理目前覆盖搜索、首页、详情、章节、评论、分类与图片；账号相关功能（登录 / 收藏 / 追踪 /
          通知）仍直连上游
        </p>
      </div>

      <!-- 代理开关 -->
      <div class="option option-block">
        <div class="block-title">启用代理</div>
        <p class="section-tip">
          开启后由代理服务器生成时间戳令牌并解密，客户端只需提供密钥；关闭则恢复原有的直连 +
          本地解密
        </p>
        <div class="theme-list">
          <button class="theme-item" :class="{ active: !enabled }" @click="pickEnabled('off')">
            <span>关闭</span>
          </button>
          <button class="theme-item" :class="{ active: enabled }" @click="pickEnabled('on')">
            <span>开启</span>
          </button>
        </div>
      </div>

      <!-- 代理地址 -->
      <div class="option option-block">
        <div class="block-title">代理地址</div>
        <p class="section-tip">
          例如 https://jmapi.yourdomain.com（Cloudflare Workers / Vercel / EdgeOne 的部署域名）
        </p>
        <input
          v-model="urlInput"
          class="username-input"
          type="url"
          inputmode="url"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          maxlength="512"
          placeholder="https://your-proxy.example.com"
        />
      </div>

      <!-- 密钥 -->
      <div class="option option-block">
        <div class="block-title">代理密钥</div>
        <p class="section-tip">与服务端环境变量 API_KEY 保持一致</p>
        <div class="proxy-key-row">
          <input
            v-model="keyInput"
            class="username-input"
            :type="showKey ? 'text' : 'password'"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            maxlength="512"
            placeholder="输入 API_KEY"
          />
          <button class="edit-name-btn" @click="showKey = !showKey">
            {{ showKey ? '隐藏' : '显示' }}
          </button>
        </div>
      </div>

      <!-- 操作 -->
      <div class="option option-block">
        <div class="block-title">保存与测试</div>
        <div class="btn-row">
          <button class="settings-btn primary" @click="handleSave">保存</button>
          <button class="settings-btn" :disabled="testing" @click="handleTest">
            <span v-if="!testing">测试连接</span>
            <span v-else>测试中...</span>
          </button>
          <button class="settings-btn" @click="handleClear">清空</button>
        </div>
        <p
          v-if="testResult"
          class="proxy-test-result"
          :class="{ ok: testResult.ok, error: !testResult.ok }"
        >
          {{ testResult.msg }}
        </p>
        <p class="section-tip">修改地址或密钥后，已显示的图片需要重新进入页面才会改用新的地址</p>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="toast"
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

<style scoped>
.proxy-status-line {
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 15px;
}
.proxy-status-line strong {
  color: var(--theme-text-weak);
  font-weight: 600;
}
.proxy-status-line strong.on {
  color: var(--theme-accent-main);
}

.proxy-key-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.proxy-key-row .username-input {
  flex: 1;
  min-width: 0;
}

.proxy-test-result {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.5;
}
.proxy-test-result.ok {
  color: var(--theme-accent-main);
}
.proxy-test-result.error {
  color: var(--theme-danger);
}
</style>
