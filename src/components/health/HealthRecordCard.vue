<script setup lang="ts">
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useHealthStore } from '../../stores/healthStore'
import { MUSCLE_GROUPS, MEAL_TYPE_LABELS, calcWorkoutVolume, calcMealCalories } from '../../types/health'
import type { MealType, WorkoutExercise, WorkoutEntry, MeasurementEntry, MealEntry } from '../../types'

const props = defineProps<{ date: string }>()
const health = useHealthStore()

const tab = ref<'workout' | 'body' | 'diet'>('workout')

// ==== 健身训练 ====
const workoutsToday = computed(() => health.getWorkoutsByDate(props.date))
const editingWorkout = ref<WorkoutEntry | null>(null)

function blankExercise(): WorkoutExercise {
  return { id: uuidv4(), name: '', muscleGroup: '胸', sets: [{ reps: 10, weight: undefined }] }
}

function newWorkout() {
  editingWorkout.value = {
    id: uuidv4(),
    date: props.date,
    startTime: '',
    durationMin: undefined,
    exercises: [blankExercise()],
    notes: '',
    createdAt: 0,
    updatedAt: 0,
  }
}

function editWorkout(w: WorkoutEntry) {
  editingWorkout.value = JSON.parse(JSON.stringify(w))
}

function addExercise() {
  if (!editingWorkout.value) return
  editingWorkout.value.exercises.push(blankExercise())
}

function removeExercise(idx: number) {
  if (!editingWorkout.value) return
  editingWorkout.value.exercises.splice(idx, 1)
}

function addSet(exIdx: number) {
  if (!editingWorkout.value) return
  const ex = editingWorkout.value.exercises[exIdx]
  const last = ex.sets[ex.sets.length - 1]
  ex.sets.push({ reps: last?.reps || 10, weight: last?.weight })
}

function removeSet(exIdx: number, setIdx: number) {
  if (!editingWorkout.value) return
  editingWorkout.value.exercises[exIdx].sets.splice(setIdx, 1)
}

async function saveWorkout() {
  if (!editingWorkout.value) return
  const w = editingWorkout.value
  const cleaned = w.exercises
    .filter(e => e.name.trim() && e.sets.length > 0)
    .map(e => ({ ...e, sets: e.sets.filter(s => s.reps > 0) }))
  if (cleaned.length === 0) return
  await health.saveWorkout({
    id: w.id,
    date: w.date,
    startTime: w.startTime || undefined,
    durationMin: w.durationMin || undefined,
    exercises: cleaned,
    notes: w.notes || undefined,
  })
  editingWorkout.value = null
}

async function deleteWorkoutRow(id: string) {
  if (!confirm('确定删除这条训练记录?')) return
  await health.removeWorkout(id)
}

// ==== 体重与身体指标 ====
const measurementToday = computed(() => health.getMeasurementByDate(props.date))
const bodyForm = ref({
  weight: '', bodyFat: '', chest: '', waist: '', hip: '', arm: '', thigh: '', notes: '',
})
const bodyDirty = ref(false)

// 载入现有值到表单
function loadBodyForm() {
  const m = measurementToday.value
  bodyForm.value = {
    weight: m?.weight?.toString() || '',
    bodyFat: m?.bodyFat?.toString() || '',
    chest: m?.chest?.toString() || '',
    waist: m?.waist?.toString() || '',
    hip: m?.hip?.toString() || '',
    arm: m?.arm?.toString() || '',
    thigh: m?.thigh?.toString() || '',
    notes: m?.notes || '',
  }
  bodyDirty.value = false
}
loadBodyForm()

function num(s: string): number | undefined {
  const n = parseFloat(s)
  return isFinite(n) ? n : undefined
}

async function saveBody() {
  await health.saveMeasurement({
    date: props.date,
    weight: num(bodyForm.value.weight),
    bodyFat: num(bodyForm.value.bodyFat),
    chest: num(bodyForm.value.chest),
    waist: num(bodyForm.value.waist),
    hip: num(bodyForm.value.hip),
    arm: num(bodyForm.value.arm),
    thigh: num(bodyForm.value.thigh),
    notes: bodyForm.value.notes || undefined,
  })
  bodyDirty.value = false
}

// ==== 饮食 ====
const mealsToday = computed(() => health.getMealsByDate(props.date))
const editingMeal = ref<MealEntry | null>(null)

function newMeal(type: MealType) {
  editingMeal.value = {
    id: uuidv4(),
    date: props.date,
    mealType: type,
    time: '',
    items: [{ name: '', calories: undefined }],
    totalCalories: undefined,
    notes: '',
    createdAt: 0,
    updatedAt: 0,
  }
}

