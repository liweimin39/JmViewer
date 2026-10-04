import { Capacitor } from '@capacitor/core'

const LOG_DIR = 'logs'
const LOG_FILE = 'app.log'
const MAX_MEMORY_LOGS = 500
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB，超过自动重置
const SAVE_DEBOUNCE_MS = 3000

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const LEVEL_LABEL = { debug: 'DEBUG', info: 'INFO ', warn: 'WARN ', error: 'ERROR' }

class Logger {
  constructor() {
    this.logs = [] // 内存日志
    this._lastSavedIndex = 0 // 已写入文件的索引
    this._saveTimer = null
    this._initialized = false
    this._originalConsole = null
    this._saving = false
  }

  /** 同步初始化：拦截 console 和全局错误（在模块加载时调用） */
  patch() {
    this._patchConsole()
    this._patchGlobalErrors()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this._flushSave()
        }
      })
    }
  }

  /** 异步初始化：加载文件里的历史日志 */
  async init() {
    if (this._initialized) return
    this._initialized = true

    if (!Capacitor.isNativePlatform()) {
      this.info('[Logger] Web 平台，日志仅保存在内存中')
      return
    }

    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      const path = `${LOG_DIR}/${LOG_FILE}`

      let content = ''
      try {
        const result = await Filesystem.readFile({
          path,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        })
        content = typeof result.data === 'string' ? result.data : ''
      } catch (e) {
        // 文件不存在，首次运行
        return
      }

      // 解析文件内容（只保留最后 MAX_MEMORY_LOGS 行）
      const lines = content.split('\n').filter((l) => l.trim())
      const recent = lines.slice(-MAX_MEMORY_LOGS)
      const parsed = recent.map((line) => this._parseLine(line)).filter(Boolean)
      this.logs = parsed.slice(-MAX_MEMORY_LOGS)

      this.info('[Logger] 已加载历史日志:', parsed.length, '条')
    } catch (e) {
      this._originalConsole?.warn('[Logger] 加载日志失败:', e)
    }
  }

  /** 获取日志快照 */
  getLogs() {
    return this.logs.slice()
  }

  /** 清空日志（内存 + 文件） */
  async clear() {
    this.logs = []
    this._lastSavedIndex = 0

    if (!Capacitor.isNativePlatform()) return

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      await Filesystem.deleteFile({
        path: `${LOG_DIR}/${LOG_FILE}`,
        directory: Directory.Documents,
      })
    } catch (e) {
      // 文件不存在，忽略
    }
  }

  /** 获取日志文件路径（用于显示） */
  getFilePath() {
    return Capacitor.isNativePlatform() ? `Documents/${LOG_DIR}/${LOG_FILE}` : '（Web 平台仅内存）'
  }

  /** 获取文件大小（字节） */
  async getFileSize() {
    if (!Capacitor.isNativePlatform()) return 0
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const stat = await Filesystem.stat({
        path: `${LOG_DIR}/${LOG_FILE}`,
        directory: Directory.Documents,
      })
      return stat.size || 0
    } catch {
      return 0
    }
  }

  /** 导出：写到 cache 并弹分享面板 */
  async export() {
    const content = this.logs.map((e) => this._formatLine(e)).join('\n')
    const filename = `jmviewer-log-${this._dateSuffix()}.txt`

    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')

      const result = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      })

      await Share.share({
        title: 'JmViewer 日志',
        url: result.uri,
        dialogTitle: '保存或分享日志',
      })
      return { filename }
    }

    // Web 平台下载
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { filename }
  }

  // ==================== 日志方法 ====================

  debug(...args) {
    this._log('debug', args)
  }
  info(...args) {
    this._log('info', args)
  }
  warn(...args) {
    this._log('warn', args)
  }
  error(...args) {
    this._log('error', args)
  }

  // ==================== 内部方法 ====================

  _patchConsole() {
    const orig = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    }
    this._originalConsole = orig

    const wrap =
      (origFn, level) =>
      (...args) => {
        origFn(...args)
        this._log(level, args)
      }

    console.log = wrap(orig.log, 'info')
    console.info = wrap(orig.info, 'info')
    console.warn = wrap(orig.warn, 'warn')
    console.error = wrap(orig.error, 'error')
    console.debug = wrap(orig.debug, 'debug')
  }

  _patchGlobalErrors() {
    if (typeof window === 'undefined') return

    window.addEventListener('error', (e) => {
      if (e.target && e.target !== window && e.target.tagName) {
        // 资源加载错误（img/script）
        this.error('[资源加载错误]', e.target.tagName, e.target.src || e.target.href || '')
        return
      }
      this.error('[未捕获错误]', e.message || 'Unknown', {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error?.stack,
      })
    })

    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason
      this.error(
        '[未处理的 Promise 拒绝]',
        reason?.message || String(reason),
        reason?.stack ? { stack: reason.stack } : '',
      )
    })
  }

  _log(level, args) {
    const entry = {
      time: new Date().toISOString(),
      level,
      message: args.map((a) => this._formatArg(a)).join(' '),
    }

    this.logs.push(entry)

    // 超出内存限制，裁剪（同时调整已保存索引）
    if (this.logs.length > MAX_MEMORY_LOGS) {
      const removed = this.logs.length - MAX_MEMORY_LOGS
      this.logs = this.logs.slice(-MAX_MEMORY_LOGS)
      this._lastSavedIndex = Math.max(0, this._lastSavedIndex - removed)
    }

    // 调度保存
    if (level === 'error') {
      // 错误立即保存
      clearTimeout(this._saveTimer)
      this._flushSave()
    } else {
      clearTimeout(this._saveTimer)
      this._saveTimer = setTimeout(() => this._flushSave(), SAVE_DEBOUNCE_MS)
    }
  }

  _formatArg(arg) {
    if (arg === null) return 'null'
    if (arg === undefined) return 'undefined'
    if (typeof arg === 'string') return arg
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg)
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}${arg.stack ? '\n  ' + arg.stack.split('\n').join('\n  ') : ''}`
    }
    try {
      return JSON.stringify(arg)
    } catch {
      return String(arg)
    }
  }

  _formatLine(entry) {
    const time = this._formatTime(entry.time)
    const level = LEVEL_LABEL[entry.level] || entry.level.toUpperCase()
    // 多行消息统一缩进
    const msg = entry.message.replace(/\n/g, '\n    ')
    return `${time} [${level}] ${msg}`
  }

  _formatTime(iso) {
    const d = new Date(iso)
    const pad = (n, len = 2) => String(n).padStart(len, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  }

  _dateSuffix() {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  }

  _parseLine(line) {
    const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) \[(\w+)\s*\] (.*)$/)
    if (!match) return null
    return {
      time: match[1],
      level: match[2].trim().toLowerCase(),
      message: match[3],
    }
  }

  async _flushSave() {
    if (!Capacitor.isNativePlatform()) return
    if (this._saving) return
    if (this._lastSavedIndex >= this.logs.length) return

    this._saving = true
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')

      // 确保目录存在
      try {
        await Filesystem.mkdir({
          path: LOG_DIR,
          directory: Directory.Documents,
          recursive: true,
        })
      } catch {
        // 目录已存在
      }

      const newEntries = this.logs.slice(this._lastSavedIndex)
      const text = newEntries.map((e) => this._formatLine(e)).join('\n') + '\n'
      const filePath = `${LOG_DIR}/${LOG_FILE}`

      // 检查文件大小
      let size = 0
      try {
        const stat = await Filesystem.stat({
          path: filePath,
          directory: Directory.Documents,
        })
        size = stat.size || 0
      } catch {
        // 文件不存在
      }

      if (size > MAX_FILE_SIZE) {
        // 文件过大，重置
        const header = `# 日志文件超过 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB，已重置\n`
        await Filesystem.writeFile({
          path: filePath,
          data: header + text,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        })
      } else {
        // 追加
        if (size === 0) {
          await Filesystem.writeFile({
            path: filePath,
            data: text,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
          })
        } else {
          await Filesystem.appendFile({
            path: filePath,
            data: text,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
          })
        }
      }

      this._lastSavedIndex = this.logs.length
    } catch (e) {
      this._originalConsole?.warn('[Logger] 保存失败:', e)
    } finally {
      this._saving = false
    }
  }
}

export const logger = new Logger()

// ★ 模块加载时立即拦截（同步）
logger.patch()
