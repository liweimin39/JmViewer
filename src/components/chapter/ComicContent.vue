<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { ComicImageLoader } from './ComicImageLoader.js'
import { ComicReadingProgress } from './ComicReadingProgress.js'
import { setting } from '@/components/general/Setting.js'

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

// ============ 全屏阅读模式 ============
const isReaderMode = ref(false)
const isHorizontal = ref(setting.reader_is_horizontal === 'on')
const imageWidth = ref(Number(setting.reader_image_width) || 100)
const showReaderSettings = ref(false)
const readerIndex = ref(0)

const totalImages = computed(() => props.chapter.images.length)

const readerPercent = computed(() => {
  const max = Math.max(totalImages.value - 1, 1)
  return (readerIndex.value / max) * 100
})

const readerStyle = computed(() =>
  isReaderMode.value && !isHorizontal.value ? { '--reader-img-width': imageWidth.value + '%' } : null,
)

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
    readerIndex.value = idx
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
  exitReader()
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
  readerIndex.value = 0
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

/* ---------------- 全屏阅读模式 ---------------- */

function enterReader() {
  if (isReaderMode.value) return
  readerIndex.value = progressIndex.value || 0
  isReaderMode.value = true
  showReaderSettings.value = false
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onReaderKeydown)
  nextTick(() => {
    if (isHorizontal.value) applyHorizontalPosition()
  })
}

function exitReader() {
  if (!isReaderMode.value) return
  isReaderMode.value = false
  showReaderSettings.value = false
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onReaderKeydown)
}

function onReaderKeydown(e) {
  if (e.key !== 'Escape' || !isReaderMode.value) return
  if (showReaderSettings.value) {
    showReaderSettings.value = false
    return
  }
  exitReader()
}

function toggleReaderSettings() {
  showReaderSettings.value = !showReaderSettings.value
}

function applyHorizontalPosition() {
  const el = imgCrRef.value
  if (!el) return
  const w = el.clientWidth || window.innerWidth
  el.scrollLeft = (readerIndex.value || 0) * w
}

function onHorizontalScroll() {
  if (!isReaderMode.value || !isHorizontal.value) return
  const el = imgCrRef.value
  if (!el) return
  const w = el.clientWidth || window.innerWidth
  if (!w) return
  const idx = Math.round(el.scrollLeft / w)
  if (idx >= 0 && idx < totalImages.value && idx !== readerIndex.value) {
    readerIndex.value = idx
  }
}

function onContainerClick(e) {
  if (!isReaderMode.value || !isHorizontal.value) return
  const el = imgCrRef.value
  if (!el) return
  const w = el.clientWidth || window.innerWidth
  scrollToPage(e.clientX < w / 2 ? -1 : 1)
}

function scrollToPage(delta) {
  const idx = readerIndex.value + delta
  if (idx < 0 || idx >= totalImages.value) return
  readerIndex.value = idx
  const el = imgCrRef.value
  const w = (el && el.clientWidth) || window.innerWidth
  if (el) el.scrollTo({ left: idx * w, behavior: 'smooth' })
}

function onWidthInput(e) {
  const value = e.target.value
  imageWidth.value = Number(value)
  setting.setOption('reader_image_width', value)
}

function onHorizontalChange(e) {
  const on = e.target.checked
  isHorizontal.value = on
  setting.setOption('reader_is_horizontal', on ? 'on' : 'off')
  if (on && isReaderMode.value) {
    nextTick(applyHorizontalPosition)
  }
}

defineExpose({ enterReader })
</script>

<template>
  <div class="comic-content-cr">
    <div class="cr-head">
      <span>图集（{{ loadedCount }}/{{ chapter.images.length }}）</span>
      <button class="reader-enter-btn" @click="enterReader">全屏阅读</button>
    </div>
    <div
      class="comic-img-cr"
      ref="imgCrRef"
      :class="{ 'fullscreen-reader': isReaderMode, 'reader-horizontal': isReaderMode && isHorizontal }"
      :style="readerStyle"
      @scroll.passive="onHorizontalScroll"
      @click="onContainerClick"
    >
      <div
        v-for="(path, i) in chapter.images"
        :key="i"
        class="comic-img"
        :data-path="path"
        :data-index="i"
        :data-local="chapter.localFiles?.[i]"
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

  <!-- 全屏阅读模式浮层 -->
  <Teleport v-if="isReaderMode" to="body">
    <div class="reader-exit-btn" @click="exitReader">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path
          d="M6.99486 7.00636C6.60433 7.39689 6.60433 8.03005 6.99486 8.42058L10.58 12.0057L6.99486 15.5909C6.60433 15.9814 6.60433 16.6146 6.99486 17.0051C7.38538 17.3956 8.01855 17.3956 8.40907 17.0051L11.9942 13.4199L15.5794 17.0051C15.9699 17.3956 16.6031 17.3956 16.9936 17.0051C17.3841 16.6146 17.3841 15.9814 16.9936 15.5909L13.4084 12.0057L16.9936 8.42059C17.3841 8.03007 17.3841 7.3969 16.9936 7.00638C16.603 6.61585 15.9699 6.61585 15.5794 7.00638L11.9942 10.5915L8.40907 7.00636C8.01855 6.61584 7.38538 6.61584 6.99486 7.00636Z"
          fill="#ffffff"
        />
      </svg>
    </div>

    <div class="reader-bottom-bar">
      <div class="reader-progress-cr">
        <div class="reader-progress-track">
          <div class="reader-progress-fill" :style="{ width: readerPercent + '%' }"></div>
        </div>
        <div class="reader-progress-text">{{ Math.min(readerIndex + 1, totalImages) }} / {{ totalImages }}</div>
      </div>
      <div class="reader-settings-btn" @click="toggleReaderSettings">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
          <path d="M4 8h16" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
          <path d="M4 16h16" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
          <circle cx="9" cy="8" r="2.6" fill="#ffffff" />
          <circle cx="15" cy="16" r="2.6" fill="#ffffff" />
        </svg>
      </div>
    </div>

    <div v-if="showReaderSettings" class="reader-settings-panel">
      <div class="reader-setting-item">
        <span>图片宽度</span>
        <div class="reader-setting-control">
          <input
            type="range"
            class="reader-width-slider"
            min="50"
            max="100"
            step="5"
            :value="imageWidth"
            :disabled="isHorizontal"
            @input="onWidthInput"
          />
          <span class="reader-width-label">{{ imageWidth }}%</span>
        </div>
      </div>
      <div class="reader-setting-item">
        <span>横向显示</span>
        <label class="reader-toggle">
          <input type="checkbox" :checked="isHorizontal" @change="onHorizontalChange" />
          <span class="reader-toggle-slider"></span>
        </label>
      </div>
    </div>
  </Teleport>
</template>
