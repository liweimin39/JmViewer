const DB_NAME = 'JmViewerLocalDB'
const DB_VERSION = 1
const STORE_USERS = 'users'
const STORE_FAVORITES = 'favorites'
const STORE_HISTORY = 'history'
const LS_CURRENT_USER = 'jmviewer.currentLocalUserId'

function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

class LocalDB {
  constructor() {
    this._dbPromise = null
    this._migrated = false
  }

  _open() {
    if (this._dbPromise) return this._dbPromise
    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve(req.result)
      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_USERS)) {
          db.createObjectStore(STORE_USERS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
          db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORE_HISTORY)) {
          db.createObjectStore(STORE_HISTORY, { keyPath: 'id' })
        }
      }
    })
    return this._dbPromise
  }

  async _get(store, key) {
    const db = await this._open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async _getAll(store) {
    const db = await this._open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  }

  async _put(store, value) {
    const db = await this._open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      const req = tx.objectStore(store).put(value)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async _delete(store, key) {
    const db = await this._open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      const req = tx.objectStore(store).delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  async _clear(store) {
    const db = await this._open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      const req = tx.objectStore(store).clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  // ==================== 迁移旧数据 ====================
  async migrateIfNeeded() {
    if (this._migrated) return
    this._migrated = true

    // 已有当前用户 → 无需迁移
    const currentId = this.getCurrentUserId()
    if (currentId) {
      const u = await this._get(STORE_USERS, currentId)
      if (u) return
    }

    // 检测旧的 'local' 用户
    const legacyUser = await this._get(STORE_USERS, 'local')
    if (!legacyUser) return

    console.log('[localDB] 检测到旧格式数据，开始迁移...')

    const newId = uuid()
    const newUser = {
      id: newId,
      username: legacyUser.username || '本地用户',
      createdAt: legacyUser.createdAt || new Date().toISOString(),
    }

    await this._put(STORE_USERS, newUser)
    await this._delete(STORE_USERS, 'local')

    // 迁移 favorites
    const favs = await this._getAll(STORE_FAVORITES)
    let favCount = 0
    for (const item of favs) {
      if (!item.userId) {
        const comicId = item.comicId || item.id
        await this._delete(STORE_FAVORITES, item.id)
        await this._put(STORE_FAVORITES, {
          id: `${newId}__${comicId}`,
          userId: newId,
          comicId,
          name: item.name || '',
          author: item.author || '',
          addedAt: item.addedAt || new Date().toISOString(),
        })
        favCount++
      }
    }

    // 迁移 history
    const hist = await this._getAll(STORE_HISTORY)
    let histCount = 0
    for (const item of hist) {
      if (!item.userId) {
        const comicId = item.comicId || item.id
        await this._delete(STORE_HISTORY, item.id)
        await this._put(STORE_HISTORY, {
          id: `${newId}__${comicId}`,
          userId: newId,
          comicId,
          name: item.name || '',
          author: item.author || '',
          chapterId: item.chapterId || null,
          chapterName: item.chapterName || '',
          lastReadAt: item.lastReadAt || new Date().toISOString(),
        })
        histCount++
      }
    }

    this.setCurrentUserId(newId)
    console.log(`[localDB] 迁移完成：${favCount} 收藏 / ${histCount} 历史`)
  }

  // ==================== 用户管理 ====================
  async getAllUsers() {
    const list = await this._getAll(STORE_USERS)
    return list
      .filter((u) => u.id !== 'local')
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
  }

  async createUser(username) {
    const name = ((username || '').trim() || '本地用户').slice(0, 30)
    const user = {
      id: uuid(),
      username: name,
      createdAt: new Date().toISOString(),
    }
    await this._put(STORE_USERS, user)
    return user
  }

  async getUser(userId) {
    if (!userId) return null
    return this._get(STORE_USERS, userId)
  }

  async deleteUser(userId) {
    if (!userId) return

    // 删用户
    await this._delete(STORE_USERS, userId)

    // 删该用户的收藏
    const favs = await this._getAll(STORE_FAVORITES)
    for (const item of favs) {
      if (item.userId === userId) {
        await this._delete(STORE_FAVORITES, item.id)
      }
    }

    // 删该用户的历史
    const hist = await this._getAll(STORE_HISTORY)
    for (const item of hist) {
      if (item.userId === userId) {
        await this._delete(STORE_HISTORY, item.id)
      }
    }

    // 如果删的是当前用户，清掉当前 ID
    if (this.getCurrentUserId() === userId) {
      this.setCurrentUserId(null)
    }
  }

  // ==================== 当前用户 ====================
  getCurrentUserId() {
    return localStorage.getItem(LS_CURRENT_USER)
  }

  setCurrentUserId(userId) {
    if (userId) {
      localStorage.setItem(LS_CURRENT_USER, userId)
    } else {
      localStorage.removeItem(LS_CURRENT_USER)
    }
  }

  async getCurrentUser() {
    const id = this.getCurrentUserId()
    if (!id) return null
    return this._get(STORE_USERS, id)
  }

  // ==================== 收藏（按 userId 隔离）====================
  async addFavorite(userId, comic) {
    if (!userId) throw new Error('缺少 userId')
    const comicId = comic.id
    const item = {
      id: `${userId}__${comicId}`,
      userId,
      comicId,
      name: comic.name || '',
      author: Array.isArray(comic.author) ? comic.author.join(' & ') : comic.author || '',
      addedAt: new Date().toISOString(),
    }
    await this._put(STORE_FAVORITES, item)
    return item
  }

  async removeFavorite(userId, comicId) {
    if (!userId) return
    await this._delete(STORE_FAVORITES, `${userId}__${comicId}`)
  }

  async getFavorites(userId) {
    if (!userId) return []
    const all = await this._getAll(STORE_FAVORITES)
    return all
      .filter((item) => item.userId === userId)
      .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
  }

  async isFavorite(userId, comicId) {
    if (!userId) return false
    const item = await this._get(STORE_FAVORITES, `${userId}__${comicId}`)
    return !!item
  }

  async clearFavorites(userId) {
    if (!userId) return
    const all = await this._getAll(STORE_FAVORITES)
    for (const item of all) {
      if (item.userId === userId) {
        await this._delete(STORE_FAVORITES, item.id)
      }
    }
  }

  // ==================== 历史（按 userId 隔离）====================
  async addHistory(userId, entry) {
    if (!userId) return null
    const comicId = entry.comicId
    const item = {
      id: `${userId}__${comicId}`,
      userId,
      comicId,
      name: entry.name || '',
      author: Array.isArray(entry.author) ? entry.author.join(' & ') : entry.author || '',
      chapterId: entry.chapterId || null,
      chapterName: entry.chapterName || '',
      lastReadAt: new Date().toISOString(),
    }
    await this._put(STORE_HISTORY, item)
    return item
  }

  async getHistory(userId) {
    if (!userId) return []
    const all = await this._getAll(STORE_HISTORY)
    return all
      .filter((item) => item.userId === userId)
      .sort((a, b) => (b.lastReadAt || '').localeCompare(a.lastReadAt || ''))
  }

  async removeHistory(userId, comicId) {
    if (!userId) return
    await this._delete(STORE_HISTORY, `${userId}__${comicId}`)
  }

  async clearHistory(userId) {
    if (!userId) return
    const all = await this._getAll(STORE_HISTORY)
    for (const item of all) {
      if (item.userId === userId) {
        await this._delete(STORE_HISTORY, item.id)
      }
    }
  }

  // ==================== 导出 / 导入 ====================
  async exportAll(userId) {
    const [user, favorites, history] = await Promise.all([
      this.getUser(userId),
      this.getFavorites(userId),
      this.getHistory(userId),
    ])
    return {
      version: 2,
      app: 'JmViewer',
      exportedAt: new Date().toISOString(),
      user: user ? { username: user.username, createdAt: user.createdAt } : null,
      favorites: favorites.map(({ userId: _u, ...rest }) => rest),
      history: history.map(({ userId: _u, ...rest }) => rest),
    }
  }

  async importAll(userId, data) {
    if (!userId) throw new Error('缺少 userId')
    if (!data || (data.version !== 1 && data.version !== 2)) {
      throw new Error('数据格式不支持（需要 version: 1 或 2）')
    }

    let favCount = 0
    let histCount = 0

    if (Array.isArray(data.favorites)) {
      for (const item of data.favorites) {
        const comicId = item.comicId || item.id
        if (!comicId) continue
        await this._put(STORE_FAVORITES, {
          id: `${userId}__${comicId}`,
          userId,
          comicId,
          name: item.name || '',
          author: item.author || '',
          addedAt: item.addedAt || new Date().toISOString(),
        })
        favCount++
      }
    }

    if (Array.isArray(data.history)) {
      for (const item of data.history) {
        const comicId = item.comicId || item.id
        if (!comicId) continue
        await this._put(STORE_HISTORY, {
          id: `${userId}__${comicId}`,
          userId,
          comicId,
          name: item.name || '',
          author: item.author || '',
          chapterId: item.chapterId || null,
          chapterName: item.chapterName || '',
          lastReadAt: item.lastReadAt || new Date().toISOString(),
        })
        histCount++
      }
    }

    return { favorites: favCount, history: histCount }
  }
}

export const localDB = new LocalDB()
