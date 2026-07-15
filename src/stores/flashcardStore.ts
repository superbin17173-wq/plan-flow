// 记忆卡牌 — 状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import type {
  FlashcardDeck, FlashcardCard, FlashcardSession,
  FlashcardRating, FlashcardPool, FlashcardStats, FlashcardWeeklyData,
} from '../types'
import { RATING_TO_MASTERY } from '../types'
import {
  initDB,
  getAllFlashcardDecks,
  getAllFlashcardCards,
  getAllFlashcardSessions,
  putFlashcardDeck,
  deleteFlashcardDeckRow,
  putFlashcardCard,
  deleteFlashcardCardRow,
  putFlashcardSession,
} from '../utils/db'
import { createInitialFSRSCard, advanceFSRSCard, type FSRSCardState } from '../utils/fsrs'

export const useFlashcardStore = defineStore('flashcard', () => {
  const decks = ref<FlashcardDeck[]>([])
  const cards = ref<FlashcardCard[]>([])
  const sessions = ref<FlashcardSession[]>([])
  const loading = ref(false)

  // ========== Load ==========

  async function loadAll() {
    loading.value = true
    try {
      await initDB()
      const [ds, cs, ss] = await Promise.all([
        getAllFlashcardDecks(),
        getAllFlashcardCards(),
        getAllFlashcardSessions(),
      ])
      decks.value = ds.sort((a, b) => b.createdAt - a.createdAt)
      cards.value = cs
      sessions.value = ss
    } finally {
      loading.value = false
    }
  }

  // ========== Helpers ==========

  function today(): string {
    return dayjs().format('YYYY-MM-DD')
  }

  function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  /** 从 FSRS state 派生三池归属 */
  function derivePool(card: FlashcardCard): FlashcardPool {
    const s = card.fsrs
    if (s.state === 0 || s.state === 3 || s.lapses >= 2) return 'unmastered'
    if (s.state === 1 || (s.state === 2 && s.stability < 10)) return 'learning'
    return 'mastered'
  }

  /** 从 sessions 计算连续打卡天数 */
  function calculateStreak(): number {
    if (sessions.value.length === 0) return 0
    const dateSet = new Set(sessions.value.map(s => s.date))
    let streak = 0
    let d = dayjs()
    // 如果今天还没练习,从昨天开始算
    if (!dateSet.has(d.format('YYYY-MM-DD'))) {
      d = d.subtract(1, 'day')
    }
    while (dateSet.has(d.format('YYYY-MM-DD'))) {
      streak++
      d = d.subtract(1, 'day')
    }
    return streak
  }

  // ========== Getters ==========

  function getDeckById(id: string): FlashcardDeck | undefined {
    return decks.value.find(d => d.id === id)
  }

  function getCardsByDeck(deckId: string): FlashcardCard[] {
    return cards.value.filter(c => c.deckId === deckId)
  }

  function getDeckStats(deckId: string): FlashcardStats {
    const deckCards = getCardsByDeck(deckId)
    const t = today()
    return {
      total: deckCards.length,
      unmastered: deckCards.filter(c => derivePool(c) === 'unmastered').length,
      learning: deckCards.filter(c => derivePool(c) === 'learning').length,
      mastered: deckCards.filter(c => derivePool(c) === 'mastered').length,
      dueToday: deckCards.filter(c => c.fsrs.due <= t).length,
      streak: calculateStreak(),
    }
  }

  const totalStats = computed<FlashcardStats>(() => {
    const t = today()
    return {
      total: cards.value.length,
      unmastered: cards.value.filter(c => derivePool(c) === 'unmastered').length,
      learning: cards.value.filter(c => derivePool(c) === 'learning').length,
      mastered: cards.value.filter(c => derivePool(c) === 'mastered').length,
      dueToday: cards.value.filter(c => c.fsrs.due <= t).length,
      streak: calculateStreak(),
    }
  })

  const weeklyData = computed<FlashcardWeeklyData[]>(() => {
    const result: FlashcardWeeklyData[] = []
    for (let i = 6; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
      const daySessions = sessions.value.filter(s => s.date === date)
      result.push({
        date,
        practiced: daySessions.reduce((sum, s) => sum + s.cardCount, 0),
        correct: daySessions.reduce((sum, s) => sum + s.correctCount, 0),
      })
    }
    return result
  })

  // ========== Deck CRUD ==========

  async function createDeck(data: { name: string; description?: string; icon: string; color: string }): Promise<FlashcardDeck> {
    const now = Date.now()
    const deck: FlashcardDeck = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      icon: data.icon,
      color: data.color,
      createdAt: now,
      updatedAt: now,
    }
    await putFlashcardDeck(deck)
    decks.value = [deck, ...decks.value]
    return deck
  }

  async function editDeck(id: string, data: Partial<Pick<FlashcardDeck, 'name' | 'description' | 'icon' | 'color'>>) {
    const deck = decks.value.find(d => d.id === id)
    if (!deck) return
    Object.assign(deck, data, { updatedAt: Date.now() })
    await putFlashcardDeck(deck)
  }

  async function deleteDeck(id: string) {
    await deleteFlashcardDeckRow(id)
    // 级联删除该牌组下的所有卡牌
    const deckCards = cards.value.filter(c => c.deckId === id)
    for (const card of deckCards) {
      await deleteFlashcardCardRow(card.id)
    }
    decks.value = decks.value.filter(d => d.id !== id)
    cards.value = cards.value.filter(c => c.deckId !== id)
  }

  // ========== Card CRUD ==========

  async function addCards(deckId: string, drafts: Array<{ front: string; back: string }>): Promise<FlashcardCard[]> {
    const now = Date.now()
    const t = today()
    const newCards: FlashcardCard[] = []
    for (const draft of drafts) {
      const card: FlashcardCard = {
        id: uuidv4(),
        deckId,
        front: draft.front,
        back: draft.back,
        fsrs: createInitialFSRSCard(t),
        reviewCount: 0,
        createdAt: now,
        updatedAt: now,
      }
      await putFlashcardCard(card)
      newCards.push(card)
    }
    cards.value = [...cards.value, ...newCards]
    return newCards
  }

  async function editCard(id: string, data: Partial<Pick<FlashcardCard, 'front' | 'back'>>) {
    const card = cards.value.find(c => c.id === id)
    if (!card) return
    Object.assign(card, data, { updatedAt: Date.now() })
    await putFlashcardCard(card)
  }

  async function deleteCard(id: string) {
    await deleteFlashcardCardRow(id)
    cards.value = cards.value.filter(c => c.id !== id)
  }

  // ========== Practice Core ==========

  /** 获取到期卡牌,洗牌后返回 */
  function getDueCards(deckId: string): FlashcardCard[] {
    const t = today()
    const due = cards.value.filter(c => c.deckId === deckId && c.fsrs.due <= t)
    return shuffleArray(due)
  }

  /** 获取最弱的 N 张卡牌(按 stability 升序) */
  function getWeakestCards(deckId: string, limit = 10): FlashcardCard[] {
    const deckCards = cards.value.filter(c => c.deckId === deckId)
    return [...deckCards]
      .sort((a, b) => a.fsrs.stability - b.fsrs.stability)
      .slice(0, limit)
  }

  /** 记录一次评分,推进 FSRS 状态 */
  async function recordRating(cardId: string, rating: FlashcardRating) {
    const card = cards.value.find(c => c.id === cardId)
    if (!card) return
    const t = today()
    const mastery = RATING_TO_MASTERY[rating]
    const newFsrs = advanceFSRSCard(card.fsrs, mastery, t)
    card.fsrs = newFsrs
    card.reviewCount++
    card.lastReviewDate = t
    card.updatedAt = Date.now()
    await putFlashcardCard(card)
  }

  /** 记录一次练习 session */
  async function recordSession(
    deckId: string,
    cardCount: number,
    correctCount: number,
    duration: number,
    ratings: FlashcardRating[],
  ) {
    const session: FlashcardSession = {
      id: uuidv4(),
      deckId,
      date: today(),
      cardCount,
      correctCount,
      duration,
      ratings,
      createdAt: Date.now(),
    }
    await putFlashcardSession(session)
    sessions.value = [...sessions.value, session]
  }

  return {
    // state
    decks, cards, sessions, loading,
    // getters
    totalStats, weeklyData,
    // actions
    loadAll,
    getDeckById, getCardsByDeck, getDeckStats,
    createDeck, editDeck, deleteDeck,
    addCards, editCard, deleteCard,
    getDueCards, getWeakestCards,
    recordRating, recordSession,
    // helpers (exposed for views)
    derivePool, calculateStreak, shuffleArray,
  }
})
