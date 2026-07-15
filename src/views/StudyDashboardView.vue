<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useTaskStore } from '../stores/taskStore'
import { useRouter } from 'vue-router'
import type { Task } from '../types'
import { MASTERY_LABELS, type MasteryLevel, type StudyQuestion } from '../types/study'

const taskStore = useTaskStore()
const router = useRouter()

const today = dayjs().format('YYYY-MM-DD')

// 今日需复习的任务
const todayReviews = computed(() => {
  return taskStore.tasks.filter(t =>
    t.study?.ebbinghaus?.enabled &&
    !t.isCompleted &&
    t.date === today
  )
})

// 所有学习任务（首学 + 复习）
const allStudyTasks = computed(() => {
  return taskStore.tasks.filter(t => t.study?.ebbinghaus?.enabled)
})

// 掌握度分布
const masteryDistribution = computed(() => {
  const dist: Record<string, number> = { again: 0, hard: 0, good: 0, easy: 0 }
  for (const t of allStudyTasks.value) {
    const history = t.study?.ebbinghaus?.masteryHistory || []
    for (const h of history) {
      dist[h.level] = (dist[h.level] || 0) + 1
    }
  }
  return dist
})

// 逐题掌握度分布(基于题目的最近一次评估)
const questionMasteryDistribution = computed(() => {
  const dist: Record<MasteryLevel, number> = { again: 0, hard: 0, good: 0, easy: 0 }
  for (const t of allStudyTasks.value) {
    const questions = t.study?.questions || []
    for (const q of questions) {
      if (q.masteryHistory.length === 0) continue
      const lastLevel = q.masteryHistory[q.masteryHistory.length - 1].level
      dist[lastLevel]++
    }
  }
  return dist
})

// 所有有评估记录的题目(用于薄弱题目排行)
const allAssessedQuestions = computed(() => {
  const result: { question: StudyQuestion; subject: string; taskId: string }[] = []
  for (const t of allStudyTasks.value) {
    const questions = t.study?.questions || []
    for (const q of questions) {
      if (q.masteryHistory.length > 0) {
        result.push({ question: q, subject: t.study?.subject || t.title, taskId: t.id })
      }
    }
  }
  return result
})

// 薄弱题目 Top 10 (按 FSRS stability 升序)
const weakestQuestions = computed(() => {
  return [...allAssessedQuestions.value]
    .sort((a, b) => a.question.fsrs.stability - b.question.fsrs.stability)
    .slice(0, 10)
})

// 总题目数
const totalQuestions = computed(() => {
  let count = 0
  for (const t of allStudyTasks.value) {
    count += (t.study?.questions || []).length
  }
  return count
})

// 复习热力图数据（最近 90 天）
const heatmapData = computed(() => {
  const data: { date: string; count: number }[] = []
  for (let i = 0; i < 90; i++) {
    const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
    const count = taskStore.tasks.filter(t =>
      t.study?.ebbinghaus?.enabled &&
      t.date === d &&
      (t.isCompleted || t.study.ebbinghaus.masteryHistory.length > 0)
    ).length
    data.push({ date: d, count })
  }
  return data.reverse() // 从旧到新
})

// 热力图颜色
function heatmapColor(count: number): string {
  if (count === 0) return 'var(--bg-primary)'
  if (count < 2) return 'rgba(108, 155, 235, 0.2)'
  if (count < 4) return 'rgba(108, 155, 235, 0.4)'
  if (count < 6) return 'rgba(108, 155, 235, 0.6)'
  return 'rgba(108, 155, 235, 0.8)'
}

// 统计数字
const totalStudyTasks = computed(() => allStudyTasks.value.length)
const completedReviews = computed(() =>
  allStudyTasks.value.filter(t => t.isCompleted).length
)
const averageEF = computed(() => {
  const efs = allStudyTasks.value
    .filter(t => t.study?.ebbinghaus?.sm2?.easinessFactor != null)
    .map(t => t.study!.ebbinghaus!.sm2!.easinessFactor)
  if (efs.length === 0) return 2.5
  return efs.reduce((a, b) => a + b, 0) / efs.length
})

// 点击复习任务
function goToReview(task: Task) {
  router.push('/#/planflow')
  // 设置选中日期并打开任务卡片
  // 需要通过 uiStore 操作，这里简化处理
}

onMounted(async () => {
  await taskStore.loadTasks()
})
</script>

