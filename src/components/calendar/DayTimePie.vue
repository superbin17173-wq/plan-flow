<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '../../types/task'
import { timeToMinutes } from '../../utils/timeUtils'

const props = defineProps<{
  tasks: Task[]
  sleepStart: string // HH:mm
  sleepEnd: string // HH:mm
}>()

const sleepMinutes = computed(() => {
  const start = timeToMinutes(props.sleepStart)
  const end = timeToMinutes(props.sleepEnd)
  if (end < start) return (1440 - start) + end
  return end - start
})

const taskMinutes = computed(() => {
  let total = 0
  for (const task of props.tasks) {
    const start = timeToMinutes(task.startTime)
    const end = timeToMinutes(task.endTime)
    total += (end - start)
  }
  return total
})

const restMinutes = computed(() => {
  return Math.max(0, 1440 - sleepMinutes.value - taskMinutes.value)
})

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}小时`
  return `${hours}小时${mins}分钟`
}

// SVG 甜甜圈参数
const cx = 50
const cy = 50
const r = 40
const strokeWidth = 10

// 周长
const circumference = 2 * Math.PI * r

const segments = computed(() => {
  const sleep = (sleepMinutes.value / 1440) * circumference
  const task = (taskMinutes.value / 1440) * circumference
  const rest = (restMinutes.value / 1440) * circumference

  return [
    { type: 'sleep', length: sleep, offset: 0, color: '#5856D6', minutes: sleepMinutes.value },
    { type: 'task', length: task, offset: -sleep, color: '#007AFF', minutes: taskMinutes.value },
    { type: 'rest', length: rest, offset: -(sleep + task), color: '#34C759', minutes: restMinutes.value },
  ]
})
</script>

<template>
  <div class="time-pie">
    <div class="pie-wrapper">
      <svg viewBox="0 0 100 100" class="pie-chart">
        <!-- 背景圆环 -->
        <circle cx="50" cy="50" :r="r" fill="none" stroke="#E5E5EA" :stroke-width="strokeWidth" />
        <!-- 各扇区 -->
        <circle
          v-for="seg in segments"
          :key="seg.type"
          cx="50" cy="50" :r="r"
          fill="none"
          :stroke="seg.color"
          :stroke-width="strokeWidth"
          :stroke-dasharray="`${seg.length} ${circumference - seg.length}`"
          :stroke-dashoffset="seg.offset"
          stroke-linecap="butt"
          class="ring-segment"
        />
      </svg>
      <div class="center-info">
        <div class="center-value">{{ formatMinutes(restMinutes) }}</div>
        <div class="center-label">休息时间</div>
      </div>
    </div>
    <div class="legend">
      <div class="legend-item">
        <span class="legend-dot sleep"></span>
        <span class="legend-text">睡眠 {{ formatMinutes(sleepMinutes) }}</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot task"></span>
        <span class="legend-text">任务 {{ formatMinutes(taskMinutes) }}</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot rest"></span>
        <span class="legend-text">休息 {{ formatMinutes(restMinutes) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.time-pie {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
}

.pie-wrapper {
  position: relative;
  width: 72px;
  height: 72px;
  flex-shrink: 0;
}

.pie-chart {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-segment {
  transition: stroke-dasharray 0.3s ease, stroke-dashoffset 0.3s ease;
}

.center-info {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.center-value {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary, #1A1A1A);
  line-height: 1.2;
}

.center-label {
  font-size: 9px;
  color: var(--text-secondary, #8E8E93);
  margin-top: 1px;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;

  &.sleep { background: #5856D6; }
  &.task { background: #007AFF; }
  &.rest { background: #34C759; }
}

.legend-text {
  font-size: 12px;
  color: var(--text-secondary, #8E8E93);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .time-pie {
    padding: 8px 12px;
    gap: 12px;
  }

  .pie-wrapper {
    width: 60px;
    height: 60px;
  }

  .center-value { font-size: 10px; }
  .center-label { font-size: 8px; }
  .legend-text { font-size: 11px; }
}
</style>