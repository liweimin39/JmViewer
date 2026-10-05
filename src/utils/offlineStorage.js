import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

const APP_ROOT = 'JmViewer'
const DIR_TMP = 'Tmp'
const DIR_RAW = 'ComicImages'
const DIR_DECODED = 'DecodedComicImages'
const DIR_ZIP = 'DownloadComics'
const TASK_FILE = 'download-tasks.json'

function isAndroid() {
  return Capacitor.getPlatform() === 'android'
}

function isNative() {
  return Capacitor.isNativePlatform()
}

/**
 * 根目录
 * - Android: /storage/emulated/0/
 * - iOS: App 沙盒 Documents/
 * - Web: IndexedDB
 */
function getRootDir() {
  if (isAndroid()) return Directory.ExternalStorage
  return Directory.Documents
}

function joinPath(...parts) {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/')
}

// ==================== 路径生成 ====================

function appRootPath() {
  return APP_ROOT
}

function tmpPath() {
  return joinPath(APP_ROOT, DIR_TMP)
}

function rawAlbumPath(albumId) {
  return joinPath(APP_ROOT, DIR_RAW, String(albumId))
}

function rawChapterPath(albumId, chapterId) {
  return joinPath(APP_ROOT, DIR_RAW, String(albumId), 'chapters', String(chapterId))
}

function decodedAlbumPath(albumId) {
  return joinPath(APP_ROOT, DIR_DECODED, String(albumId))
}

function decodedChapterPath(albumId, chapterId) {
  return joinPath(APP_ROOT, DIR_DECODED, String(albumId), 'chapters', String(chapterId))
}

function zipDirPath() {
  return joinPath(APP_ROOT, DIR_ZIP)
}

function zipFilePath(fileName) {
  return joinPath(APP_ROOT, DIR_ZIP, fileName)
}

function taskFilePath() {
  return joinPath(APP_ROOT, TASK_FILE)
}

// ==================== 目录/文件操作 ====================

async function ensureDir(path) {
  try {
    await Filesystem.mkdir({
      path,
      directory: getRootDir(),
      recursive: true,
    })
  } catch (e) {
    // 已存在
  }
}

/** 初始化所有必需目录 */
async function initDirs() {
  const dirs = [
    appRootPath(),
    tmpPath(),
    joinPath(APP_ROOT, DIR_RAW),
    joinPath(APP_ROOT, DIR_DECODED),
    joinPath(APP_ROOT, DIR_ZIP),
  ]
  for (const d of dirs) {
    await ensureDir(d)
  }
}

async function writeText(path, text) {
  const dir = path.substring(0, path.lastIndexOf('/'))
  await ensureDir(dir)
  await Filesystem.writeFile({
    path,
    data: text,
    directory: getRootDir(),
    encoding: Encoding.UTF8,
    recursive: true,
  })
}

async function readText(path) {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: getRootDir(),
      encoding: Encoding.UTF8,
    })
    return typeof result.data === 'string' ? result.data : null
  } catch {
    return null
  }
}

async function writeBase64(path, base64) {
  const dir = path.substring(0, path.lastIndexOf('/'))
  await ensureDir(dir)
  await Filesystem.writeFile({
    path,
    data: base64,
    directory: getRootDir(),
    recursive: true,
  })
}

async function readBase64(path) {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: getRootDir(),
    })
    let data = result.data
    if (typeof data !== 'string') data = String(data)
    return data
  } catch {
    return null
  }
}

async function remove(path) {
  try {
    await Filesystem.deleteFile({
      path,
      directory: getRootDir(),
      recursive: true,
    })
  } catch {
    // 忽略
  }
}

async function exists(path) {
  try {
    await Filesystem.stat({
      path,
      directory: getRootDir(),
    })
    return true
  } catch {
    return false
  }
}

async function getSize(path) {
  try {
    const stat = await Filesystem.stat({
      path,
      directory: getRootDir(),
    })
    return stat.size || 0
  } catch {
    return 0
  }
}

async function getUri(path) {
  const result = await Filesystem.getUri({
    path,
    directory: getRootDir(),
  })
  return result.uri
}

async function listDir(path) {
  try {
    const result = await Filesystem.readdir({
      path,
      directory: getRootDir(),
    })
    return result.files || []
  } catch {
    return []
  }
}

/** 清理 Tmp 目录 */
async function clearTmp() {
  try {
    const tmp = tmpPath()
    const items = await listDir(tmp)
    for (const item of items) {
      const childPath = joinPath(tmp, item.name)
      await remove(childPath)
    }
  } catch (e) {
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
  DIR_TMP,
  DIR_RAW,
  DIR_DECODED,
  DIR_ZIP,

  isNative,
  isAndroid,
  getRootDir,

  appRootPath,
  tmpPath,
  rawAlbumPath,
  rawChapterPath,
  decodedAlbumPath,
  decodedChapterPath,
  zipDirPath,
  zipFilePath,
  taskFilePath,

  initDirs,
  ensureDir,
  writeText,
  readText,
  writeBase64,
  readBase64,
  remove,
  exists,
  getSize,
  getUri,
  listDir,

  clearTmp,

  saveTasks,
  loadTasks,
}
