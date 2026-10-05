<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const containerRef = ref(null)
const tags = [
  '中出',
  '巨乳',
  '福瑞',
  '无修正',
  '全彩',
  '百合',
  '白虎',
  '黑丝',
  '萝莉',
  '白丝',
  'cosplay',
  '更多',
]
const visible = ref(tags.map(() => true))

function updateVisibility() {
  const dom = containerRef.value
  if (!dom) return
  const w = dom.offsetWidth < 500 ? 75 : 90
  let count = Math.floor(dom.offsetWidth / w)
  if (count > tags.length) count = tags.length
  const threshold = tags.length - count
  visible.value = tags.map((_, i) => i >= threshold)
}

function onTagClick(tag) {
  if (tag === '更多') {
    router.push('/categories')
  } else {
    router.push({ name: 'search', query: { sq: tag } })
  }
}

let onResize
onMounted(() => {
  updateVisibility()
  onResize = () => updateVisibility()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="tag-cr" ref="containerRef">
    <div
      v-for="(tag, i) in tags"
      :key="i"
      class="tag-item"
      :style="{ display: visible[i] ? 'block' : 'none' }"
      @click="onTagClick(tag)"
    >
      {{ tag }}
    </div>
  </div>
</template>
