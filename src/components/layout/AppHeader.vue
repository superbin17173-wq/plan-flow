<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import ViewSwitcher from './ViewSwitcher.vue'
import StatsPanel from '../common/StatsPanel.vue'
import ThemeToggle from '../common/ThemeToggle.vue'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()

// 当前视图标题
const viewTitle = computed(() => {
  const d = dayjs(uiStore.selectedDate)
  switch (uiStore.currentView) {
    case 'month':
      return d.format('YYYY年MM月')
    case 'week': {
      const start = d.startOf('week')
      const end = d.endOf('week')
      return `${start.format('MM月DD日')} - ${end.format('MM月DD日')}`
    }
    case 'day':
      return d.format('YYYY年MM月DD日')
    default:
      return ''
  }
})

// 导航
function goPrev() {
  uiStore.goPrev()
}

function goNext() {
  uiStore.goNext()
}

function goToday() {
  uiStore.goToday()
}

// 新建任务
function openTaskForm() {
  uiStore.openTaskForm(undefined, uiStore.selectedDate)
}

// 搜索
function toggleSearch() {
  uiStore.toggleSearchPanel()
}

// 统计
function toggleStats() {
  uiStore.toggleStatsPanel()
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="app-title">PlanFlow</h1>
      <div class="nav-group">
        <button class="nav-btn" @click="goPrev">
          <span>‹</span>
        </button>
        <button class="nav-btn today" @click="goToday">今天</button>
        <button class="nav-btn" @click="goNext">
          <span>›</span>
        </button>
      </div>
      <span class="view-title">{{ viewTitle }}</span>
    </div>

    <div class="header-center">
      <ViewSwitcher />
    </div>

    <div class="header-right">
      <button class="action-btn" @click="openTaskForm" title="新建任务">
        <span>+</span>
      </button>
      <button class="action-btn" @click="toggleSearch" title="搜索">
        <span>🔍</span>
      </button>
      <button class="action-btn" @click="toggleStats" title="统计">
        <span>📊</span>
      </button>
      <ThemeToggle />
    </div>

    <!-- 统计面板 -->
    <StatsPanel v-if="uiStore.showStatsPanel" />
  </header>
</template>

<style scoped lang="scss">
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-work);
}

.nav-group {
  display: flex;
  gap: 4px;
}

.nav-btn {
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 16px;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover);
  }

  &.today {
    font-size: 14px;
    background: var(--color-work);
    color: white;

    &:hover {
      filter: brightness(1.1);
    }
  }
}

.view-title {
  font-size: 16px;
  color: var(--text-primary);
}

.header-center {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
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
    color: var(--color-work);
  }
}

@media (max-width: 768px) {
  .app-header {
    padding: 10px 12px;
  }

  .header-left {
    gap: 8px;
  }

  .app-title {
    font-size: 16px;
  }

  .view-title {
    display: none;
  }

  .header-center {
    order: 3;
    width: 100%;
    justify-content: center;
  }
}
</style>