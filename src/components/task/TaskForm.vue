<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import type { Task, TaskFormData, RecurrenceRule } from '../../types'
import { DEFAULT_TASK } from '../../types'
import { DEFAULT_CATEGORIES, getCategoryById } from '../../types/category'
import { MUSCLE_GROUPS, EXERCISES_BY_GROUP, WEIGHT_OPTIONS, REP_OPTIONS, DEFAULT_WEIGHT_BY_GROUP, DEFAULT_REPS_BY_GROUP, type WorkoutExercise } from '../../types/health'
import type { StudySession } from '../../types/study'
import { extractTextFromPDF, isPDFFile } from '../../utils/pdfParser'
import { scheduleInitialReviewsFSRS } from '../../utils/fsrs'
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
  durationMinutes: undefined,
  recurrence: undefined,
  remindAt: undefined, // 默认不提醒,需在表单里手动打开开关
  workout: undefined,
})

// 时间模式:timed(默认) | duration | anytime
type TimeMode = 'timed' | 'duration' | 'anytime'
const timeMode = ref<TimeMode>('timed')
// 时长快捷选项(分钟)
const durationPresets = [15, 30, 45, 60, 90, 120, 180]
const durationInput = ref<number>(60)

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

// ==================== 学习任务相关 ====================
const isStudy = computed(() => formData.value.category === 'study')
const studyData = ref<StudySession>({ subject: '', materialText: '' })
const enableEbbinghaus = ref(false)

// 初始复习计划预览(展示给用户看会生成哪些复习任务)
const initialIntervalDays = [1, 2, 4, 7, 15]
// FSRS 预览:根据当前选择的日期,预演首学后 5 条复习任务的实际间隔天数
const fsrsPreviewDays = computed<number[]>(() => {
  const originDate = formData.value.date
  if (!originDate) return initialIntervalDays
  try {
    const schedule = scheduleInitialReviewsFSRS(originDate, 5)
    const origin = dayjs(originDate)
    return schedule.map(s => Math.max(1, dayjs(s.date).diff(origin, 'day')))
  } catch {
    return initialIntervalDays
  }
})

// 上传 MD / 纯文本 / PDF 文件
async function onStudyFileUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (isPDFFile(file)) {
    try {
      const text = await extractTextFromPDF(file)
      studyData.value.materialText = text
      studyData.value.materialFileName = file.name
    } catch (err) {
      console.error('PDF 解析失败:', err)
      // 可以显示错误提示
    }
  } else {
    const text = await file.text()
    studyData.value.materialText = text
    studyData.value.materialFileName = file.name
  }

  target.value = '' // 允许重新上传同名文件
}

