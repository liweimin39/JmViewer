<script setup>
import { ref, computed, onMounted } from 'vue'
import AuthForms from '@/components/user/AuthForms.vue'
import UserProfile from '@/components/user/UserProfile.vue'
import LocalProfile from '@/components/user/LocalProfile.vue'
import { useUser } from '@/composables/useUser.js'
import { useLocalUser } from '@/composables/useLocalUser.js'
import '@/styles/user.css'

const { userInfo, refresh } = useUser()
const { currentUser, ready } = useLocalUser()

// 是否正在显示云端登录界面
const showCloudLogin = ref(false)

const mode = computed(() => {
  if (userInfo.value) return 'cloud'
  if (showCloudLogin.value) return 'cloud-login'
  return 'local'
})

function onCloudLoggedIn() {
  showCloudLogin.value = false
  refresh()
}

function onCloudLoggedOut() {
  refresh()
  // 云端登出 → 自动回本地
}

onMounted(() => {
  refresh()
})
</script>

<template>
  <div class="user-body">
    <!-- 云端已登录 -->
    <UserProfile v-if="mode === 'cloud'" :user-info="userInfo" @logged-out="onCloudLoggedOut" />

    <!-- 云端登录界面 -->
    <AuthForms
      v-else-if="mode === 'cloud-login'"
      @logged-in="onCloudLoggedIn"
      @cancel="showCloudLogin = false"
    />

    <!-- 默认：本地账号 -->
    <LocalProfile
      v-else-if="ready && currentUser"
      :user="currentUser"
      @show-cloud-login="showCloudLogin = true"
    />
  </div>
</template>
