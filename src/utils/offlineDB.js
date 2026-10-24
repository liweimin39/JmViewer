import { Capacitor } from '@capacitor/core'
import { offlineStorage } from './offlineStorage.js'

/**
 * 离线漫画数据（SQLite）
 *
 * 仅原生端启用；Web 端所有接口返回空值，调用方回退原有网络/文件逻辑。
 *
 * 表结构：
 * - albums        下载时打开的漫画（id = 下载页的专辑 id），payload 存完整 album JSON
 * - chapters      已下载章节（id = 章节 id，album_id 指向 albums.id）
 * - images        章节图片顺序（chapter_id + idx 唯一）
 * - download_tasks 下载任务队列（替代 download-tasks.json 的读写）
 */

const DB_NAME = 'jmviewer_offline'
const DB_VERSION = 1
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i

const SCHEMA = `
CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  name TEXT,
  author TEXT,
  payload TEXT,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL,
  idx INTEGER,
  name TEXT,
  image_count INTEGER,
  bytes INTEGER,
  payload TEXT,
  downloaded_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_chapters_album ON chapters (album_id, idx);
CREATE TABLE IF NOT EXISTS images (
  chapter_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  source TEXT,
  file TEXT,
  bytes INTEGER,
  PRIMARY KEY (chapter_id, idx)
);
CREATE TABLE IF NOT EXISTS download_tasks (
  id TEXT PRIMARY KEY,
  payload TEXT,
  position INTEGER,
  updated_at INTEGER
);
`

let sqlite = null
let db = null
let initPromise = null
let failed = false

function isSupported() {
  return Capacitor.isNativePlatform()
}

function safeParse(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeAuthor(author) {
  if (!author) return ''
  return Array.isArray(author) ? author.join(' & ') : String(author)
}

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/** 打开数据库（懒加载 + 单例）。不可用时返回 null */
async function openDB() {
  if (!isSupported() || failed) return null
  if (db) return db
  if (initPromise) return initPromise

  initPromise = (async () => {
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite')
    sqlite = new SQLiteConnection(CapacitorSQLite)

    let connection = null
    try {
      const consistency = await sqlite.checkConnectionsConsistency()
      const existed = await sqlite.isConnection(DB_NAME, false)
      if (consistency?.result && existed?.result) {
        connection = await sqlite.retrieveConnection(DB_NAME, false)
      }
    } catch {
      // 无既有连接，走新建
    }

    if (!connection) {
      connection = await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false)
    }

    await connection.open()
    await connection.execute(SCHEMA)
    db = connection
    return db
  })().catch((e) => {
    failed = true
    initPromise = null
    console.warn('[OfflineDB] 初始化失败:', e)
    return null
  })

  return initPromise
}

// ==================== 写入：专辑 / 章节 / 图片 ====================

/**
 * 保存专辑信息（下载任务创建时调用）
 * @param {Object} album 完整 album 对象
 * @param {Array} chapters 本次下载的章节 [{ id, name }]
 */
async function saveAlbum(album, chapters = []) {
  const conn = await openDB()
  if (!conn || !album?.id) return false

  const series =
    Array.isArray(album.series) && album.series.length > 0
      ? album.series
      : chapters.map((c) => ({ id: c.id, name: c.name || '' }))

  const payload = JSON.stringify({ ...album, series })

  await conn.run(
    `INSERT OR REPLACE INTO albums (id, name, author, payload, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [String(album.id), album.name || '', normalizeAuthor(album.author), payload, Date.now()],
  )
  return true
}

/**
 * 保存一个已完成的章节（含图片顺序）
 * @param {Object} data { albumId, id, idx, name, payload, images: [{ idx, source, file, bytes }] }
 */
async function saveChapter(data) {
  const conn = await openDB()
  if (!conn || !data?.id) return false

  const images = Array.isArray(data.images) ? data.images : []
  const totalBytes = images.reduce((sum, img) => sum + (img.bytes || 0), 0)

  const set = [
    {
      statement: `INSERT OR REPLACE INTO chapters (id, album_id, idx, name, image_count, bytes, payload, downloaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        String(data.id),
        String(data.albumId),
        data.idx ?? 0,
        data.name || '',
        images.length,
        totalBytes,
        JSON.stringify(data.payload || {}),
        Date.now(),
      ],
    },
    { statement: `DELETE FROM images WHERE chapter_id = ?`, values: [String(data.id)] },
  ]

  for (const img of images) {
    set.push({
      statement: `INSERT OR REPLACE INTO images (chapter_id, idx, source, file, bytes) VALUES (?, ?, ?, ?, ?)`,
      values: [String(data.id), img.idx ?? 0, img.source || '', img.file || '', img.bytes || 0],
    })
  }

  await conn.executeSet(set, true)
  return true
}

