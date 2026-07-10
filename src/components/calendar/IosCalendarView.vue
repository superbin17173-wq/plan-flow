<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useRouter } from 'vue-router'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const router = useRouter()

const today = dayjs()

// 周日历条数据（显示本周7天）
const weekStrip = computed(() => {
  const selected = dayjs(uiStore.selectedDate)
  const startOfWeek = selected.startOf('week')
  const days = []
  const weekdayNames = ['日', '一', '二', '三', '四', '五', '六']

  for (let i = 0; i < 7; i++) {
    const d = startOfWeek.add(i, 'day')
    days.push({
      date: d,
      dayNum: d.format('D'),
      weekday: weekdayNames[d.day()],
      isToday: d.isSame(today, 'day'),
      isSelected: d.isSame(selected, 'day'),
    })
  }
  return days
})

// 当前月份标题
const monthTitle = computed(() => {
  return dayjs(uiStore.selectedDate).format('YYYY年M月')
})

// 选中日期的任务
const selectedDateTasks = computed(() => {
  const dateStr = dayjs(uiStore.selectedDate).format('YYYY-MM-DD')
  return taskStore.tasks.filter(t => t.date === dateStr)
})

// 按时间段分组任务
const groupedTasks = computed(() => {
  const groups: { label: string; tasks: typeof selectedDateTasks.value }[] = []

  // 上午 (6:00-12:00)
  const morning = selectedDateTasks.value.filter(t => {
    const time = t.startTime || ''
    return t.startTime && t.endTime && time >= '06:00' && time < '12:00'
  })
  if (morning.length) groups.push({ label: '上午', tasks: morning })

  // 下午 (12:00-18:00)
  const afternoon = selectedDateTasks.value.filter(t => {
    const time = t.startTime || ''
    return t.startTime && t.endTime && time >= '12:00' && time < '18:00'
  })
  if (afternoon.length) groups.push({ label: '下午', tasks: afternoon })

  // 晚上 (18:00-24:00)
  const evening = selectedDateTasks.value.filter(t => {
    const time = t.startTime || ''
    return t.startTime && t.endTime && time >= '18:00' && time < '24:00'
  })
  if (evening.length) groups.push({ label: '晚上', tasks: evening })

  // 未排时段(duration + anytime)
  const noTime = selectedDateTasks.value.filter(t => !(t.startTime && t.endTime))
  if (noTime.length) groups.push({ label: '未排时段', tasks: noTime })

  // 如果没有任何分组，返回空
  if (groups.length === 0 && selectedDateTasks.value.length > 0) {
    groups.push({ label: '今日任务', tasks: selectedDateTasks.value })
  }

  return groups
})

// 任务副标题(时间信息)
function taskMetaText(task: any): string {
  if (task.startTime && task.endTime) return `${task.startTime} - ${task.endTime}`
  if (task.durationMinutes != null) {
    const m = task.durationMinutes
    if (m >= 60) {
      const h = m / 60
      return `预计 ${Number.isInteger(h) ? h : h.toFixed(1)}h`
    }
    return `预计 ${m}m`
  }
  return '全天'
}

// 选中日期显示文字
const selectedDateText = computed(() => {
  const d = dayjs(uiStore.selectedDate)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.day()]
  if (d.isSame(today, 'day')) {
    return `今天 · ${weekday}`
  }
  return `${d.format('M月D日')} · ${weekday}`
})

// 点击周条上的日期
function selectDate(date: dayjs.Dayjs) {
  uiStore.selectDate(date.format('YYYY-MM-DD'))
}

// 点击任务
function openTask(task: any) {
  uiStore.openTaskCard(task.id)
}

// 任务类型颜色
function getTaskColor(task: any): string {
  if (task.type === 'study') return '#007AFF'
  if (task.type === 'work') return '#FF6B6B'
  if (task.type === 'health') return '#4CAF50'
  if (task.type === 'personal') return '#9C27B0'
  return '#007AFF'
}

