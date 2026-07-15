// 计划 (Plan) / 模板 (PlanTemplate) / 模板任务项 (TemplateItem) 类型定义
// 用于「模板批量生成日任务」路径，与手动新增任务(TaskForm)完全并行
import type { WorkoutExercise } from './health'

// 学习类特化字段
export interface TemplateStudySlot {
  subject?: string
  materialText?: string
  knowledgeRefs?: string[]     // 预留:关联 AIMemory id 或未来的知识主题 id
  enableEbbinghaus?: boolean
}

// 健身类特化字段
export interface TemplateWorkoutSlot {
  muscleGroup?: string          // 复用 MUSCLE_GROUPS
  exercises?: WorkoutExercise[] // 复用 types/health.ts
}

// 模板里的一条任务定义 (展开时会变成 N 天的具体任务)
export interface TemplateItem {
  id: string                    // 稳定 id,展开幂等键的一部分
  title: string
  description?: string
  category: string              // 复用 DEFAULT_CATEGORIES 的 id
  priority: 'high' | 'medium' | 'low'
  // 时间三态:timed / duration / anytime
  startTime?: string
  endTime?: string
  durationMinutes?: number
  // 分类特化 slot,按需填一个(未来新增分类只需加字段并在 categorySlots.ts 注册)
  study?: TemplateStudySlot
  workout?: TemplateWorkoutSlot
}

// 模板:一组"每周固定几天要做的任务"
export interface PlanTemplate {
  id: string
  planId: string                // 内嵌式:删计划连带删模板
  name: string                  // "练胸模板"、"每日算法"
  daysOfWeek: number[]          // [1,3,5] = 周一/三/五 (0=周日, 6=周六)
  items: TemplateItem[]         // 一个模板 = 一组任务
  createdAt: number
  updatedAt: number
}

// 计划:一段命名的时间范围容器
export interface Plan {
  id: string
  name: string
  description?: string
  startDate: string             // YYYY-MM-DD
  endDate: string
  templateIds: string[]         // 挂载的模板 id 列表(有序)
  status: 'active' | 'archived'
  createdAt: number
  updatedAt: number
}

export interface PlanFormData {
  name: string
  description?: string
  startDate: string
  endDate: string
}

export interface TemplateFormData {
  name: string
  daysOfWeek: number[]
  items: TemplateItem[]
}

// 星期几显示 (与 TaskForm.vue 的 weekdays 常量保持一致)
export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
