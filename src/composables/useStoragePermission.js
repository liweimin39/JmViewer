import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'

const granted = ref(true) // 默认假定已授权（iOS / Web 不需要）
const checking = ref(false)
const platform = ref(Capacitor.getPlatform())

/**
 * 检测 Android 版本
 * 返回主版本号，例如 10、11、12、13
 */
function getAndroidVersion() {
  if (platform.value !== 'android') return 0
  const m = navigator.userAgent.match(/Android\s+(\d+)/i)
  return m ? Number(m[1]) : 0
}

/**
 * Android 11+ 需要 MANAGE_EXTERNAL_STORAGE
 */
function needsAllFilesAccess() {
  return platform.value === 'android' && getAndroidVersion() >= 11
}

/**
 * 用 Capacitor Filesystem 检测权限（Android 10 及以下有效）
 */
async function checkLegacyPermission() {
  try {
    const { Filesystem } = await import('@capacitor/filesystem')
    const result = await Filesystem.checkPermissions()
    return result.publicStorage === 'granted'
  } catch {
    return false
  }
}

/**
 * 请求旧版存储权限（Android 10 及以下，会弹系统对话框）
 */
async function requestLegacyPermission() {
  try {
    const { Filesystem } = await import('@capacitor/filesystem')
    const result = await Filesystem.requestPermissions()
    return result.publicStorage === 'granted'
  } catch {
    return false
  }
}

/**
 * Android 11+：跳转到系统设置的"所有文件访问"页面
 * 返回 Promise<boolean>：true = 已尝试跳转，false = 跳转失败
 */
async function openAllFilesAccessSettings() {
  if (platform.value !== 'android') return false

  const packageName = 'com.liweimin.jmviewer'

  try {
    const { AppLauncher } = await import('@capacitor/app-launcher')

    // 尝试直接打开本 App 的"所有文件访问"页面
    try {
      await AppLauncher.openUrl({
        url: `android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION?package=${packageName}`,
      })
      return true
    } catch (e) {
      // 降级：打开"所有文件访问"的 App 列表页
      try {
        await AppLauncher.openUrl({
          url: `android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION`,
        })
        return true
      } catch (e2) {
        // 再降级：打开本 App 的应用详情页
        try {
          await AppLauncher.openUrl({
            url: `android.settings.APPLICATION_DETAILS_SETTINGS?package=${packageName}`,
          })
          return true
        } catch (e3) {
          return false
        }
      }
    }
  } catch (e) {
    return false
  }
}

/**
 * 主动检测权限（用户从设置返回后调用）
 * 原生平台没法用 API 查询"所有文件访问"权限，只能**实际尝试写文件**判断
 */
async function testWritePermission() {
  if (platform.value !== 'android') return true

  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')

    // 尝试在根目录创建一个测试文件
    const testPath = 'JmViewer/.permission-test'
    try {
      await Filesystem.mkdir({
        path: 'JmViewer',
        directory: Directory.ExternalStorage,
        recursive: true,
      })
    } catch {
      // 目录已存在
    }

    await Filesystem.writeFile({
      path: testPath,
      data: 'test',
      directory: Directory.ExternalStorage,
      encoding: Encoding.UTF8,
      recursive: true,
    })

    // 删除测试文件
    try {
      await Filesystem.deleteFile({
        path: testPath,
        directory: Directory.ExternalStorage,
      })
    } catch {}

    return true
  } catch {
    return false
  }
}

export function useStoragePermission() {
  /**
   * 检测当前权限状态
   */
  async function check() {
    checking.value = true
    try {
      if (platform.value !== 'android') {
        granted.value = true
        return true
      }

      const version = getAndroidVersion()

      if (version >= 11) {
        // Android 11+：实际测试写文件
        const ok = await testWritePermission()
        granted.value = ok
        return ok
      } else {
        // Android 10 及以下：用 Filesystem 检测
        const ok = await checkLegacyPermission()
        granted.value = ok
        return ok
      }
    } finally {
      checking.value = false
    }
  }

  /**
   * 请求权限
   * - Android 10-：弹系统对话框
   * - Android 11+：跳转到系统设置
   */
  async function request() {
    if (platform.value !== 'android') return true

    const version = getAndroidVersion()

    if (version >= 11) {
      // 跳系统设置
      await openAllFilesAccessSettings()
      return false // 跳转后需要用户手动开启，返回 false
    } else {
      // 弹系统对话框
      const ok = await requestLegacyPermission()
      granted.value = ok
      return ok
    }
  }

  return {
    granted,
    checking,
    platform,
    androidVersion: getAndroidVersion(),
    needsAllFilesAccess: needsAllFilesAccess(),
    check,
    request,
  }
}