// ==================== 读取：离线库列表 ====================

/**
 * 列出所有已离线的漫画（章节数、占用大小、本地封面）
 * @returns {Promise<Array>} 不可用时返回空数组
 */
async function listAlbums() {
  const conn = await openDB()
  if (!conn) return []

  const res = await conn.query(
    `SELECT a.id, a.name, a.author, a.payload, a.updated_at,
            COUNT(c.id) AS chapter_count,
            COALESCE(SUM(c.bytes), 0) AS total_bytes,
            MAX(c.downloaded_at) AS last_downloaded
       FROM albums a
       LEFT JOIN chapters c ON c.album_id = a.id
      GROUP BY a.id
      ORDER BY last_downloaded DESC`,
  )

  const rows = res.values || []
  return Promise.all(
    rows.map(async (row) => {
      const payload = safeParse(row.payload) || {}
      return {
        id: String(row.id),
        name: row.name || payload.name || '',
        author: normalizeAuthor(row.author),
        chapterCount: Number(row.chapter_count) || 0,
        bytes: Number(row.total_bytes) || 0,
        lastDownloaded: Number(row.last_downloaded) || 0,
        coverUri: await firstImageUri(row.id),
      }
    }),
  )
}

/** 取该漫画第一张已落盘的图片，作为离线封面 */
async function firstImageUri(albumId) {
  const conn = await openDB()
  if (!conn) return null

  const res = await conn.query(
    `SELECT i.file, i.chapter_id
       FROM images i
       JOIN chapters c ON c.id = i.chapter_id
      WHERE c.album_id = ?
      ORDER BY c.idx, i.idx
      LIMIT 1`,
    [String(albumId)],
  )
  const row = res.values?.[0]
  if (!row?.file) return null

  const path = `${offlineStorage.decodedChapterPath(albumId, row.chapter_id)}/${row.file}`
  try {
    return await offlineStorage.getUri(path)
  } catch {
    return null
  }
}

/** 列出某漫画已下载的章节 */
async function listChapters(albumId) {
  const conn = await openDB()
  if (!conn) return []

  const res = await conn.query(
    `SELECT id, idx, name, image_count, bytes, downloaded_at
       FROM chapters WHERE album_id = ? ORDER BY idx`,
    [String(albumId)],
  )

  return (res.values || []).map((row) => ({
    id: String(row.id),
    idx: Number(row.idx) || 0,
    name: row.name || '',
    imageCount: Number(row.image_count) || 0,
    bytes: Number(row.bytes) || 0,
    downloadedAt: Number(row.downloaded_at) || 0,
  }))
}

/** 删除专辑及其章节、图片记录 */
async function deleteAlbum(albumId) {
  const conn = await openDB()
  if (!conn || !albumId) return false

  await conn.executeSet(
    [
      {
        statement: `DELETE FROM images WHERE chapter_id IN (SELECT id FROM chapters WHERE album_id = ?)`,
        values: [String(albumId)],
      },
      { statement: `DELETE FROM chapters WHERE album_id = ?`, values: [String(albumId)] },
      { statement: `DELETE FROM albums WHERE id = ?`, values: [String(albumId)] },
    ],
    true,
  )
  return true
}

// ==================== 读取：离线章节 ====================

/**
 * 读取某章节的离线数据。
 * 磁盘文件为准（校验存在性），SQLite 提供章节顺序与元数据。
 * @param {string|number} chapterId 章节 id（阅读路由的 id）
 * @returns {Promise<{album:Object, chapter:Object}|null>}
 */
