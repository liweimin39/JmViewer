<script setup>
import { computed, onMounted } from 'vue'
import AuthForms from '@/components/user/AuthForms.vue'
import UserProfile from '@/components/user/UserProfile.vue'
import LocalProfile from '@/components/user/LocalProfile.vue'
import { useUser } from '@/composables/useUser.js'
import { useLocalUser } from '@/composables/useLocalUser.js'
import '@/styles/user.css'

const { userInfo, refresh } = useUser()
const { localUser, localUserReady } = useLocalUser()

// 云端优先
const mode = computed(() => {
  if (userInfo.value) return 'cloud'
  if (localUser.value) return 'local'
  return 'guest'
})

onMounted(() => {
  refresh()
})
</script>

<template>
  <div class="user-body">
    <!-- 云端登录 -->
    <UserProfile v-if="mode === 'cloud'" :user-info="userInfo" @logged-out="refresh" />

    <!-- 本地账号 -->
    <LocalProfile v-else-if="mode === 'local'" :user="localUser" @logged-out="refresh" />

    <!-- 未登录 -->
    <AuthForms v-else-if="localUserReady" @logged-in="refresh" />
  </div>
</template>
