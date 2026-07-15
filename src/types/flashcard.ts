// 记忆卡牌 — 类型定义
import type { FSRSCardState } from '../utils/fsrs'
import type { MasteryLevel } from './study'

export type FlashcardPool = 'unmastered' | 'learning' | 'mastered'
export type FlashcardRating = 'forgot' | 'hesitated' | 'correct' | 'instant'

export interface FlashcardDeck {
  id: string
  name: string
  description?: string
  icon: string
  color: string
  createdAt: number
  updatedAt: number
}

export interface FlashcardCard {
  id: string
  deckId: string
  front: string
  back: string
  fsrs: FSRSCardState
  reviewCount: number
  lastReviewDate?: string
  createdAt: number
  updatedAt: number
}

export interface FlashcardSession {
  id: string
  deckId: string
  date: string
  cardCount: number
  correctCount: number
  duration: number
  ratings: FlashcardRating[]
  createdAt: number
}

export interface FlashcardStats {
  total: number
  unmastered: number
  learning: number
  mastered: number
  dueToday: number
  streak: number
}

export interface FlashcardWeeklyData {
  date: string
  practiced: number
  correct: number
}

// Rating → FSRS MasteryLevel 映射
export const RATING_TO_MASTERY: Record<FlashcardRating, MasteryLevel> = {
  forgot: 'again',
  hesitated: 'hard',
  correct: 'good',
  instant: 'easy',
}

export const RATING_LABELS: Record<FlashcardRating, string> = {
  forgot: '忘了',
  hesitated: '卡了',
  correct: '对了',
  instant: '秒答',
}

export const RATING_EMOJIS: Record<FlashcardRating, string> = {
  forgot: '😵',
  hesitated: '🤔',
  correct: '😎',
  instant: '⚡',
}

export const POOL_LABELS: Record<FlashcardPool, string> = {
  unmastered: '未掌握',
  learning: '在学',
  mastered: '掌握',
}

export const POOL_COLORS: Record<FlashcardPool, string> = {
  unmastered: '#FF3B30',
  learning: '#F5A962',
  mastered: '#7BC47F',
}

// 预设牌组颜色
export const DECK_COLOR_PRESETS = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759',
  '#5AC8FA', '#007AFF', '#5856D6', '#AF52DE',
  '#FF2D55', '#A2845E', '#8E8E93', '#FF6B6B',
]

// 预设牌组 icon
export const DECK_ICON_PRESETS = [
  '📚', '🧠', '💻', '🔬', '📐', '🎯', '🔥', '⭐',
  '💡', '🎓', '📝', '🗂️', '🌐', '⚙️', '🎴', '🏆',
]
