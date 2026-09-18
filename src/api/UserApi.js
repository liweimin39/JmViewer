import { jmApi } from './JmcomicApi.js'
import { crypto } from './Crypto.js'

// 单次请求超时（毫秒），超时会自动换域名重试
const REQUEST_TIMEOUT = 15000
// 每次重试之间的等待（毫秒）
const RETRY_DELAY = 300

class UserApi {
  // 构建请求头，可选携带 Authorization
  _getHeaders(includeAuth = false) {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      token: jmApi.accessToken.token,
      tokenParam: jmApi.accessToken.tokenParam,
    }
    if (includeAuth) {
      const jwt = localStorage.getItem('jwttoken')
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`
    }
    return headers
  }

  // 解密数据
  _decryptData(cipherText) {
    return crypto.decryptData(jmApi.currentKey, cipherText)
  }

  /**
   * 判断一个错误是否值得"换域名重试"
   * - 业务错误（参数错误、密码错误、权限不足）→ 不重试
   * - 网络错误、超时、服务器 5xx → 重试
   */
  _shouldRetry(error) {
    if (!error) return true
    if (error.__businessError) return false
    if (error.name === 'AbortError') return false
    return true
  }

  /**
   * 单次请求（一个域名一次）
   * 内部处理：超时、JSON 解析、解密、错误分类
   */
  async _requestOnce(url, options = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    // 如果外部传了 signal（主动取消），优先用外部的
    const finalOptions = {
      ...options,
      signal: options.signal || controller.signal,
    }

    let resp
    try {
      resp = await fetch(url, finalOptions)
    } catch (e) {
      clearTimeout(timer)
      // 外部主动取消，直接抛
      if (e.name === 'AbortError' && options.signal?.aborted) {
        throw e
      }
      // 超时或网络错误
      const err = new Error(e.name === 'AbortError' ? '请求超时' : '网络错误')
      err.__networkError = true
      throw err
    }
    clearTimeout(timer)

    const text = await resp.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      // 非 JSON 响应（可能是 WAF 拦截页 / 404 HTML）
      const err = new Error(`请求失败 (${resp.status})`)
      // 400-499 里除了 404，其他都当业务错误；404 可能是这个域名路由不对，换域名重试
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 404) {
        err.__businessError = true
      }
      throw err
    }

    // 检查 errorMsg（业务错误）
    if (json.errorMsg && json.errorMsg.trim() !== '') {
      const msg = Array.isArray(json.errorMsg) ? json.errorMsg.join('; ') : json.errorMsg
      const err = new Error(msg)
      err.__businessError = true
      throw err
    }

    if (!resp.ok) {
      const msg = json.msg || json.message || `HTTP ${resp.status}`
      const err = new Error(Array.isArray(msg) ? msg.join('; ') : msg)
      // 4xx 一般是业务错误；5xx 是服务器错误，可换域名重试
      if (resp.status >= 400 && resp.status < 500) {
        err.__businessError = true
      }
      throw err
    }

    // 有加密数据 → 解密
    if (json.data) {
      const decrypted = this._decryptData(json.data)
      if (decrypted && typeof decrypted === 'object') {
        if (decrypted.errorMsg && decrypted.errorMsg.trim() !== '') {
          const msg = Array.isArray(decrypted.errorMsg)
            ? decrypted.errorMsg.join('; ')
            : decrypted.errorMsg
          const err = new Error(msg)
          err.__businessError = true
          throw err
        }
        if (decrypted.msg && decrypted.msg.trim() !== '') {
          return decrypted
        }
      }
      return decrypted
    }

    return json
  }

  /**
   * 带重试的请求（遍历服务器，失败就换下一个域名）
   * @param {function|string} getUrl - (serverIndex) => url，或直接 url 字符串
   * @param {object} options - fetch options
   * @param {number} [retries] - 最大尝试次数，默认 = servers.length
   */
  async _requestWithRetry(getUrl, options = {}, retries) {
    if (typeof getUrl === 'string') {
      const url = getUrl
      getUrl = () => url
    }

    const servers = jmApi.servers || []
    if (servers.length === 0) {
      throw new Error('没有可用的服务器')
    }

    // 默认尝试次数 = 服务器数量（每个试一次）
    const maxAttempts = typeof retries === 'number' && retries > 0 ? retries : servers.length

    let lastError = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 循环使用服务器列表（attempt 超过 servers.length 会绕回来）
      const serverIndex = attempt % servers.length
      const url = getUrl(serverIndex)

      try {
        return await this._requestOnce(url, options)
      } catch (error) {
        lastError = error

        // 业务错误立即抛出，不浪费其他域名
        if (!this._shouldRetry(error)) {
          throw error
        }

        // 还有下一次尝试，短暂等待后换域名
        if (attempt < maxAttempts - 1 && RETRY_DELAY > 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY))
        }
      }
    }

    throw lastError || new Error('所有服务器请求均失败')
  }

  // ==================== 用户 ====================

  // 用户注册
  async register(username, email, password, passwordConfirm, gender = '') {
    const body = new URLSearchParams({
      username,
      email,
      password,
      password_confirm: passwordConfirm,
      gender,
    })
    const options = {
      method: 'POST',
      headers: this._getHeaders(false),
      body: body.toString(),
    }
    return this._requestWithRetry((i) => `https://${jmApi.servers[i]}/register`, options)
  }

