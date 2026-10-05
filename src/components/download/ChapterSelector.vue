<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps({
  series: { type: Array, required: true },
  currentChapterId: { type: [String, Number], default: null },
  albumName: { type: String, default: '' },
})

const emit = defineEmits(['confirm', 'close'])

const selectedIds = ref(new Set())
const searchText = ref('')

const filteredSeries = computed(() => {
  if (!searchText.value.trim()) return props.series
  const kw = searchText.value.trim().toLowerCase()
  return props.series.filter(
    (ch) => (ch.name || '').toLowerCase().includes(kw) || String(ch.id).includes(kw),
  )
})

const allSelected = computed(
  () =>
    filteredSeries.value.length > 0 &&
    filteredSeries.value.every((ch) => selectedIds.value.has(ch.id)),
)

function toggle(chapterId) {
  const set = new Set(selectedIds.value)
  if (set.has(chapterId)) set.delete(chapterId)
  else set.add(chapterId)
  selectedIds.value = set
}

function selectAll() {
  const set = new Set(selectedIds.value)
  for (const ch of filteredSeries.value) set.add(ch.id)
  selectedIds.value = set
}

function deselectAll() {
  const set = new Set(selectedIds.value)
  for (const ch of filteredSeries.value) set.delete(ch.id)
  selectedIds.value = set
}

function selectCurrent() {
  if (props.currentChapterId) {
    const set = new Set(selectedIds.value)
    set.add(props.currentChapterId)
    selectedIds.value = set
  }
}

function handleConfirm() {
  const selected = props.series.filter((ch) => selectedIds.value.has(ch.id))
  if (selected.length === 0) {
    alert('请至少选择一个章节')
    return
  }
  emit('confirm', selected)
}

/** 定位到当前章节 */
function scrollToCurrent() {
  if (!props.currentChapterId) return
  const el = document.querySelector(`[data-chapter-id="${props.currentChapterId}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight')
    setTimeout(() => el.classList.remove('highlight'), 2000)
  }
}

onMounted(() => {
  // 默认选中当前章节
  if (props.currentChapterId) {
    selectedIds.value = new Set([props.currentChapterId])
  }
  setTimeout(scrollToCurrent, 300)
})
</script>

<template>
  <div class="chapter-selector-overlay" @click.self="emit('close')">
    <div class="chapter-selector-panel">
      <div class="cs-header">
        <h3>选择下载章节</h3>
        <button class="cs-close" @click="emit('close')">✕</button>
      </div>

      <!-- 搜索 -->
      <div class="cs-search">
        <input type="text" v-model="searchText" placeholder="搜索章节..." />
      </div>

      <!-- 快捷操作 -->
      <div class="cs-actions">
        <button class="cs-action-btn" @click="selectAll">全选</button>
        <button class="cs-action-btn" @click="deselectAll">全不选</button>
        <button class="cs-action-btn" @click="selectCurrent">当前章节</button>
      </div>

      <!-- 章节列表 -->
      <div class="cs-list">
        <div
          v-for="(ch, i) in filteredSeries"
          :key="ch.id"
          class="cs-item"
          :class="{
            selected: selectedIds.has(ch.id),
            current: String(ch.id) === String(currentChapterId),
          }"
          :data-chapter-id="ch.id"
          @click="toggle(ch.id)"
        >
          <div class="cs-checkbox">
            <svg
              v-if="selectedIds.has(ch.id)"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div class="cs-item-info">
            <span class="cs-item-name">{{ ch.name || `第${i + 1}章` }}</span>
            <span v-if="String(ch.id) === String(currentChapterId)" class="cs-current-tag"
              >当前</span
            >
          </div>
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="cs-footer">
        <span class="cs-count">已选 {{ selectedIds.size }} / {{ series.length }} 章</span>
        <button class="cs-confirm-btn" @click="handleConfirm">
          开始下载 ({{ selectedIds.size }})
        </button>
      </div>
    </div>
  </div>
</template>
