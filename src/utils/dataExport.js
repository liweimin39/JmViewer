import { Capacitor } from '@capacitor/core'
import { localDB } from './localDB.js'

export async function exportToJSON(userId) {
  const data = await localDB.exportAll(userId)
  return JSON.stringify(data, null, 2)
}

function makeFilename(username) {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const suffix = username ? `-${username}` : ''
  return `jmviewer-backup${suffix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`
}

export async function exportAsFile(userId) {
  const data = await localDB.exportAll(userId)
  const json = JSON.stringify(data, null, 2)
  const filename = makeFilename(data.user?.username)

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

export async function importFromJSON(userId, jsonStr) {
  let data
  try {
    data = JSON.parse(jsonStr)
  } catch (e) {
    throw new Error('JSON 解析失败：' + e.message)
  }
  return localDB.importAll(userId, data)
}
