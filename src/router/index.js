import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/latest', name: 'latest', component: () => import('@/views/LatestView.vue') },
    { path: '/search', name: 'search', component: () => import('@/views/SearchView.vue') },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/views/CategoriesView.vue'),
    },
    { path: '/setting', name: 'setting', component: () => import('@/views/SettingView.vue') }, // ← 改动
    { path: '/user', name: 'user', component: () => import('@/views/UserView.vue') },
    { path: '/chapter/:id', name: 'chapter', component: () => import('@/views/ChapterView.vue') },
    { path: '/downloads', name: 'downloads', component: () => import('@/views/DownloadsView.vue') },
    {
      path: '/download/:albumId',
      name: 'download-detail',
      component: () => import('@/views/DownloadDetailView.vue'),
    },
    {
      path: '/setting/LocalDataSettings',
      name: 'setting-local-data',
      component: () => import('@/components/setting/LocalDataSettings.vue'),
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

export default router
