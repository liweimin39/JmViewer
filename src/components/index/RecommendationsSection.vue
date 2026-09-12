<script setup>
import { ref, onMounted } from 'vue'
import { SectionCarousel } from './SectionCarousel.js'
import { jmApi } from '@/api/JmcomicApi.js'
import { lazyLoader } from '@/components/general/LazyLoader.js'

const props = defineProps({
  section: { type: Object, required: true },
})

const secRef = ref(null)
let carousel = null

function displayTitle(t) {
  return t.length > 10 ? t.substring(0, 4) : t
}
const coverUrl = (id) => jmApi.getCoverImageURL(id)

onMounted(() => {
  carousel = new SectionCarousel()
  carousel.init(secRef.value)
  secRef.value.querySelectorAll('.cover').forEach((c) => lazyLoader.addCover(c))
})
</script>

<template>
  <div class="section">
    <div class="s-title">
      <span>{{ displayTitle(section.title) }}</span>
      <h2 class="s-sr-title">{{ section.slug }}</h2>
    </div>
    <div class="sec-comics" ref="secRef">
      <div class="sc-inner">
        <div class="comic-item" v-for="(c, i) in section.content" :key="i">
          <a class="cover" :data-src="coverUrl(c.id)" :href="`/chapter/${c.id}`">
            <img alt="封面" />
            <div class="tags"></div>
          </a>
          <h1 class="c-title">{{ c.name }}</h1>
          <h2 class="c-sr-title">{{ c.author }}</h2>
        </div>
      </div>
    </div>
    <div class="controls">
      <div class="l-btn">⇐</div>
      <div class="r-btn">⇒</div>
    </div>
  </div>
</template>