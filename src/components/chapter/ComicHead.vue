<script setup>
import { computed } from 'vue'
import { jmApi } from '@/api/JmcomicApi.js'
import ActionButtons from './ActionButtons.vue'

const props = defineProps({ album: { type: Object, required: true } })
const emit = defineEmits(['read'])

const coverUrl = computed(() => jmApi.getCoverImageURL(props.album.id))
const authorText = computed(() => (props.album.author || []).join(' & '))
</script>

<template>
  <div class="head">
    <div class="cover">
      <img :src="coverUrl" alt="" />
    </div>
    <div class="comic-info">
      <h1 class="title">{{ album.name }}</h1>
      <h2 class="author">{{ authorText }}</h2>
      <div class="detailed-info">
        <div class="tags">
          <RouterLink
            v-for="t in album.tags"
            :key="t"
            class="tag"
            :to="`/search?sq=${encodeURIComponent(t)}`"
            target="_blank"
          >{{ t }}</RouterLink>
        </div>
        <div class="latest"></div>
        <div class="introduction">{{ album.description }}</div>
      </div>
      <div class="actions">
        <div class="start-read" @click="emit('read')">开始阅读</div>
        <ActionButtons :comic-id="album.id" />
      </div>
    </div>
  </div>
</template>