<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import { getTaskPosition } from '../../utils/timeUtils'
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

          <!-- 任务块 -->
          <TaskBlock
            v-for="task in getDayTasks(date)"
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
.week-calendar {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.week-header {
  display: flex;
  background: var(--calendar-header-bg);
  border-bottom: 1px solid var(--border-color);
}

.time-header {
  width: 60px;
  flex-shrink: 0;
  padding: 12px 8px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.day-header-cell {
  flex: 1;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-hover);
  }

  &.today {
    background: var(--calendar-today-bg);
    color: var(--color-work);

    .day-date {
      background: var(--color-work);
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  }
}

.weekday-name {
  font-size: 12px;
  font-weight: 500;
}

.day-date {
  font-size: 14px;
  margin-top: 4px;
}

.week-body {
  display: flex;
  overflow-y: auto;
  max-height: 70vh;
}

.time-axis {
  width: 60px;
  flex-shrink: 0;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
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
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
}

.week-columns {
  flex: 1;
  display: flex;
}

.day-column {
  flex: 1;
  position: relative;
  border-right: 1px solid var(--border-color);
  min-height: 1440px; // 24 * 60px
  cursor: pointer;

  &:hover {
    background: rgba(0, 0, 0, 0.02);
  }

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
  border-bottom: 1px solid var(--border-color);
  pointer-events: auto;
  transition: background 0.2s;
  box-sizing: border-box;

  &:hover {
    background: rgba(129, 201, 216, 0.1);
  }

  &.past {
    background: rgba(0, 0, 0, 0.04);
    cursor: not-allowed;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }
  }
}

@media (max-width: 768px) {
  // 保持与 PC 一致的尺寸和字号，仅在此断点做微调按需扩展
}
</style>