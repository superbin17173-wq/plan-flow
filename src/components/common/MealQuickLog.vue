<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import { useHealthStore } from '../../stores/healthStore'
import { MEAL_TYPE_LABELS } from '../../types/health'
import type { MealType, MealItem, MealEntry } from '../../types'
import { FOOD_PRESETS, CATEGORY_LABELS, type FoodPreset } from '../../data/foods'

const props = defineProps<{ modelValue?: boolean; date?: string }>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const health = useHealthStore()

const today = computed(() => props.date || dayjs().format('YYYY-MM-DD'))
const mealType = ref<MealType>('lunch')
const time = ref('')
const items = ref<MealItem[]>([])
const activeCategory = ref<FoodPreset['category']>('staple')
const search = ref('')

const totalKcal = computed(() =>
  items.value.reduce((s, it) => s + (it.calories || 0), 0)
)

const filteredFoods = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (q) return FOOD_PRESETS.filter(f => f.name.toLowerCase().includes(q) || f.amount.toLowerCase().includes(q))
  return FOOD_PRESETS.filter(f => f.category === activeCategory.value)
})

const categories = Object.keys(CATEGORY_LABELS) as FoodPreset['category'][]

// 今日已记录的餐
const todayMeals = computed(() => health.getMealsByDate(today.value))
const todayTotal = computed(() =>
  todayMeals.value.reduce((s, m) => {
    const kcal = m.totalCalories ?? m.items.reduce((a, i) => a + (i.calories || 0), 0)
    return s + kcal
  }, 0)
)

watch(() => props.modelValue, (v) => {
  if (v) reset()
})

function reset() {
  const hour = new Date().getHours()
  mealType.value = hour < 10 ? 'breakfast' : hour < 14 ? 'lunch' : hour < 18 ? 'snack' : 'dinner'
  time.value = ''
  items.value = []
  activeCategory.value = 'staple'
  search.value = ''
}

function addFood(f: FoodPreset) {
  items.value.push({
    name: f.name,
    amount: f.amount,
    calories: f.calories,
  })
}

function addCustomFood() {
  items.value.push({ name: '', amount: '', calories: 0 })
}

function removeItem(idx: number) {
  items.value.splice(idx, 1)
}

async function save() {
  const cleaned = items.value.filter(it => it.name.trim())
  if (cleaned.length === 0) {
    emit('update:modelValue', false)
    return
  }
  await health.saveMeal({
    date: today.value,
    mealType: mealType.value,
    time: time.value || undefined,
    items: cleaned,
    totalCalories: undefined,
  })
  emit('update:modelValue', false)
}

async function deleteMeal(id: string) {
  if (!confirm('删除这餐?')) return
  await health.removeMeal(id)
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <div v-if="modelValue" class="mask" @click.self="close">
    <div class="panel">
      <div class="header">
        <h3>🍽 记录饮食</h3>
        <button class="close" @click="close">×</button>
      </div>

      <!-- 今日已记录 -->
      <div class="today-summary">
        <div class="ts-row">
          <span>今日已记录</span>
          <b>{{ Math.round(todayTotal) }} kcal</b>
        </div>
        <div v-if="todayMeals.length" class="ts-list">
          <div v-for="m in todayMeals" :key="m.id" class="ts-item">
            <span class="ts-tag">{{ MEAL_TYPE_LABELS[m.mealType] }}</span>
            <span class="ts-content">
              {{ m.items.map(i => i.name).join(' · ') }}
            </span>
            <span class="ts-kcal">
              {{ Math.round(m.totalCalories ?? m.items.reduce((s, i) => s + (i.calories || 0), 0)) }}
            </span>
            <button class="ts-del" @click="deleteMeal(m.id)">×</button>
          </div>
        </div>
      </div>

      <!-- 新一餐 -->
      <div class="new-meal">
        <div class="new-header">
          <select v-model="mealType" class="mt-select">
            <option value="breakfast">早餐</option>
            <option value="lunch">午餐</option>
            <option value="dinner">晚餐</option>
            <option value="snack">加餐</option>
          </select>
          <input type="time" v-model="time" class="mt-input" placeholder="时间(可选)" />
          <div class="mt-total">{{ Math.round(totalKcal) }} kcal</div>
        </div>

        <!-- 食物库 -->
        <input v-model="search" placeholder="🔍 搜索食物…" class="search-input" />
        <div class="cat-tabs" v-if="!search.trim()">
          <button
            v-for="c in categories"
            :key="c"
            class="cat-btn"
            :class="{ active: activeCategory === c }"
            @click="activeCategory = c"
          >{{ CATEGORY_LABELS[c] }}</button>
        </div>

        <div class="food-grid">
          <button
            v-for="f in filteredFoods"
            :key="f.name + f.amount"
            class="food-btn"
            @click="addFood(f)"
          >
            <span class="food-name">{{ f.name }}</span>
            <span class="food-amount">{{ f.amount }}</span>
            <span class="food-kcal">{{ f.calories }} kcal</span>
          </button>
        </div>

        <!-- 已选清单 -->
        <div v-if="items.length" class="selected">
          <div class="sel-label">本餐已加 {{ items.length }} 项</div>
          <div v-for="(it, i) in items" :key="i" class="sel-row">
            <input v-model="it.name" placeholder="食物名" class="sel-input flex" />
            <input v-model="it.amount" placeholder="份量" class="sel-input tight" />
            <input type="number" v-model.number="it.calories" placeholder="kcal" class="sel-input tight" />
            <button class="sel-del" @click="removeItem(i)">×</button>
          </div>
        </div>
        <button class="add-custom" @click="addCustomFood">＋ 加自定义(未在库中)</button>
      </div>

      <div class="footer">
        <button class="btn" @click="close">取消</button>
        <button class="btn primary" :disabled="items.length === 0" @click="save">
          保存这餐 ({{ Math.round(totalKcal) }} kcal)
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 1100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}

