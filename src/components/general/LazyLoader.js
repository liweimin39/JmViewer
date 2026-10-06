const DEFAULT_COVER = '/image/cover_default.jpg'

class LazyLoader {
  observer

  constructor() {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (let entry of entries) {
          if (entry.isIntersecting) {
            this.observer.unobserve(entry.target)
            const cover = entry.target
            const coverImg = cover.children[0]
            if (!coverImg) continue

            // 先挂 onerror 再设 src
            coverImg.onerror = (e) => {
              const el = e.target
              if (el.src && el.src.includes('cover_default')) return
              el.onerror = null // 防无限循环
              el.src = DEFAULT_COVER
            }

            coverImg.src = cover.dataset.src
          }
        }
      },
      { rootMargin: '50px' },
    )
  }

  addCover(coverEle) {
    this.observer.observe(coverEle)
  }
}

export const lazyLoader = new LazyLoader()
