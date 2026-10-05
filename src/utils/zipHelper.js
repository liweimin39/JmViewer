import JSZip from 'jszip'
import { offlineStorage } from './offlineStorage.js'

/**
 * 生成磁盘上存储的文件名（和 downloadManager 里一致）
 */
function getStoredImageName(originalName, albumId) {
  const id = Number(albumId)
  const needDecrypt = id >= 220980 && !originalName.endsWith('.gif')
  if (needDecrypt) {
    return originalName.replace(/\.[^.]+$/, '.png')
  }
  return originalName
}

/**
 * 将下载好的章节图片打包为 ZIP
 */
export async function zipChapters(album, chapters, onProgress) {
  const zip = new JSZip()

  const rootFolder = zip.folder(sanitizeName(album.name || `album_${album.id}`))

  let totalImages = 0
  let processedImages = 0
  let successImages = 0
  const failedImages = []

  for (const ch of chapters) {
    totalImages += (ch.images || []).length
  }

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    const chapterNum = i + 1
    const chapterName = `${chapterNum}. ${sanitizeName(chapter.name || `第${chapterNum}章`)}`
    const chapterFolder = rootFolder.folder(chapterName)

    for (let j = 0; j < chapter.images.length; j++) {
      const originalName = chapter.images[j]
      // ★ 使用和下载时一致的存储文件名
      const storedName = getStoredImageName(originalName, album.id)
      const imagePath = `${offlineStorage.albumDir(album.id)}/chapters/${chapter.id}/${storedName}`

      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const result = await Filesystem.readFile({
          path: imagePath,
          directory: Directory.Documents,
        })

        let base64Data = result.data
        if (typeof base64Data !== 'string') {
          base64Data = String(base64Data)
        }

        const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '')

        if (!base64Clean || base64Clean.length < 100) {
          console.warn(`[ZIP] 图片数据无效: ${imagePath} (长度 ${base64Clean.length})`)
          failedImages.push(imagePath)
        } else {
          // ★ ZIP 里用原始名（用户看起来正常），数据用解密后的
          chapterFolder.file(originalName, base64Clean, { base64: true })
          successImages++
        }
      } catch (e) {
        console.warn(`[ZIP] 读取图片失败: ${imagePath}`, e)
        failedImages.push(imagePath)
      }

      processedImages++
      if (onProgress) {
        onProgress(
          Math.round((processedImages / totalImages) * 100),
          `打包中 ${processedImages}/${totalImages}`,
        )
      }
    }
  }

  if (successImages === 0) {
    throw new Error(
      `打包失败：${failedImages.length} 张图片全部读取失败。` + `请检查图片是否真的下载成功`,
    )
  }

  if (failedImages.length > 0) {
    console.warn(`[ZIP] ${failedImages.length} 张图片读取失败，已跳过`)
  }

  if (onProgress) onProgress(95, '正在压缩...')

  const blob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        onProgress(95 + Math.round(metadata.percent * 0.05), '压缩中...')
      }
    },
  )

  return blob
}

function sanitizeName(name) {
  return (name || 'unknown')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

export function getZipFileName(album) {
  const date = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const suffix = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  return `${sanitizeName(album.name || 'comic')}_${suffix}.zip`
}

export { sanitizeName }