.panel {
  background: var(--bg-elevated);
  border-radius: var(--radius-xxl) var(--radius-xxl) 0 0;
  width: 100%;
  max-width: 580px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 16px 16px calc(16px + var(--safe-bottom));
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: var(--shadow-xl);
  color: var(--text-primary);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  h3 {
    font-size: var(--font-size-headline);
    color: var(--text-primary);
    margin: 0;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
}

.close {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--bg-fill-quaternary);
  color: var(--text-secondary);
  font-size: 18px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.today-summary {
  background: var(--bg-fill-quaternary);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ts-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-footnote);
  color: var(--text-secondary);
  b { color: var(--ios-blue); font-size: var(--font-size-callout); font-family: var(--font-mono); }
}

.ts-list { display: flex; flex-direction: column; gap: 4px; }
.ts-item { display: flex; align-items: center; gap: 6px; font-size: var(--font-size-caption); }
.ts-tag {
  background: var(--color-life);
  color: white;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption2);
  flex-shrink: 0;
  font-weight: 600;
}
.ts-content {
  flex: 1;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ts-kcal { color: var(--ios-blue); font-weight: 600; font-family: var(--font-mono); }
.ts-del {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 14px;
  border: none;
  cursor: pointer;
  &:hover { background: rgba(255, 59, 48, 0.14); color: var(--ios-red); }
}

.new-meal {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 0.5px solid var(--separator);
  padding-top: 14px;
}

.new-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.mt-select, .mt-input {
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  border: 0.5px solid var(--separator);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  min-height: 40px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: var(--ios-blue);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.14);
  }
}

.mt-total {
  margin-left: auto;
  font-size: var(--font-size-callout);
  font-weight: 700;
  color: var(--ios-blue);
  font-family: var(--font-mono);
}

.search-input {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 0.5px solid transparent;
  background: var(--bg-fill-quaternary);
  color: var(--text-primary);
  font-size: var(--font-size-sub);

  &:focus {
    outline: none;
    background: var(--bg-card);
    border-color: var(--ios-blue);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.14);
  }
}

.cat-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}
.cat-btn {
  padding: 6px 12px;
  border-radius: var(--radius-full);
  background: var(--bg-fill-quaternary);
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  &.active { background: var(--ios-blue); color: #fff; }
}

.food-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}

.food-btn {
  background: var(--bg-card);
  border: 0.5px solid var(--separator);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
    border-color: var(--ios-blue);
  }
  &:active { transform: scale(0.97); }
}
.food-name { font-size: var(--font-size-footnote); color: var(--text-primary); font-weight: 600; }
.food-amount { font-size: var(--font-size-caption2); color: var(--text-tertiary); }
.food-kcal { font-size: var(--font-size-caption); color: var(--ios-blue); font-family: var(--font-mono); margin-top: 2px; font-weight: 600; }

.selected {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px dashed var(--separator);
}

.sel-label {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.sel-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.sel-input {
  padding: 8px 10px;
  border-radius: var(--radius-xs);
  border: 0.5px solid var(--separator);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: var(--font-size-footnote);
  font-family: inherit;
  &.flex { flex: 1; min-width: 0; }
  &.tight { width: 84px; flex-shrink: 0; }
  &:focus {
    outline: none;
    border-color: var(--ios-blue);
  }
}
.sel-del {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: transparent;
  color: var(--ios-red);
  font-size: 16px;
  border: none;
  cursor: pointer;
  &:hover { background: rgba(255, 59, 48, 0.14); }
}

.add-custom {
  padding: 10px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px dashed var(--separator);
  color: var(--text-secondary);
  font-size: var(--font-size-footnote);
  cursor: pointer;
  transition: background var(--transition-fast);
  &:hover { background: var(--bg-hover); }
}

.footer {
  display: flex;
  gap: 10px;
  padding-top: 10px;
  border-top: 0.5px solid var(--separator);
}

.btn {
  flex: 1;
  padding: 12px;
  min-height: 44px;
  border-radius: var(--radius-md);
  background: var(--bg-fill-quaternary);
  color: var(--text-primary);
  font-size: var(--font-size-callout);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform var(--spring), opacity var(--transition-fast);
  &:active { transform: scale(0.97); opacity: 0.9; }
  &.primary {
    flex: 2;
    background: var(--ios-blue);
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 122, 255, 0.28);
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

@media (min-width: 641px) {
  .mask { align-items: center; padding: 16px; }
  .panel { border-radius: var(--radius-xl); max-height: 88vh; }
}
</style>