// 分类切换到学习时,默认从 title 填充 subject
watch(isStudy, (v) => {
  if (v && !studyData.value.subject) {
    studyData.value.subject = formData.value.title || ''
  }
})
watch(() => formData.value.title, (t) => {
  if (isStudy.value && !studyData.value.subject) studyData.value.subject = t
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
      timeMode.value = 'timed'
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
    // 反推时间模式
    if (task.startTime && task.endTime) {
      timeMode.value = 'timed'
    } else if (task.durationMinutes != null) {
      timeMode.value = 'duration'
      durationInput.value = task.durationMinutes
    } else {
      timeMode.value = 'anytime'
    }
    formData.value = {
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      date: task.date,
      startTime: task.startTime ?? '09:00',
      endTime: task.endTime ?? '10:00',
      durationMinutes: task.durationMinutes,
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
    timeMode.value = 'timed'
    durationInput.value = 60
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
  if (formData.value.title.trim().length === 0) return false
  if (timeMode.value === 'timed') {
    return !!(formData.value.startTime && formData.value.endTime && formData.value.startTime < formData.value.endTime)
  }
  if (timeMode.value === 'duration') {
    return durationInput.value > 0
  }
  return true // anytime
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

  // 学习数据(仅学习分类)
  let studyClean: StudySession | undefined
  if (isStudy.value && studyData.value.subject.trim()) {
    studyClean = {
      subject: studyData.value.subject.trim(),
      materialText: studyData.value.materialText || undefined,
      materialFileName: studyData.value.materialFileName || undefined,
    }
    // 启用艾宾浩斯 → 让 taskStore 生成 ebbinghaus 结构与后续复习任务
    if (enableEbbinghaus.value && !isEditMode.value) {
      // 用一个占位标志,由 taskStore 判断并生成 ebbinghaus 字段
      ;(studyClean as any).__enableEbbinghaus = true
    }
  }

  // 根据时间模式装配时间字段
  let startTime: string | undefined
  let endTime: string | undefined
  let durationMinutes: number | undefined
  if (timeMode.value === 'timed') {
    startTime = formData.value.startTime
    endTime = formData.value.endTime
    // 非定时模式下提醒无意义,仅 timed 保留 remindAt
  } else if (timeMode.value === 'duration') {
    durationMinutes = durationInput.value
  }
  // anytime: 全部保持 undefined

  const submitData: TaskFormData = {
    title: formData.value.title,
    description: formData.value.description,
    category: formData.value.category,
    priority: formData.value.priority,
    date: formData.value.date,
    startTime,
    endTime,
    durationMinutes,
    recurrence,
    remindAt: (timeMode.value === 'timed' && showReminder.value) ? remindAt.value : undefined,
    workout: workoutClean,
    study: studyClean,
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

              <!-- 时间安排 -->
              <div class="form-group">
                <label class="form-label">时间安排</label>
                <div class="time-mode-tabs">
                  <button
                    type="button"
                    class="time-mode-btn"
                    :class="{ active: timeMode === 'timed' }"
                    @click="timeMode = 'timed'"
                  >⏰ 定时</button>
                  <button
                    type="button"
                    class="time-mode-btn"
                    :class="{ active: timeMode === 'duration' }"
                    @click="timeMode = 'duration'"
                  >⏳ 花费时长</button>
                  <button
                    type="button"
                    class="time-mode-btn"
                    :class="{ active: timeMode === 'anytime' }"
                    @click="timeMode = 'anytime'"
                  >📌 全天待办</button>
                </div>
              </div>

              <!-- 时间 (仅定时模式) -->
              <div v-if="timeMode === 'timed'" class="form-row">
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

              <!-- 时长 (仅时长模式) -->
              <div v-else-if="timeMode === 'duration'" class="form-group">
                <label class="form-label">预计花费</label>
                <div class="duration-presets">
                  <button
                    v-for="m in durationPresets"
                    :key="m"
                    type="button"
                    class="duration-chip"
                    :class="{ active: durationInput === m }"
                    @click="durationInput = m"
                  >{{ m < 60 ? m + 'm' : (m % 60 === 0 ? (m / 60) + 'h' : (m / 60).toFixed(1) + 'h') }}</button>
                </div>
                <div class="duration-custom">
                  <input
                    v-model.number="durationInput"
                    type="number"
                    min="1"
                    max="1440"
                    class="form-input"
                    placeholder="自定义分钟数"
                  />
                  <span class="duration-unit">分钟</span>
                </div>
              </div>

              <!-- 全天待办 (仅 anytime 模式,占位说明) -->
              <div v-else class="form-group">
                <div class="anytime-hint">✅ 该任务将归入当天"未排时段"区域,无具体时间</div>
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

              <!-- 学习计划(仅学习分类) -->
              <div v-if="isStudy" class="form-group study-block">
                <label class="form-label">📚 学习内容</label>
                <input
                  v-model="studyData.subject"
                  class="form-input"
                  placeholder="学习主题(如 GRE List 1 / 计算机八股文)"
                />
                <div class="study-material-row">
                  <textarea
                    v-model="studyData.materialText"
                    class="form-textarea"
                    rows="4"
                    placeholder="粘贴学习材料(MD 或纯文本),用于后续复习和 AI 提问"
                  ></textarea>
                </div>
                <div class="study-file-row">
                  <label class="study-file-btn">
                    📎 从文件读取 (.md / .txt / .pdf)
                    <input
                      type="file"
                      accept=".md,.markdown,.txt,.pdf"
                      @change="onStudyFileUpload"
                      style="display: none"
                    />
                  </label>
                  <span v-if="studyData.materialFileName" class="study-file-name">
                    {{ studyData.materialFileName }}
                  </span>
                </div>

                <label class="ebbinghaus-toggle">
                  <input type="checkbox" v-model="enableEbbinghaus" />
                  <span>🔁 启用艾宾浩斯复习计划(自动排期到日历)</span>
                </label>

                <div v-if="enableEbbinghaus" class="ebbinghaus-preview">
                  <div class="ebbinghaus-tip">
                    保存后将按 FSRS 记忆模型自动生成 {{ fsrsPreviewDays.length }} 次复习任务:
                  </div>
                  <div class="ebbinghaus-schedule">
                    <span
                      v-for="d in fsrsPreviewDays"
                      :key="d"
                      class="ebbinghaus-day"
                    >{{ d }} 天后</span>
                  </div>
                  <div class="ebbinghaus-hint">
                    复习时选择"重来/困难/良好/简单",FSRS 会根据你的记忆表现动态调整后续间隔
                  </div>
                </div>
              </div>

              <!-- 提醒 -->
              <div v-if="timeMode === 'timed'" class="form-group">
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
// iOS 任务表单（bottom sheet）
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: var(--radius-xxl) var(--radius-xxl) 0 0;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-bottom: var(--safe-bottom);
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px;
  background: var(--bg-card);
  border-bottom: 0.5px solid var(--separator);
  position: relative;

  h2 {
    font-size: var(--font-size-headline);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .close-btn {
    position: absolute;
    right: 12px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--bg-fill-quaternary);
    color: var(--text-secondary);
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    transition: background var(--transition-fast);

    &:hover { background: var(--bg-pressed); }
  }
}

.modal-body {
  padding: 18px 16px 22px;
  overflow-y: auto;
  flex: 1;
  background: var(--bg-primary);
}

.form-group { margin-bottom: 18px; }

.form-row {
  display: flex;
  gap: 12px;
  .half { flex: 1; }
}

.form-label {
  font-size: var(--font-size-footnote);
  font-weight: 600;
  color: var(--text-tertiary);
  margin-bottom: 6px;
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.4px;

  &.required::after {
    content: '*';
    color: var(--ios-red);
    margin-left: 4px;
  }
}

.form-input {
  width: 100%;
  padding: 12px 14px;
  min-height: 44px;
  border: 0.5px solid transparent;
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: var(--font-size-body);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);

  &::placeholder { color: var(--text-tertiary); }

  &:focus {
    outline: none;
    border-color: var(--ios-blue);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.14);
  }

  &.textarea {
    resize: vertical;
    min-height: 88px;
  }
}

.category-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.category-btn {
  padding: 9px 16px;
  border-radius: var(--radius-full);
  color: white;
  font-size: var(--font-size-sub);
  font-weight: 600;
  opacity: 0.6;
  border: none;
  cursor: pointer;
  transition: opacity var(--transition-fast), transform var(--spring);

  &:active { transform: scale(0.96); }
  &.active { opacity: 1; box-shadow: 0 2px 6px rgba(0,0,0,0.16); }
}

.priority-options {
  display: flex;
  gap: 8px;
}

.priority-btn {
  padding: 10px 14px;
  min-height: 40px;
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: var(--font-size-sub);
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition: all var(--transition-fast);

  &.active {
    background: var(--ios-blue);
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 122, 255, 0.28);
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
  background: var(--bg-card);
  padding: 12px 16px;
  min-height: 44px;
  border-radius: var(--radius-md);
}

.toggle-btn {
  width: 51px;
  height: 31px;
  border-radius: 16px;
  background: var(--bg-fill-quaternary);
  color: transparent;
  font-size: 0;
  position: relative;
  transition: background 0.3s;
  border: none;
  cursor: pointer;
  padding: 0;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 27px;
    height: 27px;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.06);
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  &.active {
    background: var(--ios-green);
    &::after { transform: translateX(20px); }
  }
}

