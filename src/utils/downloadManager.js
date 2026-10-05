import { Capacitor } from '@capacitor/core'
import { jmApi } from '@/api/JmcomicApi.js'
import { offlineStorage } from './offlineStorage.js'
import { logger } from './logger.js'
import { ImageCutter } from '@/components/chapter/ImageCutter.js'

const MAX_CONCURRENT = 2
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000
const NOTIFY_THROTTLE_MS = 200
const SAVE_THROTTLE_MS = 2000

const SIGNAL_CANCEL = '__CANCEL__'
const SIGNAL_PAUSE = '__PAUSE__'

const imageCutter = new ImageCutter()

export const DownloadStatus = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  PACKAGING: 'packaging',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
}

function needsDecrypt(albumId, imageName) {
  const id = Number(albumId)
  return id >= 220980 && !imageName.endsWith('.gif')
}

function getDecodedName(originalName, albumId) {
  if (needsDecrypt(albumId, originalName)) {
    return originalName.replace(/\.[^.]+$/, '.png')
  }
  return originalName
}

class DownloadManager {
  constructor() {
    this.tasks = []
    this.running = new Set()
    this.listeners = new Set()
    this._initialized = false
    this._notifyTimer = null
    this._notifyPending = false
    this._saveTimer = null
  }

  async init() {
    if (this._initialized) return
    this._initialized = true

    try {
      await offlineStorage.initDirs()
      await offlineStorage.clearTmp()

      const saved = await offlineStorage.loadTasks()

      this.tasks = saved.map((t) => {
        const hasChapters = Array.isArray(t._chapters) && t._chapters.length > 0

        if (
          !hasChapters &&
          (t.status === DownloadStatus.DOWNLOADING ||
            t.status === DownloadStatus.PACKAGING ||
            t.status === DownloadStatus.PENDING ||
            t.status === DownloadStatus.PAUSED)
        ) {
          return {
            ...t,
            status: DownloadStatus.FAILED,
            message: '数据丢失，请删除后重新下载',
            error: '章节数据丢失',
          }
        }

        return {
          ...t,
          status:
            t.status === DownloadStatus.DOWNLOADING || t.status === DownloadStatus.PACKAGING
              ? DownloadStatus.PAUSED
              : t.status,
        }
      })

      logger.info('[Download] 已加载', this.tasks.length, '个任务')
    } catch (e) {
      logger.warn('[Download] 初始化失败:', e)
      this.tasks = []
    }

    this._pump()
  }

