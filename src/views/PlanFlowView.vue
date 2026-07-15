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
// iOS PlanFlow 主视图
.planflow-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.main-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  background: var(--bg-primary);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-tertiary);
  font-size: var(--font-size-sub);
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--separator);
  border-top-color: var(--ios-blue);
  border-radius: 50%;
  animation: spin 0.85s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .main-content { padding: 12px; }
}

// iOS 通知式 Toast
.reminder-toast {
  position: fixed;
  top: calc(80px + var(--safe-top));
  right: 20px;
  background: var(--material-thick);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 2000;
  cursor: pointer;
  max-width: 340px;
  color: var(--text-primary);
  border: 0.5px solid var(--separator);

  .toast-icon { font-size: 26px; }
  .toast-content { flex: 1; min-width: 0; }
  .toast-title {
    font-size: var(--font-size-callout);
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .toast-time {
    font-size: var(--font-size-sub);
    color: var(--text-tertiary);
    margin-top: 3px;
  }
  .toast-close {
    background: transparent;
    color: var(--text-tertiary);
    font-size: 22px;
    line-height: 1;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    cursor: pointer;
  }
}

.toast-enter-active, .toast-leave-active {
  transition: all 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-24px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

@media (max-width: 768px) {
  .reminder-toast {
    left: 12px;
    right: 12px;
    top: calc(72px + var(--safe-top));
    max-width: none;
    border-radius: var(--radius-md);
  }
}
</style>
