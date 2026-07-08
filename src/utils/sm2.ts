// SM-2 (SuperMemo 2) 间隔重复算法实现
// 参考: https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
//
// 输入: 上一次复习后的 SM2 状态 + 本次复习的质量评分 quality (0-5)
// 输出: 新的 SM2 状态 (间隔天数 + 熟练度因子 + 复习次数)

import type { SM2State } from '../types/study'

/**
 * 计算下一次复习的间隔和参数
 *
 * @param prev 上一次的 SM-2 状态
 * @param quality 本次评估质量 (0-5)
 *   0-2: 完全或大部分忘记(重置)
 *   3:   勉强正确
 *   4:   正确, 略有迟疑
 *   5:   完美掌握
 * @returns 新的 SM-2 状态, interval 为下次复习距今天的天数
 */
export function sm2(prev: SM2State, quality: number): SM2State {
  // 边界保护
  const q = Math.max(0, Math.min(5, Math.round(quality)))

  let { easinessFactor: ef, repetitions, interval } = prev

  if (q < 3) {
    // 答得差,重置复习次数,间隔回到 1 天
    repetitions = 0
    interval = 1
  } else {
    // 答得好, 递增复习次数并计算下次间隔
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * ef)
    }
    repetitions += 1
  }

  // 更新熟练度因子 (无论答得如何都调整)
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (ef < 1.3) ef = 1.3

  return {
    easinessFactor: Number(ef.toFixed(4)),
    repetitions,
    interval,
  }
}

/**
 * 从指定日期计算 N 天后的日期字符串 (YYYY-MM-DD)
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 生成初始复习计划 (首次学习后自动排 N 次复习任务)
 * 使用固定初始间隔序列, 首次评估后交由 SM-2 动态调整
 *
 * @param originDate 首学日期 (YYYY-MM-DD)
 * @param count 生成多少次后续复习 (默认 5)
 * @returns 每次复习的日期字符串数组, 长度为 count
 */
export function initialReviewSchedule(originDate: string, count = 5): string[] {
  // 经典 Ebbinghaus 序列作为初始猜测: 1, 2, 4, 7, 15 天后
  const initialIntervals = [1, 2, 4, 7, 15, 30, 60]
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    const days = initialIntervals[i] ?? initialIntervals[initialIntervals.length - 1]
    result.push(addDays(originDate, days))
  }
  return result
}
