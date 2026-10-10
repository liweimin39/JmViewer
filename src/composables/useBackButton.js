import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

export function useBackButton() {
  const router = useRouter()
  const route = useRoute()

  let handler = null
  let lastBackTime = 0
  const DOUBLE_PRESS_DELAY = 2000

  function showExitToast() {
    let el = document.getElementById('__back_exit_toast')
    if (!el) {
      el = document.createElement('div')
      el.id = '__back_exit_toast'
      el.style.cssText = [
        'position:fixed',
        'bottom:100px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:var(--theme-toast-bg)',
        'color:var(--theme-text-inverse)',
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
      setTimeout(() => {
        const el = document.querySelector('.mob-nav')
        if (el && !el.classList.contains('show')) {
          el.style.display = 'none'
        }
      }, 400)
      return
    }

    // 2. ★ 核心：有历史记录 → 应用内后退一格
    if (window.history.state && window.history.state.position > 0) {
      router.back()
      return
    }

    // 3. 已经在根页面 → 双击退出（不是单击就退）
    const rootPaths = ['/', '/latest', '/categories', '/search', '/setting', '/user']
    if (rootPaths.includes(route.path)) {
      const now = Date.now()
      if (now - lastBackTime < DOUBLE_PRESS_DELAY) {
        CapApp.exitApp()
      } else {
        lastBackTime = now
        showExitToast()
      }
    } else {
      // 非根页面但无历史 → 回首页
      router.push('/')
    }
  }

  onMounted(() => {
    if (!Capacitor.isNativePlatform()) return
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
