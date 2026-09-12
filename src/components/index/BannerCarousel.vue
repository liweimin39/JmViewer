<script setup>
import { ref, onMounted } from 'vue'
import { BannerCarousel } from './BannerCarousel.js'
import { jmApi } from '@/api/JmcomicApi.js'
import { lazyLoader } from '@/components/general/LazyLoader.js'

const bannerRef = ref(null)
let carousel = null

// ★ 硬编码 banner 数据（原 BannerManager.bannerContent 照抄）
const bannerContent = [
  {
    large: [{ title: '', id: '1436985' }, { title: '', id: '1436983' }],
    small: ['1371700', '1436050', '345016', '1027519', '1220641', '1439051'],
  },
  {
    large: [{ title: '', id: '1433587' }, { title: '', id: '1263887' }],
    small: ['1426236', '1435722', '557728', '1435728', '1116808', '1437298'],
  },
  {
    large: [{ title: '', id: '1428159' }, { title: '', id: '1421773' }],
    small: ['1438246', '1436983', '1436682', '1292074', '1438891', '1143863'],
  },
]

const coverUrl = (id) => jmApi.getCoverImageURL(id)

onMounted(() => {
  carousel = new BannerCarousel(bannerRef.value)
  carousel.init()

  // 注册懒加载
  bannerRef.value.querySelectorAll('.cover').forEach((c) => lazyLoader.addCover(c))
})
</script>

<template>
  <div class="banner" ref="bannerRef">
    <div class="br-inner">
      <div
        v-for="(item, i) in bannerContent"
        :key="i"
        class="br-item"
        :class="{ active: i === 0 }"
      >
        <!-- 左侧大图 1 -->
        <div class="l-comic">
          <a class="cover" :data-src="coverUrl(item.large[0].id)" :href="`/chapter/${item.large[0].id}`">
            <img alt="cover" />
          </a>
        </div>
        <!-- 2 张小图 -->
        <div class="s-comic-cr">
          <div class="s-comic" v-for="(sid, si) in item.small.slice(0, 2)" :key="`s1-${si}`">
            <a class="cover" :data-src="coverUrl(sid)" :href="`/chapter/${sid}`">
              <img alt="cover" />
            </a>
          </div>
        </div>
        <!-- 中间大图 2 -->
        <div class="l-comic">
          <a class="cover" :data-src="coverUrl(item.large[1].id)" :href="`/chapter/${item.large[1].id}`">
            <img alt="cover" />
          </a>
        </div>
        <!-- 4 张小图 -->
        <div class="s-comic-cr w2">
          <div class="s-comic" v-for="(sid, si) in item.small.slice(2, 6)" :key="`s2-${si}`">
            <a class="cover" :data-src="coverUrl(sid)" :href="`/chapter/${sid}`">
              <img alt="cover" />
            </a>
          </div>
        </div>
      </div>
    </div>
    <div class="controls">
      <div class="l-btn">⇐</div>
      <div class="r-btn">⇒</div>
    </div>
  </div>
</template>