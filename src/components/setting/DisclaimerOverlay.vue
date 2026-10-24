<script setup>
import { ref } from 'vue'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'
import { useDisclaimer } from '@/composables/useDisclaimer.js'

const StoragePermission = registerPlugin('StoragePermission')

const { visible, accept } = useDisclaimer()

// 退出失败时的兜底：锁死界面，只能选择同意
const blocked = ref(false)

async function refuse() {
  if (Capacitor.getPlatform() === 'android') {
    try {
      await App.exitApp()
      return
    } catch {}
  }
  if (Capacitor.getPlatform() === 'ios') {
    // iOS 无公开退出 API，由原生插件调用 exit(0)（仅非上架分发可用）
    try {
      await StoragePermission.exitApp()
      return
    } catch {}
    blocked.value = true
    return
  }

  // Web 无法由页面关闭应用，提示用户手动关闭
  window.close()
  alert('请手动关闭应用')
}

function agree() {
  blocked.value = false
  accept()
}
</script>

<template>
  <div v-if="visible" class="disc-overlay">
    <div v-if="blocked" class="disc-panel">
      <h2 class="disc-title">无法继续使用</h2>
      <p class="disc-blocked-text">
        您已拒绝免责声明，应用无法继续使用。如需继续，请点击下方「同意」。
      </p>
      <div class="disc-actions">
        <button class="disc-btn accept" @click="agree">同意</button>
      </div>
    </div>

    <div v-else class="disc-panel">
      <h2 class="disc-title">免责声明</h2>

      <ol class="disc-list">
        <li>
          本项目只是一个界面，不含任何内容；所有漫画数据、图片都来自第三方接口，与项目作者无关。
        </li>
        <li>请遵守你所在地区的法律法规，以及内容来源方的服务条款。</li>
        <li>下载功能仅供个人备份离线阅读使用，请勿二次传播或用于任何商业用途。</li>
        <li>如有侵权，请联系删除。</li>
      </ol>

      <div class="disc-actions">
        <button class="disc-btn refuse" @click="refuse">拒绝</button>
        <button class="disc-btn accept" @click="agree">同意</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.disc-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  box-sizing: border-box;
  background: var(--theme-overlay);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.disc-panel {
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
  box-sizing: border-box;
  background: var(--theme-surface);
  border-radius: 12px;
  padding: 22px 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
}

.disc-title {
  margin: 0 0 14px;
  font-size: 20px;
  font-weight: 600;
  color: var(--theme-text-title);
}

.disc-list {
  margin: 0;
  padding-left: 20px;
  font-size: 15px;
  line-height: 1.75;
  color: var(--theme-text-body);
}

.disc-list li + li {
  margin-top: 8px;
}

.disc-blocked-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.75;
  color: var(--theme-text-body);
}

.disc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}

.disc-btn {
  min-width: 88px;
  padding: 9px 18px;
  border-radius: 6px;
  font-size: 15px;
  cursor: pointer;
  border: 1px solid var(--theme-border-soft);
  transition:
    background 0.15s,
    border-color 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.disc-btn.refuse {
  background: var(--theme-neutral-bg);
  color: var(--theme-text-option);
}

.disc-btn.refuse:hover {
  border-color: var(--theme-accent-main);
}

.disc-btn.accept {
  background: var(--theme-accent-main);
  border-color: var(--theme-accent-main);
  color: var(--theme-text-inverse);
}

.disc-btn.accept:hover {
  background: var(--theme-accent-strong);
}

@media (max-width: 600px) {
  .disc-panel {
    padding: 18px 16px;
  }
  .disc-list {
    font-size: 14px;
  }
}
</style>
