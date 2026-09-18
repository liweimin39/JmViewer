import { Capacitor } from '@capacitor/core'
import { localDB } from './localDB.js'

/** 导出为 JSON 字符串 */
export async function exportToJSON() {
  const data = await localDB.exportAll()
  return JSON.stringify(data, null, 2)
}

/** 生成文件名 */
function makeFilename() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `jmviewer-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`
}

/**
 * 导出为文件
 * - 原生平台：写到 Cache，弹系统分享面板（用户可选"存储到文件"/AirDrop/微信等）
 * - Web：浏览器下载
 */
export async function exportAsFile() {
  const json = await exportToJSON()
  const filename = makeFilename()

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')

    const result = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })

    await Share.share({
      title: 'JmViewer 数据备份',
      url: result.uri,
      dialogTitle: '保存或分享备份文件',
    })
    return { filename }
  }

  // Web
  downloadJSONWeb(json, filename)
  return { filename }
}

function downloadJSONWeb(jsonStr, filename) {
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 从 JSON 字符串导入
 */
export async function importFromJSON(jsonStr) {
  let data
  try {
    data = JSON.parse(jsonStr)
  } catch (e) {
    throw new Error('JSON 解析失败：' + e.message)
  }
  return localDB.importAll(data)
}

/** 保留旧的 downloadJSON 接口 */
export function downloadJSON(jsonStr, filename) {
  downloadJSONWeb(jsonStr, filename || makeFilename())
}
