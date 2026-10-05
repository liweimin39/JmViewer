<script setup>
import { ref } from 'vue'
import { userApi } from '@/api/UserApi.js'

const props = defineProps({
  type: { type: String, required: true },
  list: { type: Array, required: true },
  total: { type: Number, default: 0 },
  unread: { type: Number, default: 0 },
})

const emit = defineEmits(['change-type', 'updated'])

const typeOptions = [
  { key: 'all', label: '全部' },
  { key: 'comic_follow', label: '漫画更新' },
  { key: 'site_notice', label: '系统公告' },
]

const markingId = ref(null) // 正在处理的通知 ID

function typeLabel(t) {
  return t === 'comic_follow' ? '漫画更新' : '系统公告'
}

// 兼容不同的 id 字段名
function getItemId(item) {
  return item?.id ?? item?.notificationId ?? item?.nid ?? null
}

function isRead(item) {
  return !!(item?.read || item?.is_read)
}

async function handleToggleRead(item) {
  const id = getItemId(item)
  if (!id) {
    alert('无法操作：该通知缺少 ID')
    return
  }
  if (markingId.value) return // 防止重复点击

  const wasRead = isRead(item)
  const newRead = !wasRead

  markingId.value = id
  try {
    await userApi.markNotificationRead(id, newRead)
    // 通知父组件更新本地状态
    emit('updated', { id, read: newRead })
  } catch (e) {
    console.error('标记通知失败:', e)
    alert('操作失败：' + (e?.message || '未知错误'))
  } finally {
    markingId.value = null
  }
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
      >{{ opt.label }}</span
    >
  </div>

  <div class="notif-stats">共 {{ total }} 条通知，未读 {{ unread }} 条</div>

  <div class="notif-list">
    <div v-if="list.length === 0" class="notif-empty">
      <p>暂无通知</p>
    </div>

    <div
      v-for="(item, i) in list"
      :key="getItemId(item) || i"
      class="notif-item"
      :class="isRead(item) ? 'read' : 'unread'"
    >
      <div class="notif-header">
        <span class="notif-type-tag">{{ typeLabel(item.type) }}</span>
        <span class="notif-status">{{ isRead(item) ? '已读' : '未读' }}</span>
        <span class="notif-date">{{ item.date || '' }}</span>
      </div>

      <div class="notif-title" v-if="item.title">{{ item.title }}</div>

      <div class="notif-body">
        <template v-if="item.type === 'comic_follow' && Array.isArray(item.content)">
          <div v-for="(up, ui) in item.content" :key="ui" class="notif-comic-update">
            <a :href="`/chapter/${up.comicId}`" class="notif-comic-link">
              {{ up.comicTitle || '未知漫画' }}
            </a>
            <span class="notif-update-date">更新于 {{ up.updateDate || item.date }}</span>
          </div>
        </template>
        <template v-else-if="item.type === 'site_notice'">
          <div class="notif-site-content" v-html="item.content || ''"></div>
        </template>
        <template v-else>
          <div class="notif-content">
            {{
              typeof item.content === 'string' ? item.content : JSON.stringify(item.content || '')
            }}
          </div>
        </template>
      </div>

      <!-- ★ 标记已读/未读 按钮 -->
      <div class="notif-actions">
        <button
          class="notif-mark-btn"
          :disabled="markingId === getItemId(item)"
          @click="handleToggleRead(item)"
        >
          {{ markingId === getItemId(item) ? '处理中...' : isRead(item) ? '标记未读' : '标记已读' }}
        </button>
      </div>
    </div>
  </div>
</template>
