<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import { isTimedTask } from '../../utils/timeUtils'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()

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

const weekdays = computed(() => {
  const weekStartsOn = settingStore.settings.weekStartsOn
  if (weekStartsOn === 1) return ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
})

function isToday(date: Date): boolean {
  return dayjs(date).isSame(dayjs(), 'day')
}

function formatDate(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD')
}

function getDayTasks(date: Date) {
  return taskStore.getTasksByDate(formatDate(date)).slice().sort((a: any, b: any) => {
    // 定时的按 startTime，未定时的排后
    const at = isTimedTask(a) ? (a.startTime || '') : 'zz'
    const bt = isTimedTask(b) ? (b.startTime || '') : 'zz'
    return at.localeCompare(bt)
  })
}

function formatDuration(m: number): string {
  if (m >= 60) {
    const h = m / 60
    return `${Number.isInteger(h) ? h : h.toFixed(1)}h`
  }
  return `${m}m`
}

function timeLabel(task: any): string {
  if (isTimedTask(task)) {
    return task.endTime ? `${task.startTime}-${task.endTime}` : task.startTime
  }
  if (task.durationMinutes != null) return `⏳ ${formatDuration(task.durationMinutes)}`
  return '📌 全天'
}

function selectDay(date: Date) {
  uiStore.selectDate(formatDate(date))
  uiStore.setView('day')
}
</script>

<template>
  <div class="week-calendar">
    <div class="week-list">
      <section
        v-for="(date, index) in weekDates"
        :key="index"
        class="day-section"
        :class="{ today: isToday(date) }"
      >
        <button class="day-header-btn" @click="selectDay(date)">
          <div class="day-header-left">
            <span class="weekday-name">{{ weekdays[index] }}</span>
            <span class="day-date-num">{{ dayjs(date).format('DD') }}</span>
            <span v-if="isToday(date)" class="today-badge">今天</span>
          </div>
          <div class="day-header-right">
            <span v-if="getDayTasks(date).length > 0" class="day-count">
              {{ getDayTasks(date).length }} 项
            </span>
            <span v-else class="day-empty-hint">无计划</span>
            <span class="row-arrow">›</span>
          </div>
        </button>

        <div v-if="getDayTasks(date).length > 0" class="task-list">
          <button
            v-for="task in getDayTasks(date)"
            :key="task.id"
            class="task-row"
            :class="{ done: task.isCompleted }"
            :style="{ '--task-color': task.color }"
            @click="uiStore.openTaskCard(task.id)"
          >
            <span class="row-dot" :style="{ backgroundColor: task.color }"></span>
            <span class="row-time">{{ timeLabel(task) }}</span>
            <span class="row-title">{{ task.title }}</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
// iOS 周视图（列表模式）
.week-calendar {
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 4px 0 calc(20px + var(--safe-bottom));
}

.week-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 16px;
}

.day-section {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &.today {
    .day-date-num { color: var(--ios-blue); font-weight: 700; }
  }
}

.day-header-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 8px 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-primary);

  &:active { opacity: 0.75; }
}

.day-header-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.weekday-name {
  font-size: var(--font-size-footnote);
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.day-date-num {
  font-size: var(--font-size-title3);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.today-badge {
  font-size: var(--font-size-caption2);
  font-weight: 700;
  color: #fff;
  background: var(--ios-blue);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.day-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.day-count {
  font-size: var(--font-size-footnote);
  color: var(--ios-blue);
  font-weight: 600;
}

.day-empty-hint {
  font-size: var(--font-size-footnote);
  color: var(--text-quaternary);
}

.row-arrow {
  color: var(--text-quaternary);
  font-size: 18px;
  line-height: 1;
}

.task-list {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-xs);
}

.task-row {
  --task-color: var(--ios-blue);
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  min-height: 44px;
  background: var(--bg-card);
  border: none;
  border-left: 3px solid var(--task-color);
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast);

  &:active { background: var(--bg-pressed); }

  & + .task-row {
    border-top: 0.5px solid var(--separator);
  }

  &.done {
    opacity: 0.55;
    .row-title { text-decoration: line-through; }
  }

  .row-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .row-time {
    font-family: var(--font-mono);
    font-size: var(--font-size-caption);
    color: var(--text-secondary);
    font-weight: 600;
    min-width: 78px;
    white-space: nowrap;
  }

  .row-title {
    flex: 1;
    font-size: var(--font-size-sub);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
}

@media (max-width: 768px) {
  .week-list { padding: 0 12px; gap: 14px; }
  .task-row .row-time { min-width: 70px; font-size: 11px; }
}
</style>