// 任务类型图标
function getTaskIcon(task: any): string {
  if (task.type === 'study') return '📖'
  if (task.type === 'work') return '💼'
  if (task.type === 'health') return '🏃'
  if (task.type === 'personal') return '🏠'
  return '📋'
}

// 任务是否完成
function isTaskCompleted(task: any): boolean {
  return task.isCompleted
}

// 导航操作
function goPrevWeek() {
  const current = dayjs(uiStore.selectedDate)
  uiStore.selectDate(current.subtract(7, 'day').format('YYYY-MM-DD'))
}

function goNextWeek() {
  const current = dayjs(uiStore.selectedDate)
  uiStore.selectDate(current.add(7, 'day').format('YYYY-MM-DD'))
}

function goToday() {
  uiStore.selectDate(today.format('YYYY-MM-DD'))
}

// 打开新建任务
function openNewTask() {
  uiStore.openTaskForm(undefined, uiStore.selectedDate)
}

// 底部导航
const activeNav = ref('calendar')
const showSettings = ref(false)

function goNav(nav: string) {
  activeNav.value = nav
  if (nav === 'stats') {
    uiStore.toggleStatsPanel()
  } else if (nav === 'ai') {
    uiStore.openAiChat()
  } else if (nav === 'settings') {
    showSettings.value = true
  }
}

// 统计数据
const todayCompleted = computed(() => {
  const dateStr = today.format('YYYY-MM-DD')
  return taskStore.tasks.filter(t => t.date === dateStr && t.isCompleted).length
})

const todayTotal = computed(() => {
  const dateStr = today.format('YYYY-MM-DD')
  return taskStore.tasks.filter(t => t.date === dateStr).length
})

onMounted(async () => {
  await taskStore.loadTasks()
})
</script>

<template>
  <div class="ios-calendar-view">
    <!-- 顶部: 月份 + 操作 -->
    <header class="ios-header">
      <div class="ios-header-top">
        <span class="ios-month">{{ monthTitle }}</span>
        <div class="ios-header-actions">
          <button class="ios-action-btn" @click="goToday">今天</button>
          <button class="ios-action-btn icon" @click="openNewTask">+</button>
        </div>
      </div>

      <!-- 周日历条 -->
      <div class="ios-week-strip">
        <button class="ios-week-nav" @click="goPrevWeek">‹</button>
        <div class="ios-week-days">
          <div
            v-for="day in weekStrip"
            :key="day.date.format('YYYY-MM-DD')"
            class="ios-day-col"
            :class="{ today: day.isToday, selected: day.isSelected }"
            @click="selectDate(day.date)"
          >
            <span class="ios-day-name">{{ day.weekday }}</span>
            <span class="ios-day-num">{{ day.dayNum }}</span>
            <div v-if="day.isSelected" class="ios-selected-indicator"></div>
          </div>
        </div>
        <button class="ios-week-nav" @click="goNextWeek">›</button>
      </div>
    </header>

    <!-- 主内容区: 任务列表 -->
    <main class="ios-content">
      <!-- 日期标题 -->
      <div class="ios-date-header">
        <span class="ios-date-text">{{ selectedDateText }}</span>
        <span class="ios-task-count">{{ selectedDateTasks.length }}项</span>
      </div>

      <!-- 任务分组卡片 -->
      <div v-if="groupedTasks.length > 0" class="ios-task-groups">
        <div v-for="group in groupedTasks" :key="group.label" class="ios-task-group">
          <span class="ios-group-label">{{ group.label }}</span>
          <div class="ios-card">
            <div
              v-for="(task, index) in group.tasks"
              :key="task.id"
              class="ios-task-row"
              :class="{ completed: isTaskCompleted(task) }"
              @click="openTask(task)"
            >
              <div class="ios-task-dot" :style="{ background: getTaskColor(task) }"></div>
              <div class="ios-task-main">
                <span class="ios-task-name">{{ task.title }}</span>
                <span class="ios-task-meta">{{ taskMetaText(task) }}</span>
              </div>
              <span class="ios-task-icon">{{ getTaskIcon(task) }}</span>
              <div v-if="index < group.tasks.length - 1" class="ios-divider"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="ios-empty">
        <div class="ios-empty-icon">📅</div>
        <span class="ios-empty-text">今天没有任务</span>
        <button class="ios-add-btn" @click="openNewTask">添加任务</button>
      </div>

      <!-- 今日进度卡片 -->
      <div v-if="todayTotal > 0" class="ios-progress-card">
        <div class="ios-progress-header">
          <span class="ios-progress-title">今日进度</span>
          <span class="ios-progress-count">{{ todayCompleted }}/{{ todayTotal }}</span>
        </div>
        <div class="ios-progress-bar">
          <div
            class="ios-progress-fill"
            :style="{ width: `${(todayCompleted / todayTotal) * 100}%` }"
          ></div>
        </div>
      </div>
    </main>

    <!-- 底部导航栏 -->
    <nav class="ios-bottom-nav">
      <div class="ios-nav-item" :class="{ active: activeNav === 'calendar' }" @click="goNav('calendar')">
        <div class="ios-nav-icon">📅</div>
        <span>日历</span>
      </div>
      <div class="ios-nav-item" :class="{ active: activeNav === 'stats' }" @click="goNav('stats')">
        <div class="ios-nav-icon">📊</div>
        <span>统计</span>
      </div>
      <div class="ios-nav-item" :class="{ active: activeNav === 'ai' }" @click="goNav('ai')">
        <div class="ios-nav-icon">💬</div>
        <span>AI</span>
      </div>
      <div class="ios-nav-item" :class="{ active: activeNav === 'settings' }" @click="goNav('settings')">
        <div class="ios-nav-icon">⚙️</div>
        <span>设置</span>
      </div>
    </nav>
  </div>
