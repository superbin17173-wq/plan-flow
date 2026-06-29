<script setup lang="ts">
import { computed } from 'vue'
import { useSettingStore } from '../../stores/settingStore'

const settingStore = useSettingStore()

const themeIcon = computed(() => {
  switch (settingStore.settings.theme) {
    case 'light': return '☀️'
    case 'dark': return '🌙'
    case 'auto': return '🔄'
    default: return '☀️'
  }
})

const themeLabel = computed(() => {
  switch (settingStore.settings.theme) {
    case 'light': return '浅色'
    case 'dark': return '深色'
    case 'auto': return '自动'
    default: return '浅色'
  }
})

function toggleTheme() {
  settingStore.toggleTheme()
}
</script>

<template>
  <button class="theme-toggle" @click="toggleTheme" :title="`当前: ${themeLabel}`">
    <span class="theme-icon">{{ themeIcon }}</span>
  </button>
</template>

<style scoped lang="scss">
.theme-toggle {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover);
  }
}

.theme-icon {
  font-size: 18px;
}
</style>