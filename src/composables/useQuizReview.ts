// AI 问答复习状态机
// 流程: idle → asking → evaluating → result → (next question) → finished

import { ref } from 'vue'
import type { StudyQuestion, MasteryLevel } from '../types/study'
import { useTaskStore } from '../stores/taskStore'
import { useSettingStore } from '../stores/settingStore'
import { chatWithDeepSeek, type DeepSeekMessage } from '../utils/deepseek'
import { buildQuizSystemPrompt, parseAIEvaluation } from '../utils/aiTools'
import { scoreToMastery } from '../utils/fsrs'

export type QuizPhase = 'idle' | 'asking' | 'evaluating' | 'result' | 'finished'

export interface QuizResult {
  score: number
  reason: string
  mastery: MasteryLevel
  questionId: string
}

export interface QuizSummary {
  total: number
  scores: Record<MasteryLevel, number>
}

export function useQuizReview() {
  const phase = ref<QuizPhase>('idle')
  const questions = ref<StudyQuestion[]>([])
  const currentIndex = ref(0)
  const answerText = ref('')
  const currentResult = ref<QuizResult | null>(null)
  const quizSummary = ref<QuizSummary | null>(null)
  const error = ref<string | null>(null)

  // 对话历史(用于保持上下文连贯)
  const conversationHistory = ref<DeepSeekMessage[]>([])

  const currentQuestion = () => {
    if (currentIndex.value < 0 || currentIndex.value >= questions.value.length) return null
    return questions.value[currentIndex.value]
  }

  const progress = () => ({
    current: currentIndex.value + 1,
    total: questions.value.length,
  })

  // 开始一轮问答
  function startQuiz(selectedQuestions: StudyQuestion[]) {
    questions.value = selectedQuestions
    currentIndex.value = 0
    currentResult.value = null
    quizSummary.value = null
    error.value = null
    conversationHistory.value = []
    answerText.value = ''

    if (selectedQuestions.length === 0) {
      phase.value = 'finished'
      quizSummary.value = { total: 0, scores: { again: 0, hard: 0, good: 0, easy: 0 } }
      return
    }

    phase.value = 'asking'
  }

  // 提交答案 → 发给 AI 评估
  async function submitAnswer(taskId: string): Promise<void> {
    const question = currentQuestion()
    if (!question) return

    const userAnswer = answerText.value.trim()
    if (!userAnswer) {
      // 空答案当作 skip
      answerText.value = ''
    }

    const settingStore = useSettingStore()
    const settings = settingStore.settings
    if (!settings.aiEnabled || !settings.aiApiKey) {
      error.value = '请先在设置中启用 AI 助手并填写 DeepSeek API Key'
      return
    }

    phase.value = 'evaluating'
    error.value = null

    try {
      // 构建 system prompt
      const sysPrompt = buildQuizSystemPrompt(
        '', // material 太长会占用 token,让 AI 基于题目本身评估
        question.text,
        question.referenceAnswer,
      )

      // 构建消息列表(system + 历史对话 + 当前用户答案)
      const messages: DeepSeekMessage[] = [
        { role: 'system', content: sysPrompt },
        ...conversationHistory.value,
        { role: 'user', content: userAnswer || '(用户跳过此题，没有作答)' },
      ]

      const response = await chatWithDeepSeek({
        apiKey: settings.aiApiKey,
        model: settings.aiModel,
        messages,
        temperature: 0.2, // 评估需要稳定输出
      })

      const aiText = response.choices[0]?.message?.content || ''
      if (!aiText) {
        throw new Error('AI 返回了空内容')
      }

      // 解析评估结果
      const { score, reason } = parseAIEvaluation(aiText)
      const mastery = scoreToMastery(score)

      // 保存结果
      const result: QuizResult = {
        score,
        reason,
        mastery,
        questionId: question.id,
      }
      currentResult.value = result

      // 更新对话历史(保持上下文)
      conversationHistory.value.push(
        { role: 'user', content: userAnswer || '(跳过)' },
        { role: 'assistant', content: aiText },
      )

      // 持久化到 taskStore
      const taskStore = useTaskStore()
      await taskStore.submitQuestionAssessment(taskId, question.id, mastery, reason)

      phase.value = 'result'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = msg
      // 回到 asking 状态,允许重试
      phase.value = 'asking'
    }
  }

  // 进入下一题
  function nextQuestion() {
    answerText.value = ''
    currentResult.value = null

    if (currentIndex.value + 1 >= questions.value.length) {
      // 所有题目完成
      phase.value = 'finished'
      buildSummary()
      return
    }

    currentIndex.value++
    phase.value = 'asking'
  }

  // 构建总结
  function buildSummary() {
    const scores: Record<MasteryLevel, number> = { again: 0, hard: 0, good: 0, easy: 0 }
    for (const q of questions.value) {
      const history = q.masteryHistory
      if (history.length > 0) {
        const lastLevel = history[history.length - 1].level
        scores[lastLevel]++
      }
    }
    quizSummary.value = { total: questions.value.length, scores }
  }

  // 重置
  function reset() {
    phase.value = 'idle'
    questions.value = []
    currentIndex.value = 0
    answerText.value = ''
    currentResult.value = null
    quizSummary.value = null
    error.value = null
    conversationHistory.value = []
  }

  return {
    phase,
    questions,
    currentIndex,
    answerText,
    currentResult,
    quizSummary,
    error,
    currentQuestion,
    progress,
    startQuiz,
    submitAnswer,
    nextQuestion,
    reset,
  }
}
