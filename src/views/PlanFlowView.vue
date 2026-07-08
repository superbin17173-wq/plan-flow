<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useUiStore } from '../stores/uiStore'
import { useTaskStore } from '../stores/taskStore'
import { useSettingStore } from '../stores/settingStore'
import { useHealthStore } from '../stores/healthStore'
import { initReminderSystem, type ReminderToast } from '../utils/notification'
import AppHeader from '../components/layout/AppHeader.vue'
import MonthView from '../components/calendar/MonthView.vue'
import WeekView from '../components/calendar/WeekView.vue'
import DayView from '../components/calendar/DayView.vue'
import YearWeekView from '../components/calendar/YearWeekView.vue'
import TaskForm from '../components/task/TaskForm.vue'
import TaskCard from '../components/task/TaskCard.vue'
import SearchBar from '../components/common/SearchBar.vue'
import BulkTaskDialog from '../components/common/BulkTaskDialog.vue'
import ProfileDialog from '../components/common/ProfileDialog.vue'
import MealQuickLog from '../components/common/MealQuickLog.vue'
import ChatBubble from '../components/ai/ChatBubble.vue'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()
const healthStore = useHealthStore()

const reminderToast = ref<ReminderToast | null>(null)
const showToast = ref(false)

function handleReminder(reminders: ReminderToast[]) {
  if (reminders.length > 0) {
    reminderToast.value = reminders[0]
    showToast.value = true
    setTimeout(() => {
      showToast.value = false
    }, 5000)
  }
}

function closeToast() {
  showToast.value = false
}

onMounted(async () => {
  if (!settingStore.loaded) await settingStore.loadSettings()
  await taskStore.loadTasks()
  await healthStore.loadAll()
  initReminderSystem(handleReminder)
})

const currentViewComponent = computed(() => {
  switch (uiStore.currentView) {
    case 'year': return YearWeekView
    case 'month': return MonthView
    case 'week': return WeekView
    case 'day': return DayView
    default: return MonthView
  }
})

const loading = computed(() => taskStore.loading || !settingStore.loaded)
</script>

<template>
  <div class="planflow-view">
    <AppHeader />

    <main class="main-content">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>

      <component v-else :is="currentViewComponent" :key="uiStore.currentView" />
    </main>

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

    <ChatBubble />

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

<style lang="scss" scoped>
// iOS 风格 PlanFlow 主视图
.planflow-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #F2F2F7;
}

.main-content {
  flex: 1;
  padding: 16px;
  overflow: hidden;
  background: #F2F2F7;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: #8E8E93;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #E5E5EA;
  border-top-color: #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .main-content {
    padding: 12px;
  }
}

// iOS 风格提醒 Toast
.reminder-toast {
  position: fixed;
  top: 80px;
  right: 20px;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 2000;
  cursor: pointer;
  max-width: 320px;

  .toast-icon {
    font-size: 28px;
  }

  .toast-content {
    flex: 1;
  }

  .toast-title {
    font-size: 16px;
    font-weight: 600;
    color: #1A1A1A;
  }

  .toast-time {
    font-size: 14px;
    color: #8E8E93;
    margin-top: 4px;
  }
}

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
    left: 16px;
    right: 16px;
    top: 70px;
    max-width: none;
    border-radius: 12px;
  }
}
</style>
