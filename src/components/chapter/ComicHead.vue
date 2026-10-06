<script setup>
import { computed } from 'vue'
import { jmApi } from '@/api/JmcomicApi.js'
import ActionButtons from './ActionButtons.vue'

const props = defineProps({ album: { type: Object, required: true } })
const emit = defineEmits(['read', 'download-all'])

const coverUrl = computed(() => jmApi.getCoverImageURL(props.album.id))
const authorText = computed(() => (props.album.author || []).join(' & '))

// ★ 封面占位图
const DEFAULT_COVER = '/image/cover_default.jpg'

function onCoverError(e) {
  if (e.target.src.includes('cover_default')) return
  e.target.onerror = null
  e.target.src = DEFAULT_COVER
}
</script>

<template>
  <div class="head">
    <!-- 上半区：封面 + 漫画信息 + 开始阅读 -->
    <div class="head-main">
      <div class="cover">
        <img :src="coverUrl" alt="" @error="onCoverError" />
      </div>
      <div class="comic-info">
        <h1 class="title">{{ album.name }}</h1>
        <h2 class="author">{{ authorText }}</h2>
        <div class="detailed-info">
          <div class="tags">
            <RouterLink
              v-for="t in album.tags"
              :key="t"
              class="tag"
              :to="`/search?sq=${encodeURIComponent(t)}`"
              >{{ t }}</RouterLink
            >
          </div>
          <div class="latest"></div>
          <div class="introduction">{{ album.description }}</div>
        </div>

        <!-- 开始阅读放在漫画信息末尾 -->
        <div class="start-read" @click="emit('read')">开始阅读</div>
      </div>
    </div>

    <!-- 下半区：下载 + 收藏 + 追踪 -->
    <div class="head-actions">
      <div class="download-btn" @click="emit('download-all')">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>下载</span>
      </div>
      <ActionButtons :comic-id="album.id" />
    </div>
  </div>
</template>
