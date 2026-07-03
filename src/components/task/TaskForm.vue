<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import type { Task, TaskFormData, RecurrenceRule } from '../../types'
import { DEFAULT_TASK } from '../../types'
import { DEFAULT_CATEGORIES, getCategoryById } from '../../types/category'
import { MUSCLE_GROUPS, EXERCISES_BY_GROUP, WEIGHT_OPTIONS, REP_OPTIONS, DEFAULT_WEIGHT_BY_GROUP, DEFAULT_REPS_BY_GROUP, type WorkoutExercise } from '../../types/health'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'

const uiStore = useUiStore()
const taskStore = useTaskStore()
const settingStore = useSettingStore()

// 表单数据
const formData = ref<TaskFormData>({
  title: '',
  description: '',
  category: settingStore.settings.defaultCategory,
  priority: 'medium',
  date: uiStore.selectedDate,
  startTime: '09:00',
  endTime: '10:00',
  recurrence: undefined,
  remindAt: undefined, // 默认不提醒,需在表单里手动打开开关
  workout: undefined,
})

// 健身动作列表(仅当 category === 'fitness')
const workoutExercises = ref<WorkoutExercise[]>([])
const isFitness = computed(() => formData.value.category === 'fitness')

function blankExercise(group: string = '胸'): WorkoutExercise {
  const first = EXERCISES_BY_GROUP[group]?.[0] || ''
  return {
    id: uuidv4(),
    name: first,
    muscleGroup: group,
    sets: [{ reps: DEFAULT_REPS_BY_GROUP[group] || 10, weight: DEFAULT_WEIGHT_BY_GROUP[group] }],
  }
}

// 该部位是否允许"自定义动作"
function exerciseOptions(group: string): string[] {
  return EXERCISES_BY_GROUP[group] || []
}

// 判断动作名是否是当前部位下的预设,若否则显示为"自定义"
function isCustomExercise(ex: WorkoutExercise): boolean {
  return !exerciseOptions(ex.muscleGroup || '其他').includes(ex.name)
}

// 切换部位时,重置动作为该部位第一个预设并把默认重量/次数注入
function onGroupChange(ex: WorkoutExercise) {
  const opts = exerciseOptions(ex.muscleGroup || '其他')
  ex.name = opts[0] || ''
  // 保留组数,仅在没值时补默认值
  const dw = DEFAULT_WEIGHT_BY_GROUP[ex.muscleGroup || '其他'] ?? 20
  const dr = DEFAULT_REPS_BY_GROUP[ex.muscleGroup || '其他'] ?? 10
  ex.sets = ex.sets.map(s => ({
    reps: s.reps || dr,
    weight: s.weight != null ? s.weight : dw,
  }))
}

function selectExerciseName(ex: WorkoutExercise, value: string) {
  if (value === '__custom__') {
    ex.name = ''
  } else {
    ex.name = value
  }
}

function addExercise() {
  workoutExercises.value.push(blankExercise())
}
function removeExercise(idx: number) {
  workoutExercises.value.splice(idx, 1)
}
function addSet(exIdx: number) {
  const ex = workoutExercises.value[exIdx]
  const last = ex.sets[ex.sets.length - 1]
  const group = ex.muscleGroup || '其他'
  ex.sets.push({
    reps: last?.reps ?? (DEFAULT_REPS_BY_GROUP[group] ?? 10),
    weight: last?.weight ?? (DEFAULT_WEIGHT_BY_GROUP[group] ?? 20),
  })
}
function removeSet(exIdx: number, setIdx: number) {
  workoutExercises.value[exIdx].sets.splice(setIdx, 1)
}

function weightLabel(v: number): string {
  if (v === 0) return '自重'
  return v + 'kg'
}

// 分类切换到健身时自动初始化一个动作
watch(isFitness, (v) => {
  if (v && workoutExercises.value.length === 0) {
    workoutExercises.value = [blankExercise()]
  }
})

// 是否是编辑模式
const isEditMode = computed(() => uiStore.selectedTaskId !== null)

