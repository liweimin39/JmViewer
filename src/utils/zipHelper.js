import JSZip from 'jszip'
import { offlineStorage } from './offlineStorage.js'

/**
 * 判断某张图是否需要解密
 * ★ 用 chapterId，不是 albumId
 */
function needsDecrypt(chapterId, imageName) {
  const id = Number(chapterId)
  return id >= 220980 && !imageName.endsWith('.gif')
}

/**
 * 生成解密后的文件名
 * ★ 用 chapterId，不是 albumId
 */
function getDecodedName(originalName, chapterId) {
  if (needsDecrypt(chapterId, originalName)) {
    return originalName.replace(/\.[^.]+$/, '.png')
  }
  return originalName
}

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

    const decodedDir = offlineStorage.decodedChapterPath(album.id, chapter.id)

    for (let j = 0; j < chapter.images.length; j++) {
      const originalName = chapter.images[j]
      // ★ 用 chapter.id
      const decodedName = getDecodedName(originalName, chapter.id)
      const imagePath = `${decodedDir}/${decodedName}`

      try {
        const base64Data = await offlineStorage.readBase64(imagePath)

        if (!base64Data) {
          failedImages.push(imagePath)
        } else {
          const clean = base64Data.replace(/^data:[^;]+;base64,/, '')
          if (!clean || clean.length < 100) {
            failedImages.push(imagePath)
          } else {
            chapterFolder.file(decodedName, clean, { base64: true })
            successImages++
          }
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
    throw new Error(`打包失败：${failedImages.length} 张图片全部读取失败`)
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
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `${sanitizeName(album.name || 'comic')}_${ts}.zip`
}

export { sanitizeName, getDecodedName, needsDecrypt }
