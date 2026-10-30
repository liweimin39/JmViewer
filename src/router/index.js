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
    {
      path: '/about',
      name: 'about',
      component: () => import('@/components/setting/AboutView.vue'),
    },
    { path: '/user', name: 'user', component: () => import('@/views/UserView.vue') },
    { path: '/chapter/:id', name: 'chapter', component: () => import('@/views/ChapterView.vue') },
    { path: '/downloads', name: 'downloads', component: () => import('@/views/DownloadsView.vue') },
    { path: '/offline', name: 'offline', component: () => import('@/views/OfflineView.vue') },
    {
      path: '/offline/chapter/:id',
      name: 'offline-chapter',
      component: () => import('@/views/OfflineChapterView.vue'),
    },
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
    {
      path: '/setting/ReaderSettings',
      name: 'setting-reader',
      component: () => import('@/components/setting/ReaderSettings.vue'),
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

export default router
