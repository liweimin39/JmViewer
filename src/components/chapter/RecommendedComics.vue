<script setup>
import { jmApi } from '@/api/JmcomicApi.js'
defineProps({ list: { type: Array, default: () => [] } })

const DEFAULT_COVER = '/image/cover_default.jpg'

function onImgError(e) {
  if (e.target.src.includes('cover_default')) return
  e.target.src = DEFAULT_COVER
}
</script>

<template>
  <div class="recommended-comics">
    <h1 class="rc-title">更多漫画</h1>
    <div class="rc-cr">
      <RouterLink v-for="data in list" :key="data.id" class="rc-item" :to="`/chapter/${data.id}`">
        <div class="item-cover">
          <img :src="jmApi.getCoverImageURL(data.id)" alt="1" @error="onImgError" />
        </div>
        <div class="item-info">
          <h1 class="item-title">{{ data.name }}</h1>
          <h2 class="item-aname">{{ data.author }}</h2>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
