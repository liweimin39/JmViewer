import { jmApi } from '@/api/JmcomicApi.js'
import { ImageCutter } from './ImageCutter.js'
import { Queue } from '@/components/general/Queue.js'

export class ComicImageLoader {
  intersectionObserver
  progressObserver
  id
  queue
  maxQueueLength
  loadedCount = 0
  loadingMap = new Map()
  visibleIndices = new Set()

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
      { rootMargin: '300px' },
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
    const index = parseInt(container.dataset.index, 10)

    if (this.loadingMap.get(container) === 'loading') {
      return
    }

    this.loadingMap.set(container, 'loading')

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'

    let timeoutId = setTimeout(() => {
      if (!img.complete) {
        img.src = ''
        this.#handleLoadError(container, '加载超时')
      }
    }, 30000)

    img.onload = () => {
      clearTimeout(timeoutId)
      this.#handleLoadSuccess(container, img, index)
    }

    img.onerror = () => {
      clearTimeout(timeoutId)
      this.#handleLoadError(container, '网络错误')
    }

    img.src = jmApi.getChapterImageURL(this.id, path)
  }

  #handleLoadSuccess(container, img, index) {
    try {
      container.innerHTML = ''

      const needDecrypt = this.id >= 220980 && !container.dataset.path.endsWith('.gif')

      if (needDecrypt) {
        const canvas = this.cutter.cutImage(img, this.id, container.dataset.path)

        const resultImg = document.createElement('img')
        resultImg.style.cssText =
          'display:block;width:100%;height:auto;max-width:100%;padding:0;margin:0;border:none;vertical-align:bottom;filter:none;'
        resultImg.decoding = 'async'

        try {
          const dataUrl = canvas.toDataURL('image/png')
          if (dataUrl && dataUrl.length > 100) {
            resultImg.src = dataUrl
            resultImg.onload = () => {
              container.appendChild(resultImg)
              this.#finalizeLoad(container)
            }
            resultImg.onerror = () => {
              console.warn('Canvas导出失败，使用原图')
              img.style.cssText =
                'display:block;width:100%;height:auto;max-width:100%;padding:0;margin:0;border:none;vertical-align:bottom;filter:none;'
              container.appendChild(img)
              this.#finalizeLoad(container)
            }
          } else {
            throw new Error('Canvas导出数据无效')
          }
        } catch (e) {
          console.warn('Canvas导出异常，使用原图:', e)
          img.style.cssText =
            'display:block;width:100%;height:auto;max-width:100%;padding:0;margin:0;border:none;vertical-align:bottom;filter:none;'
          container.appendChild(img)
          this.#finalizeLoad(container)
        }
      } else {
        img.style.cssText =
          'display:block;width:100%;height:auto;max-width:100%;padding:0;margin:0;border:none;vertical-align:bottom;filter:none;opacity:1;'
        container.appendChild(img)
        this.#finalizeLoad(container)
      }
    } catch (error) {
      console.error('图片处理失败:', error)
      this.#handleLoadError(container, '处理失败: ' + error.message)
    }
  }

  #handleLoadError(container, errorMsg) {
    container.innerHTML = ''
    const errorDiv = document.createElement('div')
    errorDiv.style.cssText =
      'display:block;color:var(--theme-danger-soft);padding:20px;text-align:center;background:var(--theme-code-bg);font-size:14px;margin:0;line-height:1.4;'
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
