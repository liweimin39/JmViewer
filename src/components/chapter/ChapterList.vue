<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  series: { type: Array, default: () => [] },
  currentId: { type: [String, Number], required: true },
})
const router = useRouter()

function go(item) {
  if (String(item.id) === String(props.currentId)) return
  router.push(`/chapter/${item.id}`)
}
</script>

<template>
  <div v-if="series.length > 1" class="chapter-list-cr">
    <h1 class="cl-title">章节列表</h1>
    <div class="chapter-list-inner">
      <div
        v-for="(item, i) in series"
        :key="item.id"
        class="cl-item"
        :class="{ active: String(item.id) === String(currentId) }"
        @click="go(item)"
      >{{ item.name || `第${i + 1}章` }}</div>
    </div>
  </div>
</template>