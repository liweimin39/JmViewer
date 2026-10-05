import { Capacitor } from '@capacitor/core'
import { offlineStorage } from './offlineStorage.js'

const LOG_FILE = 'app.log'
const MAX_MEMORY_LOGS = 500
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const SAVE_DEBOUNCE_MS = 3000

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const LEVEL_LABEL = { debug: 'DEBUG', info: 'INFO ', warn: 'WARN ', error: 'ERROR' }

class Logger {
  constructor() {
    this.logs = []
    this._lastSavedIndex = 0
    this._saveTimer = null
    this._initialized = false
    this._originalConsole = null
    this._saving = false
  }

  // ==================== 路径 ====================

  _filePath() {
    return `${offlineStorage.logsPath()}/${LOG_FILE}`
  }

  _dirPath() {
    return offlineStorage.logsPath()
  }

  _directory() {
    return offlineStorage.mainDirectory()
  }

  // ==================== 初始化 ====================

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

  async init() {
    if (this._initialized) return
    this._initialized = true

    if (!Capacitor.isNativePlatform()) {
      this.info('[Logger] Web 平台，日志仅保存在内存中')
      return
    }

    try {
      const { Filesystem, Encoding } = await import('@capacitor/filesystem')

      // 确保目录存在
      try {
        await Filesystem.mkdir({
          path: this._dirPath(),
          directory: this._directory(),
          recursive: true,
        })
      } catch {}

      let content = ''
      try {
        const result = await Filesystem.readFile({
          path: this._filePath(),
          directory: this._directory(),
          encoding: Encoding.UTF8,
        })
        content = typeof result.data === 'string' ? result.data : ''
      } catch {
        return
      }

      const lines = content.split('\n').filter((l) => l.trim())
      const recent = lines.slice(-MAX_MEMORY_LOGS)
      const parsed = recent.map((line) => this._parseLine(line)).filter(Boolean)
      this.logs = parsed.slice(-MAX_MEMORY_LOGS)

      this.info('[Logger] 已加载历史日志:', parsed.length, '条')
    } catch (e) {
      this._originalConsole?.warn('[Logger] 加载日志失败:', e)
    }
  }

  // ==================== 公共 API ====================

  getLogs() {
    return this.logs.slice()
  }

  async clear() {
    this.logs = []
    this._lastSavedIndex = 0

    if (!Capacitor.isNativePlatform()) return

    try {
      const { Filesystem } = await import('@capacitor/filesystem')
      await Filesystem.deleteFile({
        path: this._filePath(),
        directory: this._directory(),
      })
    } catch {
      // 文件不存在
    }
  }

  getFilePath() {
    return Capacitor.isNativePlatform() ? this._filePath() : '（Web 平台仅内存）'
  }

  async getFileSize() {
    if (!Capacitor.isNativePlatform()) return 0
    try {
      const { Filesystem } = await import('@capacitor/filesystem')
      const stat = await Filesystem.stat({
        path: this._filePath(),
        directory: this._directory(),
      })
      return stat.size || 0
    } catch {
      return 0
    }
  }

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

  // ==================== 内部：拦截 ====================

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

  // ==================== 内部：记录 ====================

  _log(level, args) {
    const entry = {
      time: new Date().toISOString(),
      level,
      message: args.map((a) => this._formatArg(a)).join(' '),
    }

    this.logs.push(entry)

    if (this.logs.length > MAX_MEMORY_LOGS) {
      const removed = this.logs.length - MAX_MEMORY_LOGS
      this.logs = this.logs.slice(-MAX_MEMORY_LOGS)
      this._lastSavedIndex = Math.max(0, this._lastSavedIndex - removed)
    }

    if (level === 'error') {
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
    // DOM 元素
    if (typeof arg === 'object' && arg !== null && arg.nodeType) {
      return `<${(arg.tagName || 'element').toLowerCase()}>`
    }
    try {
      const result = JSON.stringify(arg)
      if (result === '{}' || result === undefined) {
        return String(arg)
      }
      return result
    } catch {
      return String(arg)
    }
  }

  _formatLine(entry) {
    const time = this._formatTime(entry.time)
    const level = LEVEL_LABEL[entry.level] || entry.level.toUpperCase()
    const msg = entry.message.replace(/\n/g, '\n    ')
    return `${time} [${level}] ${msg}`
  }

  _formatTime(input) {
    let d

    if (input instanceof Date) {
      d = input
    } else if (typeof input === 'string') {
      if (input.includes('T')) {
        d = new Date(input)
      } else {
        d = new Date(input.replace(' ', 'T'))
      }
    } else {
      d = new Date(input)
    }

    if (isNaN(d.getTime())) {
      return typeof input === 'string' ? input : String(input)
    }

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

  // ==================== 内部：保存 ====================

  async _flushSave() {
    if (!Capacitor.isNativePlatform()) return
    if (this._saving) return
    if (this._lastSavedIndex >= this.logs.length) return

    this._saving = true
    try {
      const { Filesystem, Encoding } = await import('@capacitor/filesystem')

      try {
        await Filesystem.mkdir({
          path: this._dirPath(),
          directory: this._directory(),
          recursive: true,
        })
      } catch {}

      const newEntries = this.logs.slice(this._lastSavedIndex)
      const text = newEntries.map((e) => this._formatLine(e)).join('\n') + '\n'

      let size = 0
      try {
        const stat = await Filesystem.stat({
          path: this._filePath(),
          directory: this._directory(),
        })
        size = stat.size || 0
      } catch {}

      if (size > MAX_FILE_SIZE) {
        const header = `# 日志文件超过 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB，已重置\n`
        await Filesystem.writeFile({
          path: this._filePath(),
          data: header + text,
          directory: this._directory(),
          encoding: Encoding.UTF8,
        })
      } else {
        if (size === 0) {
          await Filesystem.writeFile({
            path: this._filePath(),
            data: text,
            directory: this._directory(),
            encoding: Encoding.UTF8,
          })
        } else {
          await Filesystem.appendFile({
            path: this._filePath(),
            data: text,
            directory: this._directory(),
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

// 模块加载时立即拦截
logger.patch()