  // 用户登录
  async login(username, password) {
    const body = new URLSearchParams({
      username,
      password,
      id_remember: 'on',
      login_remember: 'on',
      submit_login: '',
    })
    const options = {
      method: 'POST',
      headers: this._getHeaders(false),
      body: body.toString(),
    }
    const result = await this._requestWithRetry((i) => `https://${jmApi.servers[i]}/login`, options)

    if (result.jwttoken) {
      localStorage.setItem('jwttoken', result.jwttoken)
      localStorage.setItem('userInfo', JSON.stringify(result))
    }
    return result
  }

  // 用户登出
  async logout() {
    const jwt = localStorage.getItem('jwttoken')
    if (!jwt) return
    try {
      const options = {
        method: 'POST',
        headers: this._getHeaders(true),
        body: '',
      }
      await this._requestWithRetry((i) => `https://${jmApi.servers[i]}/logout`, options)
    } finally {
      localStorage.removeItem('jwttoken')
      localStorage.removeItem('userInfo')
    }
  }

  // 忘记密码
  async forgotPassword(email) {
    const body = new URLSearchParams({ email })
    const options = {
      method: 'POST',
      headers: this._getHeaders(false),
      body: body.toString(),
    }
    return this._requestWithRetry((i) => `https://${jmApi.servers[i]}/forgot`, options)
  }

  // ==================== 收藏 ====================

  // 获取收藏列表
  async getFavoriteList(page = 1, folderId = '0', order = 'mr') {
    const options = {
      method: 'GET',
      headers: this._getHeaders(true),
    }
    return this._requestWithRetry(
      (i) => `https://${jmApi.servers[i]}/favorite?page=${page}&folder_id=${folderId}&o=${order}`,
      options,
    )
  }

  // 切换收藏（添加或取消）
  async toggleFavorite(albumId) {
    const body = new URLSearchParams({ aid: albumId })
    const options = {
      method: 'POST',
      headers: this._getHeaders(true),
      body: body.toString(),
    }
    return this._requestWithRetry((i) => `https://${jmApi.servers[i]}/favorite`, options)
  }

  // ==================== 追踪 ====================

  // 获取连载追踪列表
  async getTrackingList(page = 1) {
    const body = new URLSearchParams({ page })
    const options = {
      method: 'POST',
      headers: this._getHeaders(true),
      body: body.toString(),
    }
    return this._requestWithRetry((i) => `https://${jmApi.servers[i]}/album_tracking`, options)
  }

  // POST: 切换追踪状态（添加或取消）
  async toggleTracking(albumId) {
    const body = new URLSearchParams({ id: albumId })
    const options = {
      method: 'POST',
      headers: this._getHeaders(true),
      body: body.toString(),
    }
    return this._requestWithRetry((i) => `https://${jmApi.servers[i]}/album_sertracking`, options)
  }

  // GET: 获取单个漫画的追踪状态
  async getTrackingStatus(albumId) {
    const options = {
      method: 'GET',
      headers: this._getHeaders(true),
    }
    const result = await this._requestWithRetry(
      (i) => `https://${jmApi.servers[i]}/album_sertracking?id=${albumId}`,
      options,
    )
  }

  // ==================== 通知 ====================

  // 获取通知列表
  async getNotifications(type = 'all', page = 1) {
    const options = {
      method: 'GET',
      headers: this._getHeaders(true),
    }
    return this._requestWithRetry(
      (i) => `https://${jmApi.servers[i]}/notifications?type=${type}&page=${page}`,
      options,
    )
  }
}

export const userApi = new UserApi()
