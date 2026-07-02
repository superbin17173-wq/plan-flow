<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { useSettingStore } from '../../stores/settingStore'
import { useHealthStore } from '../../stores/healthStore'
import { calcMealCalories } from '../../types/health'
import { calcBMR, calcTDEE, sumDailyBurn, currentWeight } from '../../utils/calorie'
import MiniLineChart from '../health/MiniLineChart.vue'

const taskStore = useTaskStore()
const uiStore = useUiStore()
const settingStore = useSettingStore()
const health = useHealthStore()

function taskVolume(task: any): number {
  if (!task.workout) return 0
  let v = 0
  for (const ex of task.workout) {
    for (const s of ex.sets) {
      if (s.weight != null && s.reps != null) v += s.weight * s.reps
    }
  }
  return v
}

// 最新体重记录
const latestMeasurement = computed(() => {
  return [...health.measurements]
    .filter(m => m.weight && m.weight > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
})

// 今日能量平衡
const todayEnergy = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  const bmr = calcBMR(settingStore.settings, latestMeasurement.value)
  const tdee = calcTDEE(settingStore.settings, latestMeasurement.value)
  const weight = currentWeight(settingStore.settings, latestMeasurement.value)
  const workoutBurn = sumDailyBurn(taskStore.tasks, today, weight)
  const intake = health.getMealsByDate(today).reduce((s, m) => s + calcMealCalories(m), 0)
  // 净差 = 摄入 - 消耗(消耗 = BMR + 训练额外消耗;活动系数已含日常);此处简化用 BMR + workoutBurn
  const dailyOut = (bmr ?? 0) + workoutBurn
  const netCalorie = intake - dailyOut
  const hasProfile = bmr !== null
  return {
    bmr, tdee, workoutBurn: Math.round(workoutBurn),
    intake: Math.round(intake), dailyOut: Math.round(dailyOut),
    netCalorie: Math.round(netCalorie),
    hasProfile,
  }
})

// 14 天能量平衡趋势(每日净差)
const balanceTrend = computed(() => {
  const end = dayjs()
  const start = end.subtract(13, 'day')
  const bmr = calcBMR(settingStore.settings, latestMeasurement.value)
  const weight = currentWeight(settingStore.settings, latestMeasurement.value)
  const days: { x: string; y: number }[] = []
  for (let i = 0; i < 14; i++) {
    const d = start.add(i, 'day').format('YYYY-MM-DD')
    const burn = sumDailyBurn(taskStore.tasks, d, weight)
    const intake = health.meals
      .filter(m => m.date === d)
      .reduce((s, m) => s + calcMealCalories(m), 0)
    const net = intake - (bmr ?? 0) - burn
    days.push({ x: d, y: Math.round(net) })
  }
  return days
})

const stats = computed(() => ({
  today: taskStore.todayStats,
  week: taskStore.weekStats,
  month: taskStore.monthStats,
  category: taskStore.categoryStats,
}))

