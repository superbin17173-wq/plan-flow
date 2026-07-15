<script setup lang="ts">
import type { FlashcardWeeklyData } from '../../types'

const props = defineProps<{
  data: FlashcardWeeklyData[]
}>()

function dayLabel(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
}

const maxVal = computed(() => {
  const m = Math.max(...props.data.map(d => d.practiced), 1)
  return m
})

const totalPracticed = computed(() => props.data.reduce((s, d) => s + d.practiced, 0))
const totalCorrect = computed(() => props.data.reduce((s, d) => s + d.correct, 0))
const accuracy = computed(() =>
  totalPracticed.value > 0 ? Math.round((totalCorrect.value / totalPracticed.value) * 100) : 0
)

import { computed } from 'vue'

// SVG 坐标
const W = 320
const H = 140
const PAD_X = 30
const PAD_Y = 20
const plotW = W - PAD_X * 2
const plotH = H - PAD_Y * 2

function x(i: number) { return PAD_X + (i / 6) * plotW }
function y(val: number) { return PAD_Y + plotH - (val / maxVal.value) * plotH }

function practicedPath(): string {
  return props.data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.practiced)}`).join(' ')
}
function correctPath(): string {
  return props.data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.correct)}`).join(' ')
}
</script>

<template>
  <div class="trend-chart">
    <div class="trend-header">
      <span class="trend-title">本周趋势</span>
      <span class="trend-summary">
        练习 <b>{{ totalPracticed }}</b> 张 · 正确率 <b>{{ accuracy }}%</b>
      </span>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" class="trend-svg">
      <!-- 网格线 -->
      <line v-for="i in 4" :key="'g'+i"
        :x1="PAD_X" :x2="W - PAD_X"
        :y1="PAD_Y + (plotH / 4) * i" :y2="PAD_Y + (plotH / 4) * i"
        stroke="var(--separator-color, #e5e5e5)" stroke-width="0.5" stroke-dasharray="3,3"
      />
      <!-- 练习量线 -->
      <path :d="practicedPath()" fill="none" stroke="#5AC8FA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <!-- 正确数线 -->
      <path :d="correctPath()" fill="none" stroke="#34C759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <!-- 数据点 -->
      <circle v-for="(d, i) in data" :key="'p'+i"
        :cx="x(i)" :cy="y(d.practiced)" r="3.5" fill="#5AC8FA"
      />
      <circle v-for="(d, i) in data" :key="'c'+i"
        :cx="x(i)" :cy="y(d.correct)" r="3.5" fill="#34C759"
      />
      <!-- X 轴标签 -->
      <text v-for="(d, i) in data" :key="'l'+i"
        :x="x(i)" :y="H - 2"
        text-anchor="middle" font-size="11" fill="var(--text-secondary, #8e8e93)"
      >{{ dayLabel(d.date) }}</text>
    </svg>
    <div class="trend-legend">
      <span class="legend-item"><span class="legend-dot" style="background:#5AC8FA"></span>练习</span>
      <span class="legend-item"><span class="legend-dot" style="background:#34C759"></span>正确</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.trend-chart {
  background: var(--card-bg, #fff);
  border-radius: 12px;
  padding: 16px;
}
.trend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.trend-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #1c1c1e);
}
.trend-summary {
  font-size: 12px;
  color: var(--text-secondary, #8e8e93);
  b { color: var(--text-primary, #1c1c1e); }
}
.trend-svg {
  width: 100%;
  height: auto;
}
.trend-legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 4px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary, #8e8e93);
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>