</template>

<style scoped lang="scss">
.ios-calendar-view {
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

// 顶部 header
.ios-header {
  background: var(--material-regular);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  border-bottom: 0.5px solid var(--separator);
  padding: 12px 16px;
  position: sticky;
  top: 0;
  z-index: 100;

  .ios-header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .ios-month {
      font-size: var(--font-size-title3);
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }

    .ios-header-actions {
      display: flex;
      gap: 8px;

      .ios-action-btn {
        padding: 8px 16px;
        border-radius: var(--radius-sm);
        background: var(--ios-blue);
        color: #fff;
        font-size: var(--font-size-sub);
        font-weight: 600;
        border: none;
        cursor: pointer;
        transition: transform var(--spring), opacity var(--transition-fast);

        &:active { transform: scale(0.96); opacity: 0.9; }

        &.icon {
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
        }
      }
    }
  }
}

// 周日历条
.ios-week-strip {
  display: flex;
  align-items: center;
  gap: 8px;

  .ios-week-nav {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    color: var(--ios-blue);
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background var(--transition-fast);
    &:hover { background: var(--bg-hover); }
  }

  .ios-week-days {
    display: flex;
    flex: 1;
    justify-content: space-around;

    .ios-day-col {
      text-align: center;
      padding: 6px 8px;
      border-radius: var(--radius-md);
      cursor: pointer;
      min-width: 40px;
      transition: background var(--transition-fast);

      .ios-day-name {
        font-size: var(--font-size-caption);
        color: var(--text-tertiary);
        display: block;
        margin-bottom: 2px;
        font-weight: 500;
      }

      .ios-day-num {
        font-size: var(--font-size-callout);
        font-weight: 500;
        color: var(--text-primary);
      }

      &.today {
        .ios-day-name { color: var(--ios-blue); }
      }

      &.selected {
        background: var(--ios-blue);

        .ios-day-name, .ios-day-num {
          color: #fff;
        }

        .ios-selected-indicator {
          display: none;
        }
      }
    }
  }
}

// 主内容区
.ios-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.ios-date-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  .ios-date-text {
    font-size: var(--font-size-callout);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .ios-task-count {
    font-size: var(--font-size-sub);
    color: var(--ios-blue);
    font-weight: 500;
  }
}

