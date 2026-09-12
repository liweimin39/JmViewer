<script setup>
import { ref } from 'vue'
import { setting } from './Setting.js'

const servers = ['图源1', '图源2', '图源3', '图源4', '图源5', '图源6']
const activeIndex = ref(Number(setting.using_imgserver_index) || 0)

function select(i) {
  activeIndex.value = i
  setting.setOption('using_imgserver_index', i)
}
</script>

<template>
  <div class="switch-server">
    <span>图源{{ activeIndex + 1 }}</span>
    <div class="sh-sr-cr">
      <div
        v-for="(n, i) in servers"
        :key="i"
        class="server-name"
        :class="{ active: i === activeIndex }"
        @click="select(i)"
      >{{ n }}</div>
    </div>
  </div>
</template>