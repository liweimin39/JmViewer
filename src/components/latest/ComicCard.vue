<script setup>
import { ref, computed, onMounted } from 'vue'
import { jmApi } from '@/api/JmcomicApi.js'
import { lazyLoader } from '@/components/general/LazyLoader.js'

const props = defineProps({
  comic: { type: Object, required: true },
})

const coverRef = ref(null)
const coverUrl = jmApi.getCoverImageURL(props.comic.id)

// 搜索结果可能是字符串，按 ID 命中的专辑详情是作者数组，统一转成文本
const authorText = computed(() => {
  const author = props.comic.author
  if (!author) return ''
  if (Array.isArray(author)) return author.filter(Boolean).join(' ')
  return String(author)
})
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
    <h2 class="c-sr-title">{{ authorText }}</h2>
  </RouterLink>
</template>

<style scoped>
.comic-item {
  display: block;
  color: inherit;
  text-decoration: none;
}
</style>
