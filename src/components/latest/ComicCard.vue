<script setup>
import { ref, onMounted } from 'vue'
import { jmApi } from '@/api/JmcomicApi.js'
import { lazyLoader } from '@/components/general/LazyLoader.js'

const props = defineProps({
  comic: { type: Object, required: true },
})

const coverRef = ref(null)
const coverUrl = jmApi.getCoverImageURL(props.comic.id)
const DEFAULT_COVER = '/image/cover_default.jpg'

onMounted(() => {
  if (coverRef.value) lazyLoader.addCover(coverRef.value)
})

function onImgError(e) {
  // 防止无限循环（占位图也失败）
  if (e.target.src.includes('cover_default')) return
  e.target.src = DEFAULT_COVER
}
</script>

<template>
  <RouterLink class="comic-item" :to="`/chapter/${comic.id}`">
    <span class="cover" ref="coverRef" :data-src="coverUrl">
      <img alt="封面" @error="onImgError" />
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
