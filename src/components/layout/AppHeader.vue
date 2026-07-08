<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import ViewSwitcher from './ViewSwitcher.vue'
import StatsPanel from '../common/StatsPanel.vue'
import ThemeToggle from '../common/ThemeToggle.vue'
import SettingsPanel from '../common/SettingsPanel.vue'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()

const showSettings = ref(false)

// 当前视图标题
const viewTitle = computed(() => {
  const d = dayjs(uiStore.selectedDate)
  switch (uiStore.currentView) {
    case 'year':
      return d.format('YYYY年')
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

const themeIcon = computed(() => {
  switch (settingStore.settings.theme) {
    case 'light': return '☀️'
    case 'dark': return '🌙'
    case 'auto': return '🔄'
    default: return '☀️'
  }
})

function goPrev() { uiStore.goPrev() }
function goNext() { uiStore.goNext() }
function goToday() { uiStore.goToday() }

function openTaskForm() {
  uiStore.openTaskForm(undefined, uiStore.selectedDate)
}

function toggleSearch() { uiStore.toggleSearchPanel() }
function toggleStats() { uiStore.toggleStatsPanel() }

function handleMenuCommand(cmd: string) {
  switch (cmd) {
    case 'bulk': uiStore.openBulkDialog(); break
    case 'stats': toggleStats(); break
    case 'settings': showSettings.value = true; break
    case 'theme': settingStore.toggleTheme(); break
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="app-title">PlanFlow</h1>
      <div class="nav-group">
        <button class="nav-btn" @click="goPrev" aria-label="上一页">‹</button>
        <button class="nav-btn today" @click="goToday">今天</button>
        <button class="nav-btn" @click="goNext" aria-label="下一页">›</button>
      </div>
      <span class="view-title">{{ viewTitle }}</span>
    </div>

    <div class="header-center">
      <ViewSwitcher />
    </div>

    <div class="header-right">
      <!-- 移动端只显示: + 🔍 ⋯ ; 桌面端显示全部 -->
      <button class="action-btn" @click="openTaskForm" title="新建任务">
        <span>+</span>
      </button>
      <button class="action-btn" @click="toggleSearch" title="搜索">
        <span>🔍</span>
      </button>

      <!-- 桌面端才显示的按钮 -->
      <button class="action-btn desktop-only" @click="uiStore.openBulkDialog()" title="批量/导入">
        <span>📥</span>
      </button>
      <button class="action-btn desktop-only" @click="toggleStats" title="统计">
        <span>📊</span>
      </button>
      <button class="action-btn desktop-only" @click="showSettings = true" title="设置">
        <span>⚙️</span>
      </button>
      <ThemeToggle class="desktop-only" />

      <!-- 移动端才显示的溢出菜单 -->
      <ElDropdown class="mobile-only" trigger="click" @command="handleMenuCommand" placement="bottom-end">
        <button class="action-btn overflow-btn" title="更多">
          <span>⋯</span>
        </button>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="bulk">📥 批量 / 导入</ElDropdownItem>
            <ElDropdownItem command="stats">📊 统计</ElDropdownItem>
            <ElDropdownItem command="settings">⚙️ 设置</ElDropdownItem>
            <ElDropdownItem command="theme">{{ themeIcon }} 主题切换</ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>

    <StatsPanel v-if="uiStore.showStatsPanel" />
    <SettingsPanel v-model="showSettings" />
  </header>
</template>

<style scoped lang="scss">
// iOS 风格顶部导航
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #F2F2F7;
  border-bottom: 1px solid #E5E5EA;
  flex-wrap: nowrap;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  color: #007AFF;
  white-space: nowrap;
}

.nav-group {
  display: flex;
  gap: 4px;
}

.nav-btn {
  padding: 8px 14px;
  border-radius: 8px;
  background: transparent;
  color: #007AFF;
  font-size: 16px;
  transition: all 0.2s;
  white-space: nowrap;

  &:active { opacity: 0.7; }

  &.today {
    font-size: 15px;
    background: #007AFF;
    color: white;
    padding: 8px 16px;
    font-weight: 500;
  }
}

.view-title {
  font-size: 17px;
  font-weight: 600;
  color: #1A1A1A;
  white-space: nowrap;
}

.header-center {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: transparent;
  color: #007AFF;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:active {
    opacity: 0.6;
  }
}

.mobile-only { display: none; }
.desktop-only { display: flex; }

@media (max-width: 768px) {
  .app-header {
    padding: 10px 12px;
    gap: 6px;
    background: #F2F2F7;
  }

  .header-left { gap: 8px; }
  .app-title { display: none; }

  .view-title {
    display: block;
    font-size: 18px;
    font-weight: 600;
    color: #1A1A1A;
  }

  .nav-group { gap: 4px; }
  .nav-btn {
    padding: 6px 10px;
    font-size: 15px;

    &.today {
      font-size: 14px;
      padding: 7px 14px;
    }
  }

  .header-center {
    :deep(.view-switcher) {
      background: #FFFFFF;
      border-radius: 8px;
      padding: 2px;
    }
    :deep(.view-btn) {
      padding: 6px 12px;
      font-size: 14px;
      color: #1A1A1A;

      &.active {
        background: #007AFF;
        color: white;
      }
    }
  }

  .header-right { gap: 4px; }

  .action-btn {
    width: 34px;
    height: 34px;
    font-size: 16px;
    color: #007AFF;
  }

  .mobile-only { display: flex; }
  .desktop-only { display: none !important; }
}
</style>
