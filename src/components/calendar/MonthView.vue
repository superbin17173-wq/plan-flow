<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import TaskChip from './TaskChip.vue'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()

// 当前月
const currentMonth = computed(() => {
  return dayjs(uiStore.selectedDate).month() + 1
})

const currentYear = computed(() => {
  return dayjs(uiStore.selectedDate).year()
})

// 获取月份日期矩阵
const monthDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = dayjs(`${year}-${month}-01`)
  const daysInMonth = firstDay.daysInMonth()
  const weekStartsOn = settingStore.settings.weekStartsOn

  // 计算第一天偏移
  const firstDayOfWeek = firstDay.day()
  const offset = weekStartsOn === 1
    ? (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1)
    : firstDayOfWeek

  // 前补空
  let currentWeek: (Date | null)[] = []
  const weeks: (Date | null)[][] = []

  // 上个月的日期填充
  for (let i = offset - 1; i >= 0; i--) {
    const prevDate = firstDay.subtract(i + 1, 'day').toDate()
    currentWeek.push(prevDate)
  }

  // 本月日期
  for (let day = 1; day <= daysInMonth; day++) {
    const date = firstDay.date(day).toDate()
    currentWeek.push(date)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  // 下个月的日期填充
  if (currentWeek.length > 0) {
    let nextDay = 1
    while (currentWeek.length < 7) {
      const nextDate = firstDay.add(daysInMonth + nextDay, 'day').toDate()
      currentWeek.push(nextDate)
      nextDay++
    }
    weeks.push(currentWeek)
  }

  return weeks
})

// 星期标题
const weekdays = computed(() => {
  const weekStartsOn = settingStore.settings.weekStartsOn
  const names = ['日', '一', '二', '三', '四', '五', '六']
  if (weekStartsOn === 1) {
    return ['一', '二', '三', '四', '五', '六', '日']
  }
  return names
})

// 判断是否是今天
function isToday(date: Date | null): boolean {
  if (!date) return false
  return dayjs(date).isSame(dayjs(), 'day')
}

// 判断是否是选中日期
function isSelected(date: Date | null): boolean {
  if (!date) return false
  return dayjs(date).format('YYYY-MM-DD') === uiStore.selectedDate
}

// 判断是否是当前月
function isCurrentMonth(date: Date | null): boolean {
  if (!date) return false
  return dayjs(date).month() + 1 === currentMonth.value &&
         dayjs(date).year() === currentYear.value
}

// 获取日期字符串
function formatDate(date: Date | null): string {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD')
}

// 获取某天的任务
function getDayTasks(date: Date | null) {
  if (!date) return []
  const dateStr = formatDate(date)
  return taskStore.getTasksByDate(dateStr)
}

// 点击日期
function handleClick(date: Date | null) {
  if (!date) return
  const dateStr = formatDate(date)
  uiStore.selectDate(dateStr)
}

// 点击任务
function handleTaskClick(taskId: string, e: Event) {
  e.stopPropagation()
  uiStore.openTaskCard(taskId)
}

// 点击空白创建任务
function handleDoubleClick(date: Date | null, e: MouseEvent) {
  if (!date) return
  const dateStr = formatDate(date)
  uiStore.openTaskForm(undefined, dateStr)
}
</script>

<template>
  <div class="month-calendar">
    <!-- 星期标题 -->
    <div class="month-header">
      <div v-for="(day, idx) in weekdays" :key="idx" class="weekday-title">
        周{{ day }}
      </div>
    </div>

    <!-- 日期网格 -->
    <div class="month-view">
      <template v-for="(week, weekIndex) in monthDays" :key="weekIndex">
        <div
          v-for="(date, dayIndex) in week"
          :key="String(weekIndex) + '-' + String(dayIndex)"
          class="day-cell"
          :class="{
            today: isToday(date),
            selected: isSelected(date),
            otherMonth: !isCurrentMonth(date)
          }"
          @click="handleClick(date)"
          @dblclick="handleDoubleClick(date, $event)"
        >
          <!-- 日期数字 -->
          <div class="day-header">
            <span class="day-number">
              {{ date ? dayjs(date).date() : '' }}
            </span>
          </div>

          <!-- 任务列表 -->
          <div class="day-tasks" v-if="date && getDayTasks(date).length > 0">
            <TaskChip
              v-for="(task, index) in getDayTasks(date).slice(0, 3)"
              :key="task.id"
              :task="task"
              @click="handleTaskClick(task.id, $event)"
            />
            <div
              v-if="getDayTasks(date).length > 3"
              class="more-tasks"
              @click.stop="handleClick(date)"
            >
              +{{ getDayTasks(date).length - 3 }} 更多
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
// iOS 月视图
.month-calendar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px calc(20px + var(--safe-bottom));
}

.month-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  padding: 8px 0 4px;
  font-weight: 600;
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.weekday-title {
  padding: 6px;
}

.month-view {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.day-cell {
  min-height: 82px;
  padding: 8px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--spring);
  box-shadow: var(--shadow-xs);

  &:hover { background: var(--bg-hover); }
  &:active { transform: scale(0.97); }

  &.today {
    background: var(--calendar-today-bg);
    .day-number {
      background: var(--ios-blue);
      color: #fff;
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }
  }

  &.selected {
    background: var(--calendar-selected-bg);
    box-shadow: 0 0 0 2px var(--ios-blue);
  }

  &.otherMonth {
    background: var(--bg-fill-quaternary);
    box-shadow: none;
    .day-number { color: var(--text-quaternary); }
  }
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.day-number {
  font-size: var(--font-size-sub);
  font-weight: 500;
  color: var(--text-primary);
}

.day-tasks {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.more-tasks {
  font-size: var(--font-size-caption2);
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 2px 4px;
  font-weight: 500;

  &:active { color: var(--ios-blue); }
}

@media (max-width: 768px) {
  .month-calendar { padding: 0 8px calc(16px + var(--safe-bottom)); gap: 6px; }
  .month-view { gap: 4px; }
  .day-cell {
    min-height: 56px;
    padding: 4px;
    border-radius: var(--radius-sm);
  }
  .day-tasks { display: none; }
  .day-number { font-size: var(--font-size-footnote); }
}
</style>