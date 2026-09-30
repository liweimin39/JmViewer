<script setup>
import { computed, onMounted } from 'vue'
import AuthForms from '@/components/user/AuthForms.vue'
import UserProfile from '@/components/user/UserProfile.vue'
import LocalProfile from '@/components/user/LocalProfile.vue'
import { useUser } from '@/composables/useUser.js'
import { useLocalUser } from '@/composables/useLocalUser.js'
import '@/styles/user.css'

const { userInfo, refresh } = useUser()
const { currentUser, ready } = useLocalUser()

const mode = computed(() => {
  if (userInfo.value) return 'cloud'
  if (currentUser.value) return 'local'
  return 'guest'
})

onMounted(() => {
  refresh()
})
</script>

<template>
  <div class="user-body">
    <UserProfile v-if="mode === 'cloud'" :user-info="userInfo" @logged-out="refresh" />

    <LocalProfile v-else-if="mode === 'local'" :user="currentUser" @logged-out="refresh" />

    <AuthForms v-else-if="ready" @logged-in="refresh" />
  </div>
</template>
