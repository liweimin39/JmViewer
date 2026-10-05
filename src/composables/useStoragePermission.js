import { ref } from 'vue'
import { Capacitor, registerPlugin } from '@capacitor/core'

const StoragePermission = registerPlugin('StoragePermission')

const granted = ref(true)
const checking = ref(false)
const platform = ref(Capacitor.getPlatform())

/** Android 版本 */
function getAndroidVersion() {
  if (platform.value !== 'android') return 0
  const m = navigator.userAgent.match(/Android\s+(\d+)/i)
  return m ? Number(m[1]) : 0
}

function needsAllFilesAccess() {
  return platform.value === 'android' && getAndroidVersion() >= 11
}

/** Android 10 及以下：用 Filesystem 检测 */
async function checkLegacyPermission() {
  try {
    const { Filesystem } = await import('@capacitor/filesystem')
    const result = await Filesystem.checkPermissions()
    return result.publicStorage === 'granted'
  } catch {
    return false
  }
}

async function requestLegacyPermission() {
  try {
    const { Filesystem } = await import('@capacitor/filesystem')
    const result = await Filesystem.requestPermissions()
    return result.publicStorage === 'granted'
  } catch {
    return false
  }
}

/** Android 11+：用自定义插件检查 */
async function checkModernPermission() {
  try {
    const result = await StoragePermission.checkAllFilesAccess()
    return !!result.granted
  } catch (e) {
    console.warn('[StoragePermission] check 失败:', e)
    return false
  }
}

/** Android 11+：用自定义插件打开设置页 */
async function openAllFilesAccessSettings() {
  try {
    await StoragePermission.openAllFilesAccess()
    return true
  } catch (e) {
    console.warn('[StoragePermission] open 失败:', e)
    return false
  }
}

export function useStoragePermission() {
  async function check() {
    checking.value = true
    try {
      if (platform.value !== 'android') {
        granted.value = true
        return true
      }

      const version = getAndroidVersion()
      if (version >= 11) {
        const ok = await checkModernPermission()
        granted.value = ok
        return ok
      } else {
        const ok = await checkLegacyPermission()
        granted.value = ok
        return ok
      }
    } finally {
      checking.value = false
    }
  }

  async function request() {
    if (platform.value !== 'android') return true

    const version = getAndroidVersion()
    if (version >= 11) {
      await openAllFilesAccessSettings()
      return false
    } else {
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
