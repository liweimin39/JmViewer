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
  <RouterLink class="comic-item" :to="`/chapter/${comic.id}`">
    <span
      class="cover"
      ref="coverRef"
      :data-src="jmApi.getCoverImageURL(comic.id)"
    >
      <img alt="封面" />
      <div class="tags"></div>
    </span>
    <h1 class="c-title">{{ comic.name }}</h1>
    <h2 class="c-sr-title">{{ comic.author }}</h2>
  </RouterLink>
</template>

<style scoped>
.comic-item {
  display: block;
  color: inherit;
  text-decoration: none;
}
</style>