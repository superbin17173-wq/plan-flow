<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  data: { x: string; y: number }[]
  width?: number
  height?: number
  color?: string
  showDots?: boolean
  yUnit?: string
}>(), { width: 260, height: 80, color: '#81C9D8', showDots: true, yUnit: '' })

const chartData = computed(() => {
  if (props.data.length === 0) return null

  const ys = props.data.map(d => d.y)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const rangeY = maxY - minY || 1
  const padY = rangeY * 0.15
  const yLo = minY - padY
  const yHi = maxY + padY
  const yRange = yHi - yLo || 1

  const padding = 20
  const innerW = props.width - padding * 2
  const innerH = props.height - padding
  const n = props.data.length

  const points = props.data.map((d, i) => {
    const x = n === 1 ? props.width / 2 : padding + (i / (n - 1)) * innerW
    const y = padding + (1 - (d.y - yLo) / yRange) * (innerH - padding)
    return { x, y, val: d.y, label: d.x }
  })

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} ${props.height - 4} L ${points[0].x.toFixed(1)} ${props.height - 4} Z`

  return { points, path, areaPath, minY, maxY, last: points[points.length - 1] }
})
</script>

<template>
  <div class="mini-chart">
    <svg v-if="chartData" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`">
      <defs>
        <linearGradient :id="`grad-${color.replace('#','')}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.3" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path :d="chartData.areaPath" :fill="`url(#grad-${color.replace('#','')})`" />
      <path :d="chartData.path" :stroke="color" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round" />
      <g v-if="showDots">
        <circle
          v-for="(p, i) in chartData.points"
          :key="i"
          :cx="p.x"
          :cy="p.y"
          r="2.5"
          :fill="color"
        />
      </g>
      <g class="axis-labels">
        <text :x="8" :y="14" class="axis-txt hi">{{ chartData.maxY.toFixed(chartData.maxY < 10 ? 1 : 0) }}{{ yUnit }}</text>
        <text :x="8" :y="height - 4" class="axis-txt lo">{{ chartData.minY.toFixed(chartData.minY < 10 ? 1 : 0) }}{{ yUnit }}</text>
      </g>
    </svg>
    <div v-else class="empty">暂无数据</div>
  </div>
</template>

<style scoped lang="scss">
.mini-chart {
  width: 100%;
  overflow: hidden;
}
.empty {
  color: var(--text-tertiary);
  font-size: 12px;
  text-align: center;
  padding: 20px 0;
}
.axis-txt {
  font-size: 10px;
  fill: var(--text-tertiary);
  font-family: monospace;
}
</style>