// 近 30 天体重趋势
const weightTrend = computed(() => {
  const end = dayjs()
  const start = end.subtract(30, 'day')
  return health.measurements
    .filter(m => m.weight != null && dayjs(m.date).isAfter(start.subtract(1, 'day'), 'day') && dayjs(m.date).isBefore(end.add(1, 'day'), 'day'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(m => ({ x: m.date, y: m.weight! }))
})

// 近 30 天训练容量(基于健身任务)
const volumeTrend = computed(() => {
  const end = dayjs()
  const start = end.subtract(30, 'day')
  const byDate: Record<string, number> = {}
  for (const t of taskStore.tasks) {
    if (t.category !== 'fitness' || !t.workout) continue
    const d = dayjs(t.date)
    if (d.isBefore(start, 'day') || d.isAfter(end, 'day')) continue
    byDate[t.date] = (byDate[t.date] || 0) + taskVolume(t)
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([x, y]) => ({ x, y }))
})

// 近 14 天每日总热量
const kcalTrend = computed(() => {
  const end = dayjs()
  const start = end.subtract(14, 'day')
  const byDate: Record<string, number> = {}
  for (const m of health.meals) {
    const d = dayjs(m.date)
    if (d.isBefore(start, 'day') || d.isAfter(end, 'day')) continue
    byDate[m.date] = (byDate[m.date] || 0) + calcMealCalories(m)
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([x, y]) => ({ x, y }))
})

// 本周训练次数(基于健身任务)
const weekWorkoutCount = computed(() => {
  const start = dayjs().startOf('week').format('YYYY-MM-DD')
  const end = dayjs().endOf('week').format('YYYY-MM-DD')
  return taskStore.tasks.filter(t =>
    t.category === 'fitness' && t.workout && t.workout.length > 0 &&
    t.date >= start && t.date <= end
  ).length
})

function closePanel() {
  uiStore.toggleStatsPanel()
}
</script>

<template>
  <div class="stats-panel">
    <div class="panel-header">
      <h3>统计</h3>
      <button class="close-btn" @click="closePanel">×</button>
    </div>

    <div class="panel-body">
      <!-- 能量平衡 -->
      <div class="stat-section energy-card">
        <div class="energy-head">
          <span class="e-title">🔥 今日能量</span>
          <div class="e-actions">
            <button class="mini-link" @click="uiStore.openProfileDialog(); uiStore.toggleStatsPanel()">⚙️ 资料</button>
            <button class="mini-link primary" @click="uiStore.openMealLog(); uiStore.toggleStatsPanel()">🍽 记录饮食</button>
          </div>
        </div>

        <div v-if="!todayEnergy.hasProfile" class="e-empty">
          请先在 ⚙️资料 里填写身高/体重/年龄/性别以启用 BMR 计算
        </div>

        <div v-else class="e-grid">
          <div class="e-cell">
            <span class="e-label">BMR</span>
            <span class="e-val">{{ todayEnergy.bmr }}</span>
            <span class="e-unit">kcal</span>
          </div>
          <div class="e-cell">
            <span class="e-label">训练消耗</span>
            <span class="e-val burn">{{ todayEnergy.workoutBurn }}</span>
            <span class="e-unit">kcal</span>
          </div>
          <div class="e-cell">
            <span class="e-label">摄入</span>
            <span class="e-val intake">{{ todayEnergy.intake }}</span>
            <span class="e-unit">kcal</span>
          </div>
          <div class="e-cell net" :class="{ pos: todayEnergy.netCalorie > 0, neg: todayEnergy.netCalorie < 0 }">
            <span class="e-label">净差</span>
            <span class="e-val">
              {{ todayEnergy.netCalorie > 0 ? '+' : '' }}{{ todayEnergy.netCalorie }}
            </span>
            <span class="e-unit">
              {{ todayEnergy.netCalorie > 0 ? '盈余' : todayEnergy.netCalorie < 0 ? '亏空' : '平衡' }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="todayEnergy.hasProfile" class="stat-section">
        <div class="stat-title">
          能量平衡趋势(近 14 天,负=亏空/减脂,正=盈余/增重)
        </div>
        <MiniLineChart :data="balanceTrend" color="#E67E22" y-unit="" />
      </div>

      <!-- 今日进度 -->
      <div class="stat-section">
        <div class="stat-title">今日完成率</div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${stats.today.rate * 100}%`, backgroundColor: stats.today.rate >= 0.8 ? '#7BC47F' : '#F5A962' }"
          ></div>
        </div>
        <div class="stat-numbers">
          {{ stats.today.completed }} / {{ stats.today.total }}
        </div>
      </div>

      <!-- 本周进度 -->
      <div class="stat-section">
        <div class="stat-title">本周完成率</div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${stats.week.rate * 100}%` }"
          ></div>
        </div>
        <div class="stat-numbers">
          {{ stats.week.completed }} / {{ stats.week.total }}
        </div>
      </div>

      <!-- 本月进度 -->
      <div class="stat-section">
        <div class="stat-title">本月完成率</div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${stats.month.rate * 100}%` }"
          ></div>
        </div>
        <div class="stat-numbers">
          {{ stats.month.completed }} / {{ stats.month.total }}
        </div>
      </div>

      <!-- 健身板块 -->
      <div class="divider">💪 健身数据</div>

      <div class="stat-section">
        <div class="stat-title">
          体重趋势(近 30 天)
          <span v-if="weightTrend.length" class="stat-latest">
            当前 {{ weightTrend[weightTrend.length - 1].y }} kg
          </span>
        </div>
        <MiniLineChart :data="weightTrend" color="#81C9D8" y-unit="kg" />
      </div>

      <div class="stat-section">
        <div class="stat-title">
          训练容量(近 30 天)
          <span class="stat-latest">本周 {{ weekWorkoutCount }} 次</span>
        </div>
        <MiniLineChart :data="volumeTrend" color="#7BC47F" y-unit="kg" />
      </div>

      <div class="stat-section">
        <div class="stat-title">每日热量(近 14 天)</div>
        <MiniLineChart :data="kcalTrend" color="#F5A962" y-unit="" />
      </div>

      <div class="divider">📚 任务分类</div>

      <!-- 分类分布 -->
      <div class="stat-section">
        <div class="category-stats">
          <div
            v-for="(data, catId) in stats.category"
            :key="catId"
            class="category-item"
          >
            <span class="cat-dot" :style="{ backgroundColor: `var(--color-${catId})` }"></span>
            <span class="cat-name">{{ catId }}</span>
            <span class="cat-count">{{ data.total }}</span>
            <span class="cat-rate">{{ Math.round((data.completed / data.total) * 100) || 0 }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stats-panel {
  position: absolute;
  top: 100%;
  right: 20px;
  width: 320px;
  max-height: 80vh;
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  z-index: 50;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--calendar-header-bg);

  h3 {
    font-size: 16px;
    font-weight: 600;
  }
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--bg-hover);
  }
}

.panel-body {
  padding: 16px;
}

.energy-card {
  background: linear-gradient(135deg, rgba(245, 169, 98, 0.14), rgba(129, 201, 216, 0.10));
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 16px;
}

.energy-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.e-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.e-actions { display: flex; gap: 6px; }
.mini-link {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  &.primary { background: var(--color-work); color: white; }
  &:hover { filter: brightness(0.95); }
}

.e-empty {
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  font-size: 12px;
  text-align: center;
}

.e-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.e-cell {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;

  &.net {
    grid-column: 1 / -1;
    background: var(--bg-secondary);

    &.pos {
      background: rgba(231, 76, 60, 0.12);
      .e-val { color: #e74c3c; }
    }
    &.neg {
      background: rgba(123, 196, 127, 0.14);
      .e-val { color: #27ae60; }
    }
  }
}

.e-label { font-size: 11px; color: var(--text-tertiary); }
.e-val {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: monospace;
  &.burn { color: #e67e22; }
  &.intake { color: #16a085; }
}
.e-unit { font-size: 11px; color: var(--text-tertiary); }

.stat-section {
  margin-bottom: 16px;
}

.stat-title {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-latest {
  color: var(--color-work);
  font-weight: 600;
  font-size: 12px;
}

.divider {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 8px 0 4px;
  border-top: 1px solid var(--border-color);
  margin: 8px 0 4px;
}

.progress-bar {
  height: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-work);
  transition: width 0.3s;
}

.stat-numbers {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  text-align: right;
}

.category-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.cat-name {
  flex: 1;
  color: var(--text-primary);
}

.cat-count {
  color: var(--text-secondary);
}

.cat-rate {
  color: var(--color-work);
  font-weight: 500;
}

@media (max-width: 768px) {
  .stats-panel {
    position: fixed;
    inset: 0;
    top: 60px;
    width: 100%;
    border-radius: 0;
  }
}
</style>