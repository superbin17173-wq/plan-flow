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
  border: none;
  cursor: pointer;

  &:hover {
    background: var(--bg-hover);
  }

  &:active {
    transform: scale(0.95);
  }
}

.theme-icon {
  font-size: 18px;
}

@media (max-width: 768px) {
  .theme-toggle {
    width: 32px;
    height: 32px;
    border-radius: 6px;
  }

  .theme-icon {
    font-size: 16px;
  }
}
</style>