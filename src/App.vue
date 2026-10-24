<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/general/NavBar.vue'
import SwitchServerBtn from '@/components/general/SwitchServerBtn.vue'
import DisclaimerOverlay from '@/components/setting/DisclaimerOverlay.vue'
import { useBackButton } from '@/composables/useBackButton.js'
import { useDisclaimer } from '@/composables/useDisclaimer.js'

const route = useRoute()
const { maybeShow } = useDisclaimer()

useBackButton()

onMounted(() => {
  maybeShow()
})
</script>

<template>
  <div class="root" :class="`page-${route.name || 'unknown'}`">
    <NavBar />
    <SwitchServerBtn />
    <RouterView />
  </div>

  <DisclaimerOverlay />
</template>
