<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import { isTimedTask } from '../../utils/timeUtils'
import { useNow, isPastTime } from '../../composables/useNow'
import DayTimePie from './DayTimePie.vue'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()
const now = useNow()

// 当天任务
const dayTasks = computed(() => taskStore.getTasksByDate(uiStore.selectedDate))

// 定时任务（有 startTime/endTime）按开始时间排序
const timedTasks = computed(() =>
  dayTasks.value
    .filter(isTimedTask)
    .slice()
    .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''))
)

// 有预计时长的任务（floating duration）
const durationTasks = computed(() =>
  dayTasks.value.filter((t: any) => !isTimedTask(t) && t.durationMinutes != null)
)

// 全天/待办任务（anytime）
const anytimeTasks = computed(() =>
  dayTasks.value.filter((t: any) => !isTimedTask(t) && t.durationMinutes == null)
)

const hasAnyTask = computed(() => dayTasks.value.length > 0)

function formatDuration(m: number): string {
  if (m >= 60) {
    const h = m / 60
    return `${Number.isInteger(h) ? h : h.toFixed(1)} 小时`
  }
  return `${m} 分钟`
}

function taskIsPast(task: any): boolean {
  if (!task.endTime) return false
  return isPastTime(uiStore.selectedDate, task.endTime, now.value)
}

// 返回上一视图
function goBack() { uiStore.goBack() }
function prevDay() { uiStore.goPrev() }
function nextDay() { uiStore.goNext() }
function goToday() { uiStore.goToday() }

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

    <!-- 时间统计圆饼图（仅有任务时显示） -->
    <div v-if="hasAnyTask" class="time-stats">
      <DayTimePie
        :tasks="dayTasks"
        :sleep-start="settingStore.settings.sleepStartTime"
        :sleep-end="settingStore.settings.sleepEndTime"
      />
    </div>

    <!-- 主内容 -->
    <div class="day-body">
      <!-- 空状态 -->
      <div v-if="!hasAnyTask" class="empty-day">
        <div class="empty-icon">☀️</div>
        <div class="empty-text">今天无计划</div>
        <div class="empty-hint">点击 “新建任务” 开始规划</div>
        <button class="empty-cta" @click="uiStore.openTaskForm(undefined, uiStore.selectedDate)">
          + 新建任务
        </button>
      </div>

      <!-- 有任务：分组列表 -->
      <template v-else>
        <!-- 定时任务 -->
        <section v-if="timedTasks.length > 0" class="task-group">
          <div class="group-title">🕒 定时安排</div>
          <div class="task-list">
            <button
              v-for="task in timedTasks"
              :key="task.id"
              class="task-row"
              :class="{ done: task.isCompleted, past: taskIsPast(task) }"
              :style="{ '--task-color': task.color }"
              @click="uiStore.openTaskCard(task.id)"
            >
              <span class="row-dot" :style="{ backgroundColor: task.color }"></span>
              <span class="row-time">{{ task.startTime }}<span v-if="task.endTime"> - {{ task.endTime }}</span></span>
              <span class="row-title">{{ task.title }}</span>
              <span class="row-arrow">›</span>
            </button>
          </div>
        </section>

        <!-- 有预计时长（无固定时间） -->
        <section v-if="durationTasks.length > 0" class="task-group">
          <div class="group-title">⏳ 花费时长</div>
          <div class="task-list">
            <button
              v-for="task in durationTasks"
              :key="task.id"
              class="task-row"
              :class="{ done: task.isCompleted }"
              :style="{ '--task-color': task.color }"
              @click="uiStore.openTaskCard(task.id)"
            >
              <span class="row-dot" :style="{ backgroundColor: task.color }"></span>
              <span class="row-time">{{ formatDuration(task.durationMinutes!) }}</span>
              <span class="row-title">{{ task.title }}</span>
              <span class="row-arrow">›</span>
            </button>
          </div>
        </section>

        <!-- 全天待办 -->
        <section v-if="anytimeTasks.length > 0" class="task-group">
          <div class="group-title">📌 全天待办</div>
          <div class="task-list">
            <button
              v-for="task in anytimeTasks"
              :key="task.id"
              class="task-row"
              :class="{ done: task.isCompleted }"
              :style="{ '--task-color': task.color }"
              @click="uiStore.openTaskCard(task.id)"
            >
              <span class="row-dot" :style="{ backgroundColor: task.color }"></span>
              <span class="row-title">{{ task.title }}</span>
              <span class="row-arrow">›</span>
            </button>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
// iOS 日视图（列表模式）
.day-calendar {
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100%;
  padding-bottom: calc(20px + var(--safe-bottom));
}

.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-primary);
}

.nav-buttons {
  display: flex;
  gap: 6px;
}

.nav-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ios-blue);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--spring);

  &:hover { background: var(--bg-hover); }
  &:active { transform: scale(0.9); background: var(--bg-pressed); }

  &.today-btn {
    width: auto;
    padding: 8px 16px;
    background: var(--ios-blue);
    color: #fff;
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 122, 255, 0.28);
  }
}

.day-info { text-align: center; }

.day-title {
  font-size: var(--font-size-headline);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.day-relative {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
  margin-top: 3px;
}

.add-task-btn {
  padding: 9px 16px;
  border-radius: var(--radius-md);
  background: var(--ios-blue);
  color: #fff;
  font-size: var(--font-size-sub);
  font-weight: 600;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 122, 255, 0.28);
  transition: transform var(--spring), opacity var(--transition-fast);

  &:active { transform: scale(0.97); opacity: 0.9; }
}

.time-stats {
  margin: 8px 16px 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  box-shadow: var(--shadow-xs);
}

.day-body {
  flex: 1;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

// 空状态
.empty-day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px 40px;
  color: var(--text-tertiary);

  .empty-icon {
    font-size: 54px;
    margin-bottom: 12px;
    opacity: 0.85;
  }
  .empty-text {
    font-size: var(--font-size-title3);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    margin-bottom: 6px;
  }
  .empty-hint {
    font-size: var(--font-size-sub);
    color: var(--text-tertiary);
    margin-bottom: 22px;
  }
  .empty-cta {
    padding: 12px 26px;
    min-height: 44px;
    border-radius: var(--radius-md);
    background: var(--ios-blue);
    color: #fff;
    font-size: var(--font-size-callout);
    font-weight: 600;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.28);
    transition: transform var(--spring), opacity var(--transition-fast);
    &:active { transform: scale(0.97); opacity: 0.9; }
  }
}

.task-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-title {
  padding: 0 8px;
  font-size: var(--font-size-footnote);
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
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
  padding: 12px 16px;
  min-height: 52px;
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

  &.past { opacity: 0.65; }

  .row-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .row-time {
    font-family: var(--font-mono);
    font-size: var(--font-size-footnote);
    color: var(--text-secondary);
    font-weight: 600;
    min-width: 82px;
    white-space: nowrap;
  }

  .row-title {
    flex: 1;
    font-size: var(--font-size-callout);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .row-arrow {
    color: var(--text-quaternary);
    font-size: 18px;
    font-weight: 500;
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
    margin-bottom: 4px;
  }
  .nav-buttons { flex: 1; }
  .add-task-btn { padding: 8px 14px; }
  .day-body { padding: 0 12px; gap: 16px; }
  .task-row .row-time { min-width: 70px; }
}
</style>
