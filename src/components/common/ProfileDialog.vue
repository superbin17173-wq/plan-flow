<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSettingStore } from '../../stores/settingStore'
import { useHealthStore } from '../../stores/healthStore'
import { calcBMR, calcTDEE, ACTIVITY_LABEL } from '../../utils/calorie'
import type { Settings } from '../../types'

const props = defineProps<{ modelValue?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const settings = useSettingStore()
const health = useHealthStore()

const form = ref({
  height: settings.settings.profileHeight || 170,
  weight: settings.settings.profileWeight || 70,
  age: settings.settings.profileAge || 25,
  gender: (settings.settings.profileGender || 'male') as 'male' | 'female',
  activity: settings.settings.profileActivity,
})

watch(() => props.modelValue, (v) => {
  if (v) {
    form.value = {
      height: settings.settings.profileHeight || 170,
      weight: settings.settings.profileWeight || 70,
      age: settings.settings.profileAge || 25,
      gender: (settings.settings.profileGender || 'male') as 'male' | 'female',
      activity: settings.settings.profileActivity,
    }
  }
})

// 最新体重记录
const latestMeasurement = computed(() => {
  const list = [...health.measurements]
    .filter(m => m.weight && m.weight > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
  return list[0]
})

// 用于预览计算的临时 settings
const previewSettings = computed<Settings>(() => ({
  ...settings.settings,
  profileHeight: form.value.height,
  profileWeight: form.value.weight,
  profileAge: form.value.age,
  profileGender: form.value.gender,
  profileActivity: form.value.activity,
}))

const bmr = computed(() => calcBMR(previewSettings.value, latestMeasurement.value))
const tdee = computed(() => calcTDEE(previewSettings.value, latestMeasurement.value))

// 下拉选项
const heightOptions = Array.from({ length: 71 }, (_, i) => 140 + i) // 140-210
const weightOptions = Array.from({ length: 121 }, (_, i) => 40 + i) // 40-160
const ageOptions = Array.from({ length: 83 }, (_, i) => 8 + i) // 8-90
const activityOptions: Settings['profileActivity'][] = ['sedentary', 'light', 'moderate', 'active', 'very_active']

async function save() {
  await settings.updateSettings({
    profileHeight: form.value.height,
    profileWeight: form.value.weight,
    profileAge: form.value.age,
    profileGender: form.value.gender,
    profileActivity: form.value.activity,
  })
  emit('update:modelValue', false)
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <div v-if="modelValue" class="mask" @click.self="close">
    <div class="panel">
      <div class="header">
        <h3>🧍 个人资料</h3>
        <button class="close" @click="close">×</button>
      </div>

      <div class="hint">
        用于计算基础代谢率(BMR)和每日总消耗(TDEE)。数据只存在本地。
        <span v-if="latestMeasurement">
          体重会优先使用体重记录中的最新值:<b>{{ latestMeasurement.weight }}kg</b>
        </span>
      </div>

      <div class="grid">
        <label class="field">
          <span>性别</span>
          <div class="seg">
            <button
              class="seg-btn"
              :class="{ active: form.gender === 'male' }"
              @click="form.gender = 'male'"
            >男</button>
            <button
              class="seg-btn"
              :class="{ active: form.gender === 'female' }"
              @click="form.gender = 'female'"
            >女</button>
          </div>
        </label>

        <label class="field">
          <span>年龄</span>
          <select v-model.number="form.age">
            <option v-for="v in ageOptions" :key="v" :value="v">{{ v }} 岁</option>
          </select>
        </label>

        <label class="field">
          <span>身高 (cm)</span>
          <select v-model.number="form.height">
            <option v-for="v in heightOptions" :key="v" :value="v">{{ v }}</option>
          </select>
        </label>

        <label class="field">
          <span>体重 (kg)</span>
          <select v-model.number="form.weight">
            <option v-for="v in weightOptions" :key="v" :value="v">{{ v }}</option>
          </select>
        </label>

        <label class="field wide">
          <span>日常活动等级</span>
          <select v-model="form.activity">
            <option v-for="a in activityOptions" :key="a" :value="a">{{ ACTIVITY_LABEL[a] }}</option>
          </select>
        </label>
      </div>

      <div class="preview">
        <div class="prev-row">
          <span class="prev-label">基础代谢 BMR</span>
          <span class="prev-val">{{ bmr !== null ? bmr + ' kcal/天' : '—' }}</span>
        </div>
        <div class="prev-row">
          <span class="prev-label">每日总消耗 TDEE</span>
          <span class="prev-val hi">{{ tdee !== null ? tdee + ' kcal/天' : '—' }}</span>
        </div>
        <div class="prev-tip">
          TDEE = BMR × 活动系数<span v-if="tdee !== null">(约 {{ (tdee / (bmr || 1)).toFixed(2) }})</span>,是不训练不进食也会消耗的水平
        </div>
      </div>

      <div class="footer">
        <button class="btn" @click="close">取消</button>
        <button class="btn primary" @click="save">保存</button>
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
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.panel {
  background: var(--bg-elevated);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 480px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 20px;
  box-shadow: var(--shadow-xl);
  color: var(--text-primary);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  h3 {
    font-size: var(--font-size-headline);
    margin: 0;
    color: var(--text-primary);
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

.hint {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  line-height: 1.6;
  background: var(--bg-fill-quaternary);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 14px;
  b { color: var(--ios-blue); }
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  &.wide { grid-column: 1 / -1; }

  select {
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 0.5px solid var(--separator);
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: var(--font-size-sub);
    min-height: 44px;
    font-family: inherit;
    text-transform: none;
    letter-spacing: normal;

    &:focus {
      outline: none;
      border-color: var(--ios-blue);
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.14);
    }
  }
}

.seg {
  display: flex;
  background: var(--bg-fill-quaternary);
  border-radius: 9px;
  padding: 2px;
  gap: 2px;
}
.seg-btn {
  flex: 1;
  padding: 8px;
  border-radius: 7px;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background var(--transition-normal);
  &.active {
    background: var(--bg-card);
    color: var(--text-primary);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
}
.dark .seg-btn.active { background: var(--bg-primary); }

.preview {
  margin-top: 14px;
  padding: 14px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.10), rgba(52, 199, 89, 0.10));
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prev-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sub);
}
.prev-label { color: var(--text-secondary); }
.prev-val {
  color: var(--text-primary);
  font-weight: 600;
  font-family: var(--font-mono);
  &.hi { color: var(--ios-blue); font-size: var(--font-size-callout); }
}
.prev-tip {
  font-size: var(--font-size-caption2);
  color: var(--text-tertiary);
  margin-top: 2px;
}

.footer {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  justify-content: flex-end;
}
.btn {
  padding: 10px 20px;
  min-height: 40px;
  border-radius: var(--radius-md);
  background: var(--bg-fill-quaternary);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform var(--spring), opacity var(--transition-fast);
  &:active { transform: scale(0.97); opacity: 0.9; }
  &.primary { background: var(--ios-blue); color: #fff; }
}
</style>
