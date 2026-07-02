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
  background: rgba(0, 0, 0, 0.45);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.panel {
  background: var(--bg-secondary);
  border-radius: 16px;
  width: 100%;
  max-width: 460px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 18px 20px 16px;
  box-shadow: var(--shadow-lg);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  h3 { font-size: 17px; margin: 0; color: var(--text-primary); }
}

.close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 20px;
}

.hint {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.6;
  background: var(--bg-primary);
  padding: 8px 10px;
  border-radius: 8px;
  margin-bottom: 14px;
  b { color: var(--color-work); }
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  &.wide { grid-column: 1 / -1; }

  select {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    min-height: 40px;
  }
}

.seg {
  display: flex;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 4px;
  gap: 4px;
}
.seg-btn {
  flex: 1;
  padding: 8px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  &.active { background: var(--color-work); color: white; }
}

.preview {
  margin-top: 14px;
  padding: 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(129, 201, 216, 0.14), rgba(123, 196, 127, 0.14));
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prev-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}
.prev-label { color: var(--text-secondary); }
.prev-val {
  color: var(--text-primary);
  font-weight: 600;
  font-family: monospace;
  &.hi { color: var(--color-work); font-size: 16px; }
}
.prev-tip {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.footer {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  justify-content: flex-end;
}
.btn {
  padding: 9px 20px;
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  &.primary { background: var(--color-work); color: white; }
}
</style>