.recurrence-options, .reminder-options {
  margin-top: 10px;
  padding: 12px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
}

.weekday-select {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.weekday-btn {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--bg-fill-quaternary);
  color: var(--text-secondary);
  font-size: var(--font-size-footnote);
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);

  &.active {
    background: var(--ios-blue);
    color: #fff;
  }
}

// 底部按钮
.modal-footer {
  display: flex;
  gap: 10px;
  padding: 14px 16px calc(14px + var(--safe-bottom));
  background: var(--bg-card);
  border-top: 0.5px solid var(--separator);
}

.cancel-btn {
  flex: 1;
  padding: 13px;
  min-height: 48px;
  border-radius: var(--radius-md);
  background: var(--bg-fill-quaternary);
  color: var(--text-primary);
  font-size: var(--font-size-callout);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform var(--spring), opacity var(--transition-fast);

  &:active { transform: scale(0.97); opacity: 0.85; }
}

.submit-btn {
  flex: 2;
  padding: 13px;
  min-height: 48px;
  border-radius: var(--radius-md);
  background: var(--ios-blue);
  color: #fff;
  font-size: var(--font-size-callout);
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: transform var(--spring), opacity var(--transition-fast);
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.28);

  &:active { transform: scale(0.97); opacity: 0.9; }

  &:disabled {
    background: var(--bg-fill-quaternary);
    color: var(--text-tertiary);
    box-shadow: none;
  }
}

