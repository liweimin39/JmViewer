import { Capacitor } from '@capacitor/core'
import { jmApi } from '@/api/JmcomicApi.js'
import { offlineStorage } from './offlineStorage.js'
import { zipChapters, getZipFileName } from './zipHelper.js'
import { logger } from './logger.js'
import { ImageCutter } from '@/components/chapter/ImageCutter.js'

const MAX_CONCURRENT = 2
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000
const NOTIFY_THROTTLE_MS = 200
const SAVE_THROTTLE_MS = 2000

const SIGNAL_CANCEL = '__CANCEL__'
const SIGNAL_PAUSE = '__PAUSE__'

const zipBlobCache = new Map()

// ★ 单例 ImageCutter
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

/**
 * ★ 判断某张图是否需要解密
 * 和 ComicImageLoader 里逻辑一致
 */
function needsDecrypt(albumId, imageName) {
  const id = Number(albumId)
  return id >= 220980 && !imageName.endsWith('.gif')
}

/**
 * ★ 生成磁盘上存储的文件名
 * 需要解密的图，扩展名改成 .png（因为解密后是 PNG 数据）
 * 不需要解密的图，保持原名
 */
function getStoredImageName(originalName, albumId) {
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
      logger.warn('[Download] 加载任务失败:', e)
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
        } catch (e) {
          /* ignore */
        }
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
      } catch (e) {
        /* ignore */
      }
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
    if (existing) {
      throw new Error('该漫画已在下载中')
    }

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
      zipPath: null,
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

      for (let ci = 0; ci < chapters.length; ci++) {
        if (task.status === DownloadStatus.CANCELLED) throw new Error(SIGNAL_CANCEL)
        if (task.status === DownloadStatus.PAUSED) throw new Error(SIGNAL_PAUSE)
        await this._downloadChapter(task, chapters[ci], ci, chapters.length)
      }

      // 打包
      task.status = DownloadStatus.PACKAGING
      task.message = '正在打包 ZIP...'
      task.progress = 95
      this._notifyImmediate()
      await this._saveImmediate()

      const blob = await zipChapters(
        { id: task.albumId, name: task.albumName, author: task.albumAuthor },
        chapters,
        (percent, msg) => {
          task.progress = 95 + Math.round(percent * 0.05)
          task.message = msg
          this._notify()
        },
      )

      zipBlobCache.set(task.id, blob)

      const zipFileName = getZipFileName({ name: task.albumName })
      const zipPath = `${offlineStorage.ROOT_DIR}/${zipFileName}`
      await offlineStorage.ensureDir(offlineStorage.ROOT_DIR)

      task.status = DownloadStatus.COMPLETED
      task.progress = 100
      task.message = '下载完成'
      task.zipPath = zipPath
      task.zipFileName = zipFileName
      task.fileSize = blob.size
      task.completedAt = new Date().toISOString()

      saveZipToDisk(zipPath, blob).catch((e) => {
        logger.warn('[Download] ZIP 持久化失败（内存仍可用）:', e)
      })

      logger.info('[Download] 任务完成:', task.id, task.albumName)
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

    const chapterDir = `${offlineStorage.albumDir(albumId)}/chapters/${chapterId}`
    await offlineStorage.ensureDir(chapterDir)

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
      const storedName = getStoredImageName(originalName, albumId)
      const imagePath = `${chapterDir}/${storedName}`
      const imageUrl = jmApi.getChapterImageURL(chapterId, originalName)

      task.currentChapterImageIndex = i + 1

      // 断点续传（> 100 字节才算有效）
      const fileExists = await offlineStorage.exists(imagePath)
      if (fileExists) {
        const size = await offlineStorage.getSize(imagePath)
        if (size > 100) {
          task.downloadedImages++
          const total = task.totalImages || 1
          task.progress = Math.round((task.downloadedImages / total) * 90)
          this._notify()
          continue
        }
      }

      // 下载 + 解密
      try {
        const res = await fetch(imageUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const buffer = await res.arrayBuffer()
        if (!buffer || buffer.byteLength === 0) {
          throw new Error('响应为空')
        }

        const rawBlob = new Blob([buffer])

        let finalBase64

        if (needsDecrypt(albumId, originalName)) {
          // ★ 解密流程
          try {
            const img = await blobToImage(rawBlob)
            const canvas = imageCutter.cutImage(img, albumId, originalName)
            const dataUrl = canvas.toDataURL('image/png')
            finalBase64 = dataUrl.split(',')[1]
          } catch (err) {
            logger.warn(`[Download] 解密失败，保存原图: ${originalName}`, err)
            finalBase64 = arrayBufferToBase64(buffer)
          }
        } else {
          // 不需要解密
          finalBase64 = arrayBufferToBase64(buffer)
        }

        if (!finalBase64 || finalBase64.length < 100) {
          throw new Error('图片数据无效')
        }

        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        await Filesystem.writeFile({
          path: imagePath,
          data: finalBase64,
          directory: Directory.Documents,
          recursive: true,
        })

        task.downloadedImages++
        const total = task.totalImages || 1
        task.progress = Math.round((task.downloadedImages / total) * 90)
        this._notify()
      } catch (e) {
        if (e.message === SIGNAL_CANCEL || e.message === SIGNAL_PAUSE) throw e

        logger.error(`[Download] 图片下载失败: ${originalName}`, {
          url: imageUrl,
          path: imagePath,
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

    zipBlobCache.delete(taskId)

    if (task.albumId) {
      const albumDir = offlineStorage.albumDir(task.albumId)
      await offlineStorage.remove(albumDir)
    }
    if (task.zipPath) {
      await offlineStorage.remove(task.zipPath)
    }

    this.tasks.splice(idx, 1)
    this.running.delete(taskId)
    this._notifyImmediate()
    await this._saveImmediate()
  }

  async downloadZip(taskId) {
    const task = this.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('任务不存在')
    if (task.status !== DownloadStatus.COMPLETED) throw new Error('任务尚未完成')

    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')

      const uriResult = await Filesystem.getUri({
        path: task.zipPath,
        directory: Directory.Documents,
      })

      await Share.share({
        title: task.albumName,
        url: uriResult.uri,
        dialogTitle: '保存或分享',
      })
      return { type: 'share' }
    }

    let blob = zipBlobCache.get(taskId)

    if (!blob) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const result = await Filesystem.readFile({
          path: task.zipPath,
          directory: Directory.Documents,
        })

        let base64 = result.data
        if (typeof base64 !== 'string') base64 = String(base64)
        base64 = base64.trim()
        if (base64.startsWith('data:')) base64 = base64.split(',')[1]

        if (base64) {
          blob = base64ToBlob(base64, 'application/zip')
          zipBlobCache.set(taskId, blob)
        }
      } catch (e) {
        logger.warn('[Download] 从磁盘读取 ZIP 失败:', e)
      }
    }

    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('ZIP 文件无效或已丢失，请删除后重新下载')
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

  async clearCompleted() {
    const completed = this.tasks.filter((t) => t.status === DownloadStatus.COMPLETED)
    for (const t of completed) {
      zipBlobCache.delete(t.id)
      if (t.zipPath) await offlineStorage.remove(t.zipPath)
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

/** 保存 ZIP 到磁盘 */
async function saveZipToDisk(zipPath, blob) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')

  const dataUrl = await blobToBase64(blob)
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl

  await Filesystem.writeFile({
    path: zipPath,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  })
}

/** Blob 转 base64（带 data: 前缀） */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Blob 转 Image 对象 */
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

/** ArrayBuffer 转 base64（分块，避免大图栈溢出） */
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

/** base64 转 Blob */
function base64ToBlob(base64, mimeType = 'application/octet-stream') {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

export const downloadManager = new DownloadManager()
