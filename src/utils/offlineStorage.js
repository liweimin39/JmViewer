import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

const APP_ROOT = 'JmViewer'
const TMP_DIR = 'Tmp'
const COMICS_DIR = 'Comics'
const RAW_IMAGES_DIR = 'ComicImages'
const LOGS_DIR = 'logs'
const TASK_FILE = 'download-tasks.json'

function isAndroid() {
  return Capacitor.getPlatform() === 'android'
}
function isNative() {
  return Capacitor.isNativePlatform()
}

/** 主目录（Comics / logs / tasks） */
function mainDirectory() {
  return isAndroid() ? Directory.ExternalStorage : Directory.Documents
}

/** 原图临时目录（Android 用外部缓存，iOS 用 Documents） */
function rawDirectory() {
  return isAndroid() ? Directory.ExternalCache : Directory.Documents
}

function joinPath(...parts) {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/')
}

// ==================== 路径 ====================

function mainRootPath() {
  return APP_ROOT
}

function tmpRootPath() {
  return joinPath(APP_ROOT, TMP_DIR)
}

function logsPath() {
  return joinPath(APP_ROOT, TMP_DIR, LOGS_DIR)
}

function comicsPath() {
  return joinPath(APP_ROOT, COMICS_DIR)
}

/** 解密图片章节目录 */
function decodedChapterPath(albumId, chapterId) {
  return joinPath(APP_ROOT, COMICS_DIR, String(albumId), 'chapters', String(chapterId))
}

function decodedAlbumPath(albumId) {
  return joinPath(APP_ROOT, COMICS_DIR, String(albumId))
}

/** 原图章节目录 */
function rawChapterPath(albumId, chapterId) {
  const base = isAndroid()
    ? joinPath(TMP_DIR, RAW_IMAGES_DIR)
    : joinPath(APP_ROOT, TMP_DIR, RAW_IMAGES_DIR)
  return joinPath(base, String(albumId), 'chapters', String(chapterId))
}

function taskFilePath() {
  return joinPath(APP_ROOT, TASK_FILE)
}

// ==================== 内部通用 ====================

async function mkdirSafe(path, directory) {
  if (!path) return
  try {
    await Filesystem.mkdir({ path, directory, recursive: true })
  } catch {
    // 已存在
  }
}

async function writeFileInternal(path, data, directory, encoding) {
  const parent = path.substring(0, path.lastIndexOf('/'))
  if (parent) await mkdirSafe(parent, directory)

  const options = { path, data, directory, recursive: true }
  if (encoding) options.encoding = encoding

  await Filesystem.writeFile(options)
}

async function readFileInternal(path, directory, encoding) {
  const options = { path, directory }
  if (encoding) options.encoding = encoding
  const result = await Filesystem.readFile(options)
  return result.data
}

// ==================== 主目录操作 ====================

async function ensureDir(path) {
  await mkdirSafe(path, mainDirectory())
}

async function ensureRawDir(path) {
  await mkdirSafe(path, rawDirectory())
}

async function writeText(path, text) {
  await writeFileInternal(path, text, mainDirectory(), Encoding.UTF8)
}

async function readText(path) {
  try {
    const data = await readFileInternal(path, mainDirectory(), Encoding.UTF8)
    return typeof data === 'string' ? data : null
  } catch {
    return null
  }
}

async function writeBase64(path, base64) {
  await writeFileInternal(path, base64, mainDirectory())
}

async function readBase64(path) {
  try {
    let data = await readFileInternal(path, mainDirectory())
    if (typeof data !== 'string') data = String(data)
    return data
  } catch {
    return null
  }
}

// ==================== 原图目录操作 ====================

async function writeRawBase64(path, base64) {
  await writeFileInternal(path, base64, rawDirectory())
}

async function readRawBase64(path) {
  try {
    let data = await readFileInternal(path, rawDirectory())
    if (typeof data !== 'string') data = String(data)
    return data
  } catch {
    return null
  }
}

// ==================== 通用 ====================

async function remove(path, directory) {
  const dir = directory || mainDirectory()
  try {
    await Filesystem.deleteFile({ path, directory: dir, recursive: true })
  } catch {
    // 忽略
  }
}

async function removeRaw(path) {
  return remove(path, rawDirectory())
}

async function exists(path, directory) {
  const dir = directory || mainDirectory()
  try {
    await Filesystem.stat({ path, directory: dir })
    return true
  } catch {
    return false
  }
}

async function existsRaw(path) {
  return exists(path, rawDirectory())
}

async function getSize(path, directory) {
  const dir = directory || mainDirectory()
  try {
    const stat = await Filesystem.stat({ path, directory: dir })
    return stat.size || 0
  } catch {
    return 0
  }
}

async function getSizeRaw(path) {
  return getSize(path, rawDirectory())
}

async function getUri(path, directory) {
  const dir = directory || mainDirectory()
  const result = await Filesystem.getUri({ path, directory: dir })
  return result.uri
}

async function getUriRaw(path) {
  return getUri(path, rawDirectory())
}

async function listDir(path, directory) {
  const dir = directory || mainDirectory()
  try {
    const result = await Filesystem.readdir({ path, directory: dir })
    return result.files || []
  } catch {
    return []
  }
}

async function listDirRaw(path) {
  return listDir(path, rawDirectory())
}

// ==================== 初始化 ====================

/** 初始化所有必需目录 */
async function initDirs() {
  // 主目录下的目录
  await ensureDir(mainRootPath())
  await ensureDir(tmpRootPath())
  await ensureDir(logsPath())
  await ensureDir(comicsPath())

  // 原图目录
  const rawBase = isAndroid()
    ? joinPath(TMP_DIR, RAW_IMAGES_DIR)
    : joinPath(APP_ROOT, TMP_DIR, RAW_IMAGES_DIR)
  await ensureRawDir(rawBase)
}

/** 清空 Tmp 目录（保留 logs） */
async function clearTmp() {
  try {
    const tmp = tmpRootPath()
    const items = await listDir(tmp)
    for (const item of items) {
      // 保留 logs 目录
      if (item.name === LOGS_DIR) continue
      await remove(joinPath(tmp, item.name))
    }

    // Android 的 Cache 里的原图也要清
    if (isAndroid()) {
      const rawBase = joinPath(TMP_DIR, RAW_IMAGES_DIR)
      try {
        const rawItems = await listDirRaw(rawBase)
        for (const item of rawItems) {
          await removeRaw(joinPath(rawBase, item.name))
        }
      } catch {}
    }
  } catch {
    // 忽略
  }
}

// ==================== 任务持久化 ====================

async function saveTasks(tasks) {
  await writeText(taskFilePath(), JSON.stringify(tasks, null, 2))
}

async function loadTasks() {
  const text = await readText(taskFilePath())
  if (!text) return []
  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}

export const offlineStorage = {
  APP_ROOT,
  TMP_DIR,
  COMICS_DIR,
  LOGS_DIR,

  isNative,
  isAndroid,
  mainDirectory,
  rawDirectory,

  mainRootPath,
  tmpRootPath,
  logsPath,
  comicsPath,
  decodedChapterPath,
  decodedAlbumPath,
  rawChapterPath,
  taskFilePath,

  initDirs,
  clearTmp,

  ensureDir,
  ensureRawDir,

  writeText,
  readText,
  writeBase64,
  readBase64,

  writeRawBase64,
  readRawBase64,

  remove,
  removeRaw,
  exists,
  existsRaw,
  getSize,
  getSizeRaw,
  getUri,
  getUriRaw,
  listDir,
  listDirRaw,

  saveTasks,
  loadTasks,
}
