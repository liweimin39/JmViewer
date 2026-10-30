<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { setting } from '@/components/general/Setting.js'
import '@/styles/setting.css'

const router = useRouter()

// ---------- 返回 ----------
function goBack() {
  if (window.history.state && window.history.state.position > 0) {
    router.back()
  } else {
    router.push({ name: 'setting' })
  }
}

// ---------- 图片预加载边距 ----------
const rootMargin = ref(setting.root_margin)
const rootMarginOptions = ['0px', '50px', '100px', '200px', '500px', '1000px', '2000px'].map(
  (v) => ({ value: v, name: v }),
)

function pickRootMargin(value) {
  setting.setOption('root_margin', value)
  rootMargin.value = value
}

// ---------- 阅读图片宽度 ----------
const readerImageWidth = ref(setting.reader_image_width)
const readerWidthOptions = ['50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '100'].map(
  (v) => ({ value: v, name: v + '%' }),
)

function pickReaderWidth(value) {
  setting.setOption('reader_image_width', value)
  readerImageWidth.value = value
}

// ---------- 横向阅读 / 自动全屏 ----------
const readerHorizontal = ref(setting.reader_is_horizontal === 'on')
const readerFullscreen = ref(setting.auto_fullscreen_reader === 'on')

function pickReaderHorizontal(value) {
  setting.setOption('reader_is_horizontal', value)
  readerHorizontal.value = value === 'on'
}

function pickReaderFullscreen(value) {
  setting.setOption('auto_fullscreen_reader', value)
  readerFullscreen.value = value === 'on'
}
</script>

<template>
  <div class="setting-body">
    <!-- 返回栏 -->
    <div class="page-back-bar">
      <button class="page-back-btn" @click="goBack" aria-label="返回">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>返回</span>
      </button>
    </div>

    <h1 class="title">漫画阅读</h1>

    <div class="options">
      <!-- 图片预加载边距 -->
      <div class="option option-block">
        <div class="block-title">图片预加载边距</div>
        <p class="section-tip">边距越大，下方图片越早开始加载，流量与内存占用也越高</p>
        <div class="theme-list">
          <button
            v-for="o in rootMarginOptions"
            :key="o.value"
            class="theme-item"
            :class="{ active: rootMargin === o.value }"
            @click="pickRootMargin(o.value)"
          >
            <span>{{ o.name }}</span>
          </button>
        </div>
      </div>

      <!-- 阅读图片宽度 -->
      <div class="option option-block">
        <div class="block-title">阅读图片宽度</div>
        <p class="section-tip">全屏阅读时图片的显示宽度，可在阅读页内随时调整</p>
        <div class="theme-list">
          <button
            v-for="o in readerWidthOptions"
            :key="o.value"
            class="theme-item"
            :class="{ active: readerImageWidth === o.value }"
            @click="pickReaderWidth(o.value)"
          >
            <span>{{ o.name }}</span>
          </button>
        </div>
      </div>

      <!-- 横向阅读模式 -->
      <div class="option option-block">
        <div class="block-title">横向阅读模式</div>
        <p class="section-tip">开启后全屏阅读改为整屏横向滑动，点击左右半屏可翻页</p>
        <div class="theme-list">
          <button
            class="theme-item"
            :class="{ active: !readerHorizontal }"
            @click="pickReaderHorizontal('off')"
          >
            <span>关闭</span>
          </button>
          <button
            class="theme-item"
            :class="{ active: readerHorizontal }"
            @click="pickReaderHorizontal('on')"
          >
            <span>开启</span>
          </button>
        </div>
      </div>

      <!-- 自动全屏阅读 -->
      <div class="option option-block">
        <div class="block-title">自动全屏阅读</div>
        <p class="section-tip">开启后点击「开始阅读」直接进入全屏阅读模式</p>
        <div class="theme-list">
          <button
            class="theme-item"
            :class="{ active: !readerFullscreen }"
            @click="pickReaderFullscreen('off')"
          >
            <span>关闭</span>
          </button>
          <button
            class="theme-item"
            :class="{ active: readerFullscreen }"
            @click="pickReaderFullscreen('on')"
          >
            <span>开启</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
