<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { useSettingStore } from './stores/settingStore'
import { useUiStore } from './stores/uiStore'
import OtaUpdate from './components/common/OtaUpdate.vue'
import { notifyAppReady } from './utils/otaUpdate'
import { initBaguQuestions } from './utils/baguInitializer'

const settingStore = useSettingStore()
const uiStore = useUiStore()
const router = useRouter()

onMounted(async () => {
  // 最先调用: 告诉 Capgo 插件 WebView 已启动,防止超时回滚(不等 DB 初始化)
  notifyAppReady()
  await settingStore.loadSettings()

  // 首次启动时导入八股文题库到知识库(幂等,不阻塞 UI)
  initBaguQuestions()

  // Android 硬件返回键处理
  if (Capacitor.isNativePlatform()) {
    const { App } = await import('@capacitor/app')
    App.addListener('backButton', () => {
      // 1. 先关闭所有浮层/弹窗
      if (uiStore.showTaskForm) { uiStore.closeTaskForm(); return }
      if (uiStore.showTaskCard) { uiStore.closeTaskCard(); return }
      if (uiStore.showSearchPanel) { uiStore.toggleSearchPanel(); return }
      if (uiStore.showStatsPanel) { uiStore.toggleStatsPanel(); return }
      if (uiStore.showBulkDialog) { uiStore.showBulkDialog = false; return }
      if (uiStore.showProfileDialog) { uiStore.showProfileDialog = false; return }
      if (uiStore.showMealLog) { uiStore.showMealLog = false; return }
      if (uiStore.showAiChat) { uiStore.closeAiChat(); return }

      // 2. 不在首页 → 返回上一页
      if (router.currentRoute.value.path !== '/') {
        router.back()
        return
      }

      // 3. 在首页 → 退出应用
      App.exitApp()
    })
  }
})
</script>

<template>
  <div class="app" :class="{ dark: settingStore.isDark() }">
    <RouterView />
    <OtaUpdate />
  </div>
</template>

<style lang="scss">
@use './styles/index.scss' as *;
@use './styles/calendar.scss' as *;
@use './styles/ios-theme.scss' as *;

.app {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: background 0.3s ease;
}
</style>
