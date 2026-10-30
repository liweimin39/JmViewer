import { Capacitor } from '@capacitor/core'
import { jmApi } from '@/api/JmcomicApi.js'
import { offlineStorage } from '@/utils/offlineStorage.js'
import { ImageCutter } from './ImageCutter.js'
import { Queue } from '@/components/general/Queue.js'
import { setting } from '@/components/general/Setting.js'

const IMG_STYLE =
  'display:block;width:100%;height:auto;max-width:100%;padding:0;margin:0;border:none;vertical-align:bottom;filter:none;'
const LOAD_TIMEOUT = 30000

export class ComicImageLoader {
  intersectionObserver
  progressObserver
  id
  queue
  maxQueueLength
  loadedCount = 0
  loadingMap = new Map()
  visibleIndices = new Set()
  objectUrls = new Set()

  constructor(id) {
    this.id = id
    this.cutter = new ImageCutter()
    this.maxQueueLength = this.getMaxQueueLength()
    this.queue = new Queue(this.maxQueueLength)

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (let entry of entries) {
          if (entry.isIntersecting) {
            const container = entry.target
            if (!this.loadingMap.has(container) && this.queue.hasEmptySeat()) {
              this.loadingMap.set(container, 'pending')
              this.queue.add(container)
              this.#loadImage(container)
            }
          }
        }
      },
      { rootMargin: setting.root_margin || '300px' },
    )

    this.progressObserver = new IntersectionObserver(
      (entries) => {
        let changed = false
        for (let entry of entries) {
          const idx = parseInt(entry.target.dataset.index, 10)
          if (!Number.isFinite(idx)) continue
          if (entry.isIntersecting) {
            if (!this.visibleIndices.has(idx)) {
              this.visibleIndices.add(idx)
              changed = true
            }
          } else {
            if (this.visibleIndices.delete(idx)) {
              changed = true
            }
          }
        }
        if (changed && this.visibleIndices.size > 0) {
          const maxIdx = Math.max(...this.visibleIndices)
          this.onIndexUpdate(maxIdx)
        }
      },
      { rootMargin: '0px', threshold: 0.01 },
    )
  }

  addImgCr(container) {
    container.dataset.loaded = 'false'
    this.intersectionObserver.observe(container)
    this.progressObserver.observe(container)
  }

  #loadImage(container) {
    const path = container.dataset.path

    if (this.loadingMap.get(container) === 'loading') {
      return
    }

    this.loadingMap.set(container, 'loading')

    // ★ 离线章节：图片已解密并落盘，直接用本地文件渲染
    const localPath = container.dataset.local
    if (localPath) {
      this.#loadLocal(container, localPath)
      return
    }

    // ★ 加载方式由设置项 img_load_mode 决定（切换后重新进入章节生效）：
    //   direct = 原实现；blob = fetch 取字节 → Blob → objectURL 渲染
    if (setting.img_load_mode === 'blob') {
      this.#loadAsBlob(container, path)
    } else {
      this.#loadDirect(container, path)
    }
  }

  #needDecrypt(path) {
    return this.id >= 220980 && !path.endsWith('.gif')
  }

  /* ---------------- 离线加载：本地文件直读（下载时已解密） ---------------- */

  async #loadLocal(container, localPath) {
    try {
      const uri = await offlineStorage.getUri(localPath)
      const img = new Image()
      img.decoding = 'async'
      img.style.cssText = IMG_STYLE

      const timeoutId = setTimeout(() => {
        if (!img.complete) {
          img.src = ''
          this.#handleLoadError(container, '本地图片加载超时')
        }
      }, LOAD_TIMEOUT)

      img.onload = () => {
        clearTimeout(timeoutId)
        container.innerHTML = ''
        container.appendChild(img)
        this.#finalizeLoad(container)
      }

      img.onerror = () => {
        clearTimeout(timeoutId)
        this.#handleLoadError(container, '本地图片加载失败')
      }

      img.src = Capacitor.convertFileSrc(uri)
    } catch (error) {
      this.#handleLoadError(container, error?.message || '本地图片读取失败')
    }
  }

  /* ---------------- 原加载方式：Image 直链 + toDataURL ---------------- */

  #loadDirect(container, path) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'

    const timeoutId = setTimeout(() => {
      if (!img.complete) {
        img.src = ''
        this.#handleLoadError(container, '加载超时')
      }
    }, LOAD_TIMEOUT)

    img.onload = () => {
      clearTimeout(timeoutId)
      this.#handleDirectSuccess(container, img, path)
    }

    img.onerror = () => {
      clearTimeout(timeoutId)
      this.#handleLoadError(container, '网络错误')
    }

    img.src = jmApi.getChapterImageURL(this.id, path)
  }

  #handleDirectSuccess(container, img, path) {
    try {
      container.innerHTML = ''

      if (this.#needDecrypt(path)) {
        const canvas = this.cutter.cutImage(img, this.id, path)

        const resultImg = document.createElement('img')
        resultImg.style.cssText = IMG_STYLE
        resultImg.decoding = 'async'

        try {
          const dataUrl = canvas.toDataURL('image/png')
          if (!dataUrl || dataUrl.length <= 100) {
            throw new Error('Canvas导出数据无效')
          }
          resultImg.src = dataUrl
          resultImg.onload = () => {
            container.appendChild(resultImg)
            this.#finalizeLoad(container)
          }
          resultImg.onerror = () => {
            console.warn('Canvas导出失败，使用原图')
            this.#appendOriginal(container, img)
          }
        } catch (e) {
          console.warn('Canvas导出异常，使用原图:', e)
          this.#appendOriginal(container, img)
        }
      } else {
        img.style.cssText = IMG_STYLE + 'opacity:1;'
        container.appendChild(img)
        this.#finalizeLoad(container)
      }
    } catch (error) {
      console.error('图片处理失败:', error)
      this.#handleLoadError(container, '处理失败: ' + error.message)
    }
  }

  #appendOriginal(container, img) {
    img.style.cssText = IMG_STYLE
    container.appendChild(img)
    this.#finalizeLoad(container)
  }

  /* ---------------- Blob 加载：fetch 取字节后同源渲染 ---------------- */

  async #loadAsBlob(container, path) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), LOAD_TIMEOUT)

    let source = null
    let sourceUrl = null

    try {
      const response = await fetch(jmApi.getChapterImageURL(this.id, path), {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()
      if (!blob || blob.size === 0) throw new Error('响应为空')

      const decoded = await this.#blobToImage(blob)
      source = decoded.img
      sourceUrl = decoded.url

      // 无需解密：直接用 blob 渲染，URL 交由 destroy 统一释放
      if (!this.#needDecrypt(path)) {
        source.style.cssText = IMG_STYLE
        container.innerHTML = ''
        container.appendChild(source)
        this.objectUrls.add(sourceUrl)
        sourceUrl = null
        this.#finalizeLoad(container)
        return
      }

      // 需解密：图片同源，canvas 不会被跨域污染
      const canvas = this.cutter.cutImage(source, this.id, path)
      const decodedBlob = await this.#canvasToBlob(canvas)

      URL.revokeObjectURL(sourceUrl)
      sourceUrl = null

      const objectUrl = URL.createObjectURL(decodedBlob)
      this.objectUrls.add(objectUrl)

      await this.#showImage(container, objectUrl)
    } catch (error) {
      if (source) {
        // 解密 / 导出失败，降级显示原图
        console.warn('解密失败，降级显示原图:', error)
        source.style.cssText = IMG_STYLE
        container.innerHTML = ''
        container.appendChild(source)
        if (sourceUrl) {
          this.objectUrls.add(sourceUrl)
          sourceUrl = null
        }
        this.#finalizeLoad(container)
      } else {
        const message = error?.name === 'AbortError' ? '加载超时' : error?.message || '加载失败'
        this.#handleLoadError(container, message)
      }
    } finally {
      clearTimeout(timeoutId)
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    }
  }

  // 返回 { img, url }，objectURL 由调用方决定何时释放
  #blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve({ img, url })
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('图片解码失败'))
      }
      img.src = url
    })
  }

  #canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) resolve(blob)
        else reject(new Error('解密结果导出失败'))
      }, 'image/png')
    })
  }

  #showImage(container, objectUrl) {
    return new Promise((resolve) => {
      const img = document.createElement('img')
      img.decoding = 'async'
      img.style.cssText = IMG_STYLE
      img.onload = () => {
        container.innerHTML = ''
        container.appendChild(img)
        this.#finalizeLoad(container)
        resolve()
      }
      img.onerror = () => {
        this.#handleLoadError(container, '解密图片渲染失败')
        resolve()
      }
      img.src = objectUrl
    })
  }

  #handleLoadError(container, errorMsg) {
    container.innerHTML = ''
    const errorDiv = document.createElement('div')
    errorDiv.className = 'reader-error'
    errorDiv.textContent = `加载失败`
    container.appendChild(errorDiv)
    this.#finalizeLoad(container)
    console.warn(`图片加载失败: ${container.dataset.path} - ${errorMsg}`)
  }

  #finalizeLoad(container) {
    container.dataset.loaded = 'true'
    this.loadingMap.set(container, 'loaded')
    this.queue.removeItem(container)
    this.loadedCount++
    this.onLoadedImage(this.loadedCount)

    this.intersectionObserver.unobserve(container)
  }

  // ★ Vue 迁移新增：卸载时清理所有观察器和队列
  destroy() {
    this.intersectionObserver.disconnect()
    this.progressObserver.disconnect()
    this.loadingMap.clear()
    this.queue.clear()
    this.visibleIndices.clear()

    // ★ 释放解密图片的 blob URL，避免内存泄漏
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url)
    }
    this.objectUrls.clear()
  }

  getMaxQueueLength() {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    const hours = new Date().getHours()

    if (isMobile) {
      if (hours > 21 || hours < 6) return 2
      return 3
    }

    if (hours > 21 || hours < 6) return 3
    if (hours > 18) return 6
    return 10
  }

  onIndexUpdate(index) {}
  onLoadedImage(count) {}
}
