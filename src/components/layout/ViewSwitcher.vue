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
  display: inline-flex;
  gap: 0;
  padding: 2px;
  border-radius: 9px;
  background: var(--bg-fill-quaternary);
}

.view-btn {
  padding: 6px 14px;
  min-width: 40px;
  border-radius: 7px;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  font-weight: 500;
  transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.25s;
  border: none;
  cursor: pointer;

  &.active {
    background: var(--bg-card);
    color: var(--text-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    font-weight: 600;
  }
}

.dark .view-btn.active { background: var(--bg-elevated); }
</style>
