<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingStore } from './stores/settingStore'
import OtaUpdate from './components/common/OtaUpdate.vue'
import { notifyAppReady } from './utils/otaUpdate'

const settingStore = useSettingStore()

onMounted(async () => {
  await settingStore.loadSettings()
  // 通知 OTA 插件当前 bundle 启动成功,防止被自动回滚
  await notifyAppReady()
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
