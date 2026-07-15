// FSRS (Free Spaced Repetition Scheduler) 封装
// 项目原先用 SM-2 + 硬编码 [1,2,4,7,15] 的初始序列,改为 FSRS 4.5+ 后:
// - 首次学习就使用 17 参数记忆模型(ts-fsrs 内置默认参数)推算合理间隔
// - 4 档评估(Again/Hard/Good/Easy)与 UI 上已有的 MasteryLevel 一一对应
// - 全本地计算,无需部署

import {
  fsrs as createFSRS,
  createEmptyCard,
  Rating,
  type Card,
  type Grade,
} from 'ts-fsrs'
import type { MasteryLevel } from '../types/study'

// 长时程 FSRS 调度器:关闭分钟级 learning-steps,每次评估至少推进到"天"级别,
// 匹配"一天一条复习任务"的产品模型
const scheduler = createFSRS({ enable_short_term: false })

// 我们的持久化状态(把 Card.due 从 Date 换成 YYYY-MM-DD 字符串,和项目其他日期字段口径一致)
export interface FSRSCardState {
  due: string             // YYYY-MM-DD
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  learning_steps: number
  state: number           // 0=New, 1=Learning, 2=Review, 3=Relearning
}

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toCard(state: FSRSCardState): Card {
  return {
    due: new Date(state.due + 'T00:00:00'),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    reps: state.reps,
    lapses: state.lapses,
    learning_steps: state.learning_steps,
    state: state.state,
    last_review: undefined,
  } as Card
}

function fromCard(card: Card): FSRSCardState {
  return {
    due: fmtDate(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps,
    state: card.state,
  }
}

// 空卡片(首学前的状态)
export function createInitialFSRSCard(originDate: string): FSRSCardState {
  const card = createEmptyCard(new Date(originDate + 'T00:00:00'))
  return fromCard(card)
}

// MasteryLevel → FSRS Rating
export function masteryToRating(m: MasteryLevel): Rating {
  switch (m) {
    case 'again': return Rating.Again
    case 'hard': return Rating.Hard
    case 'good': return Rating.Good
    case 'easy': return Rating.Easy
  }
}

// 用户评估一次复习,返回新的卡片状态(内含下一次 due 日期)
export function advanceFSRSCard(
  state: FSRSCardState,
  mastery: MasteryLevel,
  reviewDate: string,
): FSRSCardState {
  const card = toCard(state)
  const now = new Date(reviewDate + 'T00:00:00')
  // ts-fsrs 的 next() 接受 Grade (1-4),与 Rating 的值完全对应,直接强转即可
  const rec = scheduler.next(card, now, masteryToRating(mastery) as unknown as Grade)
  return fromCard(rec.card)
}

// 首次学习完成后,预先生成 N 条复习任务的日期(假设用户每次都是 Good)
// 返回每条复习的日期字符串 + 当时的 Card 快照,便于把 FSRSCardState 塞进任务里
export function scheduleInitialReviewsFSRS(
  originDate: string,
  count = 5,
): Array<{ date: string; card: FSRSCardState }> {
  let card = createEmptyCard(new Date(originDate + 'T00:00:00'))
  let now = new Date(originDate + 'T00:00:00')
  const out: Array<{ date: string; card: FSRSCardState }> = []
  for (let i = 0; i < count; i++) {
    const rec = scheduler.repeat(card, now)
    const good = rec[Rating.Good]
    card = good.card
    now = card.due
    out.push({ date: fmtDate(card.due), card: fromCard(card) })
  }
  return out
}

// 预览:仅返回日期数组(供 UI 展示"首次学习后会生成这些复习")
export function previewInitialReviewDates(originDate: string, count = 5): string[] {
  return scheduleInitialReviewsFSRS(originDate, count).map(x => x.date)
}
