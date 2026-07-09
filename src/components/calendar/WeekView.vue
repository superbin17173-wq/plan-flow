<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import { getTaskPosition, isTimedTask } from '../../utils/timeUtils'
import { useNow, isPastHour, isPastTime } from '../../composables/useNow'
import TaskBlock from './TaskBlock.vue'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()
const now = useNow()

// 周日期列表
const weekDates = computed(() => {
  const d = dayjs(uiStore.selectedDate)
  const weekStartsOn = settingStore.settings.weekStartsOn
  const dayOfWeek = d.day()
  const offset = weekStartsOn === 1
    ? (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    : dayOfWeek

  const startOfWeek = d.subtract(offset, 'day')
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    dates.push(startOfWeek.add(i, 'day').toDate())
  }
  return dates
})

// 星期标题
const weekdays = computed(() => {
  const weekStartsOn = settingStore.settings.weekStartsOn
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  if (weekStartsOn === 1) {
    return ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  }
  return names
})

// 小时列表 (0-23)
const hours = Array.from({ length: 24 }, (_, i) => i)

// 判断是否是今天
function isToday(date: Date): boolean {
  return dayjs(date).isSame(dayjs(), 'day')
}

// 获取日期字符串
function formatDate(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD')
}

// 获取某天的任务
function getDayTasks(date: Date) {
  const dateStr = formatDate(date)
  return taskStore.getTasksByDate(dateStr)
}

// 获取某天的定时任务(用于时间轴)
function getDayTimedTasks(date: Date) {
  return getDayTasks(date).filter(isTimedTask)
}

// 获取某天的未排时段任务数
function getDayUnscheduledCount(date: Date) {
  return getDayTasks(date).filter(t => !isTimedTask(t)).length
}

// 点击日期列
function handleColumnClick(date: Date) {
  const dateStr = formatDate(date)
  uiStore.selectDate(dateStr)
}

// 点击空白时间创建任务
function handleTimeSlotClick(date: Date, hour: number, e: MouseEvent) {
  if (isPastHour(formatDate(date), hour, now.value)) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  const minuteOffset = Math.floor((y / 60) * 60)
  const startHour = Math.min(hour + Math.floor(minuteOffset / 60), 23)
  const startTime = `${String(startHour).padStart(2, '0')}:${String(minuteOffset % 60).padStart(2, '0')}`
  const endTime = `${String(Math.min(startHour + 1, 23)).padStart(2, '0')}:${String(minuteOffset % 60).padStart(2, '0')}`
  uiStore.openTaskForm(undefined, formatDate(date), startTime)
}

function hourIsPast(date: Date, hour: number): boolean {
  return isPastHour(formatDate(date), hour, now.value)
}

function taskIsPast(date: Date, task: any): boolean {
  if (!task.endTime) return false
  return isPastTime(formatDate(date), task.endTime, now.value)
}

// 拖拽处理
const draggingTask = ref<string | null>(null)
const dragStartY = ref(0)
const dragOriginalTop = ref(0)
const dragOriginalHeight = ref(0)

function startDrag(taskId: string, startY: number, originalTop: number, originalHeight: number) {
  draggingTask.value = taskId
  dragStartY.value = startY
  dragOriginalTop.value = originalTop
  dragOriginalHeight.value = originalHeight
}

function endDrag() {
  draggingTask.value = null
}
</script>

<template>
  <div class="week-calendar">
    <!-- 周标题 -->
    <div class="week-header">
      <div class="time-header">时间</div>
      <div
        v-for="(date, index) in weekDates"
        :key="index"
        class="day-header-cell"
        :class="{ today: isToday(date) }"
        @click="handleColumnClick(date)"
      >
        <div class="weekday-name">{{ weekdays[index] }}</div>
        <div class="day-date">{{ dayjs(date).format('DD') }}</div>
        <div v-if="getDayUnscheduledCount(date) > 0" class="unsched-dot" :title="`${getDayUnscheduledCount(date)} 项未排时段`">·{{ getDayUnscheduledCount(date) }}</div>
      </div>
    </div>

    <!-- 周内容 -->
    <div class="week-body">
      <!-- 时间轴 -->
      <div class="time-axis">
        <div v-for="hour in hours" :key="hour" class="hour-label">
          {{ String(hour).padStart(2, '0') }}:00
        </div>
      </div>

      <!-- 日期列 -->
      <div class="week-columns">
        <div
          v-for="(date, index) in weekDates"
          :key="index"
          class="day-column"
          @click="handleColumnClick(date)"
        >
          <!-- 小时网格背景 -->
          <div class="hour-grid">
            <div
              v-for="hour in hours"
              :key="hour"
              class="hour-slot"
              :class="{ past: hourIsPast(date, hour) }"
              @click.stop="handleTimeSlotClick(date, hour, $event)"
            ></div>
          </div>

          <!-- 任务块(仅定时任务) -->
          <TaskBlock
            v-for="task in getDayTimedTasks(date)"
            :key="task.id"
            :task="task"
            :hour-height="60"
            :is-dragging="draggingTask === task.id"
            :is-past="taskIsPast(date, task)"
            @drag-start="startDrag"
            @drag-end="endDrag"
            @click.stop="uiStore.openTaskCard(task.id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
// iOS 风格周视图
.week-calendar {
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  border-radius: 12px;
  overflow: hidden;
}

.week-header {
  display: flex;
  background: #F2F2F7;
  border-bottom: 1px solid #E5E5EA;
}

.time-header {
  width: 60px;
  flex-shrink: 0;
  padding: 12px 8px;
  font-size: 12px;
  color: #8E8E93;
  text-align: center;
}

.day-header-cell {
  flex: 1;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;

  &:active {
    background: #E5E5EA;
  }

  &.today {
    background: rgba(0, 122, 255, 0.08);

    .day-date {
      background: #007AFF;
      color: white;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }
  }
}

.weekday-name {
  font-size: 13px;
  font-weight: 500;
  color: #8E8E93;
}

.unsched-dot {
  margin-top: 2px;
  font-size: 10px;
  color: #FF9500;
  font-weight: 600;
}

.day-date {
  font-size: 15px;
  margin-top: 4px;
  color: #1A1A1A;
}

.week-body {
  display: flex;
  overflow-y: auto;
  max-height: 70vh;
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
}

.week-columns {
  flex: 1;
  display: flex;
}

.day-column {
  flex: 1;
  position: relative;
  border-right: 1px solid #E5E5EA;
  min-height: 1440px;

  &:last-child {
    border-right: none;
  }
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
  .weekday-name { font-size: 11px; }
  .day-date { font-size: 13px; }
}
</style>