import JSZip from 'jszip'
import { offlineStorage } from './offlineStorage.js'

/**
 * 将下载好的章节图片打包为 ZIP
 * @param {Object} album 漫画信息 { id, name, author }
 * @param {Array} chapters 章节数组 [{ id, name, images: [] }]
 * @param {Function} onProgress 进度回调 (percent, message)
 * @returns {Promise<Blob>} ZIP Blob
 */
export async function zipChapters(album, chapters, onProgress) {
  const zip = new JSZip()

  // 漫画根目录
  const rootFolder = zip.folder(sanitizeName(album.name || `album_${album.id}`))

  let totalImages = 0
  let processedImages = 0

  // 统计总图片数
  for (const ch of chapters) {
    totalImages += (ch.images || []).length
  }

  // 按章节顺序添加
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    const chapterNum = i + 1
    const chapterName = `${chapterNum}. ${sanitizeName(chapter.name || `第${chapterNum}章`)}`
    const chapterFolder = rootFolder.folder(chapterName)

    for (let j = 0; j < chapter.images.length; j++) {
      const imageName = chapter.images[j]
      const imagePath = `${offlineStorage.albumDir(album.id)}/chapters/${chapter.id}/${imageName}`

      try {
        // 从文件系统读取图片
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
        const result = await Filesystem.readFile({
          path: imagePath,
          directory: Directory.Documents,
        })

        // 原生平台返回 base64，Web 平台直接是 base64
        let base64Data = result.data
        if (typeof base64Data !== 'string') {
          base64Data = base64Data.toString('base64')
        }

        // 去掉 base64 前缀
        const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '')

        chapterFolder.file(imageName, base64Clean, { base64: true })
      } catch (e) {
        console.warn(`[ZIP] 读取图片失败: ${imagePath}`, e)
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

  // 生成 ZIP
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

/** 清理文件名中的非法字符 */
function sanitizeName(name) {
  return (name || 'unknown')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

/** 获取 ZIP 文件名 */
export function getZipFileName(album) {
  const date = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const suffix = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  return `${sanitizeName(album.name || 'comic')}_${suffix}.zip`
}

export { sanitizeName }
