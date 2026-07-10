<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import type { Task } from '../../types'
import { getCategoryById } from '../../types/category'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import { useHealthStore } from '../../stores/healthStore'
import { calcTaskCalories, currentWeight } from '../../utils/calorie'
import { MASTERY_LABELS } from '../../types/study'
import ReviewDialog from './ReviewDialog.vue'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()
const healthStore = useHealthStore()

// 复习评估对话框
const showReviewDialog = ref(false)

// 当前任务
const task = computed(() => {
  if (uiStore.selectedTaskId) {
    return taskStore.tasks.find(t => t.id === uiStore.selectedTaskId)
  }
  return null
})

// 分类信息
const category = computed(() => {
  if (task.value) {
    return getCategoryById(task.value.category)
  }
  return null
})

// 重复信息文本
const recurrenceText = computed(() => {
  if (!task.value?.recurrence) return null
  const r = task.value.recurrence
  const typeNames = { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' }
  let text = `${typeNames[r.type]}`
  if (r.interval > 1) text += ` (间隔${r.interval})`
  if (r.endDate) text += ` 直到 ${r.endDate}`
  return text
})

// 提醒信息文本
const remindText = computed(() => {
  if (!task.value?.remindAt) return null
  if (task.value.remindAt === 0) return '任务开始时提醒'
  return `提前 ${task.value.remindAt} 分钟提醒`
})

// 训练摘要
const workoutSummary = computed(() => {
  const w = task.value?.workout
  if (!w || w.length === 0) return null
  let volume = 0
  let setCount = 0
  for (const ex of w) {
    for (const s of ex.sets) {
      setCount++
      if (s.weight != null && s.reps != null) volume += s.weight * s.reps
    }
  }
  const latestM = [...healthStore.measurements]
    .filter(m => m.weight && m.weight > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const weight = currentWeight(settingStore.settings, latestM)
  const kcal = task.value ? calcTaskCalories(task.value, weight) : 0
  return { exCount: w.length, setCount, volume: Math.round(volume), kcal, weight }
})

// 完成状态切换
async function handleToggleComplete() {
  if (task.value) {
    await taskStore.toggleComplete(task.value.id)
  }
}

// 编辑
function handleEdit() {
  if (task.value) {
    const taskId = task.value.id
    uiStore.closeTaskCard()
    uiStore.openTaskForm(taskId)
  }
}

// 删除
async function handleDelete() {
  if (task.value && confirm('确定删除此任务？')) {
    await taskStore.removeTask(task.value.id)
    uiStore.closeTaskCard()
  }
}

// 关闭
function handleClose() {
  uiStore.closeTaskCard()
}

// 时间显示
const timeDisplay = computed(() => {
  if (!task.value) return ''
  const t = task.value
  if (t.startTime && t.endTime) return `${t.startTime} - ${t.endTime}`
  if (t.durationMinutes != null) {
    const m = t.durationMinutes
    if (m >= 60) {
      const h = m / 60
      return `预计 ${Number.isInteger(h) ? h : h.toFixed(1)}h`
    }
    return `预计 ${m}m`
  }
  return '全天'
})

// 日期显示
const dateDisplay = computed(() => {
  if (!task.value) return ''
  const d = dayjs(task.value.date)
  const today = dayjs()
  if (d.isSame(today, 'day')) return '今天'
  if (d.isSame(today.subtract(1, 'day'), 'day')) return '昨天'
  if (d.isSame(today.add(1, 'day'), 'day')) return '明天'
  return d.format('YYYY年MM月DD日')
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="uiStore.showTaskCard && task" class="card-overlay" @click.self="handleClose">
        <Transition name="slide-up">
          <div
            class="task-card"
            :style="{ borderColor: category?.color }"
          >
            <!-- 头部 -->
            <div class="card-header" :style="{ backgroundColor: category?.color }">
              <div class="card-title-row">
                <span class="card-title" :class="{ completed: task.isCompleted }">
                  {{ task.title }}
                </span>
                <button class="close-btn" @click="handleClose">×</button>
              </div>
              <div class="card-meta">
                <span>{{ dateDisplay }}</span>
                <span>{{ timeDisplay }}</span>
                <span v-if="category">{{ category.name }}</span>
              </div>
            </div>

            <!-- 内容 -->
            <div class="card-body">
              <!-- 描述 -->
              <div v-if="task.description" class="card-section">
                <div class="section-label">描述</div>
                <div class="section-content">{{ task.description }}</div>
              </div>

              <!-- 优先级 -->
              <div class="card-section">
                <div class="section-label">优先级</div>
                <div class="section-content">
                  <span class="priority-tag" :class="task.priority">
                    {{ task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低' }}
                  </span>
                </div>
              </div>

              <!-- 学习任务(学习分类 + 艾宾浩斯) -->
              <div v-if="task.study" class="card-section study-section">
                <div class="section-label">
                  📚 学习内容
                  <span v-if="task.study.ebbinghaus" class="study-badge">
                    第 {{ task.study.ebbinghaus.reviewIndex }} 次{{ task.study.ebbinghaus.reviewIndex === 0 ? '学习' : '复习' }}
                  </span>
                </div>
                <div class="study-subject">{{ task.study.subject }}</div>
                <div v-if="task.study.materialFileName" class="study-file">
                  📎 {{ task.study.materialFileName }}
                </div>
                <div
                  v-if="task.study.materialText"
                  class="study-material"
                >{{ task.study.materialText.slice(0, 240) }}<span v-if="task.study.materialText.length > 240">…</span></div>
                <div v-if="task.study.ebbinghaus && !task.isCompleted" class="study-actions">
                  <button class="study-review-btn" @click="showReviewDialog = true">
                    🔁 开始复习评估
                  </button>
                </div>
                <div v-if="task.study.ebbinghaus?.masteryHistory?.length" class="study-history">
                  <span class="section-label" style="font-size:12px">评估历史:</span>
                  <span
                    v-for="(h, i) in task.study.ebbinghaus.masteryHistory"
                    :key="i"
                    class="mastery-chip"
                    :class="`mastery-${h.level}`"
                  >{{ MASTERY_LABELS[h.level] }}</span>
                </div>
              </div>

              <!-- 训练动作(健身分类) -->
              <div v-if="task.workout && task.workout.length > 0" class="card-section workout-section">
                <div class="section-label">
                  💪 训练详情
                  <span v-if="workoutSummary" class="workout-badge">
                    {{ workoutSummary.exCount }} 动作 · {{ workoutSummary.setCount }} 组<span v-if="workoutSummary.volume > 0"> · {{ workoutSummary.volume }}kg</span>
                  </span>
                </div>
                <div v-if="workoutSummary && workoutSummary.kcal > 0" class="kcal-row">
                  <span>🔥 预估消耗</span>
                  <b>{{ workoutSummary.kcal }} kcal</b>
                  <span class="kcal-tip">按体重 {{ workoutSummary.weight }}kg × 动作 MET 估算</span>
                </div>
                <div class="workout-list">
                  <div v-for="ex in task.workout" :key="ex.id" class="ex-item">
                    <div class="ex-name-row">
                      <span class="ex-tag">{{ ex.muscleGroup }}</span>
                      <span class="ex-name">{{ ex.name }}</span>
                    </div>
                    <div class="ex-sets">
                      <span v-for="(s, i) in ex.sets" :key="i" class="set-chip">
                        {{ s.weight != null ? s.weight + 'kg×' + s.reps : s.reps + ' 次' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 重复 -->
              <div v-if="recurrenceText" class="card-section">
                <div class="section-label">重复</div>
                <div class="section-content">{{ recurrenceText }}</div>
              </div>

              <!-- 提醒 -->
              <div v-if="remindText" class="card-section">
                <div class="section-label">提醒</div>
                <div class="section-content">{{ remindText }}</div>
              </div>
            </div>

            <!-- 操作 -->
            <div class="card-footer">
              <button
                class="complete-btn"
                :class="{ completed: task.isCompleted }"
                @click="handleToggleComplete"
              >
                {{ task.isCompleted ? '取消完成' : '标记完成' }}
              </button>
              <button class="edit-btn" @click="handleEdit">编辑</button>
              <button class="delete-btn" @click="handleDelete">删除</button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
    <ReviewDialog v-if="task && task.study?.ebbinghaus" v-model="showReviewDialog" :task="task" />
  </Teleport>
</template>

<style scoped lang="scss">
.card-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  padding: 0;
}

.task-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-xxl) var(--radius-xxl) 0 0;
  width: 100%;
  max-width: 520px;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  border-top: 3px solid;
  padding-bottom: var(--safe-bottom);
}

.card-header {
  padding: 20px 20px 16px;
  color: #fff;
  position: relative;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  font-size: var(--font-size-title3);
  font-weight: 700;
  letter-spacing: -0.02em;

  &.completed { text-decoration: line-through; opacity: 0.78; }
}

.close-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  color: white;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover { background: rgba(255, 255, 255, 0.34); }
}

.card-meta {
  display: flex;
  gap: 12px;
  margin-top: 10px;
  font-size: var(--font-size-sub);
  opacity: 0.95;
  flex-wrap: wrap;
}

.card-body { padding: 18px 20px; }

.card-section { margin-bottom: 16px; }
.card-section:last-child { margin-bottom: 0; }

.section-label {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-weight: 600;
}

.section-content {
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  line-height: 1.5;
}

.priority-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption);
  font-weight: 600;

  &.high   { background: rgba(255, 59, 48, 0.16); color: var(--ios-red); }
  &.medium { background: rgba(255, 149, 0, 0.16); color: var(--ios-orange); }
  &.low    { background: var(--bg-fill-quaternary); color: var(--text-tertiary); }
}

.workout-section .section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-footnote);
  color: var(--text-primary);
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
}

