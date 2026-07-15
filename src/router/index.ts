import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '我的项目' },
  },
  {
    path: '/planflow',
    name: 'planflow',
    component: () => import('../views/PlanFlowView.vue'),
    meta: { title: 'PlanFlow · 日历计划书' },
  },
  {
    path: '/ios',
    name: 'ios-calendar',
    component: () => import('../components/calendar/IosCalendarView.vue'),
    meta: { title: 'PlanFlow · iOS风格日历' },
  },
  {
    path: '/study-dashboard',
    name: 'study-dashboard',
    component: () => import('../views/StudyDashboardView.vue'),
    meta: { title: '学习仪表盘 · PlanFlow' },
  },
  {
    path: '/plans',
    name: 'plans',
    component: () => import('../views/PlansView.vue'),
    meta: { title: '计划与模板 · PlanFlow' },
  },
  {
    path: '/ui-preview',
    name: 'ui-preview',
    component: () => import('../views/UIStylePreview.vue'),
    meta: { title: 'UI风格预览 · PlanFlow' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = (to.meta?.title as string) || 'SuperBin'
  if (typeof document !== 'undefined') document.title = title
})

export default router
