import { ref } from 'vue'
import { localDB } from '@/utils/localDB.js'

const currentUser = ref(null)
const users = ref([])
const ready = ref(false)

let _initialized = false

async function init() {
  if (_initialized) return
  _initialized = true
  try {
    await localDB.migrateIfNeeded()
    users.value = await localDB.getAllUsers()
    currentUser.value = await localDB.getCurrentUser()
  } catch (e) {
    console.warn('本地账号初始化失败:', e)
  } finally {
    ready.value = true
  }
}

async function refreshUsers() {
  users.value = await localDB.getAllUsers()
}

export function useLocalUser() {
  init()

  async function createUser(username) {
    const user = await localDB.createUser(username)
    localDB.setCurrentUserId(user.id)
    currentUser.value = user
    await refreshUsers()
    return user
  }

  async function switchUser(userId) {
    const user = await localDB.getUser(userId)
    if (!user) return null
    localDB.setCurrentUserId(userId)
    currentUser.value = user
    return user
  }

  async function deleteUser(userId) {
    await localDB.deleteUser(userId)
    await refreshUsers()

    if (currentUser.value?.id === userId) {
      const next = users.value[0]
      if (next) {
        await switchUser(next.id)
      } else {
        currentUser.value = null
      }
    }
  }

  function logout() {
    localDB.setCurrentUserId(null)
    currentUser.value = null
  }

  return {
    currentUser,
    users,
    ready,
    createUser,
    switchUser,
    deleteUser,
    logout,
    refreshUsers,
  }
}