function editMeal(m: MealEntry) {
  editingMeal.value = JSON.parse(JSON.stringify(m))
}

function addMealItem() {
  if (!editingMeal.value) return
  editingMeal.value.items.push({ name: '' })
}

function removeMealItem(idx: number) {
  if (!editingMeal.value) return
  editingMeal.value.items.splice(idx, 1)
}

async function saveMeal() {
  if (!editingMeal.value) return
  const m = editingMeal.value
  const cleaned = m.items.filter(it => it.name.trim())
  if (cleaned.length === 0) return
  await health.saveMeal({
    id: m.id,
    date: m.date,
    mealType: m.mealType,
    time: m.time || undefined,
    items: cleaned,
    totalCalories: m.totalCalories,
    notes: m.notes || undefined,
  })
  editingMeal.value = null
}

async function deleteMealRow(id: string) {
  if (!confirm('确定删除这条饮食记录?')) return
  await health.removeMeal(id)
}

// 今日汇总
const todaySummary = computed(() => {
  const volume = workoutsToday.value.reduce((s, w) => s + calcWorkoutVolume(w), 0)
  const kcal = mealsToday.value.reduce((s, m) => s + calcMealCalories(m), 0)
  const w = measurementToday.value?.weight
  return { volume, kcal, weight: w }
})
</script>