async function getOfflineChapter(chapterId) {
  const conn = await openDB()
  if (!conn) return null

  const chapterRes = await conn.query(`SELECT * FROM chapters WHERE id = ?`, [String(chapterId)])
  const chapterRow = chapterRes.values?.[0]

  if (!chapterRow) return readLegacyChapter(chapterId)

  const albumId = String(chapterRow.album_id)
  const dir = offlineStorage.decodedChapterPath(albumId, chapterRow.id)
  const files = await offlineStorage.listDir(dir)
  const sizeMap = new Map(
    files.filter((f) => f.type !== 'directory').map((f) => [f.name, f.size || 0]),
  )

  let fileList = []
  const imageRes = await conn.query(`SELECT file FROM images WHERE chapter_id = ? ORDER BY idx`, [
    String(chapterRow.id),
  ])
  fileList = (imageRes.values || []).map((r) => r.file).filter((name) => sizeMap.has(name))

  // 记录缺失或文件被移动时，回退按目录内容排序
  if (fileList.length === 0) {
    fileList = files
      .filter((f) => f.type !== 'directory' && IMAGE_EXT.test(f.name))
      .map((f) => f.name)
      .sort(naturalCompare)
  }

  if (fileList.length === 0) return null

  const albumRes = await conn.query(`SELECT * FROM albums WHERE id = ?`, [albumId])
  const albumRow = albumRes.values?.[0]
  const albumPayload = safeParse(albumRow?.payload) || {}

  const seriesRes = await conn.query(
    `SELECT id, name FROM chapters WHERE album_id = ? ORDER BY idx`,
    [albumId],
  )
  const series = (seriesRes.values || []).map((r) => ({ id: r.id, name: r.name || '' }))

  const chapterPayload = safeParse(chapterRow.payload) || {}
  const chapterName = chapterRow.name || chapterPayload.name || ''

  return {
    album: {
      ...albumPayload,
      id: String(chapterRow.id),
      name: chapterName || albumPayload.name || '',
      series,
    },
    chapter: {
      ...chapterPayload,
      id: String(chapterRow.id),
      name: chapterName,
      images: fileList,
      localFiles: fileList.map((name) => `${dir}/${name}`),
      series,
      offline: true,
      offlineDir: dir,
    },
  }
}

/** 兼容旧版（仅图片文件、无 SQLite 记录）的下载数据 */
async function readLegacyChapter(chapterId) {
  const conn = await openDB()
  if (!conn) return null

  const taskRes = await conn.query(`SELECT payload FROM download_tasks ORDER BY position`)
  for (const row of taskRes.values || []) {
    const task = safeParse(row.payload)
    if (!task) continue

    const ids = Array.isArray(task.chapterIds) ? task.chapterIds : []
    const index = ids.findIndex((id) => String(id) === String(chapterId))
    if (index === -1) continue

    const albumId = String(task.albumId)
    const dir = offlineStorage.decodedChapterPath(albumId, chapterId)
    const files = await offlineStorage.listDir(dir)
    const fileList = files
      .filter((f) => f.type !== 'directory' && IMAGE_EXT.test(f.name))
      .map((f) => f.name)
      .sort(naturalCompare)

    if (fileList.length === 0) continue

    const chapterName = (task.chapterNames || [])[index] || ''
    const series = ids.map((id, i) => ({ id, name: (task.chapterNames || [])[i] || '' }))

    return {
      album: {
        id: String(chapterId),
        name: chapterName || task.albumName || '',
        // ComicHead 按数组处理 author
        author: task.albumAuthor ? String(task.albumAuthor).split(' & ') : [],
        series,
      },
      chapter: {
        id: String(chapterId),
        name: chapterName,
        images: fileList,
        localFiles: fileList.map((name) => `${dir}/${name}`),
        series,
        offline: true,
        offlineDir: dir,
      },
    }
  }

  return null
}

// ==================== 下载任务持久化 ====================

/**
 * 保存任务队列
 * @returns {Promise<boolean>} 是否写入成功（false 时调用方回退文件存储）
 */
async function saveTasks(tasks) {
  const conn = await openDB()
  if (!conn) return false

  const set = [{ statement: `DELETE FROM download_tasks`, values: [] }]
  ;(tasks || []).forEach((task, position) => {
    set.push({
      statement: `INSERT OR REPLACE INTO download_tasks (id, payload, position, updated_at) VALUES (?, ?, ?, ?)`,
      values: [String(task.id), JSON.stringify(task), position, Date.now()],
    })
  })

  await conn.executeSet(set, true)
  return true
}

/**
 * 读取任务队列
 * @returns {Promise<Array|null>} null 表示数据库不可用（调用方回退文件存储）
 */
async function loadTasks() {
  const conn = await openDB()
  if (!conn) return null

  const res = await conn.query(`SELECT payload FROM download_tasks ORDER BY position`)
  return (res.values || []).map((row) => safeParse(row.payload)).filter(Boolean)
}

export const offlineDB = {
  isSupported,
  open: openDB,

  saveAlbum,
  saveChapter,
  deleteAlbum,
  getOfflineChapter,
  listAlbums,
  listChapters,

  saveTasks,
  loadTasks,
}
