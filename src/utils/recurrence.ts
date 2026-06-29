// 重复任务计算工具
import dayjs from 'dayjs'
import type { RecurrenceRule } from '../types'

// 根据重复规则生成下一个重复日期
export function getNextRecurrenceDate(currentDate: string, rule: RecurrenceRule): string | null {
  const current = dayjs(currentDate)

  // 检查是否超过结束日期
  if (rule.endDate && current.isAfter(dayjs(rule.endDate), 'day')) {
    return null
  }

  let next: dayjs.Dayjs

  switch (rule.type) {
    case 'daily':
      next = current.add(rule.interval, 'day')
      break

    case 'weekly':
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        // 找下一个符合 daysOfWeek 的日期
        const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b)
        const currentDayOfWeek = current.day()

        // 找当前周内是否有下一个符合条件的日期
        const nextDayInWeek = sortedDays.find(d => d > currentDayOfWeek)
        if (nextDayInWeek !== undefined) {
          next = current.day(nextDayInWeek)
        } else {
          // 跳到下一周的第一个符合条件的日期
          const daysToAdd = 7 - currentDayOfWeek + sortedDays[0]
          next = current.add(daysToAdd + (rule.interval - 1) * 7, 'day')
        }
      } else {
        next = current.add(rule.interval * 7, 'day')
      }
      break

    case 'monthly':
      next = current.add(rule.interval, 'month')
      break

    case 'yearly':
      next = current.add(rule.interval, 'year')
      break

    default:
      return null
  }

  // 再次检查结束日期
  if (rule.endDate && next.isAfter(dayjs(rule.endDate), 'day')) {
    return null
  }

  return next.format('YYYY-MM-DD')
}

// 根据重复规则生成指定日期范围内的所有重复日期
export function generateRecurrenceDates(
  startDate: string,
  rule: RecurrenceRule,
  rangeStart: string,
  rangeEnd: string
): string[] {
  const result: string[] = []
  let current = startDate

  while (current) {
    if (current >= rangeStart && current <= rangeEnd) {
      result.push(current)
    }
    if (current > rangeEnd) break
    current = getNextRecurrenceDate(current, rule) || ''
  }

  return result
}

// 判断某日期是否是重复任务的实例
export function isRecurrenceInstance(date: string, startDate: string, rule: RecurrenceRule): boolean {
  const dates = generateRecurrenceDates(startDate, rule, startDate, date)
  return dates.includes(date)
}