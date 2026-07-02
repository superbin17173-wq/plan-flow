<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import { useNow } from '../../composables/useNow'
import { getCategoryById } from '../../types/category'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()
const now = useNow()

// 当前年份(基于选中日期)
const year = ref(dayjs(uiStore.selectedDate).year())

// 该年所有 ISO 周
interface WeekCell {
  weekNo: number
  start: dayjs.Dayjs
  end: dayjs.Dayjs
  isCurrent: boolean
  isPast: boolean
  taskCount: number
  completedCount: number
  categories: Set<string>
  month: number // 主体月份(周中间那天的月份)
}

const weeks = computed<WeekCell[]>(() => {
  const weekStartsOn = settingStore.settings.weekStartsOn // 0 or 1
  const list: WeekCell[] = []
  // 找到年内包含 1 月 1 日的那一周的起点
  const jan1 = dayjs(`${year.value}-01-01`)
  const offset = weekStartsOn === 1
    ? (jan1.day() === 0 ? 6 : jan1.day() - 1)
    : jan1.day()
  let cursor = jan1.subtract(offset, 'day')

  const today = dayjs(now.value)
  const yearEnd = dayjs(`${year.value}-12-31`)

  let idx = 1
  while (cursor.isBefore(yearEnd, 'day') || cursor.isSame(yearEnd, 'day') || cursor.year() <= year.value) {
    const start = cursor
    const end = cursor.add(6, 'day')
    // 该周中间(周四)的月份代表这一周所属月
    const mid = cursor.add(3, 'day')
    if (mid.year() > year.value) break

    const startStr = start.format('YYYY-MM-DD')
    const endStr = end.format('YYYY-MM-DD')
    const tasks = taskStore.getTasksInRange(startStr, endStr)
    const categories = new Set<string>()
    let completed = 0
    for (const t of tasks) {
      categories.add(t.category)
      if (t.isCompleted) completed++
    }

    list.push({
      weekNo: idx,
      start,
      end,
      isCurrent: today.isSame(start, 'day') || today.isSame(end, 'day') || (today.isAfter(start, 'day') && today.isBefore(end, 'day')),
      isPast: end.isBefore(today, 'day'),
      taskCount: tasks.length,
      completedCount: completed,
      categories,
      month: mid.month(),
    })
    idx++
    cursor = cursor.add(1, 'week')
    if (idx > 60) break
  }
  return list
})

const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

// 按月分组
const weeksByMonth = computed(() => {
  const groups: { month: number; label: string; weeks: WeekCell[] }[] = []
  for (const w of weeks.value) {
    let g = groups.find(x => x.month === w.month)
    if (!g) {
      g = { month: w.month, label: monthNames[w.month], weeks: [] }
      groups.push(g)
    }
    g.weeks.push(w)
  }
  return groups
})

function goPrevYear() { year.value-- }
function goNextYear() { year.value++ }
function goCurrentYear() { year.value = dayjs().year() }

function openWeek(w: WeekCell) {
  uiStore.selectedDate = w.start.format('YYYY-MM-DD')
  uiStore.setView('week')
}

function categoryColor(id: string): string {
  const c = getCategoryById(id)
  return c?.color || '#A8A8A8'
}
</script>

<template>
  <div class="year-week-view">
    <div class="yw-header">
      <div class="nav-buttons">
        <button class="nav-btn" @click="goPrevYear" title="上一年">‹</button>
        <button class="nav-btn today-btn" @click="goCurrentYear">今年</button>
        <button class="nav-btn" @click="goNextYear" title="下一年">›</button>
      </div>
      <div class="yw-title">{{ year }} 年 · 共 {{ weeks.length }} 周</div>
      <div class="legend">
        <span class="legend-dot current"></span>本周
        <span class="legend-dot past"></span>已过
      </div>
    </div>

    <div class="months-container">
      <div v-for="g in weeksByMonth" :key="g.month" class="month-group">
        <div class="month-label">{{ g.label }}</div>
        <div class="weeks-row">
          <button
            v-for="w in g.weeks"
            :key="w.weekNo"
            class="week-cell"
            :class="{ current: w.isCurrent, past: w.isPast, empty: w.taskCount === 0 }"
            @click="openWeek(w)"
            :title="`第 ${w.weekNo} 周 · ${w.start.format('MM/DD')}-${w.end.format('MM/DD')} · ${w.taskCount} 条任务`"
          >
            <div class="wc-top">
              <span class="wc-num">W{{ w.weekNo }}</span>
              <span class="wc-count" v-if="w.taskCount > 0">{{ w.taskCount }}</span>
            </div>
            <div class="wc-range">{{ w.start.format('MM/DD') }}-{{ w.end.format('MM/DD') }}</div>
            <div class="wc-dots" v-if="w.categories.size > 0">
              <span
                v-for="cat in Array.from(w.categories).slice(0, 6)"
                :key="cat"
                class="wc-dot"
                :style="{ background: categoryColor(cat) }"
              ></span>
            </div>
            <div v-if="w.taskCount > 0" class="wc-progress">
              <div class="wc-progress-bar" :style="{ width: (w.completedCount / w.taskCount * 100) + '%' }"></div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.year-week-view {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.yw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.nav-buttons { display: flex; gap: 8px; }
.nav-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 16px;
  &:hover { background: var(--bg-hover); }
  &.today-btn {
    width: auto;
    padding: 0 14px;
    border-radius: 8px;
    background: var(--color-work);
    color: white;
    font-size: 13px;
  }
}

.yw-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.legend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-left: 8px;
  &.current { background: var(--color-work); }
  &.past { background: var(--text-tertiary); opacity: 0.5; }
}

.months-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.month-group {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.month-label {
  width: 42px;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  padding-top: 6px;
  text-align: right;
}

.weeks-row {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}

.week-cell {
  background: var(--bg-primary);
  border-radius: 10px;
  padding: 8px 10px;
  text-align: left;
  transition: all 0.2s;
  border: 2px solid transparent;
  min-height: 76px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;

  &:hover {
    background: var(--bg-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  &.current {
    border-color: var(--color-work);
    background: var(--calendar-today-bg);
  }

  &.past {
    opacity: 0.6;
  }

  &.empty {
    opacity: 0.75;
  }
}

.wc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wc-num {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.wc-count {
  background: var(--color-work);
  color: white;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.wc-range {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: monospace;
}

.wc-dots {
  display: flex;
  gap: 3px;
}
.wc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.wc-progress {
  height: 3px;
  background: var(--border-color);
  border-radius: 999px;
  overflow: hidden;
  margin-top: auto;
}
.wc-progress-bar {
  height: 100%;
  background: var(--color-study);
  transition: width 0.3s;
}

@media (max-width: 640px) {
  .month-group { flex-direction: column; align-items: stretch; gap: 6px; }
  .month-label { width: auto; text-align: left; padding-top: 0; }
  .weeks-row { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
  .week-cell { min-height: 68px; padding: 6px 8px; }
}
</style>
