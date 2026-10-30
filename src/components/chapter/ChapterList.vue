<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  series: { type: Array, default: () => [] },
  currentId: { type: [String, Number], required: true },
  // 在线页默认 /chapter/，离线页传 /offline/chapter/
  routePrefix: { type: String, default: '/chapter/' },
})
const router = useRouter()

const innerRef = ref(null)

/** 把当前阅读章节滚动到列表可视区中部 */
function locateCurrent() {
  const inner = innerRef.value
  if (!inner) return
  const active = inner.querySelector('.cl-item.active')
  if (!active) return
  const innerRect = inner.getBoundingClientRect()
  const itemRect = active.getBoundingClientRect()
  const offset = itemRect.top - innerRect.top - (inner.clientHeight - itemRect.height) / 2
  inner.scrollTop = Math.max(inner.scrollTop + offset, 0)
}

function go(item) {
  if (String(item.id) === String(props.currentId)) return
  router.push(`${props.routePrefix}${item.id}`)
}

onMounted(() => {
  nextTick(locateCurrent)
})

watch(
  () => [props.currentId, props.series],
  () => {
    nextTick(locateCurrent)
  },
)
</script>

<template>
  <div v-if="series.length > 1" class="chapter-list-cr">
    <h1 class="cl-title">章节列表</h1>
    <div class="chapter-list-inner" ref="innerRef">
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
