// 任务类型定义
import type { WorkoutExercise } from './health'

export interface Task {
  id: string
  title: string
  description?: string
  category: string
  priority: 'high' | 'medium' | 'low'
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  color: string
  isCompleted: boolean
  recurrence?: RecurrenceRule
  remindAt?: number // 提前多少分钟提醒
  workout?: WorkoutExercise[] // 健身分类专用:动作/组数
  createdAt: number
  updatedAt: number
}

export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  endDate?: string
  daysOfWeek?: number[] // 0-6, 用于周重复
}

export interface TaskFormData {
  title: string
  description?: string
  category: string
  priority: 'high' | 'medium' | 'low'
  date: string
  startTime: string
  endTime: string
  recurrence?: RecurrenceRule
  remindAt?: number
  workout?: WorkoutExercise[]
}

// 用于创建新任务的默认值
export const DEFAULT_TASK: Partial<TaskFormData> = {
  title: '',
  category: 'work',
  priority: 'medium',
  startTime: '09:00',
  endTime: '10:00',
}