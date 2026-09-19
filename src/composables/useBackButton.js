import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/**
 * 全局返回键处理
 * 优先级：
 *   1. 抽屉打开 → 关抽屉
 *   2. 有历史记录 → 路由返回
 *   3. 在首页 → 双击退出
 */
export function useBackButton() {
  const router = useRouter()
  const route = useRoute()

  let handler = null
  let lastBackTime = 0
  const DOUBLE_PRESS_DELAY = 2000 // 2 秒内再按一次才退出

  function showExitToast() {
    // 复用已有的 toast 样式，动态创建一个
    let el = document.getElementById('__back_exit_toast')
    if (!el) {
      el = document.createElement('div')
      el.id = '__back_exit_toast'
      el.style.cssText = [
        'position:fixed',
        'bottom:100px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:rgba(0,0,0,0.75)',
        'color:#fff',
        'padding:12px 24px',
        'border-radius:8px',
        'font-size:15px',
        'z-index:10000',
        'pointer-events:none',
        'transition:opacity .3s ease',
        'opacity:0',
      ].join(';')
      document.body.appendChild(el)
    }
    el.textContent = '再按一次退出应用'
    requestAnimationFrame(() => {
      el.style.opacity = '1'
    })
    clearTimeout(el._timer)
    el._timer = setTimeout(() => {
      el.style.opacity = '0'
    }, 1800)
  }

  function onBackButton() {
    // 1. 抽屉打开 → 关抽屉
    const mobNav = document.querySelector('.mob-nav.show')
    if (mobNav) {
      mobNav.classList.remove('show')
      // 兼容 NavBar 里的过渡逻辑：400ms 后隐藏
      setTimeout(() => {
        const el = document.querySelector('.mob-nav')
        if (el && !el.classList.contains('show')) {
          el.style.display = 'none'
        }
      }, 400)
      return
    }

    // 2. 有历史 → 返回上一页
    const history = window.history
    if (history.state && history.state.position > 0) {
      router.back()
      return
    }

    // 3. 在首页或其他"根"路由 → 双击退出
    const rootPaths = ['/', '/latest', '/categories', '/search', '/setting', '/user']
    const isRoot = rootPaths.includes(route.path)
    if (isRoot) {
      const now = Date.now()
      if (now - lastBackTime < DOUBLE_PRESS_DELAY) {
        CapApp.exitApp()
      } else {
        lastBackTime = now
        showExitToast()
      }
    } else {
      // 非 root 页（比如 chapter），若无历史就回到首页
      router.push('/')
    }
  }

  onMounted(() => {
    if (!Capacitor.isNativePlatform()) return
    // 只在 Android 上启用（iOS 没有物理返回键）
    if (Capacitor.getPlatform() !== 'android') return

    CapApp.addListener('backButton', onBackButton).then((h) => {
      handler = h
    })
  })

  onBeforeUnmount(() => {
    if (handler) {
      handler.remove()
      handler = null
    }
  })
}