  addListener(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  _notify() {
    this._notifyPending = true
    if (this._notifyTimer) return
    this._notifyTimer = setTimeout(() => {
      this._notifyTimer = null
      if (!this._notifyPending) return
      this._notifyPending = false
      this.listeners.forEach((fn) => {
        try {
          fn(this.tasks)
        } catch {}
      })
    }, NOTIFY_THROTTLE_MS)
  }

  _notifyImmediate() {
    if (this._notifyTimer) {
      clearTimeout(this._notifyTimer)
      this._notifyTimer = null
    }
    this._notifyPending = false
    this.listeners.forEach((fn) => {
      try {
        fn(this.tasks)
      } catch {}
    })
  }

  async _save() {
    if (this._saveTimer) return
    this._saveTimer = setTimeout(async () => {
      this._saveTimer = null
      try {
        await offlineStorage.saveTasks(this._cleanTasksForSave())
      } catch (e) {
        logger.warn('[Download] 保存任务失败:', e)
      }
    }, SAVE_THROTTLE_MS)
  }

  async _saveImmediate() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer)
      this._saveTimer = null
    }
    try {
      await offlineStorage.saveTasks(this._cleanTasksForSave())
    } catch (e) {
      logger.warn('[Download] 保存任务失败:', e)
    }
  }

  _cleanTasksForSave() {
    return this.tasks.map((t) => {
      const { _zipBlob, ...rest } = t
      return rest
    })
  }

  async addTask(album, chapters) {
    const taskId = `dl_${album.id}_${Date.now()}`

    const existing = this.tasks.find(
      (t) =>
        String(t.albumId) === String(album.id) &&
        (t.status === DownloadStatus.DOWNLOADING || t.status === DownloadStatus.PENDING),
    )
    if (existing) throw new Error('该漫画已在下载中')

    const task = {
      id: taskId,
      albumId: album.id,
      albumName: album.name,
      albumAuthor: Array.isArray(album.author) ? album.author.join(' & ') : album.author || '',
      chapterIds: chapters.map((c) => c.id),
      chapterNames: chapters.map((c) => c.name || ''),
      totalImages: chapters.reduce((sum, c) => sum + (c.images?.length || 0), 0),
      downloadedImages: 0,
      status: DownloadStatus.PENDING,
      message: '等待下载',
      error: null,
      retries: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      outputPath: null,
      zipFileName: null,
      fileSize: 0,
      currentChapterIndex: 0,
      totalChapters: chapters.length,
      currentChapterName: '',
      currentChapterImageIndex: 0,
      currentChapterImageTotal: 0,
      _chapters: chapters,
    }

    this.tasks.unshift(task)
    await this._saveImmediate()
    this._notifyImmediate()
    this._pump()

    return taskId
  }

  async _pump() {
    if (this.running.size >= MAX_CONCURRENT) return
    const pending = this.tasks.filter((t) => t.status === DownloadStatus.PENDING)
    for (const task of pending) {
      if (this.running.size >= MAX_CONCURRENT) break
      this._runTask(task)
    }
  }

  async _runTask(task) {
    if (this.running.has(task.id)) return
    this.running.add(task.id)

    try {
      const chapters = task._chapters || []
      if (chapters.length === 0) {
        throw new Error('章节数据丢失，请删除任务后重新下载')
      }

      task.status = DownloadStatus.DOWNLOADING
      task.message = '准备下载...'
      task.downloadedImages = 0
      task.error = null
      task.currentChapterIndex = 0
      task.totalChapters = chapters.length
      task.currentChapterName = ''
      task.currentChapterImageIndex = 0
      task.currentChapterImageTotal = 0
      this._notifyImmediate()
      await this._saveImmediate()

      // 下载所有章节（原生和 Web 都做，解密图存到 Comics/）
      for (let ci = 0; ci < chapters.length; ci++) {
        if (task.status === DownloadStatus.CANCELLED) throw new Error(SIGNAL_CANCEL)
        if (task.status === DownloadStatus.PAUSED) throw new Error(SIGNAL_PAUSE)
        await this._downloadChapter(task, chapters[ci], ci, chapters.length)
      }

      // ★ 按平台分支
      if (Capacitor.isNativePlatform()) {
        // ====== 原生：不打包，直接完成 ======
        const decodedDir = offlineStorage.decodedAlbumPath(task.albumId)

        let totalSize = 0
        for (const ch of chapters) {
          const chapterDir = offlineStorage.decodedChapterPath(task.albumId, ch.id)
          const files = await offlineStorage.listDir(chapterDir)
          for (const f of files) {
            totalSize += f.size || 0
          }
        }

        task.status = DownloadStatus.COMPLETED
        task.progress = 100
        task.message = '下载完成'
        task.outputPath = decodedDir
        task.fileSize = totalSize
        task.completedAt = new Date().toISOString()

        logger.info('[Download] 原生任务完成:', task.id, '→', decodedDir)
      } else {
        // ====== Web：打包 ZIP ======
        task.status = DownloadStatus.PACKAGING
        task.message = '正在打包 ZIP...'
        task.progress = 95
        this._notifyImmediate()
        await this._saveImmediate()

        const { zipChapters, getZipFileName } = await import('./zipHelper.js')

        const blob = await zipChapters(
          { id: task.albumId, name: task.albumName, author: task.albumAuthor },
          chapters,
          (percent, msg) => {
            task.progress = 95 + Math.round(percent * 0.05)
            task.message = msg
            this._notify()
          },
        )

        const zipFileName = getZipFileName({ name: task.albumName })

        task.status = DownloadStatus.COMPLETED
        task.progress = 100
        task.message = '下载完成'
        task.zipFileName = zipFileName
        task.fileSize = blob.size
        task.completedAt = new Date().toISOString()

        // 缓存 blob 到内存（供本次会话下载），同时写磁盘
        task._zipBlob = blob

        // 写入 Tmp 目录（可选，刷新后可从磁盘读）
        try {
          const dataUrl = await blobToBase64(blob)
          const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
          const zipPath = `${offlineStorage.tmpRootPath()}/${zipFileName}`
          await offlineStorage.writeBase64(zipPath, base64)
          task.outputPath = zipPath
        } catch (e) {
          logger.warn('[Download] Web ZIP 落盘失败（内存仍可用）:', e)
        }

        logger.info('[Download] Web 任务完成:', task.id, task.zipFileName)
      }
    } catch (e) {
      if (e.message === SIGNAL_CANCEL) {
        task.status = DownloadStatus.CANCELLED
        task.message = '已取消'
        this.running.delete(task.id)
        this._notifyImmediate()
        await this._saveImmediate()
        this._pump()
        return
      }

      if (e.message === SIGNAL_PAUSE) {
        task.status = DownloadStatus.PAUSED
        task.message = '已暂停'
        this.running.delete(task.id)
        this._notifyImmediate()
        await this._saveImmediate()
        this._pump()
        return
      }

      logger.error('[Download] 任务失败:', task.id, e)

      task.retries = (task.retries || 0) + 1
      if (task.retries < MAX_RETRIES && task.status !== DownloadStatus.CANCELLED) {
        task.status = DownloadStatus.PENDING
        task.message = `重试中 (${task.retries}/${MAX_RETRIES})...`
        this._notifyImmediate()
        await this._saveImmediate()
        setTimeout(() => {
          this.running.delete(task.id)
          this._pump()
        }, RETRY_DELAY_MS * task.retries)
        return
      }

      task.status = DownloadStatus.FAILED
      task.message = e.message || '下载失败'
      task.error = e.message
    } finally {
      this.running.delete(task.id)
      this._notifyImmediate()
      await this._saveImmediate()
      this._pump()
    }
  }

  async _downloadChapter(task, chapter, chapterIndex, totalChapters) {
    const albumId = task.albumId
    const chapterId = chapter.id
    const images = chapter.images || []

    const decodedDir = offlineStorage.decodedChapterPath(albumId, chapterId)
    await offlineStorage.ensureDir(decodedDir)

    task.currentChapterIndex = chapterIndex + 1
    task.totalChapters = totalChapters
    task.currentChapterName = chapter.name || `第${chapterIndex + 1}章`
    task.currentChapterImageIndex = 0
    task.currentChapterImageTotal = images.length
    task.message = `第 ${task.currentChapterIndex}/${totalChapters} 章 · ${task.currentChapterName}`
    this._notifyImmediate()

    for (let i = 0; i < images.length; i++) {
      if (task.status === DownloadStatus.CANCELLED) throw new Error(SIGNAL_CANCEL)
      if (task.status === DownloadStatus.PAUSED) throw new Error(SIGNAL_PAUSE)

      const originalName = images[i]
      const decodedName = getDecodedName(originalName, albumId)
      const decodedPath = `${decodedDir}/${decodedName}`
      const imageUrl = jmApi.getChapterImageURL(chapterId, originalName)

      task.currentChapterImageIndex = i + 1

      // 断点续传
      const decodedExists = await offlineStorage.exists(decodedPath)
      if (decodedExists) {
        const size = await offlineStorage.getSize(decodedPath)
        if (size > 100) {
          task.downloadedImages++
          const total = task.totalImages || 1
          task.progress = Math.round((task.downloadedImages / total) * 90)
          this._notify()
          continue
        }
      }

      try {
        const res = await fetch(imageUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const buffer = await res.arrayBuffer()
        if (!buffer || buffer.byteLength === 0) throw new Error('响应为空')

        let decodedBase64
        if (needsDecrypt(albumId, originalName)) {
          try {
            const blob = new Blob([buffer])
            const img = await blobToImage(blob)
            const canvas = imageCutter.cutImage(img, albumId, originalName)
            const dataUrl = canvas.toDataURL('image/png')
            decodedBase64 = dataUrl.split(',')[1]
          } catch (err) {
            logger.warn(`[Download] 解密失败，用原图: ${originalName}`, err)
            decodedBase64 = arrayBufferToBase64(buffer)
          }
        } else {
          decodedBase64 = arrayBufferToBase64(buffer)
        }

        if (!decodedBase64 || decodedBase64.length < 100) {
          throw new Error('图片数据无效')
        }

        await offlineStorage.writeBase64(decodedPath, decodedBase64)

        task.downloadedImages++
        const total = task.totalImages || 1
        task.progress = Math.round((task.downloadedImages / total) * 90)
        this._notify()
      } catch (e) {
        if (e.message === SIGNAL_CANCEL || e.message === SIGNAL_PAUSE) throw e

        logger.error(`[Download] 图片下载失败: ${originalName}`, {
          url: imageUrl,
          error: e?.message,
        })
        throw new Error(`图片下载失败: ${originalName}`)
      }
    }

    task.message = `第 ${task.currentChapterIndex}/${totalChapters} 章 完成`
    this._notifyImmediate()
  }

  async pause(taskId) {
    const task = this.tasks.find((t) => t.id === taskId)
    if (!task) return
    if (task.status === DownloadStatus.DOWNLOADING || task.status === DownloadStatus.PACKAGING) {
      task.status = DownloadStatus.PAUSED
      task.message = '已暂停'
      this.running.delete(taskId)
      this._notifyImmediate()
      await this._saveImmediate()
    }
  }

  async resume(taskId) {
    const task = this.tasks.find((t) => t.id === taskId)
    if (!task) return
    if (task.status === DownloadStatus.PAUSED || task.status === DownloadStatus.FAILED) {
      if (!Array.isArray(task._chapters) || task._chapters.length === 0) {
        throw new Error('章节数据丢失，请删除任务后重新下载')
      }
      task.status = DownloadStatus.PENDING
      task.message = '等待下载'
      task.error = null
      task.retries = 0
      this.running.delete(taskId)
      this._notifyImmediate()
      await this._saveImmediate()
      this._pump()
    }
  }

  async cancel(taskId) {
    const task = this.tasks.find((t) => t.id === taskId)
    if (!task) return
    task.status = DownloadStatus.CANCELLED
    task.message = '已取消'
    this.running.delete(taskId)
    this._notifyImmediate()
    await this._saveImmediate()
    this._pump()
  }

  async remove(taskId) {
    const idx = this.tasks.findIndex((t) => t.id === taskId)
    if (idx === -1) return
    const task = this.tasks[idx]

    if (task.albumId) {
      await offlineStorage.remove(offlineStorage.decodedAlbumPath(task.albumId))
    }
    if (task.outputPath) {
      await offlineStorage.remove(task.outputPath)
    }

    this.tasks.splice(idx, 1)
    this.running.delete(taskId)
    this._notifyImmediate()
    await this._saveImmediate()
  }

  /**
   * ★ 已完成任务点击
   * 原生：打开文件夹
   * Web：触发 ZIP 下载
   */
  async openOutput(taskId) {
    const task = this.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('任务不存在')
    if (task.status !== DownloadStatus.COMPLETED) throw new Error('任务尚未完成')

    // ====== Web：触发 ZIP 下载 ======
    if (!Capacitor.isNativePlatform()) {
      let blob = task._zipBlob

      if (!blob && task.outputPath) {
        try {
          const base64 = await offlineStorage.readBase64(task.outputPath)
          if (base64) {
            const clean = base64.replace(/^data:[^;]+;base64,/, '')
            blob = base64ToBlob(clean, 'application/zip')
            task._zipBlob = blob
          }
        } catch {}
      }

      if (!blob || !(blob instanceof Blob) || blob.size === 0) {
        throw new Error('ZIP 已丢失，请删除后重新下载')
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = task.zipFileName || `comic_${task.albumId}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)

      return { type: 'download', filename: a.download }
    }

    // ====== 原生：打开文件夹 ======
    if (!task.outputPath) throw new Error('输出路径丢失')

    const fullUri = await offlineStorage.getUri(task.outputPath)

    const { registerPlugin } = await import('@capacitor/core')
    const StoragePermission = registerPlugin('StoragePermission')
    await StoragePermission.openFolder({ path: fullUri })
    return { type: 'folder' }
  }

  async clearCompleted() {
    const completed = this.tasks.filter((t) => t.status === DownloadStatus.COMPLETED)
    for (const t of completed) {
      if (t.albumId) {
        await offlineStorage.remove(offlineStorage.decodedAlbumPath(t.albumId))
      }
      if (t.outputPath) {
        await offlineStorage.remove(t.outputPath)
      }
    }
    this.tasks = this.tasks.filter((t) => t.status !== DownloadStatus.COMPLETED)
    this._notifyImmediate()
    await this._saveImmediate()
  }

  getTasks() {
    return this.tasks.map((t) => ({ ...t }))
  }

  getActiveTasks() {
    return this.tasks
      .filter((t) =>
        [DownloadStatus.DOWNLOADING, DownloadStatus.PENDING, DownloadStatus.PACKAGING].includes(
          t.status,
        ),
      )
      .map((t) => ({ ...t }))
  }
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64, mimeType = 'application/octet-stream') {
  const clean = base64.replace(/^data:[^;]+;base64,/, '')
  const byteChars = atob(clean)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk)
  }
  return btoa(binary)
}

export const downloadManager = new DownloadManager()
