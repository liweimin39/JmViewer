import { ref } from 'vue'
import { localDB } from '@/utils/localDB.js'

const localUser = ref(null)
const localUserReady = ref(false)
let _initialized = false

async function initLocalUser() {
  if (_initialized) return
  _initialized = true
  try {
    const user = await localDB.getUser()
    if (user) localUser.value = user
  } catch (e) {
    console.warn('加载本地账号失败:', e)
  } finally {
    localUserReady.value = true
  }
}

export function useLocalUser() {
  initLocalUser()

  async function register(username) {
    const user = await localDB.registerUser(username)
    localUser.value = user
    return user
  }

  async function login() {
    const user = await localDB.getUser()
    if (user) {
      localUser.value = user
      return user
    }
    return null
  }

  function logout() {
    localUser.value = null
  }

  async function destroy() {
    await localDB.clearAll()
    localUser.value = null
  }

  return { localUser, localUserReady, register, login, logout, destroy }
}
