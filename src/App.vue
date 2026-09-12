<script setup>
import NavBar from '@/components/general/NavBar.vue'
import SwitchServerBtn from '@/components/general/SwitchServerBtn.vue'
</script>

<template>
  <div class="root">
    <NavBar />
    <SwitchServerBtn />
    <RouterView />
  </div>
</template>