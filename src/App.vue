<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingStore } from './stores/settingStore'
import OtaUpdate from './components/common/OtaUpdate.vue'

const settingStore = useSettingStore()

onMounted(async () => {
  await settingStore.loadSettings()
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
  background: #F2F2F7; // iOS 灰色背景
  color: #1A1A1A;

  &.dark {
    background: #1A1A1A;
    color: #FFFFFF;
  }
}
</style>