// 任务分组
.ios-task-groups {
  .ios-task-group {
    margin-bottom: 18px;

    .ios-group-label {
      font-size: var(--font-size-footnote);
      color: var(--text-tertiary);
      margin-bottom: 6px;
      display: block;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 0 8px;
    }

    .ios-card {
      background: var(--bg-card);
      border-radius: var(--radius-md);
      overflow: hidden;
      box-shadow: var(--shadow-xs);

      .ios-task-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        min-height: 44px;
        cursor: pointer;
        transition: background var(--transition-fast);

        &:active {
          background: var(--bg-pressed);
        }

        &.completed {
          .ios-task-name {
            color: var(--text-tertiary);
            text-decoration: line-through;
          }
        }

        .ios-task-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .ios-task-main {
          flex: 1;
          min-width: 0;

          .ios-task-name {
            font-size: var(--font-size-callout);
            color: var(--text-primary);
            display: block;
          }

          .ios-task-meta {
            font-size: var(--font-size-footnote);
            color: var(--text-tertiary);
            display: block;
            margin-top: 2px;
          }
        }

        .ios-task-icon {
          font-size: 20px;
        }
      }

      .ios-divider {
        height: 0.5px;
        background: var(--separator);
        margin: 0 16px;
      }
    }
  }
}

// 空状态
.ios-empty {
  text-align: center;
  padding: 40px 20px;

  .ios-empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .ios-empty-text {
    font-size: var(--font-size-callout);
    color: var(--text-tertiary);
    display: block;
    margin-bottom: 20px;
  }

  .ios-add-btn {
    padding: 12px 24px;
    min-height: 44px;
    border-radius: var(--radius-md);
    background: var(--ios-blue);
    color: #fff;
    font-size: var(--font-size-callout);
    font-weight: 600;
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 122, 255, 0.28);
    transition: transform var(--spring), opacity var(--transition-fast);

    &:active { transform: scale(0.97); opacity: 0.9; }
  }
}

// 进度卡片
.ios-progress-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-top: 16px;
  box-shadow: var(--shadow-xs);

  .ios-progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;

    .ios-progress-title {
      font-size: var(--font-size-callout);
      font-weight: 600;
      color: var(--text-primary);
    }

    .ios-progress-count {
      font-size: var(--font-size-sub);
      color: var(--ios-blue);
      font-family: var(--font-mono);
      font-weight: 600;
    }
  }

  .ios-progress-bar {
    height: 8px;
    background: var(--bg-fill-quaternary);
    border-radius: 4px;
    overflow: hidden;

    .ios-progress-fill {
      height: 100%;
      background: var(--ios-blue);
      border-radius: 4px;
      transition: width 0.3s;
    }
  }
}

// 底部导航栏
.ios-bottom-nav {
  display: flex;
  justify-content: space-around;
  background: var(--material-regular);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  border-top: 0.5px solid var(--separator);
  padding: 8px 0 calc(8px + var(--safe-bottom));
  position: sticky;
  bottom: 0;

  .ios-nav-item {
    text-align: center;
    cursor: pointer;
    padding: 4px 12px;
    transition: transform var(--spring);

    &:active { transform: scale(0.94); }

    .ios-nav-icon {
      font-size: 24px;
      margin-bottom: 2px;
      color: var(--text-tertiary);
    }

    span:last-child {
      font-size: 10px;
      color: var(--text-tertiary);
    }

    &.active {
      .ios-nav-icon { color: var(--ios-blue); }
      span:last-child { color: var(--ios-blue); font-weight: 600; }
    }
  }
}

// 移动端适配
@media (max-width: 768px) {
  .ios-header {
    padding: 10px 12px;

    .ios-header-top .ios-month {
      font-size: var(--font-size-title3);
    }

    .ios-week-strip .ios-week-days .ios-day-col {
      min-width: 36px;
    }
  }

  .ios-content {
    padding: 12px;
  }
}
</style>