// 编辑的任务
const editingTask = computed(() => {
  if (uiStore.selectedTaskId) {
    return taskStore.tasks.find(t => t.id === uiStore.selectedTaskId)
  }
  return null
})

// 重复设置
const showRecurrence = ref(false)
const recurrenceType = ref<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none')
const recurrenceInterval = ref(1)
const recurrenceEndDate = ref('')
const recurrenceDaysOfWeek = ref<number[]>([])

// 提醒设置
const showReminder = ref(false)
const remindAt = ref(15)

// 监听prefillTime变化，预填充开始和结束时间
watch(
  () => uiStore.prefillTime,
  (time) => {
    if (time && !isEditMode.value) {
      formData.value.startTime = time
      // 自动设置结束时间为开始时间后一小时
      const [hour, minute] = time.split(':').map(Number)
      const endHour = Math.min(hour + 1, 23)
      formData.value.endTime = `${String(endHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
  },
  { immediate: true }
)

// 加载编辑任务数据
watch(editingTask, (task) => {
  if (task) {
    formData.value = {
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      date: task.date,
      startTime: task.startTime,
      endTime: task.endTime,
      recurrence: task.recurrence,
      remindAt: task.remindAt,
      workout: task.workout,
    }
    workoutExercises.value = task.workout ? JSON.parse(JSON.stringify(task.workout)) : []
    // 同步提醒开关状态
    if (task.remindAt !== undefined && task.remindAt !== null) {
      showReminder.value = true
      remindAt.value = task.remindAt
    } else {
      showReminder.value = false
    }
    // 同步重复开关状态
    if (task.recurrence) {
      showRecurrence.value = true
      recurrenceType.value = task.recurrence.type
      recurrenceInterval.value = task.recurrence.interval
      recurrenceEndDate.value = task.recurrence.endDate || ''
      recurrenceDaysOfWeek.value = task.recurrence.daysOfWeek || []
    } else {
      showRecurrence.value = false
      recurrenceType.value = 'none'
    }
  } else {
    workoutExercises.value = []
    showReminder.value = false
    showRecurrence.value = false
    recurrenceType.value = 'none'
  }
}, { immediate: true })

// 分类选项
const categoryOptions = DEFAULT_CATEGORIES

// 优先级选项
const priorityOptions = [
  { value: 'high', label: '高', color: '#E74C3C' },
  { value: 'medium', label: '中', color: '#F5A962' },
  { value: 'low', label: '低', color: '#A8A8A8' },
]

// 时间选项
const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minute = (i % 2) * 30
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
})

// 提醒时间选项
const remindOptions = [
  { value: 0, label: '任务开始时' },
  { value: 5, label: '提前5分钟' },
  { value: 15, label: '提前15分钟' },
  { value: 30, label: '提前30分钟' },
  { value: 60, label: '提前1小时' },
]

// 周几选项
const weekdays = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
]

// 验证
const isValid = computed(() => {
  return formData.value.title.trim().length > 0 &&
         formData.value.startTime < formData.value.endTime
})

// 提交
async function handleSubmit() {
  if (!isValid.value) return

  // 构建重复规则
  let recurrence: RecurrenceRule | undefined
  if (recurrenceType.value !== 'none') {
    recurrence = {
      type: recurrenceType.value as any,
      interval: recurrenceInterval.value,
      endDate: recurrenceEndDate.value || undefined,
      daysOfWeek: recurrenceType.value === 'weekly' ? recurrenceDaysOfWeek.value : undefined,
    }
  }

  // 清洗健身数据(去除空名和空组)
  let workoutClean: WorkoutExercise[] | undefined
  if (isFitness.value) {
    const cleaned = workoutExercises.value
      .filter(e => e.name.trim() && e.sets.length > 0)
      .map(e => ({ ...e, sets: e.sets.filter(s => s.reps > 0) }))
      .filter(e => e.sets.length > 0)
    workoutClean = cleaned.length > 0 ? cleaned : undefined
  }

  const submitData: TaskFormData = {
    ...formData.value,
    recurrence,
    remindAt: showReminder.value ? remindAt.value : undefined,
    workout: workoutClean,
  }

  // 先捕获编辑所需的任务 ID（closeTaskForm 会将其重置为 null）
  const editingId = uiStore.selectedTaskId

  // 先同步关闭表单，避免竞态条件
  uiStore.closeTaskForm()

  // 再异步保存数据
  if (isEditMode.value && editingId) {
    await taskStore.editTask(editingId, submitData)
  } else {
    await taskStore.createTask(submitData, formData.value.date)
  }
}

// 关闭
function handleClose() {
  uiStore.closeTaskForm()
}

// 切换重复类型时设置默认值
watch(recurrenceType, (type) => {
  if (type === 'weekly') {
    recurrenceDaysOfWeek.value = [dayjs(formData.value.date).day()]
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="uiStore.showTaskForm" class="modal-overlay" @click.self="handleClose">
        <Transition name="slide">
          <div class="modal-content">
            <div class="modal-header">
              <h2>{{ isEditMode ? '编辑任务' : '新建任务' }}</h2>
              <button class="close-btn" @click="handleClose">×</button>
            </div>

            <form class="modal-body" @submit.prevent="handleSubmit">
              <!-- 标题 -->
              <div class="form-group">
                <label class="form-label required">标题</label>
                <input
                  v-model="formData.title"
                  type="text"
                  class="form-input"
                  placeholder="输入任务标题"
                  maxlength="50"
                  autofocus
                />
              </div>

              <!-- 描述 -->
              <div class="form-group">
                <label class="form-label">描述</label>
                <textarea
                  v-model="formData.description"
                  class="form-input textarea"
                  placeholder="输入任务描述（可选）"
                  maxlength="200"
                  rows="2"
                ></textarea>
              </div>

              <!-- 分类 -->
              <div class="form-group">
                <label class="form-label">分类</label>
                <div class="category-options">
                  <button
                    v-for="cat in categoryOptions"
                    :key="cat.id"
                    type="button"
                    class="category-btn"
                    :class="{ active: formData.category === cat.id }"
                    :style="{ backgroundColor: cat.color }"
                    @click="formData.category = cat.id"
                  >
                    {{ cat.name }}
                  </button>
                </div>
              </div>

              <!-- 优先级 -->
              <div class="form-group">
                <label class="form-label">优先级</label>
                <div class="priority-options">
                  <button
                    v-for="pri in priorityOptions"
                    :key="pri.value"
                    type="button"
                    class="priority-btn"
                    :class="{ active: formData.priority === pri.value }"
                    @click="formData.priority = pri.value as any"
                  >
                    <span class="priority-dot" :style="{ backgroundColor: pri.color }"></span>
                    {{ pri.label }}
                  </button>
                </div>
              </div>

              <!-- 日期 -->
              <div class="form-group">
                <label class="form-label">日期</label>
                <input
                  v-model="formData.date"
                  type="date"
                  class="form-input"
                />
              </div>

              <!-- 时间 -->
              <div class="form-row">
                <div class="form-group half">
                  <label class="form-label">开始时间</label>
                  <select v-model="formData.startTime" class="form-input">
                    <option v-for="time in timeOptions" :key="time" :value="time">
                      {{ time }}
                    </option>
                  </select>
                </div>
                <div class="form-group half">
                  <label class="form-label">结束时间</label>
                  <select v-model="formData.endTime" class="form-input">
                    <option v-for="time in timeOptions" :key="time" :value="time">
                      {{ time }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- 健身计划(仅健身分类) -->
              <div v-if="isFitness" class="form-group workout-block">
                <label class="form-label">💪 训练动作</label>
                <div class="workout-tip">全部下拉选择,默认值已填好,直接调整即可</div>
                <div v-for="(ex, exIdx) in workoutExercises" :key="ex.id" class="ex-card">
                  <div class="ex-head">
                    <select v-model="ex.muscleGroup" class="wk-input tight" @change="onGroupChange(ex)">
                      <option v-for="g in MUSCLE_GROUPS" :key="g" :value="g">{{ g }}</option>
                    </select>
                    <select
                      class="wk-input flex"
                      :value="isCustomExercise(ex) ? '__custom__' : ex.name"
                      @change="selectExerciseName(ex, ($event.target as HTMLSelectElement).value)"
                    >
                      <option
                        v-for="opt in exerciseOptions(ex.muscleGroup || '其他')"
                        :key="opt"
                        :value="opt"
                      >{{ opt }}</option>
                      <option value="__custom__">＋ 自定义…</option>
                    </select>
                    <button type="button" class="wk-btn danger" @click="removeExercise(exIdx)">×</button>
                  </div>
                  <input
                    v-if="isCustomExercise(ex)"
                    v-model="ex.name"
                    class="wk-input full custom-name"
                    placeholder="自定义动作名"
                  />
                  <div class="ex-sets">
                    <div v-for="(s, sIdx) in ex.sets" :key="sIdx" class="set-row">
                      <span class="set-idx">#{{ sIdx + 1 }}</span>
                      <select v-model.number="s.weight" class="wk-input tight">
                        <option v-for="w in WEIGHT_OPTIONS" :key="w" :value="w">{{ weightLabel(w) }}</option>
                      </select>
                      <span class="times">×</span>
                      <select v-model.number="s.reps" class="wk-input tight">
                        <option v-for="r in REP_OPTIONS" :key="r" :value="r">{{ r }} 次</option>
                      </select>
                      <button type="button" class="wk-btn" @click="removeSet(exIdx, sIdx)">－</button>
                    </div>
                    <button type="button" class="wk-btn ghost" @click="addSet(exIdx)">＋ 加一组</button>
                  </div>
                </div>
                <button type="button" class="wk-btn ghost full" @click="addExercise">＋ 添加动作</button>
              </div>

              <!-- 提醒 -->
              <div class="form-group">
                <div class="toggle-row">
                  <label class="form-label">提醒</label>
                  <button
                    type="button"
                    class="toggle-btn"
                    :class="{ active: showReminder }"
                    @click="showReminder = !showReminder"
                  >
                    {{ showReminder ? '开启' : '关闭' }}
                  </button>
                </div>
                <div v-if="showReminder" class="reminder-options">
                  <select v-model="remindAt" class="form-input">
                    <option v-for="opt in remindOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- 重复 -->
              <div class="form-group">
                <div class="toggle-row">
                  <label class="form-label">重复</label>
                  <button
                    type="button"
                    class="toggle-btn"
                    :class="{ active: showRecurrence && recurrenceType !== 'none' }"
                    @click="showRecurrence = !showRecurrence"
                  >
                    {{ showRecurrence && recurrenceType !== 'none' ? '开启' : '关闭' }}
                  </button>
                </div>
                <div v-if="showRecurrence" class="recurrence-options">
                  <div class="form-row">
                    <select v-model="recurrenceType" class="form-input half">
                      <option value="none">不重复</option>
                      <option value="daily">每天</option>
                      <option value="weekly">每周</option>
                      <option value="monthly">每月</option>
                      <option value="yearly">每年</option>
                    </select>
                    <input
                      v-if="recurrenceType !== 'none'"
                      v-model.number="recurrenceInterval"
                      type="number"
                      min="1"
                      max="99"
                      class="form-input half"
                      placeholder="间隔"
                    />
                  </div>

                  <!-- 周重复选择 -->
                  <div v-if="recurrenceType === 'weekly'" class="weekday-select">
                    <button
                      v-for="day in weekdays"
                      :key="day.value"
                      type="button"
                      class="weekday-btn"
                      :class="{ active: recurrenceDaysOfWeek.includes(day.value) }"
                      @click="recurrenceDaysOfWeek.includes(day.value)
                        ? recurrenceDaysOfWeek = recurrenceDaysOfWeek.filter(d => d !== day.value)
                        : recurrenceDaysOfWeek.push(day.value)"
                    >
                      {{ day.label }}
                    </button>
                  </div>

                  <!-- 结束日期 -->
                  <div v-if="recurrenceType !== 'none'" class="form-group">
                    <label class="form-label">结束日期（可选）</label>
                    <input
                      v-model="recurrenceEndDate"
                      type="date"
                      class="form-input"
                    />
                  </div>
                </div>
              </div>
            </form>

            <div class="modal-footer">
              <button class="cancel-btn" @click="handleClose">取消</button>
              <button
                class="submit-btn"
                :disabled="!isValid"
                @click="handleSubmit"
              >
                {{ isEditMode ? '保存' : '创建' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);

  h2 {
    font-size: 18px;
    font-weight: 600;
  }
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--bg-hover);
  }
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  gap: 12px;

  .half {
    flex: 1;
  }
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
  display: block;

  &.required::after {
    content: '*';
    color: #E74C3C;
    margin-left: 4px;
  }
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: var(--color-work);
  }

  &.textarea {
    resize: vertical;
  }
}

.category-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.category-btn {
  padding: 8px 16px;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  opacity: 0.7;

  &:hover {
    opacity: 0.9;
  }

  &.active {
    opacity: 1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
}

.priority-options {
  display: flex;
  gap: 8px;
}

.priority-btn {
  padding: 8px 16px;
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover);
  }

  &.active {
    background: var(--calendar-selected-bg);
    color: var(--text-primary);
  }
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle-btn {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-tertiary);
  font-size: 12px;

  &:hover {
    background: var(--bg-hover);
  }

  &.active {
    background: var(--color-work);
    color: white;
  }
}

.recurrence-options, .reminder-options {
  margin-top: 12px;
}

.weekday-select {
  display: flex;
  gap: 6px;
  margin-top: 12px;
}

.weekday-btn {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-tertiary);
  font-size: 12px;

  &:hover {
    background: var(--bg-hover);
  }

  &.active {
    background: var(--color-work);
    color: white;
  }
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.workout-block {
  background: rgba(242, 123, 123, 0.06);
  border: 1px solid rgba(242, 123, 123, 0.25);
  border-radius: 10px;
  padding: 12px;
}

.workout-tip {
  color: var(--text-tertiary);
  font-size: 12px;
  margin-bottom: 10px;
}

.ex-card {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 8px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ex-head {
  display: flex;
  gap: 6px;
  align-items: center;
}

.ex-sets {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 6px;
}

.set-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.set-idx {
  color: var(--text-tertiary);
  min-width: 26px;
  font-family: monospace;
  font-size: 12px;
}

.times { color: var(--text-tertiary); font-size: 12px; }

.wk-input {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  min-height: 36px;
  &.tight { width: 96px; flex-shrink: 0; }
  &.flex { flex: 1; min-width: 0; }
  &.full { width: 100%; }
  &.custom-name { margin-top: 4px; }
}

select.wk-input {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 24px;
}

.wk-btn {
  padding: 5px 10px;
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 12px;
  &:hover { background: var(--bg-hover); }
  &.danger { color: #c0392b; }
  &.ghost {
    background: transparent;
    border: 1px dashed var(--border-color);
    color: var(--text-secondary);
  }
  &.full { width: 100%; padding: 8px; }
}

.cancel-btn {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 14px;

  &:hover {
    background: var(--bg-hover);
  }
}

.submit-btn {
  flex: 2;
  padding: 12px;
  border-radius: 8px;
  background: var(--color-work);
  color: white;
  font-size: 14px;
  font-weight: 500;

  &:hover {
    filter: brightness(1.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// 动画
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s, opacity 0.3s;
}
.slide-enter-from, .slide-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

@media (max-width: 768px) {
  .modal-content {
    max-width: 100%;
    border-radius: 16px 16px 0 0;
    margin-top: auto;
  }
}
</style>