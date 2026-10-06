<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const drawerOpen = ref(false)
const drawerDisplay = ref('none') // 控制 display: none / block
const keyword = ref('')
const userName = ref('登录')

const navItems = [
  { name: '主页', to: '/' },
  { name: '最新', to: '/latest' },
  { name: '分类', to: '/categories' },
  { name: '下载', to: '/downloads' },
  { name: '设置', to: '/setting' },
]

// ---- 抽屉开合：用两步动画还原原 CSS 过渡 ----
function openDrawer() {
  drawerDisplay.value = 'block'
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      drawerOpen.value = true
    }),
  )
}
function closeDrawer() {
  drawerOpen.value = false
  setTimeout(() => {
    drawerDisplay.value = 'none'
  }, 400) // 与 CSS transition 时间对齐
}

function onSearch() {
  const v = keyword.value.trim()
  if (!v) return
  router.push({ name: 'search', query: { sq: v } })
  keyword.value = ''
  closeDrawer()
}

function isActive(to) {
  return to !== null && route.path === to
}

onMounted(() => {
  const info = localStorage.getItem('userInfo')
  if (info) {
    try {
      userName.value = JSON.parse(info).username || '登录'
    } catch {}
  }
})
</script>

<template>
  <nav class="nav">
    <div class="page-list-btn" @click="openDrawer">
      <div class="btn-inner"></div>
      <div class="btn-inner"></div>
      <div class="btn-inner"></div>
    </div>
    <div class="logo">JmViewer</div>
    <div class="search">
      <form @submit.prevent="onSearch">
        <input type="search" placeholder="搜索" v-model="keyword" />
      </form>
    </div>
  </nav>

  <nav
    class="mob-nav"
    :class="{ show: drawerOpen }"
    :style="{ display: drawerDisplay }"
    @click.self="closeDrawer"
  >
    <div class="mn-inner">
      <div class="mn-items-cr">
        <RouterLink
          v-for="(item, i) in navItems"
          :key="i"
          class="mn-item"
          :class="{ active: isActive(item.to) }"
          :to="item.to || route.fullPath"
          @click="item.to && closeDrawer()"
          >{{ item.name }}</RouterLink
        >
        <RouterLink
          class="mn-item user-nav-link"
          :class="{ active: route.path === '/user' }"
          to="/user"
          @click="closeDrawer()"
        >
          <span>{{ userName }}</span>
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
