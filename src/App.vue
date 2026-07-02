<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useUiStore } from './stores/uiStore'
import { useTaskStore } from './stores/taskStore'
import { useSettingStore } from './stores/settingStore'
import { useHealthStore } from './stores/healthStore'
import { initReminderSystem, type ReminderToast } from './utils/notification'
import AppHeader from './components/layout/AppHeader.vue'
import MonthView from './components/calendar/MonthView.vue'
import WeekView from './components/calendar/WeekView.vue'
import DayView from './components/calendar/DayView.vue'
import YearWeekView from './components/calendar/YearWeekView.vue'
import TaskForm from './components/task/TaskForm.vue'
import TaskCard from './components/task/TaskCard.vue'
import SearchBar from './components/common/SearchBar.vue'
import BulkTaskDialog from './components/common/BulkTaskDialog.vue'
import ProfileDialog from './components/common/ProfileDialog.vue'
import MealQuickLog from './components/common/MealQuickLog.vue'
import ChatBubble from './components/ai/ChatBubble.vue'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()
const healthStore = useHealthStore()

// 提醒 Toast 状态
const reminderToast = ref<ReminderToast | null>(null)
const showToast = ref(false)

// 处理提醒
function handleReminder(reminders: ReminderToast[]) {
  if (reminders.length > 0) {
    reminderToast.value = reminders[0]
    showToast.value = true
    // 5秒后自动关闭
    setTimeout(() => {
      showToast.value = false
    }, 5000)
  }
}

// 关闭 Toast
function closeToast() {
  showToast.value = false
}

// 初始化
onMounted(async () => {
  await settingStore.loadSettings()
  await taskStore.loadTasks()
  await healthStore.loadAll()

  // 提醒系统始终运行,但仅对显式打开提醒的任务(task.remindAt 有值)才触发。
  // 全局 notificationsEnabled 现作为系统通知(浏览器 Notification)的开关,不影响应用内 Toast 提醒。
  initReminderSystem(handleReminder)
})

// 当前视图组件
const currentViewComponent = computed(() => {
  switch (uiStore.currentView) {
    case 'year': return YearWeekView
    case 'month': return MonthView
    case 'week': return WeekView
    case 'day': return DayView
    default: return MonthView
  }
})

// 加载状态
const loading = computed(() => taskStore.loading || !settingStore.loaded)
</script>

<template>
  <div class="app" :class="{ dark: settingStore.isDark() }">
    <!-- 头部 -->
    <AppHeader />

    <!-- 主内容 -->
    <main class="main-content">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>

      <component v-else :is="currentViewComponent" :key="uiStore.currentView" />
    </main>

    <!-- 弹窗组件 -->
    <TaskForm />
    <TaskCard />
    <SearchBar />
    <BulkTaskDialog
      :model-value="uiStore.showBulkDialog"
      @update:model-value="uiStore.showBulkDialog = $event"
    />
    <ProfileDialog
      :model-value="uiStore.showProfileDialog"
      @update:model-value="uiStore.showProfileDialog = $event"
    />
    <MealQuickLog
      :model-value="uiStore.showMealLog"
      @update:model-value="uiStore.showMealLog = $event"
    />

    <!-- AI 助手浮动按钮 -->
    <ChatBubble />

    <!-- 提醒 Toast -->
    <Transition name="toast">
      <div v-if="showToast && reminderToast" class="reminder-toast" @click="closeToast">
        <div class="toast-icon">🔔</div>
        <div class="toast-content">
          <div class="toast-title">{{ reminderToast.title }}</div>
          <div class="toast-time">{{ reminderToast.time }} 即将开始</div>
        </div>
        <button class="toast-close">×</button>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss">
@use './styles/index.scss' as *;
@use './styles/calendar.scss' as *;

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.main-content {
  flex: 1;
  padding: 16px;
  overflow: hidden;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-tertiary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-work);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .main-content {
    padding: 8px;
  }
}

// 提醒 Toast 样式
.reminder-toast {
  position: fixed;
  top: 80px;
  right: 20px;
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow-lg);
  border: 2px solid var(--color-work);
  z-index: 2000;
  cursor: pointer;
  max-width: 300px;

  .toast-icon {
    font-size: 24px;
  }

  .toast-content {
    flex: 1;
  }

  .toast-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .toast-time {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 4px;
  }

  .toast-close {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--bg-primary);
    color: var(--text-tertiary);
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: var(--bg-hover);
    }
  }
}

// Toast 动画
.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

@media (max-width: 768px) {
  .reminder-toast {
    left: 20px;
    right: 20px;
    top: 70px;
    max-width: none;
  }
}
</style>
