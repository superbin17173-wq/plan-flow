// 计划 + 模板 → 具体日任务展开器
// 复用 bulkPlan.ts 的思路(日期区间 × 星期几 × 时间三态),但额外携带 planId/templateItemId
// 并处理 study/workout 特化字段与幂等去重
// 学习任务勾选艾宾浩斯时,同时展开 FSRS 首次调度的 5 条复习任务

import dayjs from 'dayjs'
import { v4 as uuidv4 } from 'uuid'
import type { Task, Plan, PlanTemplate, TemplateItem } from '../types'
import { getCategoryColor } from '../types/category'
import { createInitialFSRSCard, scheduleInitialReviewsFSRS } from './fsrs'

const MAX_DAYS = 1200 // 与 bulkPlan.ts 保持一致的安全上限
const REVIEW_COUNT = 5 // 每次首学后生成 5 条复习任务

// 展开一个模板到一组 Task(不写库,由调用方决定何时落库)
// existingTasks:当前 store 里已经存在的、隶属该 planId 的任务,用于幂等去重
export function expandTemplateToTasks(
  plan: Plan,
  template: PlanTemplate,
  existingTasks: Task[],
): Task[] {
  const start = dayjs(plan.startDate)
  const end = dayjs(plan.endDate)
  if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day')) return []
  if (!template.items.length || !template.daysOfWeek.length) return []

  const weekSet = new Set(template.daysOfWeek)
  // 幂等键 = planId + templateItemId + date
  // 复习任务用不同的 templateItemId 后缀(::r1..::r5),不会与首学任务冲突
  const existingKeys = new Set(
    existingTasks
      .filter(t => t.planId === plan.id)
      .map(t => `${t.templateItemId}::${t.date}`),
  )

  const result: Task[] = []
  const now = Date.now()

  let cur = start
  let steps = 0
  while ((cur.isBefore(end, 'day') || cur.isSame(end, 'day')) && steps < MAX_DAYS) {
    if (weekSet.has(cur.day())) {
      const dateStr = cur.format('YYYY-MM-DD')
      for (const item of template.items) {
        const key = `${item.id}::${dateStr}`
        if (existingKeys.has(key)) continue

        const baseTask: Task = {
          id: uuidv4(),
          title: item.title,
          description: item.description,
          category: item.category,
          priority: item.priority,
          date: dateStr,
          startTime: item.startTime,
          endTime: item.endTime,
          durationMinutes: item.durationMinutes,
          color: getCategoryColor(item.category),
          isCompleted: false,
          planId: plan.id,
          templateItemId: item.id,
          createdAt: now,
          updatedAt: now,
        }

        // 健身特化
        if (item.category === 'fitness' && item.workout?.exercises?.length) {
          baseTask.workout = JSON.parse(JSON.stringify(item.workout.exercises))
        }

        // 学习特化 + 艾宾浩斯展开
        if (item.category === 'study' && item.study) {
          const useEbbinghaus = !!item.study.enableEbbinghaus

          if (useEbbinghaus) {
            // 生成学习小组(base + 5 条复习)共享的 groupId
            const studyGroupId = uuidv4()
            const aiSessionId = uuidv4()

            baseTask.study = {
              subject: item.study.subject || '',
              materialText: item.study.materialText,
              ebbinghaus: {
                enabled: true,
                studyGroupId,
                originTaskId: baseTask.id,
                reviewIndex: 0,
                fsrs: createInitialFSRSCard(dateStr),
                masteryHistory: [],
                aiSessionId,
              },
            }
            result.push(baseTask)

            // FSRS 首次调度的 5 条复习(每条带独立 templateItemId 后缀以避免与首学任务碰撞)
            const schedule = scheduleInitialReviewsFSRS(dateStr, REVIEW_COUNT)
            for (let i = 0; i < schedule.length; i++) {
              const step = schedule[i]
              const reviewKey = `${item.id}::r${i + 1}::${step.date}`
              if (existingKeys.has(reviewKey)) continue

              result.push({
                id: uuidv4(),
                title: `🔁 复习:${item.study.subject || item.title}`,
                description: `第 ${i + 1} 次复习(首学于 ${dateStr})`,
                category: 'study',
                priority: 'medium',
                date: step.date,
                startTime: item.startTime,
                endTime: item.endTime,
                durationMinutes: item.durationMinutes,
                color: getCategoryColor('study'),
                isCompleted: false,
                planId: plan.id,
                templateItemId: `${item.id}::r${i + 1}`,
                study: {
                  subject: item.study.subject || '',
                  materialText: item.study.materialText,
                  ebbinghaus: {
                    enabled: true,
                    studyGroupId,
                    originTaskId: baseTask.id,
                    reviewIndex: i + 1,
                    fsrs: step.card,
                    masteryHistory: [],
                    aiSessionId,
                  },
                },
                createdAt: now,
                updatedAt: now,
              })
            }
          } else {
            // 未开启艾宾浩斯:只挂主题/材料,不生成复习链
            baseTask.study = {
              subject: item.study.subject || '',
              materialText: item.study.materialText,
            }
            result.push(baseTask)
          }
        } else {
          // 非学习类,直接落
          result.push(baseTask)
        }
      }
    }
    cur = cur.add(1, 'day')
    steps++
  }

  return result
}

// 预览:仅计算数量与前几天的示例日期,不构造 Task 对象
// 注意:艾宾浩斯会额外产生 5 倍复习任务,预览数会体现
export function previewTemplateExpansion(
  plan: Plan,
  template: PlanTemplate,
): { count: number; sampleDates: string[] } {
  const start = dayjs(plan.startDate)
  const end = dayjs(plan.endDate)
  if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day')) {
    return { count: 0, sampleDates: [] }
  }
  const weekSet = new Set(template.daysOfWeek)
  const days: string[] = []
  let cur = start
  let steps = 0
  while ((cur.isBefore(end, 'day') || cur.isSame(end, 'day')) && steps < MAX_DAYS) {
    if (weekSet.has(cur.day())) days.push(cur.format('YYYY-MM-DD'))
    cur = cur.add(1, 'day')
    steps++
  }
  // 每个 item 每天 1 条基础,若开了艾宾浩斯则额外 REVIEW_COUNT 条
  const itemFactor = template.items.reduce(
    (acc, it) => acc + (it.category === 'study' && it.study?.enableEbbinghaus ? 1 + REVIEW_COUNT : 1),
    0,
  )
  return { count: days.length * itemFactor, sampleDates: days.slice(0, 5) }
}
