// 批量生成任务:日期区间 + 星期几 + 时段
import dayjs from 'dayjs'
import type { TaskFormData } from '../types'

export interface BulkPlanParams {
  title: string
  description?: string
  category: string
  priority: 'high' | 'medium' | 'low'
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  daysOfWeek: number[] // 0=周日 ... 6=周六
  startTime: string
  endTime: string
}

// 展开成任务数组
export function expandBulkPlan(params: BulkPlanParams): TaskFormData[] {
  const result: TaskFormData[] = []
  let cur = dayjs(params.startDate)
  const end = dayjs(params.endDate)
  if (!cur.isValid() || !end.isValid() || end.isBefore(cur, 'day')) return result

  const weekSet = new Set(params.daysOfWeek)
  // 安全上限: 3 年 * 365 天 = 1095, 避免误操作生成过多
  const maxDays = 1200
  let steps = 0

  while ((cur.isBefore(end, 'day') || cur.isSame(end, 'day')) && steps < maxDays) {
    if (weekSet.has(cur.day())) {
      result.push({
        title: params.title,
        description: params.description,
        category: params.category,
        priority: params.priority,
        date: cur.format('YYYY-MM-DD'),
        startTime: params.startTime,
        endTime: params.endTime,
      })
    }
    cur = cur.add(1, 'day')
    steps++
  }

  return result
}

// 预览:仅计算数量和示例
export function previewBulkPlan(params: BulkPlanParams): { count: number; sampleDates: string[] } {
  const list = expandBulkPlan(params)
  return {
    count: list.length,
    sampleDates: list.slice(0, 5).map(t => t.date),
  }
}
