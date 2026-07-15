<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { PlanTemplate, TemplateItem, TemplateFormData } from '../../types'
import { WEEKDAY_LABELS } from '../../types/plan'
import { DEFAULT_CATEGORIES } from '../../types/category'
import { MUSCLE_GROUPS, EXERCISES_BY_GROUP, DEFAULT_WEIGHT_BY_GROUP, DEFAULT_REPS_BY_GROUP } from '../../types/health'
import { usePlanStore } from '../../stores/planStore'

const props = defineProps<{ planId: string; editing: PlanTemplate | null }>()
const emit = defineEmits<{ close: [] }>()

const planStore = usePlanStore()

const form = ref<TemplateFormData>({
  name: '',
  daysOfWeek: [1],
  items: [],
})

const error = ref('')
const saving = ref(false)
// 每个 item 的时间模式(仅前端 UI 状态,不入库,通过字段推断)
type TimeMode = 'timed' | 'duration' | 'anytime'
const timeModes = ref<Record<string, TimeMode>>({})

function detectTimeMode(item: TemplateItem): TimeMode {
  if (item.startTime && item.endTime) return 'timed'
  if (item.durationMinutes && item.durationMinutes > 0) return 'duration'
  return 'anytime'
}

function blankItem(): TemplateItem {
  return {
    id: uuidv4(),
    title: '',
    category: 'study',
    priority: 'medium',
    startTime: '09:00',
    endTime: '10:00',
    study: { subject: '', materialText: '' },
  }
}

watch(
  () => props.editing,
  (e) => {
    if (e) {
      form.value = {
        name: e.name,
        daysOfWeek: [...e.daysOfWeek],
        items: JSON.parse(JSON.stringify(e.items)),
      }
    } else {
      form.value = {
        name: '',
        daysOfWeek: [1],
        items: [blankItem()],
      }
    }
    // 初始化时间模式
    const tm: Record<string, TimeMode> = {}
    for (const it of form.value.items) tm[it.id] = detectTimeMode(it)
    timeModes.value = tm
  },
  { immediate: true },
)

function toggleWeekday(d: number) {
  const idx = form.value.daysOfWeek.indexOf(d)
  if (idx >= 0) form.value.daysOfWeek.splice(idx, 1)
  else form.value.daysOfWeek.push(d)
  form.value.daysOfWeek.sort()
}

function addItem() {
  const it = blankItem()
  form.value.items.push(it)
  timeModes.value[it.id] = 'timed'
}

function removeItem(idx: number) {
  const removed = form.value.items[idx]
  form.value.items.splice(idx, 1)
  if (removed) delete timeModes.value[removed.id]
}

function onItemCategoryChange(item: TemplateItem, newCat: string) {
  item.category = newCat
  // 切换分类时清空对方 slot
  if (newCat === 'study') {
    delete item.workout
    if (!item.study) item.study = { subject: '', materialText: '' }
  } else if (newCat === 'fitness') {
    delete item.study
    if (!item.workout) item.workout = { muscleGroup: '胸', exercises: [] }
  } else {
    delete item.study
    delete item.workout
  }
}

function onTimeModeChange(item: TemplateItem, mode: TimeMode) {
  timeModes.value[item.id] = mode
  if (mode === 'timed') {
    if (!item.startTime) item.startTime = '09:00'
    if (!item.endTime) item.endTime = '10:00'
    item.durationMinutes = undefined
  } else if (mode === 'duration') {
    item.startTime = undefined
    item.endTime = undefined
    if (!item.durationMinutes) item.durationMinutes = 60
  } else {
    item.startTime = undefined
    item.endTime = undefined
    item.durationMinutes = undefined
  }
}

// 健身:添加一个动作
function addFitnessExercise(item: TemplateItem) {
  if (!item.workout) item.workout = { muscleGroup: '胸', exercises: [] }
  const g = item.workout.muscleGroup || '胸'
  const first = EXERCISES_BY_GROUP[g]?.[0] || ''
  if (!item.workout.exercises) item.workout.exercises = []
  item.workout.exercises.push({
    id: uuidv4(),
    name: first,
    muscleGroup: g,
    sets: [{
      reps: DEFAULT_REPS_BY_GROUP[g] || 10,
      weight: DEFAULT_WEIGHT_BY_GROUP[g],
    }],
  })
}
function removeFitnessExercise(item: TemplateItem, idx: number) {
  item.workout?.exercises?.splice(idx, 1)
}
function onMuscleGroupChange(item: TemplateItem) {
  const g = item.workout?.muscleGroup || '其他'
  // 已有动作若来自新部位不匹配的预设,更新为新部位第一动作
  if (item.workout?.exercises) {
    for (const ex of item.workout.exercises) {
      const opts = EXERCISES_BY_GROUP[g] || []
      if (!opts.includes(ex.name)) ex.name = opts[0] || ex.name
      ex.muscleGroup = g
    }
  }
}