<template>
  <div class="health-card">
    <div class="hc-header">
      <span class="hc-title">📝 今日记录</span>
      <div class="hc-summary">
        <span v-if="todaySummary.weight != null" title="今日体重">⚖️ {{ todaySummary.weight }}kg</span>
        <span v-if="todaySummary.volume > 0" title="训练容量">💪 {{ Math.round(todaySummary.volume) }}kg</span>
        <span v-if="todaySummary.kcal > 0" title="今日热量">🍽 {{ Math.round(todaySummary.kcal) }}kcal</span>
      </div>
    </div>

    <div class="hc-tabs">
      <button class="tab" :class="{ active: tab === 'workout' }" @click="tab = 'workout'">💪 训练</button>
      <button class="tab" :class="{ active: tab === 'body' }" @click="tab = 'body'; loadBodyForm()">⚖️ 体重</button>
      <button class="tab" :class="{ active: tab === 'diet' }" @click="tab = 'diet'">🍽 饮食</button>
    </div>

    <!-- 训练 -->
    <div v-if="tab === 'workout'" class="tab-body">
      <div v-if="!editingWorkout" class="list-mode">
        <div v-if="workoutsToday.length === 0" class="empty">今日暂无训练记录</div>
        <div v-for="w in workoutsToday" :key="w.id" class="workout-item">
          <div class="wi-head">
            <span class="wi-title">
              {{ w.startTime ? w.startTime + ' · ' : '' }}{{ w.exercises.length }} 个动作
            </span>
            <div class="wi-actions">
              <button class="mini-btn" @click="editWorkout(w)">编辑</button>
              <button class="mini-btn danger" @click="deleteWorkoutRow(w.id)">删除</button>
            </div>
          </div>
          <div class="wi-body">
            <div v-for="ex in w.exercises" :key="ex.id" class="ex-line">
              <span class="ex-tag">{{ ex.muscleGroup }}</span>
              <span class="ex-name">{{ ex.name }}</span>
              <span class="ex-sets">
                <span v-for="(s, i) in ex.sets" :key="i" class="set-chip">
                  {{ s.weight != null ? s.weight + 'kg×' + s.reps : s.reps }}
                </span>
              </span>
            </div>
          </div>
          <div v-if="w.notes" class="wi-notes">📝 {{ w.notes }}</div>
        </div>
        <button class="add-btn" @click="newWorkout">＋ 添加训练</button>
      </div>

      <div v-else class="edit-mode">
        <div class="edit-header">
          <input class="mini-input" type="time" v-model="editingWorkout.startTime" placeholder="开始时间" />
          <input class="mini-input" type="number" v-model.number="editingWorkout.durationMin" placeholder="总时长(分)" min="0" />
        </div>
        <div v-for="(ex, exIdx) in editingWorkout.exercises" :key="ex.id" class="ex-editor">
          <div class="ex-editor-head">
            <select v-model="ex.muscleGroup" class="mini-input tight">
              <option v-for="g in MUSCLE_GROUPS" :key="g" :value="g">{{ g }}</option>
            </select>
            <input class="mini-input flex" v-model="ex.name" placeholder="动作名(如 卧推)" />
            <button class="mini-btn danger" @click="removeExercise(exIdx)">×</button>
          </div>
          <div class="set-editor">
            <div v-for="(s, sIdx) in ex.sets" :key="sIdx" class="set-row">
              <span class="set-idx">#{{ sIdx + 1 }}</span>
              <input class="mini-input tight" type="number" v-model.number="s.weight" placeholder="kg" step="0.5" />
              <span class="times">×</span>
              <input class="mini-input tight" type="number" v-model.number="s.reps" placeholder="次" />
              <button class="mini-btn" @click="removeSet(exIdx, sIdx)">－</button>
            </div>
            <button class="mini-btn ghost" @click="addSet(exIdx)">＋ 加一组</button>
          </div>
        </div>
        <button class="mini-btn ghost full" @click="addExercise">＋ 添加动作</button>
        <textarea class="mini-input full" v-model="editingWorkout.notes" placeholder="备注(状态、感受)" rows="2"></textarea>
        <div class="edit-actions">
          <button class="mini-btn" @click="editingWorkout = null">取消</button>
          <button class="mini-btn primary" @click="saveWorkout">保存</button>
        </div>
      </div>
    </div>

    <!-- 体重 -->
    <div v-if="tab === 'body'" class="tab-body">
      <div class="body-grid">
        <label class="body-field">
          <span>体重 (kg)</span>
          <input type="number" step="0.1" v-model="bodyForm.weight" @input="bodyDirty = true" placeholder="70.5" />
        </label>
        <label class="body-field">
          <span>体脂率 (%)</span>
          <input type="number" step="0.1" v-model="bodyForm.bodyFat" @input="bodyDirty = true" placeholder="18.0" />
        </label>
        <label class="body-field">
          <span>胸围 (cm)</span>
          <input type="number" step="0.5" v-model="bodyForm.chest" @input="bodyDirty = true" />
        </label>
        <label class="body-field">
          <span>腰围 (cm)</span>
          <input type="number" step="0.5" v-model="bodyForm.waist" @input="bodyDirty = true" />
        </label>
        <label class="body-field">
          <span>臀围 (cm)</span>
          <input type="number" step="0.5" v-model="bodyForm.hip" @input="bodyDirty = true" />
        </label>
        <label class="body-field">
          <span>臂围 (cm)</span>
          <input type="number" step="0.5" v-model="bodyForm.arm" @input="bodyDirty = true" />
        </label>
        <label class="body-field">
          <span>大腿围 (cm)</span>
          <input type="number" step="0.5" v-model="bodyForm.thigh" @input="bodyDirty = true" />
        </label>
      </div>
      <textarea class="mini-input full" v-model="bodyForm.notes" @input="bodyDirty = true" placeholder="备注" rows="2"></textarea>
      <div class="edit-actions">
        <button class="mini-btn primary" :disabled="!bodyDirty" @click="saveBody">
          {{ measurementToday ? '更新记录' : '保存记录' }}
        </button>
      </div>
    </div>

    <!-- 饮食 -->
    <div v-if="tab === 'diet'" class="tab-body">
      <div v-if="!editingMeal" class="list-mode">
        <div class="meal-quick-add">
          <button class="mini-btn" @click="newMeal('breakfast')">＋ 早餐</button>
          <button class="mini-btn" @click="newMeal('lunch')">＋ 午餐</button>
          <button class="mini-btn" @click="newMeal('dinner')">＋ 晚餐</button>
          <button class="mini-btn" @click="newMeal('snack')">＋ 加餐</button>
        </div>
        <div v-if="mealsToday.length === 0" class="empty">今日暂无饮食记录</div>
        <div v-for="m in mealsToday" :key="m.id" class="meal-item">
          <div class="mi-head">
            <span class="mi-tag">{{ MEAL_TYPE_LABELS[m.mealType] }}</span>
            <span class="mi-time" v-if="m.time">{{ m.time }}</span>
            <span class="mi-kcal">{{ Math.round(m.totalCalories ?? m.items.reduce((s, i) => s + (i.calories || 0), 0)) }} kcal</span>
            <div class="wi-actions">
              <button class="mini-btn" @click="editMeal(m)">编辑</button>
              <button class="mini-btn danger" @click="deleteMealRow(m.id)">删除</button>
            </div>
          </div>
          <div class="mi-body">
            <span v-for="(it, i) in m.items" :key="i" class="food-chip">
              {{ it.name }}<span v-if="it.amount"> ({{ it.amount }})</span><span v-if="it.calories"> · {{ it.calories }}kcal</span>
            </span>
          </div>
          <div v-if="m.notes" class="wi-notes">📝 {{ m.notes }}</div>
        </div>
      </div>

      <div v-else class="edit-mode">
        <div class="edit-header">
          <select class="mini-input tight" v-model="editingMeal.mealType">
            <option value="breakfast">早餐</option>
            <option value="lunch">午餐</option>
            <option value="dinner">晚餐</option>
            <option value="snack">加餐</option>
          </select>
          <input class="mini-input" type="time" v-model="editingMeal.time" />
          <input class="mini-input tight" type="number" v-model.number="editingMeal.totalCalories" placeholder="总热量(可选)" />
        </div>
        <div v-for="(it, i) in editingMeal.items" :key="i" class="food-row">
          <input class="mini-input flex" v-model="it.name" placeholder="食物(如 鸡胸肉)" />
          <input class="mini-input tight" v-model="it.amount" placeholder="份量" />
          <input class="mini-input tight" type="number" v-model.number="it.calories" placeholder="kcal" />
          <button class="mini-btn danger" @click="removeMealItem(i)">×</button>
        </div>
        <button class="mini-btn ghost full" @click="addMealItem">＋ 加一项</button>
        <textarea class="mini-input full" v-model="editingMeal.notes" placeholder="备注" rows="2"></textarea>
        <div class="edit-actions">
          <button class="mini-btn" @click="editingMeal = null">取消</button>
          <button class="mini-btn primary" @click="saveMeal">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.health-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 14px 16px;
  margin: 12px 0;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.hc-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.hc-summary {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.hc-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-primary);
  padding: 4px;
  border-radius: 10px;
}

