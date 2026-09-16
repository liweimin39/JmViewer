<script setup>
import { useRoute } from 'vue-router'
import NavBar from '@/components/general/NavBar.vue'
import SwitchServerBtn from '@/components/general/SwitchServerBtn.vue'

const route = useRoute()
</script>

<template>
  <div class="root" :class="`page-${route.name || 'unknown'}`">
    <NavBar />
    <SwitchServerBtn />
    <RouterView />
  </div>
</template>