.workout-block {
  background: rgba(255, 45, 85, 0.08);
  border-radius: var(--radius-md);
  padding: 14px;
}

.study-block {
  background: rgba(88, 86, 214, 0.06);
  border-radius: var(--radius-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .form-input, .form-textarea { border-radius: var(--radius-sm); }
}

.ebbinghaus-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sub);
  color: var(--text-primary);

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: var(--ios-blue);
  }
}

.ebbinghaus-preview {
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  padding: 12px;
}

.ebbinghaus-day {
  padding: 5px 12px;
  background: rgba(0, 122, 255, 0.14);
  color: var(--ios-blue);
  border-radius: var(--radius-full);
  font-size: var(--font-size-footnote);
  font-weight: 500;
}

// 动画
.fade-enter-active, .fade-leave-active { transition: opacity 0.24s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active, .slide-leave-active {
  transition: transform 0.34s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-enter-from, .slide-leave-to { transform: translateY(100%); }

@media (min-width: 769px) {
  .modal-overlay { align-items: center; padding: 16px; }
  .modal-content { border-radius: var(--radius-xl); max-height: 88vh; }
}

// 时间模式三态切换（iOS 分段控件）
.time-mode-tabs {
  display: flex;
  gap: 2px;
  background: var(--bg-fill-quaternary);
  padding: 2px;
  border-radius: 9px;
}

.time-mode-btn {
  flex: 1;
  padding: 8px 6px;
  border-radius: 7px;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all var(--transition-normal);

  &.active {
    background: var(--bg-card);
    color: var(--text-primary);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
}
.dark .time-mode-btn.active { background: var(--bg-elevated); }

.duration-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.duration-chip {
  padding: 8px 14px;
  border-radius: var(--radius-full);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  font-weight: 500;
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition: all var(--transition-fast);

  &.active {
    background: var(--ios-blue);
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 122, 255, 0.24);
  }
}

.duration-custom {
  display: flex;
  align-items: center;
  gap: 10px;
  .form-input { flex: 1; }
}

.duration-unit {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
}

.anytime-hint {
  padding: 13px 16px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  font-size: var(--font-size-sub);
  line-height: 1.5;
}
</style>