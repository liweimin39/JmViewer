<script setup>
import { onMounted } from 'vue'
import AuthForms from '@/components/user/AuthForms.vue'
import UserProfile from '@/components/user/UserProfile.vue'
import { useUser } from '@/composables/useUser.js'
import '@/styles/user.css'

const { userInfo, refresh } = useUser()

onMounted(() => {
  refresh()   // 首次挂载时从 localStorage 同步一次
})
</script>

<template>
  <div class="user-body">
    <AuthForms v-if="!userInfo" @logged-in="refresh" />
    <UserProfile v-else :user-info="userInfo" @logged-out="refresh" />
  </div>
</template>