.study-section {
  background: rgba(88, 86, 214, 0.06);
  border: 1px solid rgba(88, 86, 214, 0.18);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .section-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-footnote);
    color: var(--text-primary);
    font-weight: 600;
    text-transform: none;
    letter-spacing: normal;
  }
}

.study-badge {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption2);
  background: rgba(88, 86, 214, 0.18);
  color: var(--ios-indigo);
  font-weight: 600;
}

.study-subject {
  font-size: var(--font-size-callout);
  font-weight: 600;
  color: var(--text-primary);
}

.study-file {
  font-size: var(--font-size-caption2);
  color: var(--text-tertiary);
}

.study-material {
  padding: 10px 12px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.55;
}

.study-review-btn {
  padding: 10px 18px;
  background: var(--ios-indigo);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sub);
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: transform var(--spring), filter var(--transition-fast);

  &:hover { filter: brightness(1.08); }
  &:active { transform: scale(0.97); }
}

.study-history {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.mastery-chip {
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption2);
  font-weight: 600;

  &.mastery-again { background: rgba(255, 59, 48, 0.14); color: var(--ios-red); }
  &.mastery-hard  { background: rgba(255, 149, 0, 0.15); color: var(--ios-orange); }
  &.mastery-good  { background: rgba(52, 199, 89, 0.15); color: var(--ios-green); }
  &.mastery-easy  { background: rgba(0, 122, 255, 0.15); color: var(--ios-blue); }
}

