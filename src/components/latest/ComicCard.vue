<script setup>
import { ref, onMounted } from 'vue'
import { jmApi } from '@/api/JmcomicApi.js'
import { lazyLoader } from '@/components/general/LazyLoader.js'

const props = defineProps({
  comic: { type: Object, required: true },
})

const coverRef = ref(null)

onMounted(() => {
  if (coverRef.value) lazyLoader.addCover(coverRef.value)
})
</script>

<template>
  <div class="comic-item">
    <a
      class="cover"
      ref="coverRef"
      :data-src="jmApi.getCoverImageURL(comic.id)"
      :href="`/chapter/${comic.id}`"
      target="_blank"
    >
      <img alt="封面" />
      <div class="tags"></div>
    </a>
    <h1 class="c-title">{{ comic.name }}</h1>
    <h2 class="c-sr-title">{{ comic.author }}</h2>
  </div>
</template>