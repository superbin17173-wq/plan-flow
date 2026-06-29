<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Task } from '../../types'
import { getCategoryById } from '../../types/category'
import { getTaskPosition, minutesToTime, timeToMinutes } from '../../utils/timeUtils'
import { useTaskStore } from '../../stores/taskStore'

const props = defineProps<{
  task: Task
  hourHeight: number
  overlapIndex?: number
  isDragging?: boolean
}>()

const emit = defineEmits<{
  click: [e: Event]
  dragStart: [taskId: string, startY: number, originalTop: number, originalHeight: number]
  dragEnd: []
}>()

const taskStore = useTaskStore()

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

// 拖拽处理
let dragStartY = 0
let dragOriginalTop = 0
let dragOriginalHeight = 0
let isResizing = false

function handleMouseDown(e: MouseEvent) {
  if (props.task.isCompleted) return
  e.preventDefault()

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const taskEl = e.currentTarget as HTMLElement

  // 判断是否点击在底部（调整高度）
  const clickY = e.clientY - rect.top
  const taskHeight = rect.height
  const isBottomClick = clickY > taskHeight - 10

  if (isBottomClick) {
    isResizing = true
  }

  dragStartY = e.clientY
  dragOriginalTop = position.value.top
  dragOriginalHeight = position.value.height

  emit('dragStart', props.task.id, e.clientY, position.value.top, position.value.height)

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

async function handleMouseMove(e: MouseEvent) {
  if (!props.isDragging) return

  const deltaY = e.clientY - dragStartY
  const deltaMinutes = Math.round((deltaY / props.hourHeight) * 60)

  if (isResizing) {
    // 调整结束时间
    const newEndMinutes = timeToMinutes(props.task.endTime) + deltaMinutes
    const newEndTime = minutesToTime(Math.max(newEndMinutes, timeToMinutes(props.task.startTime) + 30))
    await taskStore.dragUpdateTaskTime(props.task.id, props.task.startTime, newEndTime)
  } else {
    // 移动任务
    const newStartMinutes = timeToMinutes(props.task.startTime) + deltaMinutes
    const newEndMinutes = timeToMinutes(props.task.endTime) + deltaMinutes
    const clampedStart = Math.max(0, Math.min(newStartMinutes, 1440 - 60))
    const clampedEnd = Math.max(clampedStart + 30, Math.min(newEndMinutes, 1440))
    await taskStore.dragUpdateTaskTime(props.task.id, minutesToTime(clampedStart), minutesToTime(clampedEnd))
  }
}

function handleMouseUp() {
  isResizing = false
  emit('dragEnd')
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}
</script>

<template>
  <div
    class="task-block"
    :class="[priorityClass, completedClass, draggingClass]"
    :style="{
      top: `${position.top}px`,
      height: `${position.height}px`,
      backgroundColor: categoryColor,
      ...overlapStyle,
    }"
    @click="emit('click', $event)"
    @mousedown="handleMouseDown"
  >
    <div class="task-title">{{ task.title }}</div>
    <div class="task-time">{{ timeDisplay }}</div>
    <!-- 拖拽调整指示器 -->
    <div class="resize-handle" v-if="!task.isCompleted"></div>
  </div>
</template>

<style scoped lang="scss">
.task-block {
  position: absolute;
  left: 10px;
  width: calc(100% - 20px);
  border-radius: 6px;
  padding: 8px;
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
}

.task-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-time {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
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