const DB_NAME = 'JmViewerLocalDB'
const DB_VERSION = 1
const STORE_USERS = 'users'
const STORE_FAVORITES = 'favorites'
const STORE_HISTORY = 'history'

class LocalDB {
  constructor() {
    this._dbPromise = null
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

  // ==================== 用户 ====================
  async registerUser(username) {
    const user = {
      id: 'local',
      username: (username || '本地用户').trim().slice(0, 30),
      createdAt: new Date().toISOString(),
    }
    await this._put(STORE_USERS, user)
    return user
  }

  async getUser() {
    return this._get(STORE_USERS, 'local')
  }

  async clearUser() {
    await this._delete(STORE_USERS, 'local')
  }

  // ==================== 收藏 ====================
  async addFavorite(comic) {
    const item = {
      id: String(comic.id),
      comicId: comic.id,
      name: comic.name || '',
      author: Array.isArray(comic.author) ? comic.author.join(' & ') : comic.author || '',
      addedAt: new Date().toISOString(),
    }
    await this._put(STORE_FAVORITES, item)
    return item
  }

  async removeFavorite(comicId) {
    await this._delete(STORE_FAVORITES, String(comicId))
  }

  async getFavorites() {
    const list = await this._getAll(STORE_FAVORITES)
    return list.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  }

  async isFavorite(comicId) {
    const item = await this._get(STORE_FAVORITES, String(comicId))
    return !!item
  }

  // ==================== 历史 ====================
  async addHistory(entry) {
    const item = {
      id: String(entry.comicId),
      comicId: entry.comicId,
      name: entry.name || '',
      author: Array.isArray(entry.author) ? entry.author.join(' & ') : entry.author || '',
      chapterId: entry.chapterId || null,
      chapterName: entry.chapterName || '',
      lastReadAt: new Date().toISOString(),
    }
    await this._put(STORE_HISTORY, item)
    return item
  }

  async getHistory() {
    const list = await this._getAll(STORE_HISTORY)
    return list.sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt))
  }

  async removeHistory(comicId) {
    await this._delete(STORE_HISTORY, String(comicId))
  }

  async clearHistory() {
    await this._clear(STORE_HISTORY)
  }

  // ==================== 导出 / 导入 ====================
  async exportAll() {
    const [user, favorites, history] = await Promise.all([
      this.getUser(),
      this.getFavorites(),
      this.getHistory(),
    ])
    return {
      version: 1,
      app: 'JmViewer',
      exportedAt: new Date().toISOString(),
      user,
      favorites,
      history,
    }
  }

  async importAll(data) {
    if (!data || data.version !== 1) {
      throw new Error('数据格式不支持（需要 version: 1）')
    }
    if (data.user) {
      await this._put(STORE_USERS, data.user)
    }
    if (Array.isArray(data.favorites)) {
      for (const item of data.favorites) {
        if (item && item.id) await this._put(STORE_FAVORITES, item)
      }
    }
    if (Array.isArray(data.history)) {
      for (const item of data.history) {
        if (item && item.id) await this._put(STORE_HISTORY, item)
      }
    }
    return {
      favorites: (data.favorites || []).length,
      history: (data.history || []).length,
    }
  }

  async clearAll() {
    await Promise.all([
      this._clear(STORE_USERS),
      this._clear(STORE_FAVORITES),
      this._clear(STORE_HISTORY),
    ])
  }
}

export const localDB = new LocalDB()
