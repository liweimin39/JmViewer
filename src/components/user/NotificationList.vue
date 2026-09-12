<script setup>
const props = defineProps({
  type: { type: String, required: true },
  list: { type: Array, required: true },
  total: { type: Number, default: 0 },
  unread: { type: Number, default: 0 },
})
const emit = defineEmits(['change-type'])

const typeOptions = [
  { key: 'all', label: '全部' },
  { key: 'comic_follow', label: '漫画更新' },
  { key: 'site_notice', label: '系统公告' },
]

function typeLabel(t) {
  return t === 'comic_follow' ? '漫画更新' : '系统公告'
}
</script>

<template>
  <div class="notif-types">
    <span
      v-for="opt in typeOptions"
      :key="opt.key"
      class="notif-type-btn"
      :class="{ active: type === opt.key }"
      @click="emit('change-type', opt.key)"
    >{{ opt.label }}</span>
  </div>

  <div class="notif-stats">共 {{ total }} 条通知，未读 {{ unread }} 条</div>

  <div class="notif-list">
    <div v-if="list.length === 0" class="notif-empty">
      <p>暂无通知</p>
    </div>

    <div
      v-for="(item, i) in list"
      :key="i"
      class="notif-item"
      :class="(item.read || item.is_read) ? 'read' : 'unread'"
    >
      <div class="notif-header">
        <span class="notif-type-tag">{{ typeLabel(item.type) }}</span>
        <span class="notif-status">{{ (item.read || item.is_read) ? '已读' : '未读' }}</span>
        <span class="notif-date">{{ item.date || '' }}</span>
      </div>
      <div class="notif-title" v-if="item.title">{{ item.title }}</div>
      <div class="notif-body">
        <!-- 漫画更新 -->
        <template v-if="item.type === 'comic_follow' && Array.isArray(item.content)">
          <div v-for="(up, ui) in item.content" :key="ui" class="notif-comic-update">
            <a :href="`/chapter/${up.comicId}`" class="notif-comic-link">
              {{ up.comicTitle || '未知漫画' }}
            </a>
            <span class="notif-update-date">更新于 {{ up.updateDate || item.date }}</span>
          </div>
        </template>
        <!-- 系统公告：内容是 HTML 字符串，用 v-html（原代码也是直接 innerHTML） -->
        <template v-else-if="item.type === 'site_notice'">
          <div class="notif-site-content" v-html="item.content || ''"></div>
        </template>
        <!-- 兜底 -->
        <template v-else>
          <div class="notif-content">
            {{ typeof item.content === 'string' ? item.content : JSON.stringify(item.content || '') }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>