.workout-badge {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: rgba(255, 45, 85, 0.14);
  color: var(--ios-pink);
  font-size: var(--font-size-caption2);
  font-weight: 600;
}

.kcal-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-top: 8px;
  background: linear-gradient(135deg, rgba(255, 149, 0, 0.14), rgba(255, 59, 48, 0.08));
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
  color: var(--text-secondary);

  b {
    color: var(--ios-orange);
    font-size: var(--font-size-callout);
    font-family: var(--font-mono);
  }
  .kcal-tip {
    color: var(--text-tertiary);
    font-size: var(--font-size-caption2);
    margin-left: auto;
  }
}

.workout-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.ex-item {
  background: var(--bg-fill-quaternary);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ex-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-footnote);
}

.ex-tag {
  background: var(--color-work);
  color: white;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption2);
  font-weight: 600;
}

.ex-name { color: var(--text-primary); font-weight: 600; }

.ex-sets {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding-left: 4px;
}

.set-chip {
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-caption);
  font-family: var(--font-mono);
}

.card-footer {
  display: flex;
  gap: 10px;
  padding: 14px 20px calc(14px + var(--safe-bottom));
  border-top: 0.5px solid var(--separator);
  background: var(--bg-card);
}

.complete-btn, .edit-btn, .delete-btn {
  flex: 1;
  padding: 12px;
  min-height: 44px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-callout);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform var(--spring), opacity var(--transition-fast);

  &:active { transform: scale(0.97); opacity: 0.85; }
}

.complete-btn {
  background: var(--ios-blue);
  color: white;

  &.completed {
    background: var(--bg-fill-quaternary);
    color: var(--text-secondary);
  }
}

.edit-btn {
  background: var(--bg-fill-quaternary);
  color: var(--text-primary);
}

.delete-btn {
  background: rgba(255, 59, 48, 0.14);
  color: var(--ios-red);
}

// 动画
.fade-enter-active, .fade-leave-active { transition: opacity 0.24s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.34s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.24s;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (min-width: 769px) {
  .card-overlay { align-items: center; padding: 16px; }
  .task-card { border-radius: var(--radius-xl); }
}
</style>