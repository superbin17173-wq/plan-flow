<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Task } from '../../types'
import { getCategoryById } from '../../types/category'
import { getTaskPosition, minutesToTime, timeToMinutes } from '../../utils/timeUtils'
import { calcTaskCalories, currentWeight } from '../../utils/calorie'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingStore } from '../../stores/settingStore'
import { useHealthStore } from '../../stores/healthStore'

const props = defineProps<{
  task: Task
  hourHeight: number
  overlapIndex?: number
  isDragging?: boolean
  isPast?: boolean
}>()

const emit = defineEmits<{
  click: [e: Event]
  dragStart: [taskId: string, startY: number, originalTop: number, originalHeight: number]
  dragEnd: []
}>()

const taskStore = useTaskStore()
const settingStore = useSettingStore()
const healthStore = useHealthStore()

// 计算位置
const position = computed(() => {
  return getTaskPosition(props.task, props.hourHeight)
})

// 分类颜色
const categoryColor = computed(() => {
  const cat = getCategoryById(props.task.category)
  return cat?.color || '#A8A8A8'
})

// 优先级类名
const priorityClass = computed(() => {
  return `priority-${props.task.priority}`
})

// 完成状态类名
const completedClass = computed(() => {
  return props.task.isCompleted ? 'completed' : ''
})

// 拖拽状态类名
const draggingClass = computed(() => {
  return props.isDragging ? 'dragging' : ''
})

// 重叠偏移
const overlapStyle = computed(() => {
  if (props.overlapIndex && props.overlapIndex > 0) {
    const offset = props.overlapIndex * 15
    return {
      left: `calc(10px + ${offset}px)`,
      width: `calc(100% - 20px - ${offset}px)`,
    }
  }
  return {}
})

// 时间显示
const timeDisplay = computed(() => {
  return `${props.task.startTime} - ${props.task.endTime}`
})

// 健身摘要
const workoutSummary = computed(() => {
  const w = props.task.workout
  if (!w || w.length === 0) return null
  let volume = 0
  let setCount = 0
  for (const ex of w) {
    for (const s of ex.sets) {
      setCount++
      if (s.weight != null && s.reps != null) volume += s.weight * s.reps
    }
  }
  // 最新体重
  const latestM = [...healthStore.measurements]
    .filter(m => m.weight && m.weight > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const weight = currentWeight(settingStore.settings, latestM)
  const kcal = calcTaskCalories(props.task, weight)
  return { exCount: w.length, setCount, volume: Math.round(volume), kcal }
})

// 拖拽处理
let dragStartY = 0
let dragOrigStartMin = 0
let dragOrigEndMin = 0
let isResizing = false
let rafId: number | null = null
let pendingStart: string | null = null
let pendingEnd: string | null = null

function handleMouseDown(e: MouseEvent) {
  if (props.task.isCompleted || props.isPast) return
  e.preventDefault()

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()

  // 判断是否点击在底部（调整高度）
  const clickY = e.clientY - rect.top
  const taskHeight = rect.height
  const isBottomClick = clickY > taskHeight - 10

  isResizing = isBottomClick

  dragStartY = e.clientY
  dragOrigStartMin = timeToMinutes(props.task.startTime)
  dragOrigEndMin = timeToMinutes(props.task.endTime)

  emit('dragStart', props.task.id, e.clientY, position.value.top, position.value.height)

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function scheduleUpdate() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(async () => {
    rafId = null
    if (pendingStart !== null && pendingEnd !== null) {
      const s = pendingStart
      const e = pendingEnd
      pendingStart = null
      pendingEnd = null
      await taskStore.dragUpdateTaskTime(props.task.id, s, e)
    }
  })
}

function handleMouseMove(e: MouseEvent) {
  if (!props.isDragging) return

  const deltaY = e.clientY - dragStartY
  const deltaMinutes = Math.round((deltaY / props.hourHeight) * 60)
  const duration = dragOrigEndMin - dragOrigStartMin

  let newStart: number
  let newEnd: number

  if (isResizing) {
    newStart = dragOrigStartMin
    newEnd = Math.max(dragOrigEndMin + deltaMinutes, dragOrigStartMin + 15)
    newEnd = Math.min(newEnd, 1440)
  } else {
    newStart = dragOrigStartMin + deltaMinutes
    newStart = Math.max(0, Math.min(newStart, 1440 - duration))
    newEnd = newStart + duration
  }

  pendingStart = minutesToTime(newStart)
  pendingEnd = minutesToTime(newEnd)
  scheduleUpdate()
}

function handleMouseUp() {
  isResizing = false
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (pendingStart !== null && pendingEnd !== null) {
    const s = pendingStart
    const e = pendingEnd
    pendingStart = null
    pendingEnd = null
    taskStore.dragUpdateTaskTime(props.task.id, s, e)
  }
  emit('dragEnd')
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}
</script>

<template>
  <div
    class="task-block"
    :class="[priorityClass, completedClass, draggingClass, { past: isPast }]"
    :style="{
      top: `${position.top}px`,
      height: `${position.height}px`,
      backgroundColor: categoryColor,
      ...overlapStyle,
    }"
    @click="emit('click', $event)"
    @mousedown="handleMouseDown"
  >
    <div class="task-title">
      <span v-if="workoutSummary" class="workout-icon">💪</span>{{ task.title }}
    </div>
    <div class="task-time">{{ timeDisplay }}</div>
    <div v-if="workoutSummary" class="task-workout">
      {{ workoutSummary.exCount }} 动作 · {{ workoutSummary.setCount }} 组<span v-if="workoutSummary.volume > 0"> · {{ workoutSummary.volume }}kg</span><span v-if="workoutSummary.kcal > 0"> · 🔥 {{ workoutSummary.kcal }}kcal</span>
    </div>
    <!-- 拖拽调整指示器 -->
    <div class="resize-handle" v-if="!task.isCompleted && !isPast"></div>
  </div>
</template>

<style scoped lang="scss">
.task-block {
  position: absolute;
  left: 10px;
  width: calc(100% - 20px);
  border-radius: 12px;
  padding: 8px 10px;
  color: white;
  cursor: grab;
  transition: all 0.2s ease;
  overflow: hidden;
  z-index: 10;

  &:hover {
    z-index: 20;
    filter: brightness(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &.dragging {
    cursor: grabbing;
    z-index: 100;
    opacity: 0.9;
  }

  &.priority-high {
    border-left: 4px solid #E74C3C;
  }

  &.priority-low {
    opacity: 0.6;
  }

  &.completed {
    opacity: 0.4;
    text-decoration: line-through;
    cursor: default;
  }

  &.past {
    background-color: var(--text-tertiary) !important;
    color: rgba(255, 255, 255, 0.9);
    filter: grayscale(0.7);
    cursor: pointer;

    &:hover {
      filter: grayscale(0.5) brightness(1.05);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }
  }
}

.task-title {
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-time {
  font-size: 13px;
  opacity: 0.85;
  margin-top: 4px;
}

.task-workout {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 4px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  display: inline-block;
  font-family: monospace;
}

.workout-icon {
  margin-right: 4px;
}

.resize-handle {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 10px;
  cursor: ns-resize;
  background: linear-gradient(to top, rgba(0,0,0,0.2), transparent);
}
</style>