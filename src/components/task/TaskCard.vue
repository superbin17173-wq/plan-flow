<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Task } from '../../types'
import { getCategoryById } from '../../types/category'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import { useHealthStore } from '../../stores/healthStore'
import { calcTaskCalories, currentWeight } from '../../utils/calorie'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()
const healthStore = useHealthStore()

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
  return `${task.value.startTime} - ${task.value.endTime}`
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
  </Teleport>
</template>

<style scoped lang="scss">
.card-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.task-card {
  background: var(--bg-secondary);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 500px;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  border-top: 4px solid;
}

.card-header {
  padding: 20px;
  color: white;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 18px;
  font-weight: 600;

  &.completed {
    text-decoration: line-through;
    opacity: 0.8;
  }
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}

.card-meta {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  font-size: 14px;
  opacity: 0.9;
}

.card-body {
  padding: 20px;
}

.card-section {
  margin-bottom: 16px;
}

.section-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}

.section-content {
  font-size: 14px;
  color: var(--text-primary);
}

.priority-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;

  &.high {
    background: rgba(231, 76, 60, 0.2);
    color: #E74C3C;
  }

  &.medium {
    background: rgba(245, 169, 98, 0.2);
    color: #F5A962;
  }

  &.low {
    background: rgba(168, 168, 168, 0.2);
    color: #A8A8A8;
  }
}

.workout-section .section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.workout-badge {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(242, 123, 123, 0.15);
  color: #d85555;
  font-size: 11px;
  font-weight: 500;
}

.kcal-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-top: 8px;
  background: linear-gradient(135deg, rgba(245, 169, 98, 0.16), rgba(231, 76, 60, 0.10));
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);

  b {
    color: #e67e22;
    font-size: 16px;
    font-family: monospace;
  }

  .kcal-tip {
    color: var(--text-tertiary);
    font-size: 11px;
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
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ex-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.ex-tag {
  background: var(--color-work);
  color: white;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
}

.ex-name {
  color: var(--text-primary);
  font-weight: 500;
}

.ex-sets {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding-left: 4px;
}

.set-chip {
  background: var(--bg-hover);
  color: var(--text-secondary);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
}

.card-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.complete-btn, .edit-btn, .delete-btn {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
}

.complete-btn {
  background: var(--color-work);
  color: white;

  &.completed {
    background: var(--bg-primary);
    color: var(--text-secondary);
  }

  &:hover {
    filter: brightness(1.1);
  }
}

.edit-btn {
  background: var(--bg-primary);
  color: var(--text-secondary);

  &:hover {
    background: var(--bg-hover);
  }
}

.delete-btn {
  background: rgba(231, 76, 60, 0.1);
  color: #E74C3C;

  &:hover {
    background: rgba(231, 76, 60, 0.2);
  }
}

// 动画
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.3s, opacity 0.3s;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (min-width: 769px) {
  .card-overlay {
    align-items: center;
  }

  .task-card {
    border-radius: 16px;
  }
}
</style>