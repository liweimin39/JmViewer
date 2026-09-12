import { ref } from 'vue'

function loadUserInfo() {
  const token = localStorage.getItem('jwttoken')
  const info = localStorage.getItem('userInfo')
  if (token && info) {
    try { return JSON.parse(info) } catch { /* ignore */ }
  }
  return null
}

// ★ 模块级单例：所有引用 useUser() 的组件共享同一份状态
const userInfo = ref(loadUserInfo())
const notificationUnread = ref(0)

export function useUser() {
  function refresh() {
    userInfo.value = loadUserInfo()
  }

  function setUser(info) {
    if (info && info.jwttoken) {
      localStorage.setItem('jwttoken', info.jwttoken)
      localStorage.setItem('userInfo', JSON.stringify(info))
    }
    userInfo.value = info
  }

  function clearUser() {
    localStorage.removeItem('jwttoken')
    localStorage.removeItem('userInfo')
    userInfo.value = null
    notificationUnread.value = 0
  }

  function updateUserInfo(patch) {
    if (!userInfo.value) return
    const next = { ...userInfo.value, ...patch }
    userInfo.value = next
    localStorage.setItem('userInfo', JSON.stringify(next))
  }

  return { userInfo, notificationUnread, refresh, setUser, clearUser, updateUserInfo }
}