// 认知训练状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { DecisionEntry, ThinkingChallenge, BiasCheck, CognitiveStats } from '../types'
import {
  initDB,
  getAllDecisions,
  getAllChallenges,
  getAllBiases,
  putDecision,
  putChallenge,
  putBias,
  deleteDecisionRow,
  deleteChallengeRow,
  deleteBiasRow,
} from '../utils/db'
import dayjs from 'dayjs'

export const useCognitiveStore = defineStore('cognitive', () => {
  const decisions = ref<DecisionEntry[]>([])
  const challenges = ref<ThinkingChallenge[]>([])
  const biases = ref<BiasCheck[]>([])
  const loading = ref(false)

  async function loadAll() {
    loading.value = true
    try {
      await initDB()
      const [ds, cs, bs] = await Promise.all([
        getAllDecisions(),
        getAllChallenges(),
        getAllBiases(),
      ])
      decisions.value = ds.sort((a, b) => b.createdAt - a.createdAt)
      challenges.value = cs.sort((a, b) => b.createdAt - a.createdAt)
      biases.value = bs.sort((a, b) => b.createdAt - a.createdAt)
    } finally {
      loading.value = false
    }
  }

  // ========== 决策日记 ==========

  async function createDecision(data: {
    title: string
    context: string
    reasoning: string
    expectedOutcome: string
  }): Promise<DecisionEntry> {
    const now = Date.now()
    const entry: DecisionEntry = {
      id: uuidv4(),
      title: data.title,
      context: data.context,
      reasoning: data.reasoning,
      expectedOutcome: data.expectedOutcome,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    await putDecision(entry)
    decisions.value.unshift(entry)
    return entry
  }

  async function reviewDecision(
    id: string,
    data: { actualOutcome: string; lessonLearned: string }
  ): Promise<DecisionEntry | null> {
    const idx = decisions.value.findIndex(d => d.id === id)
    if (idx < 0) return null
    const updated: DecisionEntry = {
      ...decisions.value[idx],
      actualOutcome: data.actualOutcome,
      lessonLearned: data.lessonLearned,
      status: 'reviewed',
      updatedAt: Date.now(),
    }
    await putDecision(updated)
    decisions.value[idx] = updated
    return updated
  }

  async function deleteDecision(id: string): Promise<void> {
    await deleteDecisionRow(id)
    decisions.value = decisions.value.filter(d => d.id !== id)
  }

  // ========== 思维挑战 ==========

  async function createChallenge(data: {
    topic: string
    initialBelief: string
    answers: ThinkingChallenge['answers']
    insight?: string
  }): Promise<ThinkingChallenge> {
    const now = Date.now()
    const entry: ThinkingChallenge = {
      id: uuidv4(),
      topic: data.topic,
      initialBelief: data.initialBelief,
      answers: data.answers,
      insight: data.insight,
      createdAt: now,
      updatedAt: now,
    }
    await putChallenge(entry)
    challenges.value.unshift(entry)
    return entry
  }

  async function deleteChallenge(id: string): Promise<void> {
    await deleteChallengeRow(id)
    challenges.value = challenges.value.filter(c => c.id !== id)
  }

  // ========== 认知偏差 ==========

  async function recordBiasCheck(biasKey: string, recognized: boolean, reflection?: string): Promise<BiasCheck> {
    const now = Date.now()
    const entry: BiasCheck = {
      id: uuidv4(),
      biasKey,
      recognized,
      reflection,
      createdAt: now,
    }
    await putBias(entry)
    biases.value.unshift(entry)
    return entry
  }

  // ========== 统计 ==========

  const stats = computed<CognitiveStats>(() => {
    const sevenDaysAgo = dayjs().subtract(7, 'day').valueOf()
    const recentDecisions = decisions.value.filter(d => d.createdAt >= sevenDaysAgo).length
    const recentChallenges = challenges.value.filter(c => c.createdAt >= sevenDaysAgo).length
    const recentBiases = biases.value.filter(b => b.createdAt >= sevenDaysAgo).length

    return {
      totalDecisions: decisions.value.length,
      reviewedDecisions: decisions.value.filter(d => d.status === 'reviewed').length,
      pendingReviews: decisions.value.filter(d => d.status === 'pending').length,
      totalChallenges: challenges.value.length,
      recentActivity: recentDecisions + recentChallenges + recentBiases,
    }
  })

  return {
    decisions,
    challenges,
    biases,
    loading,
    loadAll,
    createDecision,
    reviewDecision,
    deleteDecision,
    createChallenge,
    deleteChallenge,
    recordBiasCheck,
    stats,
  }
})
