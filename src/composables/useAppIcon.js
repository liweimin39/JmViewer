import { Capacitor, registerPlugin } from '@capacitor/core'

const AppIcon = registerPlugin('AppIcon')

const platform = Capacitor.getPlatform()

/** 是否支持运行时切换图标（Android 用 activity-alias，iOS 用 alternate icons；Web 不支持） */
export const iconSwitchSupported = platform === 'android' || platform === 'ios'

/** 读取当前原生生效的图标主题 */
export async function getAppIcon() {
  if (!iconSwitchSupported) return 'pink'
  try {
    const ret = await AppIcon.getIcon()
    return ret?.theme || 'pink'
  } catch (e) {
    console.warn('[AppIcon] 读取图标失败:', e)
    return null
  }
}

/**
 * 切换桌面应用图标
 * @param {string} theme pink | blue | green | purple | gray | dark
 */
export async function setAppIcon(theme) {
  if (!iconSwitchSupported) return false
  try {
    await AppIcon.setIcon({ theme })
    return true
  } catch (e) {
    console.warn('[AppIcon] 切换图标失败:', e)
    return false
  }
}
