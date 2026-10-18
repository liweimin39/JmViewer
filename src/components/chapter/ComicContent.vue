<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { ComicImageLoader } from './ComicImageLoader.js'
import { ComicReadingProgress } from './ComicReadingProgress.js'

const props = defineProps({
  chapter: { type: Object, required: true },
})

const imgCrRef = ref(null)
const progressRef = ref(null)
const progressInnerRef = ref(null)
const hotRef = ref(null)

const loadedCount = ref(0)
const progressIndex = ref(0)
const ready = ref(false)

let loader = null
let progress = null
let active = true

async function setup() {
  if (!active) return
  if (!imgCrRef.value || !progressRef.value) return

  loader = new ComicImageLoader(props.chapter.id)
  progress = new ComicReadingProgress({
    progressEl: progressRef.value,
    progressInnerEl: progressInnerRef.value,
    jmnianHotEl: hotRef.value,
    imageContainerEl: imgCrRef.value,
  })
  progress.init(props.chapter.images.length - 1)

  loader.onIndexUpdate = (idx) => {
    progressIndex.value = idx
    progress.setProgress(idx)
  }
  loader.onLoadedImage = (count) => {
    loadedCount.value = count
  }

  const containers = Array.from(imgCrRef.value.children)
  const batchSize = 15
  for (let i = 0; i < containers.length; i += batchSize) {
    setTimeout(() => {
      if (!active || !loader) return
      const end = Math.min(i + batchSize, containers.length)
      for (let j = i; j < end; j++) {
        loader.addImgCr(containers[j])
      }
    }, i * 80)
  }
}

async function teardown() {
  if (loader) {
    loader.destroy()
    loader = null
  }
  if (progress) {
    progress.destroy()
    progress = null
  }
  loadedCount.value = 0
  progressIndex.value = 0
}

onMounted(async () => {
  await nextTick()
  ready.value = true
  await nextTick()
  setup()
})

onBeforeUnmount(() => {
  active = false
  teardown()
})

watch(
  () => props.chapter.id,
  async () => {
    await teardown()
    await nextTick()
    setup()
  },
)
</script>

<template>
  <div class="comic-content-cr">
    <div class="cr-head">图集（{{ loadedCount }}/{{ chapter.images.length }}）</div>
    <div class="comic-img-cr" ref="imgCrRef">
      <div
        v-for="(path, i) in chapter.images"
        :key="i"
        class="comic-img"
        :data-path="path"
        :data-index="i"
      >
        <div class="img-placeholder">
          {{ path }}
        </div>
      </div>
    </div>
  </div>

  <!-- 进度条 + 装饰图：一起 sticky 粘在视口 -->
  <Teleport v-if="ready" to=".progress-slot">
    <div class="progress-cr">
      <div class="progress" ref="progressRef">
        <div class="progress-inner" ref="progressInnerRef">
          <span>←1</span>
        </div>
      </div>
      <div class="jmnian-looking">
        <img src="/image/looking.png" alt="looking" />
        <img src="/image/hot.png" alt="hot" class="jmnian-hot" ref="hotRef" />
      </div>
    </div>
  </Teleport>
</template>