.tab {
  flex: 1;
  padding: 8px;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  &.active { background: var(--color-work); color: white; }
}

.tab-body { display: flex; flex-direction: column; gap: 10px; }

.empty {
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
  padding: 16px;
  background: var(--bg-primary);
  border-radius: 8px;
}

.workout-item, .meal-item {
  background: var(--bg-primary);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wi-head, .mi-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  flex-wrap: wrap;
}

.wi-title { color: var(--text-primary); font-weight: 500; flex: 1; }
.wi-actions { display: flex; gap: 4px; margin-left: auto; }

.mi-tag {
  background: var(--color-life);
  color: white;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}
.mi-time { color: var(--text-tertiary); font-family: monospace; font-size: 12px; }
.mi-kcal {
  background: var(--color-study);
  color: white;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.ex-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  flex-wrap: wrap;
}
.ex-tag {
  background: var(--color-work);
  color: white;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
}
.ex-name { color: var(--text-primary); font-weight: 500; min-width: 60px; }
.ex-sets { display: flex; gap: 4px; flex-wrap: wrap; }
.set-chip {
  background: var(--bg-hover);
  color: var(--text-secondary);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
}

.food-chip {
  background: var(--bg-hover);
  color: var(--text-secondary);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  margin-right: 4px;
  display: inline-block;
  margin-bottom: 4px;
}

.wi-notes {
  color: var(--text-tertiary);
  font-size: 12px;
  padding-top: 4px;
  border-top: 1px dashed var(--border-color);
}

.add-btn, .mini-btn.ghost.full {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--color-work);
  font-size: 14px;
  font-weight: 500;
  border: 1px dashed var(--border-color);
  &:hover { background: var(--bg-hover); }
}

.meal-quick-add { display: flex; gap: 6px; flex-wrap: wrap; }

// 编辑区
.edit-mode {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-primary);
  padding: 12px;
  border-radius: 10px;
}
.edit-header { display: flex; gap: 6px; flex-wrap: wrap; }

.ex-editor {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ex-editor-head { display: flex; gap: 6px; align-items: center; }

.set-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 4px;
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
}
.times { color: var(--text-tertiary); }

.food-row { display: flex; gap: 4px; align-items: center; }

.mini-input {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  &.tight { width: 80px; flex-shrink: 0; }
  &.flex { flex: 1; min-width: 0; }
  &.full { width: 100%; }
}

.mini-btn {
  padding: 5px 10px;
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  &:hover { background: var(--bg-hover); }
  &.primary { background: var(--color-work); color: white; }
  &.danger { color: var(--ios-red); }
  &.ghost {
    background: transparent;
    border: 1px dashed var(--border-color);
    color: var(--text-secondary);
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

.edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.body-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}
.body-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: var(--text-secondary);
  input {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
  }
}

@media (max-width: 640px) {
  .body-grid { grid-template-columns: repeat(2, 1fr); }
  .hc-summary { font-size: 12px; gap: 8px; }
}
</style>
