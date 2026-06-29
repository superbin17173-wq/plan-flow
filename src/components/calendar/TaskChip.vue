<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '../../types'
import { getCategoryById } from '../../types/category'

const props = defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  click: [e: Event]
}>()

// 分类颜色样式
const categoryStyle = computed(() => {
  const cat = getCategoryById(props.task.category)
  return {
    backgroundColor: cat?.color || '#A8A8A8',
  }
})

// 优先级类名
const priorityClass = computed(() => {
  return `priority-${props.task.priority}`
})

// 完成状态类名
const completedClass = computed(() => {
  return props.task.isCompleted ? 'completed' : ''
})

// 显示标题（截断）
const displayTitle = computed(() => {
  return props.task.title.length > 12
    ? props.task.title.slice(0, 12) + '...'
    : props.task.title
})
</script>

<template>
  <div
    class="task-chip"
    :class="[priorityClass, completedClass]"
    :style="categoryStyle"
    :title="task.title"
    @click="emit('click', $event)"
  >
    {{ displayTitle }}
  </div>
</template>

<style scoped lang="scss">
.task-chip {
  display: inline-block;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    filter: brightness(1.15);
    transform: scale(1.02);
  }

  &.priority-high {
    border-left: 3px solid #E74C3C;
  }

  &.priority-low {
    opacity: 0.6;
  }

  &.completed {
    opacity: 0.5;
    text-decoration: line-through;
  }
}
</style>