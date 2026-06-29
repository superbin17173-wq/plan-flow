// 时间处理工具
import dayjs from 'dayjs'
import type { Task, RecurrenceRule } from '../types'

// 获取今天的日期字符串
export function getToday(): string {
  return dayjs().format('YYYY-MM-DD')
}

// 格式化日期
export function formatDate(date: string | Date, format: string = 'YYYY-MM-DD'): string {
  return dayjs(date).format(format)
}

// 获取某月的所有日期（按周分组）
export function getMonthDates(year: number, month: number, weekStartsOn: 0 | 1 = 1): Date[][] {
  const firstDay = dayjs(`${year}-${month}-01`)
  const daysInMonth = firstDay.daysInMonth()
  const result: Date[][] = []

  // 计算第一天偏移
  const firstDayOfWeek = firstDay.day()
  const offset = weekStartsOn === 1
    ? (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1)
    : firstDayOfWeek

  // 前补空
  let currentWeek: Date[] = []
  for (let i = 0; i < offset; i++) {
    currentWeek.push(null as any) // 用 null 表示空
  }

  // 填充本月日期
  for (let day = 1; day <= daysInMonth; day++) {
    const date = firstDay.date(day).toDate()
    currentWeek.push(date)
    if (currentWeek.length === 7) {
      result.push(currentWeek)
      currentWeek = []
    }
  }

  // 后补空
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null as any)
    }
    result.push(currentWeek)
  }

  return result
}

// 获取某周的所有日期
export function getWeekDates(date: string | Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const d = dayjs(date)
  const dayOfWeek = d.day()
  const offset = weekStartsOn === 1
    ? (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    : dayOfWeek

  const startOfWeek = d.subtract(offset, 'day')
  const result: Date[] = []
  for (let i = 0; i < 7; i++) {
    result.push(startOfWeek.add(i, 'day').toDate())
  }
  return result
}

// 获取两个日期之间的所有日期
export function getDateRange(startDate: string, endDate: string): string[] {
  const start = dayjs(startDate)
  const end = dayjs(endDate)
  const result: string[] = []
  let current = start
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    result.push(current.format('YYYY-MM-DD'))
    current = current.add(1, 'day')
  }
  return result
}

// 判断日期是否是今天
export function isToday(date: string | Date): boolean {
  return dayjs(date).isSame(dayjs(), 'day')
}

// 判断日期是否是同一周
export function isSameWeek(date1: string | Date, date2: string | Date, weekStartsOn: 0 | 1 = 1): boolean {
  const d1 = dayjs(date1)
  const d2 = dayjs(date2)
  const week1 = getWeekDates(d1.format('YYYY-MM-DD'), weekStartsOn)
  const week2 = getWeekDates(d2.format('YYYY-MM-DD'), weekStartsOn)
  return week1[0].getTime() === week2[0].getTime()
}

// 时间字符串转换为分钟数
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// 分钟数转换为时间字符串
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

// 计算任务时长（分钟）
export function getTaskDuration(task: Task): number {
  const start = timeToMinutes(task.startTime)
  const end = timeToMinutes(task.endTime)
  return end - start
}

// 获取任务在时间轴上的位置（小时高度 = 60px）
export function getTaskPosition(task: Task, hourHeight: number = 60): { top: number; height: number } {
  const startMinutes = timeToMinutes(task.startTime)
  const endMinutes = timeToMinutes(task.endTime)
  const top = (startMinutes / 60) * hourHeight
  const height = ((endMinutes - startMinutes) / 60) * hourHeight
  return { top, height }
}

// 检查时间冲突
export function hasTimeConflict(task1: Task, task2: Task): boolean {
  if (task1.date !== task2.date) return false
  const start1 = timeToMinutes(task1.startTime)
  const end1 = timeToMinutes(task1.endTime)
  const start2 = timeToMinutes(task2.startTime)
  const end2 = timeToMinutes(task2.endTime)
  return !(end1 <= start2 || end2 <= start1)
}

// 获取一天中某时间段的冲突任务
export function getConflictingTasks(tasks: Task[], startTime: string, endTime: string): Task[] {
  return tasks.filter(task => {
    const start1 = timeToMinutes(startTime)
    const end1 = timeToMinutes(endTime)
    const start2 = timeToMinutes(task.startTime)
    const end2 = timeToMinutes(task.endTime)
    return !(end1 <= start2 || end2 <= start1)
  })
}

// 格式化时间显示（根据设置）
export function formatTimeDisplay(time: string, format: '24h' | '12h' = '24h'): string {
  if (format === '24h') return time
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}

// 获取相对日期描述
export function getRelativeDate(date: string): string {
  const d = dayjs(date)
  const today = dayjs()
  if (d.isSame(today, 'day')) return '今天'
  if (d.isSame(today.subtract(1, 'day'), 'day')) return '昨天'
  if (d.isSame(today.add(1, 'day'), 'day')) return '明天'
  if (d.isSame(today, 'week')) return `本周${['日', '一', '二', '三', '四', '五', '六'][d.day()]}`
  return d.format('MM月DD日')
}