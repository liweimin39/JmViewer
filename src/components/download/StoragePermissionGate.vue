<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useStoragePermission } from '@/composables/useStoragePermission.js'

const emit = defineEmits(['granted', 'cancel'])

const { granted, checking, androidVersion, needsAllFilesAccess, check, request } =
  useStoragePermission()

let resumeHandler = null
let checkTimer = null

async function handleRequest() {
  await request()

  if (needsAllFilesAccess) {
    // 监听 App 从后台回到前台
    const { App: CapApp } = await import('@capacitor/app')

    // 清旧监听
    if (resumeHandler) {
      resumeHandler.remove()
      resumeHandler = null
    }

    resumeHandler = await CapApp.addListener('resume', async () => {
      // 用户从设置返回，延迟 500ms 再检测（等系统刷新）
      if (checkTimer) clearTimeout(checkTimer)
      checkTimer = setTimeout(async () => {
        const ok = await check()
        if (ok) {
          if (resumeHandler) {
            resumeHandler.remove()
            resumeHandler = null
          }
          emit('granted')
        }
      }, 500)
    })
  } else {
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
  if (checkTimer) {
    clearTimeout(checkTimer)
    checkTimer = null
  }
})
</script>

<template>
  <div class="perm-overlay">
    <div class="perm-panel">
      <h2>需要存储权限</h2>

      <p v-if="needsAllFilesAccess" class="perm-desc">
        Android {{ androidVersion }} 需要「所有文件访问」权限才能把漫画保存到
        <code>/storage/emulated/0/JmViewer/</code>
      </p>
      <p v-else class="perm-desc">需要「读写存储」权限才能把漫画保存到公共目录</p>

      <div class="perm-steps" v-if="needsAllFilesAccess">
        <p class="perm-steps-title">操作步骤：</p>
        <ol>
          <li>点击下方「去授权」按钮</li>
          <li>在跳转的页面找到 <strong>「允许管理所有文件」</strong> 开关</li>
          <li>打开开关</li>
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
