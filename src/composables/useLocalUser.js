import { ref } from 'vue'
import { localDB } from '@/utils/localDB.js'

const currentUser = ref(null)
const ready = ref(false)
let _initialized = false

async function init() {
  if (_initialized) return
  _initialized = true
  try {
    await localDB.init()
    currentUser.value = await localDB.getLocalUser()
  } catch (e) {
    console.warn('本地账号初始化失败:', e)
  } finally {
    ready.value = true
  }
}

export function useLocalUser() {
  init()

  async function updateUsername(newName) {
    const user = await localDB.updateLocalUsername(newName)
    if (user) currentUser.value = user
    return user
  }

  async function reset() {
    const user = await localDB.resetLocalAccount()
    currentUser.value = user
    return user
  }

  return { currentUser, ready, updateUsername, reset }
}
