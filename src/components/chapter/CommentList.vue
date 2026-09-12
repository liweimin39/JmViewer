<script setup>
import { ref, onMounted } from 'vue'
import { jmApi } from '@/api/JmcomicApi.js'

const props = defineProps({ album: { type: Object, required: true } })
const comments = ref([])

onMounted(async () => {
  try {
    const data = await jmApi.getComicComments(props.album.id, 0)
    if (Array.isArray(data)) comments.value = data
  } catch (e) {
    console.warn('加载评论失败:', e)
  }
})
</script>

<template>
  <div class="comment">
    <h1>评论({{ album.comment_total || 0 }})：</h1>
    <div class="comment-inner">
      <div v-for="(c, i) in comments" :key="i" class="comment-item">
        <div class="user-head">
          <img :src="jmApi.getUserPhotoURL(c.photo)" alt="head" />
        </div>
        <div class="user-info">
          <h2>{{ c.username }}</h2>
          <!-- ★ 修复：用 v-html 渲染 HTML 内容，与原代码 innerHTML 行为一致 -->
          <p class="comment-text" v-html="c.content"></p>
        </div>
      </div>
    </div>
    <div class="comment-lock">已锁定</div>
  </div>
</template>