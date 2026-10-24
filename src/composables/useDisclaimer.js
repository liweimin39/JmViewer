import { ref } from 'vue'

const STORAGE_KEY = 'disclaimer_accepted'

// 全局共享显隐状态：启动时自动弹出与设置页重新查看共用
const visible = ref(false)

export function useDisclaimer() {
  function maybeShow() {
    try {
      visible.value = localStorage.getItem(STORAGE_KEY) !== '1'
    } catch {
      visible.value = true
    }
  }

  function open() {
    visible.value = true
  }

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
    visible.value = false
  }

  return { visible, maybeShow, open, accept }
}