<template>
  <div class="study-dashboard">
    <header class="dashboard-header">
      <h1>📚 学习仪表盘</h1>
      <button class="back-btn" @click="router.push('/#/planflow')">← 返回日历</button>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon">📖</div>
        <div class="stat-value">{{ totalStudyTasks }}</div>
        <div class="stat-label">学习计划</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-value">{{ completedReviews }}</div>
        <div class="stat-label">已完成复习</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎯</div>
        <div class="stat-value">{{ averageEF.toFixed(2) }}</div>
        <div class="stat-label">平均 EF</div>
      </div>
      <div class="stat-card today-card">
        <div class="stat-icon">🔥</div>
        <div class="stat-value">{{ todayReviews.length }}</div>
        <div class="stat-label">今日复习</div>
      </div>
    </div>

    <!-- 今日复习清单 -->
    <section class="today-section">
      <h2>今日复习清单</h2>
      <div v-if="todayReviews.length === 0" class="empty">
        🎉 今日没有待复习任务
      </div>
      <div v-else class="review-list">
        <div
          v-for="task in todayReviews"
          :key="task.id"
          class="review-item"
          @click="goToReview(task)"
        >
          <div class="review-badge">
            第 {{ task.study?.ebbinghaus?.reviewIndex }} 次复习
          </div>
          <div class="review-subject">{{ task.study?.subject }}</div>
          <div class="review-sm2">
            EF: {{ task.study?.ebbinghaus?.sm2?.easinessFactor }}
          </div>
        </div>
      </div>
    </section>

    <!-- 掌握度分布 -->
    <section class="mastery-section">
      <h2>掌握度分布</h2>
      <div class="mastery-chart">
        <div
          v-for="(count, level) in masteryDistribution"
          :key="level"
          class="mastery-bar"
          :class="`mastery-${level}`"
        >
          <span class="mastery-label">{{ MASTERY_LABELS[level as MasteryLevel] }}</span>
          <div class="bar-fill" :style="{ width: `${(count / Object.values(masteryDistribution).reduce((a,b) => a+b, 0) || 1) * 100}%` }"></div>
          <span class="mastery-count">{{ count }}</span>
        </div>
      </div>
    </section>

    <!-- 逐题掌握度分布(有题目时显示) -->
    <section v-if="totalQuestions > 0" class="mastery-section">
      <h2>逐题掌握度 ({{ totalQuestions }} 道题)</h2>
      <div class="mastery-chart">
        <div
          v-for="(count, level) in questionMasteryDistribution"
          :key="level"
          class="mastery-bar"
          :class="`mastery-${level}`"
        >
          <span class="mastery-label">{{ MASTERY_LABELS[level as MasteryLevel] }}</span>
          <div class="bar-fill" :style="{ width: `${(count / Object.values(questionMasteryDistribution).reduce((a,b) => a+b, 0) || 1) * 100}%` }"></div>
          <span class="mastery-count">{{ count }}</span>
        </div>
      </div>
    </section>

    <!-- 薄弱题目 Top 10 -->
    <section v-if="weakestQuestions.length > 0" class="weakest-section">
      <h2>🔴 最薄弱题目 Top {{ weakestQuestions.length }}</h2>
      <div class="weakest-list">
        <div
          v-for="(item, i) in weakestQuestions"
          :key="item.question.id"
          class="weakest-item"
        >
          <span class="weakest-rank">{{ i + 1 }}</span>
          <div class="weakest-content">
            <div class="weakest-text">{{ item.question.text }}</div>
            <div class="weakest-meta">
              {{ item.subject }}
              · 稳定度 {{ item.question.fsrs.stability.toFixed(1) }} 天
              · {{ MASTERY_LABELS[item.question.masteryHistory[item.question.masteryHistory.length - 1]?.level || 'good'] }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 复习热力图 -->
    <section class="heatmap-section">
      <h2>复习热力图（最近 90 天）</h2>
      <div class="heatmap-grid">
        <div
          v-for="d in heatmapData"
          :key="d.date"
          class="heatmap-cell"
          :style="{ background: heatmapColor(d.count) }"
          :title="`${d.date}: ${d.count} 次复习`"
        ></div>
      </div>
      <div class="heatmap-labels">
        <span>少</span>
        <span class="heatmap-legend">
          <span class="legend-cell" style="background: var(--bg-primary)"></span>
          <span class="legend-cell" style="background: rgba(108, 155, 235, 0.2)"></span>
          <span class="legend-cell" style="background: rgba(108, 155, 235, 0.4)"></span>
          <span class="legend-cell" style="background: rgba(108, 155, 235, 0.6)"></span>
          <span class="legend-cell" style="background: rgba(108, 155, 235, 0.8)"></span>
        </span>
        <span>多</span>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.study-dashboard {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  h1 {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary);
  }
}

.back-btn {
  padding: 10px 18px;
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;

  &:hover { background: var(--bg-hover); }
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 12px;
  text-align: center;

  .stat-icon { font-size: 28px; margin-bottom: 8px; }
  .stat-value { font-size: 32px; font-weight: 700; color: var(--text-primary); }
  .stat-label { font-size: 13px; color: var(--text-tertiary); margin-top: 4px; }

  &.today-card {
    background: rgba(108, 155, 235, 0.1);
    border: 2px solid rgba(108, 155, 235, 0.3);
  }
}

.today-section, .mastery-section, .heatmap-section {
  margin-bottom: 32px;

  h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
  }
}

.empty {
  padding: 32px;
  background: var(--bg-secondary);
  border-radius: 12px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.review-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  cursor: pointer;

  &:hover { background: var(--bg-hover); }
}

.review-badge {
  padding: 4px 10px;
  background: rgba(108, 155, 235, 0.15);
  color: rgb(80, 130, 220);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}

.review-subject {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.review-sm2 {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-left: auto;
}

.mastery-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.mastery-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mastery-label {
  min-width: 60px;
  font-size: 14px;
  font-weight: 500;

  &.mastery-again { color: rgb(200, 70, 70); }
  &.mastery-hard { color: rgb(200, 130, 40); }
  &.mastery-good { color: rgb(60, 150, 80); }
  &.mastery-easy { color: rgb(80, 130, 220); }
}

.bar-fill {
  height: 24px;
  background: currentColor;
  border-radius: 4px;
  opacity: 0.4;
}

.mastery-count {
  font-size: 13px;
  color: var(--text-tertiary);
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  gap: 4px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.heatmap-cell {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 2px;
}

.heatmap-labels {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.heatmap-legend {
  display: flex;
  gap: 4px;
}

.legend-cell {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  .heatmap-grid {
    grid-template-columns: repeat(10, 1fr);
  }
}

.weakest-section {
  margin-bottom: 32px;

  h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
  }
}

.weakest-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.weakest-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border-left: 3px solid rgba(240, 100, 100, 0.4);
}

.weakest-rank {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(240, 100, 100, 0.15);
  color: rgb(200, 70, 70);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.weakest-content {
  flex: 1;
  min-width: 0;
}

.weakest-text {
  font-size: 14px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weakest-meta {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
</style>