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
  background: rgba(0, 0, 0, 0.45);
  z-index: 1100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}

.panel {
  background: var(--bg-secondary);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 560px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  h3 { font-size: 17px; color: var(--text-primary); margin: 0; }
}

.close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 20px;
}

.today-summary {
  background: var(--bg-primary);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ts-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
  b { color: var(--color-work); font-size: 15px; }
}

.ts-list { display: flex; flex-direction: column; gap: 4px; }
.ts-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.ts-tag {
  background: var(--color-life);
  color: white;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  flex-shrink: 0;
}
.ts-content {
  flex: 1;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ts-kcal { color: var(--color-work); font-weight: 500; font-family: monospace; }
.ts-del {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 14px;
  &:hover { background: rgba(231, 76, 60, 0.15); color: #c0392b; }
}

.new-meal {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
}

.new-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.mt-select, .mt-input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  min-height: 38px;
}

.mt-total {
  margin-left: auto;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-work);
  font-family: monospace;
}

.search-input {
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.cat-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.cat-btn {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
  &.active { background: var(--color-work); color: white; }
}

.food-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.food-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--bg-hover);
    border-color: var(--color-work);
  }
}
.food-name { font-size: 13px; color: var(--text-primary); font-weight: 500; }
.food-amount { font-size: 11px; color: var(--text-tertiary); }
.food-kcal { font-size: 12px; color: var(--color-work); font-family: monospace; margin-top: 2px; }

.selected {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--border-color);
}

.sel-label { font-size: 12px; color: var(--text-tertiary); }

.sel-row {
  display: flex;
  gap: 4px;
  align-items: center;
}
.sel-input {
  padding: 7px 9px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  &.flex { flex: 1; min-width: 0; }
  &.tight { width: 78px; flex-shrink: 0; }
}
.sel-del {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: transparent;
  color: #c0392b;
  font-size: 16px;
  &:hover { background: rgba(231, 76, 60, 0.15); }
}

.add-custom {
  padding: 8px;
  border-radius: 8px;
  background: transparent;
  border: 1px dashed var(--border-color);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  &:hover { background: var(--bg-hover); }
}

.footer {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.btn {
  flex: 1;
  padding: 11px;
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  &.primary {
    flex: 2;
    background: var(--color-work);
    color: white;
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

@media (min-width: 641px) {
  .mask { align-items: center; padding: 16px; }
  .panel { border-radius: 16px; }
}
</style>
