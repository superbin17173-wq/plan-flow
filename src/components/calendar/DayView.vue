<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import { timeToMinutes, minutesToTime, getTaskPosition, getConflictingTasks } from '../../utils/timeUtils'
import { useNow, isPastHour, isPastTime } from '../../composables/useNow'
import TaskBlock from './TaskBlock.vue'
import DayTimePie from './DayTimePie.vue'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()
const now = useNow()

// 当天任务
const dayTasks = computed(() => {
  return taskStore.getTasksByDate(uiStore.selectedDate)
})

// 小时列表 (0-23)
const hours = Array.from({ length: 24 }, (_, i) => i)

// 格式化小时显示
function formatHour(hour: number): string {
  if (settingStore.settings.timeFormat === '12h') {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour} ${period}`
  }
  return `${String(hour).padStart(2, '0')}:00`
}

// 点击时间槽创建任务
function handleTimeSlotClick(hour: number, e: MouseEvent) {
  if (isPastHour(uiStore.selectedDate, hour, now.value)) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  const minuteOffset = Math.floor((y / 60) * 60)
  const startMinutes = hour * 60 + minuteOffset
  const startTime = minutesToTime(startMinutes)
  const endTime = minutesToTime(Math.min(startMinutes + 60, 1440))
  uiStore.openTaskForm(undefined, uiStore.selectedDate, startTime)
}

// 判断某小时是否已过去
function hourIsPast(hour: number): boolean {
  return isPastHour(uiStore.selectedDate, hour, now.value)
}

// 判断某任务是否已结束
function taskIsPast(task: any): boolean {
  return isPastTime(uiStore.selectedDate, task.endTime, now.value)
}

// 计算任务重叠层级
function getOverlapIndex(task: any): number {
  const tasks = dayTasks.value.filter(t => !t.isCompleted)
  const conflicts = getConflictingTasks(tasks, task.startTime, task.endTime)
  const index = conflicts.findIndex(t => t.id === task.id)
  return index
}

// 拖拽状态
const draggingTask = ref<string | null>(null)

function handleDragStart(taskId: string) {
  draggingTask.value = taskId
}

function handleDragEnd() {
  draggingTask.value = null
}

// 返回上一视图
function goBack() {
  uiStore.goBack()
}

// 日期导航
function prevDay() {
  uiStore.goPrev()
}

function nextDay() {
  uiStore.goNext()
}

function goToday() {
  uiStore.goToday()
}

// 获取相对日期
function getRelativeDate(): string {
  const d = dayjs(uiStore.selectedDate)
  const today = dayjs()
  if (d.isSame(today, 'day')) return '今天'
  if (d.isSame(today.subtract(1, 'day'), 'day')) return '昨天'
  if (d.isSame(today.add(1, 'day'), 'day')) return '明天'
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekdays[d.day()]
}
</script>

<template>
  <div class="day-calendar">
    <!-- 日标题 -->
    <div class="day-header">
      <div class="nav-buttons">
        <button class="nav-btn" @click="goBack" title="返回">
          <span class="icon">←</span>
        </button>
        <button class="nav-btn" @click="prevDay" title="前一天">
          <span class="icon">‹</span>
        </button>
        <button class="nav-btn today-btn" @click="goToday" title="今天">
          今
        </button>
        <button class="nav-btn" @click="nextDay" title="后一天">
          <span class="icon">›</span>
        </button>
      </div>

      <div class="day-info">
        <div class="day-title">{{ dayjs(uiStore.selectedDate).format('YYYY年MM月DD日') }}</div>
        <div class="day-relative">{{ getRelativeDate() }}</div>
      </div>

      <button class="add-task-btn" @click="uiStore.openTaskForm(undefined, uiStore.selectedDate)">
        + 新建任务
      </button>
    </div>

    <!-- 时间统计圆饼图 -->
    <div class="time-stats">
      <DayTimePie
        :tasks="dayTasks"
        :sleep-start="settingStore.settings.sleepStartTime"
        :sleep-end="settingStore.settings.sleepEndTime"
      />
    </div>

    <!-- 日内容 -->
    <div class="day-body">
      <!-- 时间轴 -->
      <div class="time-axis">
        <div
          v-for="hour in hours"
          :key="hour"
          class="hour-label"
          :class="{ past: hourIsPast(hour) }"
        >
          {{ formatHour(hour) }}
        </div>
      </div>

      <!-- 任务区域 -->
      <div class="task-area">
        <!-- 小时网格 -->
        <div class="hour-grid">
          <div
            v-for="hour in hours"
            :key="hour"
            class="hour-slot"
            :class="{ past: hourIsPast(hour) }"
            @click="handleTimeSlotClick(hour, $event)"
          ></div>
        </div>

        <!-- 任务块 -->
        <TaskBlock
          v-for="task in dayTasks"
          :key="task.id"
          :task="task"
          :hour-height="60"
          :overlap-index="getOverlapIndex(task)"
          :is-dragging="draggingTask === task.id"
          :is-past="taskIsPast(task)"
          @drag-start="handleDragStart"
          @drag-end="handleDragEnd"
          @click="uiStore.openTaskCard(task.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
// iOS 风格日视图
.day-calendar {
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  border-radius: 12px;
  overflow-y: auto;
  max-height: calc(100vh - 100px);
}

.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #F2F2F7;
  border-bottom: 1px solid #E5E5EA;
}

.nav-buttons {
  display: flex;
  gap: 8px;
}

.nav-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: transparent;
  color: #007AFF;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active { opacity: 0.6; }

  &.today-btn {
    width: auto;
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 15px;
    background: #007AFF;
    color: white;
    font-weight: 500;
  }
}

.day-info {
  text-align: center;
}

.day-title {
  font-size: 17px;
  font-weight: 600;
  color: #1A1A1A;
}

.day-relative {
  font-size: 14px;
  color: #8E8E93;
  margin-top: 4px;
}

.add-task-btn {
  padding: 10px 20px;
  border-radius: 10px;
  background: #007AFF;
  color: white;
  font-size: 15px;
  font-weight: 500;

  &:active { opacity: 0.8; }
}

.day-body {
  display: flex;
  position: relative;
}

.time-stats {
  padding: 12px 16px;
  background: #F2F2F7;
  border-bottom: 1px solid #E5E5EA;
}

.time-axis {
  width: 60px;
  flex-shrink: 0;
  background: #F2F2F7;
  border-right: 1px solid #E5E5EA;
  display: flex;
  flex-direction: column;
}

.hour-label {
  height: 60px;
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #8E8E93;
  border-bottom: 1px solid #E5E5EA;
  box-sizing: border-box;

  &.past {
    color: #C7C7CC;
    opacity: 0.55;
  }
}

.task-area {
  flex: 1;
  position: relative;
  min-height: 1440px;
}

.hour-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
}

.hour-slot {
  height: 60px;
  flex-shrink: 0;
  border-bottom: 1px solid #E5E5EA;
  pointer-events: auto;
  box-sizing: border-box;

  &:active {
    background: rgba(0, 122, 255, 0.08);
  }

  &.past {
    background: rgba(0, 0, 0, 0.03);
    cursor: not-allowed;
  }
}

@media (max-width: 768px) {
  .day-header {
    padding: 12px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .day-info {
    order: -1;
    width: 100%;
    margin-bottom: 8px;
  }

  .nav-buttons {
    flex: 1;
  }

  .add-task-btn {
    padding: 8px 14px;
    font-size: 14px;
  }
}
</style>