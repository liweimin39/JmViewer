const DB_NAME = 'JmViewerLocalDB'
const DB_VERSION = 1
const STORE_USERS = 'users'
const STORE_FAVORITES = 'favorites'
const STORE_HISTORY = 'history'

// ★ 历史共享 userId（本地和云端共用一份）
const HISTORY_USER_ID = 'common'

const LS_LOCAL_USER_ID = 'jmviewer.localUserId'
const LS_CLEANED_V2 = 'jmviewer.cleanedV2'
const LS_HISTORY_COMMON_MIGRATED = 'jmviewer.historyCommonMigrated'

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
      let req
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION)
      } catch (e) {
        this._dbPromise = null
        reject(e)
        return
      }

      req.onerror = () => {
        // 打开失败，下次重试
        this._dbPromise = null
        reject(req.error)
      }

      req.onblocked = () => {
        console.warn('[localDB] open blocked（其他标签页占用）')
      }

      req.onsuccess = () => {
        const db = req.result

        // ★ 连接被系统/浏览器关闭时，清掉缓存，下次自动重连
        db.onclose = () => {
          console.warn('[localDB] 连接已被关闭，下次操作将自动重连')
          this._dbPromise = null
        }

        // ★ 数据库版本被其他标签页升级时，主动关闭并清缓存
        db.onversionchange = () => {
          console.warn('[localDB] 数据库版本变化，关闭当前连接')
          try {
            db.close()
          } catch {}
          this._dbPromise = null
        }

        resolve(db)
      }

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

  /**
   * ★ 核心：包装所有 IDB 操作
   * - 连接失效（InvalidStateError / TransactionInactiveError）时自动重连 + 重试一次
   */
  async _withDB(fn) {
    let db
    try {
      db = await this._open()
      return await fn(db)
    } catch (e) {
      // 连接失效或事务失效 → 清缓存重连一次
      if (
        e &&
        (e.name === 'InvalidStateError' ||
          e.name === 'TransactionInactiveError' ||
          e.name === 'DatabaseClosedError' ||
          /connection is closing/i.test(e.message || ''))
      ) {
        console.warn('[localDB] 连接失效，重试一次:', e.name)
        this._dbPromise = null
        db = await this._open()
        return await fn(db)
      }
      throw e
    }
  }

  async _get(store, key) {
    return this._withDB(
      (db) =>
        new Promise((resolve, reject) => {
          let tx
          try {
            tx = db.transaction(store, 'readonly')
          } catch (e) {
            reject(e)
            return
          }

          const req = tx.objectStore(store).get(key)
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
          tx.onerror = () => reject(tx.error)
        }),
    )
  }

  async _getAll(store) {
    return this._withDB(
      (db) =>
        new Promise((resolve, reject) => {
          let tx
          try {
            tx = db.transaction(store, 'readonly')
          } catch (e) {
            reject(e)
            return
          }

          const req = tx.objectStore(store).getAll()
          req.onsuccess = () => resolve(req.result || [])
          req.onerror = () => reject(req.error)
          tx.onerror = () => reject(tx.error)
        }),
    )
  }

  async _put(store, value) {
    return this._withDB(
      (db) =>
        new Promise((resolve, reject) => {
          let tx
          try {
            tx = db.transaction(store, 'readwrite')
          } catch (e) {
            reject(e)
            return
          }

          const req = tx.objectStore(store).put(value)
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
          tx.onerror = () => reject(tx.error)
        }),
    )
  }

  async _delete(store, key) {
    return this._withDB(
      (db) =>
        new Promise((resolve, reject) => {
          let tx
          try {
            tx = db.transaction(store, 'readwrite')
          } catch (e) {
            reject(e)
            return
          }

          const req = tx.objectStore(store).delete(key)
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
          tx.onerror = () => reject(tx.error)
        }),
    )
  }

  async _clear(store) {
    return this._withDB(
      (db) =>
        new Promise((resolve, reject) => {
          let tx
          try {
            tx = db.transaction(store, 'readwrite')
          } catch (e) {
            reject(e)
            return
          }

          const req = tx.objectStore(store).clear()
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
          tx.onerror = () => reject(tx.error)
        }),
    )
  }

  // ==================== 初始化 ====================

  async init() {
    if (this._migrated) return
    this._migrated = true

    // 一次性清空旧账号
    if (!localStorage.getItem(LS_CLEANED_V2)) {
      try {
        await this._clear(STORE_USERS)
        await this._clear(STORE_FAVORITES)
        await this._clear(STORE_HISTORY)
        localStorage.removeItem('jmviewer.currentLocalUserId')
        localStorage.setItem(LS_CLEANED_V2, '1')
        console.log('[localDB] 已清空所有旧账号数据')
      } catch (e) {
        console.warn('[localDB] 清空旧数据失败:', e)
      }
    }

    // 历史迁移到 common
    if (!localStorage.getItem(LS_HISTORY_COMMON_MIGRATED)) {
      try {
        const all = await this._getAll(STORE_HISTORY)
        const seen = new Map()

        for (const item of all) {
          const key = item.comicId
          const existing = seen.get(key)
          if (!existing || (item.lastReadAt || '') > (existing.lastReadAt || '')) {
            seen.set(key, item)
          }
        }

        await this._clear(STORE_HISTORY)
        for (const [key, item] of seen) {
          await this._put(STORE_HISTORY, {
            ...item,
            id: `${HISTORY_USER_ID}__${key}`,
            userId: HISTORY_USER_ID,
          })
        }

        localStorage.setItem(LS_HISTORY_COMMON_MIGRATED, '1')
        console.log(`[localDB] 历史已合并到 common：${seen.size} 条`)
      } catch (e) {
        console.warn('[localDB] 历史迁移失败:', e)
      }
    }

    // 确保本地账号存在
    let localUserId = localStorage.getItem(LS_LOCAL_USER_ID)
    if (localUserId) {
      const u = await this._get(STORE_USERS, localUserId)
      if (!u) {
        localStorage.removeItem(LS_LOCAL_USER_ID)
        localUserId = null
      }
    }

    if (!localUserId) {
      const user = {
        id: uuid(),
        username: '用户',
        createdAt: new Date().toISOString(),
      }
      await this._put(STORE_USERS, user)
      localStorage.setItem(LS_LOCAL_USER_ID, user.id)
      console.log('[localDB] 已创建本地账号:', user.username)
    }
  }

  // ==================== 本地账号 ====================

  async getLocalUser() {
    const id = localStorage.getItem(LS_LOCAL_USER_ID)
    if (!id) return null
    return this._get(STORE_USERS, id)
  }

  async updateLocalUsername(newName) {
    const id = localStorage.getItem(LS_LOCAL_USER_ID)
    if (!id) return null

    const user = await this._get(STORE_USERS, id)
    if (!user) return null

    user.username = (newName || '').trim().slice(0, 30) || '用户'
    await this._put(STORE_USERS, user)
    return user
  }

  async resetLocalAccount() {
    const oldId = localStorage.getItem(LS_LOCAL_USER_ID)
    if (oldId) await this._delete(STORE_USERS, oldId)

    const favs = await this._getAll(STORE_FAVORITES)
    for (const item of favs) {
      if (item.userId === oldId) await this._delete(STORE_FAVORITES, item.id)
    }

    // 历史保留（common）

    const user = {
      id: uuid(),
      username: '用户',
      createdAt: new Date().toISOString(),
    }
    await this._put(STORE_USERS, user)
    localStorage.setItem(LS_LOCAL_USER_ID, user.id)

    return user
  }

  // ==================== 收藏 ====================

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

  // ==================== 历史（共享） ====================

  async addHistory(userId, entry) {
    const seriesKey = String(entry.comicId || entry.id)
    const chapterId = entry.chapterId
    if (!chapterId) return null

    const now = new Date().toISOString()
    const key = `${HISTORY_USER_ID}__${seriesKey}`
    const existing = await this._get(STORE_HISTORY, key)

    const item = {
      id: key,
      userId: HISTORY_USER_ID,
      comicId: seriesKey,
      name: existing?.name || entry.name || '',
      author: Array.isArray(entry.author)
        ? entry.author.join(' & ')
        : entry.author || existing?.author || '',
      coverId: existing?.coverId || entry.coverId || seriesKey,
      lastChapterId: chapterId,
      lastChapterName: entry.chapterName || existing?.lastChapterName || `第${chapterId}章`,
      lastReadAt: now,
      currentAlbumId: entry.currentAlbumId || chapterId,
    }

    await this._put(STORE_HISTORY, item)
    return item
  }

  async getHistory(userId) {
    const all = await this._getAll(STORE_HISTORY)
    return all
      .filter((item) => item.userId === HISTORY_USER_ID)
      .sort((a, b) => (b.lastReadAt || '').localeCompare(a.lastReadAt || ''))
  }

  async removeHistory(userId, seriesKey) {
    await this._delete(STORE_HISTORY, `${HISTORY_USER_ID}__${seriesKey}`)
  }

  async clearHistory(userId) {
    const all = await this._getAll(STORE_HISTORY)
    for (const item of all) {
      if (item.userId === HISTORY_USER_ID) {
        await this._delete(STORE_HISTORY, item.id)
      }
    }
  }

  // ==================== 导出 / 导入 ====================

  async exportAll(userId) {
    const [user, favorites, history] = await Promise.all([
      this._get(STORE_USERS, userId),
      this.getFavorites(userId),
      this.getHistory(HISTORY_USER_ID),
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
        const seriesKey = item.comicId || item.id
        if (!seriesKey) continue
        await this._put(STORE_HISTORY, {
          id: `${HISTORY_USER_ID}__${seriesKey}`,
          userId: HISTORY_USER_ID,
          comicId: seriesKey,
          name: item.name || '',
          author: item.author || '',
          coverId: item.coverId || seriesKey,
          lastChapterId: item.lastChapterId || item.chapterId || null,
          lastChapterName: item.lastChapterName || item.chapterName || null,
          lastReadAt: item.lastReadAt || new Date().toISOString(),
          currentAlbumId: item.currentAlbumId || item.chapterId || null,
        })
        histCount++
      }
    }

    return { favorites: favCount, history: histCount }
  }
}

export const localDB = new LocalDB()
