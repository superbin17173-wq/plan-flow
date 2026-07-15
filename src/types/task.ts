// 任务类型定义
import type { WorkoutExercise } from './health'
import type { StudySession } from './study'

export interface Task {
  id: string
  title: string
  description?: string
  category: string
  priority: 'high' | 'medium' | 'low'
  date: string // YYYY-MM-DD
  // 时间模型三态(由字段组合推断):
  //  timed    - startTime && endTime 都有       -> 时间轴带位置的方块
  //  duration - 只有 durationMinutes            -> 归入"未排时段",占用统计时长
  //  anytime  - 三者都无                        -> 归入"未排时段",纯待办
  startTime?: string // HH:mm
  endTime?: string // HH:mm
  durationMinutes?: number // 花费时长模式使用
  color: string
  isCompleted: boolean
  recurrence?: RecurrenceRule
  remindAt?: number // 提前多少分钟提醒(仅 timed 生效)
  workout?: WorkoutExercise[] // 健身分类专用:动作/组数
  study?: StudySession // 学习分类专用:主题/材料/艾宾浩斯
  // ---- 计划/模板 关联(可选,由 planExpander 写入,用于幂等去重 + AI 汇总过滤) ----
  planId?: string
  templateItemId?: string
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
  startTime?: string
  endTime?: string
  durationMinutes?: number
  recurrence?: RecurrenceRule
  remindAt?: number
  workout?: WorkoutExercise[]
  study?: import('./study').StudySession
}

// 用于创建新任务的默认值
export const DEFAULT_TASK: Partial<TaskFormData> = {
  title: '',
  category: 'work',
  priority: 'medium',
  startTime: '09:00',
  endTime: '10:00',
}