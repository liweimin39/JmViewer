<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useStoragePermission } from '@/composables/useStoragePermission.js'

const emit = defineEmits(['granted', 'cancel'])

const { granted, checking, androidVersion, needsAllFilesAccess, check, request } =
  useStoragePermission()

let resumeHandler = null

async function handleRequest() {
  await request()

  // 跳系统设置后，等用户切回来
  if (needsAllFilesAccess) {
    // 监听 App 恢复前台
    const { App: CapApp } = await import('@capacitor/app')
    resumeHandler = await CapApp.addListener('resume', async () => {
      // 用户从设置返回，重新检测
      const ok = await check()
      if (ok) {
        if (resumeHandler) {
          resumeHandler.remove()
          resumeHandler = null
        }
        emit('granted')
      }
    })
  } else {
    // Android 10-：系统弹窗返回后立即检测
    if (granted.value) emit('granted')
  }
}

async function handleRecheck() {
  const ok = await check()
  if (ok) emit('granted')
}

onMounted(() => {
  check()
})

onBeforeUnmount(() => {
  if (resumeHandler) {
    resumeHandler.remove()
    resumeHandler = null
  }
})
</script>

<template>
  <div class="perm-overlay">
    <div class="perm-panel">
      <h2>需要存储权限</h2>

      <p v-if="needsAllFilesAccess" class="perm-desc">
        Android {{ androidVersion }} 需要"所有文件访问"权限才能把下载的漫画保存到公共目录
        <code>/storage/emulated/0/JmViewer/</code>
      </p>
      <p v-else class="perm-desc">需要"读写存储"权限才能把下载的漫画保存到公共目录</p>

      <div class="perm-steps" v-if="needsAllFilesAccess">
        <p class="perm-steps-title">操作步骤：</p>
        <ol>
          <li>点击下方"去授权"按钮</li>
          <li>在系统设置里找到 <strong>「JmViewer」</strong></li>
          <li>打开 <strong>「允许访问所有文件」</strong> 或 <strong>「所有文件访问」</strong></li>
          <li>返回本 App 即可</li>
        </ol>
      </div>

      <div class="perm-actions">
        <button class="perm-btn secondary" @click="emit('cancel')">取消</button>
        <button class="perm-btn primary" :disabled="checking" @click="handleRequest">去授权</button>
      </div>

      <button class="perm-recheck" @click="handleRecheck">已授权？点此重新检测</button>
    </div>
  </div>
</template>
