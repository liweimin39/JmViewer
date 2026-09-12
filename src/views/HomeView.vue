<script setup>
import { ref, onMounted } from 'vue'
import BannerCarousel from '@/components/index/BannerCarousel.vue'
import TagBar from '@/components/index/TagBar.vue'
import RecommendationsSection from '@/components/index/RecommendationsSection.vue'
import { jmApi } from '@/api/JmcomicApi.js'

const sections = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const data = await jmApi.getPromotionContent()
    sections.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error('推荐内容加载失败:', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <BannerCarousel />
  <TagBar />

  <div class="recommendations">
    <RecommendationsSection
      v-for="(s, i) in sections"
      :key="s.slug || i"
      :section="s"
    />
  </div>
</template>

<style>
/* index 页专用样式，用全局导入 */
@import '@/styles/index.css';
</style>