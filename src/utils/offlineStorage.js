import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

const ROOT_DIR = 'JmViewerDownloads'
const TASK_FILE = 'download-tasks.json'

function isNative() {
  return Capacitor.isNativePlatform()
}

/** 获取漫画存储目录（按漫画ID隔离） */
function albumDir(albumId) {
  return `${ROOT_DIR}/${albumId}`
}

/** 确保目录存在 */
async function ensureDir(path) {
  try {
    await Filesystem.mkdir({
      path,
      directory: Directory.Documents,
      recursive: true,
    })
  } catch (e) {
    // 目录已存在
  }
}

/** 写入文本文件 */
async function writeText(path, text) {
  const dir = path.substring(0, path.lastIndexOf('/'))
  await ensureDir(dir)
  await Filesystem.writeFile({
    path,
    data: text,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  })
}

/** 读取文本文件 */
async function readText(path) {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    })
    return typeof result.data === 'string' ? result.data : null
  } catch {
    return null
  }
}

/** 删除文件或目录 */
async function remove(path) {
  try {
    await Filesystem.deleteFile({
      path,
      directory: Directory.Documents,
      recursive: true,
    })
  } catch {
    // 忽略不存在的文件
  }
}

/** 检查文件是否存在 */
async function exists(path) {
  try {
    await Filesystem.stat({
      path,
      directory: Directory.Documents,
    })
    return true
  } catch {
    return false
  }
}

/** 获取文件大小 */
async function getSize(path) {
  try {
    const stat = await Filesystem.stat({
      path,
      directory: Directory.Documents,
    })
    return stat.size || 0
  } catch {
    return 0
  }
}

/** 列出目录下的文件 */
async function listDir(path) {
  try {
    const result = await Filesystem.readdir({
      path,
      directory: Directory.Documents,
    })
    return result.files || []
  } catch {
    return []
  }
}

/** 获取文件的完整 URI（用于 FileTransfer 下载目标） */
async function getUri(path) {
  const result = await Filesystem.getUri({
    path,
    directory: Directory.Documents,
  })
  return result.uri
}

/** 保存下载任务元数据 */
async function saveTasks(tasks) {
  await writeText(`${ROOT_DIR}/${TASK_FILE}`, JSON.stringify(tasks, null, 2))
}

/** 加载下载任务元数据 */
async function loadTasks() {
  const text = await readText(`${ROOT_DIR}/${TASK_FILE}`)
  if (!text) return []
  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}

export const offlineStorage = {
  isNative,
  albumDir,
  ensureDir,
  writeText,
  readText,
  remove,
  exists,
  getSize,
  listDir,
  getUri,
  saveTasks,
  loadTasks,
  ROOT_DIR,
}
