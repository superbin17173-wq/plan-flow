<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
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
const router = useRouter()

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
    case 'plans': router.push('/plans'); break
    case 'stats': toggleStats(); break
    case 'settings': showSettings.value = true; break
    case 'theme': settingStore.toggleTheme(); break
  }
}

function goPlans() { router.push('/plans') }
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
      <button class="action-btn desktop-only" @click="goPlans" title="计划与模板">
        <span>🗂</span>
      </button>
      <button class="action-btn desktop-only" @click="toggleStats" title="统计">
        <span>📊</span>
      </button>

      <!-- 移动端也显示的常用按钮 -->
      <button class="action-btn" @click="showSettings = true" title="设置">
        <span>⚙️</span>
      </button>
      <ThemeToggle />

      <!-- 移动端才显示的溢出菜单 -->
      <ElDropdown class="mobile-only" trigger="click" @command="handleMenuCommand" placement="bottom-end">
        <button class="action-btn overflow-btn" title="更多">
          <span>⋯</span>
        </button>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="bulk">📥 批量 / 导入</ElDropdownItem>
            <ElDropdownItem command="plans">🗂 计划与模板</ElDropdownItem>
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
// iOS 毛玻璃顶部导航
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px calc(10px + var(--safe-top, 0px));
  padding-top: calc(10px + var(--safe-top, 0px));
  background: var(--material-regular);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  border-bottom: 0.5px solid var(--separator);
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
  font-size: var(--font-size-title3);
  font-weight: 700;
  color: var(--ios-blue);
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.nav-group {
  display: flex;
  gap: 2px;
  align-items: center;
}

.nav-btn {
  padding: 7px 12px;
  min-width: 34px;
  border-radius: 9px;
  background: transparent;
  color: var(--ios-blue);
  font-size: 17px;
  font-weight: 500;
  transition: background var(--transition-fast), transform var(--spring);
  white-space: nowrap;
  border: none;
  cursor: pointer;

  &:hover { background: var(--bg-hover); }
  &:active { transform: scale(0.94); background: var(--bg-pressed); }

  &.today {
    font-size: var(--font-size-sub);
    background: var(--ios-blue);
    color: #fff;
    padding: 7px 14px;
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 122, 255, 0.28);
  }
}

.view-title {
  font-size: var(--font-size-headline);
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.header-center {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: transparent;
  color: var(--ios-blue);
  font-size: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast), transform var(--spring);
  border: none;
  cursor: pointer;

  &:hover { background: var(--bg-hover); }
  &:active { transform: scale(0.9); background: var(--bg-pressed); }
}

.mobile-only { display: none; }
.desktop-only { display: flex; }

@media (max-width: 768px) {
  .app-header {
    padding: 8px 12px;
    gap: 6px;
  }

  .header-left { gap: 6px; }
  .app-title { display: none; }

  .view-title {
    display: block;
    font-size: var(--font-size-callout);
    font-weight: 600;
  }

  .nav-group { gap: 2px; }
  .nav-btn {
    padding: 6px 10px;
    font-size: 16px;

    &.today {
      font-size: 13px;
      padding: 6px 12px;
    }
  }

  .header-right { gap: 2px; }

  .action-btn {
    width: 32px;
    height: 32px;
    font-size: 15px;
  }

  .mobile-only { display: flex; }
  .desktop-only { display: none !important; }
}
</style>
