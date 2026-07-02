<script setup lang="ts">
import { useUiStore } from '../../stores/uiStore'

const uiStore = useUiStore()

const views = [
  { key: 'year', label: '年' },
  { key: 'month', label: '月' },
  { key: 'week', label: '周' },
  { key: 'day', label: '日' },
]

function setView(view: 'month' | 'week' | 'day' | 'year') {
  uiStore.setView(view)
}
</script>

<template>
  <div class="view-switcher">
    <button
      v-for="v in views"
      :key="v.key"
      class="view-btn"
      :class="{ active: uiStore.currentView === v.key }"
      @click="setView(v.key as any)"
    >
      {{ v.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.view-switcher {
  display: flex;
  gap: 4px;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 4px;
}

.view-btn {
  padding: 8px 16px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover);
  }

  &.active {
    background: var(--color-work);
    color: white;
  }
}
</style>