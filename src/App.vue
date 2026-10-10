<script setup>
import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/general/NavBar.vue'
import SwitchServerBtn from '@/components/general/SwitchServerBtn.vue'
import { useBackButton } from '@/composables/useBackButton.js'
import { setting } from '@/components/general/Setting.js'

const route = useRoute()

useBackButton()

// 应用内切换主题即时生效（index.html 的同步脚本负责首屏防闪烁）
const THEMES = ['pink', 'blue', 'green', 'purple', 'gray', 'dark']
watchEffect(() => {
  const t = THEMES.includes(setting.app_theme) ? setting.app_theme : 'pink'
  document.documentElement.className = t + '-theme'
})
</script>

<template>
  <div class="root" :class="`page-${route.name || 'unknown'}`">
    <NavBar />
    <SwitchServerBtn />
    <RouterView />
  </div>
</template>