async function onSave(alsoExpand: boolean) {
  error.value = ''
  if (!form.value.name.trim()) {
    error.value = '请填写模板名称'
    return
  }
  if (!form.value.daysOfWeek.length) {
    error.value = '至少选择一个星期几'
    return
  }
  if (!form.value.items.length) {
    error.value = '至少添加一条任务'
    return
  }
  for (const it of form.value.items) {
    if (!it.title.trim()) {
      error.value = '任务标题不能为空'
      return
    }
  }

  saving.value = true
  try {
    let templateId: string
    if (props.editing) {
      const updated = await planStore.editTemplate(props.editing.id, form.value)
      templateId = updated?.id || props.editing.id
    } else {
      const tpl = await planStore.addTemplate(props.planId, form.value)
      templateId = tpl.id
    }
    if (alsoExpand) {
      const n = await planStore.expandTemplate(templateId)
      window.alert(n > 0 ? `已生成 ${n} 条日任务` : '所有匹配日期已存在任务,无新增')
    }
    emit('close')
  } catch (e: any) {
    error.value = e?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

const editableCategories = computed(() =>
  // 只显示常用的几个分类以简化 UI
  DEFAULT_CATEGORIES,
)
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content wider">
        <div class="modal-header">
          <h2>{{ editing ? '编辑模板' : '新建模板' }}</h2>
          <button class="close-btn" @click="emit('close')">×</button>
        </div>

        <div class="modal-body">
          <!-- 模板基础信息 -->
          <div class="form-group">
            <label class="form-label required">模板名称</label>
            <input
              v-model="form.name"
              type="text"
              class="form-input"
              maxlength="30"
              placeholder="例如:练胸模板、每日算法、晨间英语"
              autofocus
            />
          </div>

          <div class="form-group">
            <label class="form-label required">星期几(多选)</label>
            <div class="weekday-select">
              <button
                v-for="(label, i) in WEEKDAY_LABELS"
                :key="i"
                type="button"
                class="weekday-btn"
                :class="{ active: form.daysOfWeek.includes(i) }"
                @click="toggleWeekday(i)"
              >
                周{{ label }}
              </button>
            </div>
          </div>

          <!-- 任务清单 -->
          <div class="items-header">
            <label class="form-label">任务清单(该模板下所有星期几每天生成这些任务)</label>
            <button type="button" class="mini-add" @click="addItem">+ 添加任务</button>
          </div>

          <div class="items-list">
            <div
              v-for="(item, idx) in form.items"
              :key="item.id"
              class="item-card"
            >
              <div class="item-head">
                <span class="item-idx">#{{ idx + 1 }}</span>
                <input
                  v-model="item.title"
                  type="text"
                  class="form-input item-title-input"
                  maxlength="40"
                  placeholder="任务标题"
                />
                <button type="button" class="ghost-mini" @click="removeItem(idx)" title="删除">×</button>
              </div>

              <div class="form-group">
                <label class="form-label">分类</label>
                <div class="category-row">
                  <button
                    v-for="c in editableCategories"
                    :key="c.id"
                    type="button"
                    class="category-btn"
                    :class="{ active: item.category === c.id }"
                    :style="{ backgroundColor: c.color }"
                    @click="onItemCategoryChange(item, c.id)"
                  >
                    {{ c.name }}
                  </button>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group half">
                  <label class="form-label">优先级</label>
                  <div class="priority-row">
                    <button type="button" class="priority-btn" :class="{ active: item.priority === 'high' }" @click="item.priority = 'high'">高</button>
                    <button type="button" class="priority-btn" :class="{ active: item.priority === 'medium' }" @click="item.priority = 'medium'">中</button>
                    <button type="button" class="priority-btn" :class="{ active: item.priority === 'low' }" @click="item.priority = 'low'">低</button>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">时间</label>
                <div class="time-mode-row">
                  <button type="button" class="time-mode-btn" :class="{ active: timeModes[item.id] === 'timed' }" @click="onTimeModeChange(item, 'timed')">定时</button>
                  <button type="button" class="time-mode-btn" :class="{ active: timeModes[item.id] === 'duration' }" @click="onTimeModeChange(item, 'duration')">时长</button>
                  <button type="button" class="time-mode-btn" :class="{ active: timeModes[item.id] === 'anytime' }" @click="onTimeModeChange(item, 'anytime')">全天</button>
                </div>
                <div v-if="timeModes[item.id] === 'timed'" class="form-row">
                  <input v-model="item.startTime" type="time" class="form-input half" />
                  <input v-model="item.endTime" type="time" class="form-input half" />
                </div>
                <div v-else-if="timeModes[item.id] === 'duration'" class="form-row">
                  <input v-model.number="item.durationMinutes" type="number" min="1" max="600" class="form-input" placeholder="分钟" />
                </div>
              </div>

              <!-- 学习类特化 slot -->
              <div v-if="item.category === 'study' && item.study" class="slot-block study-slot">
                <p class="slot-title">📚 学习任务附加信息</p>
                <div class="form-group">
                  <label class="form-label">主题(subject)</label>
                  <input
                    v-model="item.study!.subject"
                    type="text"
                    class="form-input"
                    placeholder="例如:数组算法 / 计算机八股 / GRE List 1"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">学习材料(可选,展开后每天的任务都会带上这份材料)</label>
                  <textarea
                    v-model="item.study!.materialText"
                    class="form-input textarea"
                    rows="3"
                    maxlength="2000"
                    placeholder="粘贴知识点、题目、单词表等"
                  />
                </div>
                <label class="toggle-line">
                  <input type="checkbox" v-model="item.study!.enableEbbinghaus" />
                  <span>开启艾宾浩斯复习(每天生成的任务会带复习标记)</span>
                </label>
              </div>

              <!-- 健身类特化 slot -->
              <div v-if="item.category === 'fitness' && item.workout" class="slot-block fitness-slot">
                <p class="slot-title">💪 健身任务附加信息</p>
                <div class="form-group">
                  <label class="form-label">部位</label>
                  <select
                    v-model="item.workout!.muscleGroup"
                    class="form-input"
                    @change="onMuscleGroupChange(item)"
                  >
                    <option v-for="g in MUSCLE_GROUPS" :key="g" :value="g">{{ g }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <div class="items-header">
                    <label class="form-label">动作清单</label>
                    <button type="button" class="mini-add" @click="addFitnessExercise(item)">+ 添加动作</button>
                  </div>
                  <div v-for="(ex, exIdx) in item.workout!.exercises || []" :key="ex.id" class="exercise-row">
                    <select v-model="ex.name" class="form-input flex-1">
                      <option v-for="opt in EXERCISES_BY_GROUP[item.workout!.muscleGroup || '其他'] || []" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                    <input v-model.number="ex.sets[0].reps" type="number" class="form-input mini-num" min="1" title="次数" />
                    <span class="times">×</span>
                    <input v-model.number="ex.sets[0].weight" type="number" class="form-input mini-num" min="0" title="重量kg" />
                    <button type="button" class="ghost-mini" @click="removeFitnessExercise(item, exIdx)">×</button>
                  </div>
                  <p v-if="!(item.workout!.exercises || []).length" class="hint-small">还没有动作,点右上「+ 添加动作」</p>
                </div>
              </div>
            </div>
          </div>

          <p v-if="!form.items.length" class="empty-inline">
            还没有任务。点上方「+ 添加任务」开始。
          </p>

          <p v-if="error" class="error-hint">{{ error }}</p>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="emit('close')">取消</button>
            <button type="button" class="btn-secondary" :disabled="saving" @click="onSave(false)">保存草稿</button>
            <button type="button" class="btn-primary" :disabled="saving" @click="onSave(true)">
              {{ saving ? '保存中...' : '保存并展开' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@import './planDialog.shared.scss';

.modal-content.wider { max-width: 640px; }

.items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 12px;
}
.mini-add {
  background: transparent;
  border: 0.5px solid var(--ios-blue);
  color: var(--ios-blue);
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  &:hover { background: rgba(0,122,255,0.08); }
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.item-card {
  background: var(--bg-card);
  border: 0.5px solid var(--separator);
  border-radius: 12px;
  padding: 14px;
}

.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.item-idx {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}
.item-title-input { flex: 1; }
.ghost-mini {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 17px;
  &:hover { background: rgba(255,59,48,0.12); color: #ff3b30; }
}

.slot-block {
  margin-top: 10px;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 10px;
  border-left: 3px solid var(--ios-blue);
}
.slot-block.fitness-slot { border-left-color: #F27B7B; }
.slot-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.toggle-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  padding: 6px 0;
}

.exercise-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  .flex-1 { flex: 1; min-width: 0; }
}
.mini-num { width: 64px; text-align: center; }
.times { color: var(--text-secondary); font-size: 13px; }
.hint-small { font-size: 12px; color: var(--text-secondary); }

.empty-inline {
  text-align: center;
  color: var(--text-secondary);
  padding: 20px;
  font-size: 13px;
}
</style>
