<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Task } from '../../types'
import type { MasteryLevel, StudyQuestion } from '../../types/study'
import { MASTERY_LABELS, MASTERY_TO_QUALITY } from '../../types/study'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { recordSinglePhrase } from '../../utils/speechRecognition'
import { useAIChat } from '../../composables/useAIChat'
import { useQuizReview } from '../../composables/useQuizReview'
import { v4 as uuidv4 } from 'uuid'
import { createInitialFSRSCard } from '../../utils/fsrs'
import dayjs from 'dayjs'

const props = defineProps<{
  task: Task
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'completed'): void
}>()

const taskStore = useTaskStore()
const uiStore = useUiStore()
const aiChat = useAIChat()
const quiz = useQuizReview()

const submitting = ref(false)
const showMaterial = ref(false)
const isRecording = ref(false)

// 模式: 'quiz' | 'manual'
const activeMode = ref<'quiz' | 'manual'>('quiz')

// 题目管理
const showQuestionList = ref(false)
const showAddQuestion = ref(false)
const newQuestionText = ref('')
const editingQuestionId = ref<string | null>(null)
const editingQuestionText = ref('')

// AI 出题
const isGeneratingQuestions = ref(false)
const generatedQuestions = ref<{ question: string; answer: string }[]>([])
const showGeneratedPreview = ref(false)

const reviewIndex = computed(() => props.task.study?.ebbinghaus?.reviewIndex ?? 0)
const subject = computed(() => props.task.study?.subject ?? props.task.title)
const material = computed(() => props.task.study?.materialText ?? '')
const sm2State = computed(() => props.task.study?.ebbinghaus?.sm2)
const fsrsState = computed(() => props.task.study?.ebbinghaus?.fsrs)
const history = computed(() => props.task.study?.ebbinghaus?.masteryHistory ?? [])
const aiSessionId = computed(() => props.task.study?.ebbinghaus?.aiSessionId)
const questions = computed(() => props.task.study?.questions ?? [])
const hasQuestions = computed(() => questions.value.length > 0)

const masteryOptions: { level: MasteryLevel; icon: string; hint: string }[] = [
  { level: 'again', icon: '🔄', hint: '完全忘记 · 1 天后再来' },
  { level: 'hard', icon: '😓', hint: '勉强记住 · 缩短间隔' },
  { level: 'good', icon: '👍', hint: '顺利记住 · 正常间隔' },
  { level: 'easy', icon: '⭐', hint: '完美掌握 · 拉长间隔' },
]

// 避开 vue-tsc 在 v-if 作用域里的字面量类型窄化:
// 把 phase.value 的比较结果提前算成 boolean,模板里用 bool 判断
const isQuizEvaluating = computed(() => quiz.phase.value === 'evaluating')

async function assess(level: MasteryLevel) {
  if (submitting.value) return
  submitting.value = true
  try {
    await taskStore.submitReviewAssessment(props.task.id, level)
    emit('completed')
    close()
  } finally {
    submitting.value = false
  }
}

function openAIChat() {
  const sessionId = aiSessionId.value
  const extraPrompt = material.value
    ? `你正在帮助用户复习学习材料。以下是学习内容:\n\n${material.value}\n\n请基于这份材料提问用户,评估掌握情况。每次问答后给出质量评分(格式: [评估] 质量: N/5, 理由: ...),N 为 1-5 分。`
    : undefined

  uiStore.openAiChat(sessionId, extraPrompt)
  close()
}

// ---- 问答模式 ----

function startQuizMode() {
  const today = dayjs().format('YYYY-MM-DD')
  const selected = taskStore.selectNextQuestion(questions.value, today)
  quiz.startQuiz(selected)
}

// 语音输入(问答模式)
async function startVoiceQuiz() {
  if (isRecording.value) return
  isRecording.value = true
  try {
    const text = await recordSinglePhrase('zh-CN', 15000)
    quiz.answerText.value = text
  } catch (err) {
    console.error('语音识别失败:', err)
  } finally {
    isRecording.value = false
  }
}

async function submitQuizAnswer() {
  await quiz.submitAnswer(props.task.id)
}

async function finishQuizAndComplete() {
  await taskStore.completeQuizReview(props.task.id)
  emit('completed')
  close()
}

// ---- 题目管理 ----

async function addQuestion() {
  const text = newQuestionText.value.trim()
  if (!text) return
  await taskStore.addQuestionsToStudy(props.task.id, [{ text }])
  newQuestionText.value = ''
  showAddQuestion.value = false
}

async function removeQuestion(questionId: string) {
  await taskStore.removeQuestionFromStudy(props.task.id, questionId)
}

function startEditQuestion(q: StudyQuestion) {
  editingQuestionId.value = q.id
  editingQuestionText.value = q.text
}

async function saveEditQuestion() {
  if (!editingQuestionId.value) return
  const text = editingQuestionText.value.trim()
  if (!text) return
  await taskStore.editQuestionText(props.task.id, editingQuestionId.value, text)
  editingQuestionId.value = null
  editingQuestionText.value = ''
}

// AI 自动出题
async function generateQuestionsFromAI() {
  if (!material.value) return
  isGeneratingQuestions.value = true
  generatedQuestions.value = []

  try {
    const { chatWithDeepSeek } = await import('../../utils/deepseek')
    const { buildQuestionGenerationMessages, parseGeneratedQuestions } = await import('../../utils/aiTools')
    const { useSettingStore } = await import('../../stores/settingStore')
    const settingStore = useSettingStore()
    const settings = settingStore.settings

    if (!settings.aiEnabled || !settings.aiApiKey) {
      alert('请先在设置中启用 AI 并填写 API Key')
      return
    }

    const messages = buildQuestionGenerationMessages(material.value)
    const response = await chatWithDeepSeek({
      apiKey: settings.aiApiKey,
      model: settings.aiModel,
      messages,
      temperature: 0.5,
    })

    const aiText = response.choices[0]?.message?.content || ''
    generatedQuestions.value = parseGeneratedQuestions(aiText)

    if (generatedQuestions.value.length === 0) {
      alert('AI 未能生成题目，请重试或手动添加')
    } else {
      showGeneratedPreview.value = true
    }
  } catch (err) {
    console.error('AI 出题失败:', err)
    alert('AI 出题失败：' + (err instanceof Error ? err.message : String(err)))
  } finally {
    isGeneratingQuestions.value = false
  }
}

async function confirmGeneratedQuestions() {
  const items = generatedQuestions.value.map(g => ({ text: g.question, answer: g.answer }))
  await taskStore.addQuestionsToStudy(props.task.id, items)
  generatedQuestions.value = []
  showGeneratedPreview.value = false
}

// 获取题目最近掌握度
function getQuestionMastery(q: StudyQuestion): MasteryLevel | null {
  if (q.masteryHistory.length === 0) return null
  return q.masteryHistory[q.masteryHistory.length - 1].level
}

function masteryClass(level: MasteryLevel | null): string {
  if (!level) return 'mastery-new'
  return `mastery-${level}`
}

// 对话框打开时重置状态
watch(() => props.modelValue, (v) => {
  if (v) {
    quiz.reset()
    showAddQuestion.value = false
    showGeneratedPreview.value = false
  }
})

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <transition name="fade">
    <div v-if="modelValue" class="review-overlay" @click.self="close">
      <div class="review-panel">
        <header class="review-header">
          <div>
            <div class="review-badge">🔁 第 {{ reviewIndex }} 次复习</div>
            <h2>{{ subject }}</h2>
          </div>
          <button class="close-btn" @click="close">×</button>
        </header>

        <div class="review-body">
          <!-- 模式切换: 有题目时才显示 -->
          <div v-if="hasQuestions" class="mode-tabs">
            <button
              class="mode-tab"
              :class="{ active: activeMode === 'quiz' }"
              @click="activeMode = 'quiz'"
            >🤖 AI 问答</button>
            <button
              class="mode-tab"
              :class="{ active: activeMode === 'manual' }"
              @click="activeMode = 'manual'"
            >✍️ 手动评估</button>
          </div>

          <!-- ========== AI 问答模式 ========== -->
          <template v-if="hasQuestions && activeMode === 'quiz'">
            <!-- idle: 还没开始 -->
            <div v-if="quiz.phase.value === 'idle'" class="quiz-idle">
              <div class="section-label">📝 本轮复习题目 ({{ questions.length }} 道)</div>
              <p class="quiz-hint">AI 会逐题提问，你回答后 AI 自动评估掌握程度并更新记忆曲线。</p>
              <button class="start-quiz-btn" @click="startQuizMode">
                开始 AI 问答复习
              </button>
            </div>

            <!-- asking: AI 已出题，等待用户输入 -->
            <div v-if="quiz.phase.value === 'asking'" class="quiz-asking">
              <div class="quiz-progress">
                <span>📝 {{ quiz.progress().current }} / {{ quiz.progress().total }}</span>
              </div>
              <div class="quiz-question">
                <div class="question-label">题目:</div>
                <div class="question-text">{{ quiz.currentQuestion()?.text }}</div>
              </div>
              <div class="answer-input">
                <textarea
                  v-model="quiz.answerText.value"
                  class="answer-textarea"
                  placeholder="输入你的回答..."
                  rows="4"
                />
                <div class="answer-actions">
                  <button
                    class="voice-btn"
                    :class="{ recording: isRecording }"
                    :disabled="isRecording"
                    @click="startVoiceQuiz"
                  >
                    {{ isRecording ? '🎤 录音中...' : '🎤 语音' }}
                  </button>
                  <button
                    class="submit-answer-btn"
                    :disabled="isQuizEvaluating"
                    @click="submitQuizAnswer"
                  >
                    {{ isQuizEvaluating ? '评估中...' : '提交答案' }}
                  </button>
                </div>
              </div>
              <p v-if="quiz.error.value" class="quiz-error">{{ quiz.error.value }}</p>
            </div>

            <!-- evaluating: AI 正在评估 -->
            <div v-if="quiz.phase.value === 'evaluating'" class="quiz-evaluating">
              <div class="quiz-progress">
                <span>📝 {{ quiz.progress().current }} / {{ quiz.progress().total }}</span>
              </div>
              <div class="quiz-question">
                <div class="question-label">题目:</div>
                <div class="question-text">{{ quiz.currentQuestion()?.text }}</div>
              </div>
              <div class="evaluating-indicator">
                <span class="spinner"></span>
                AI 正在评估你的回答...
              </div>
            </div>

            <!-- result: 显示评估结果 -->
            <div v-if="quiz.phase.value === 'result' && quiz.currentResult.value" class="quiz-result">
              <div class="quiz-progress">
                <span>📝 {{ quiz.progress().current }} / {{ quiz.progress().total }}</span>
              </div>
              <div class="result-card" :class="`mastery-${quiz.currentResult.value.mastery}`">
                <div class="result-score">
                  {{ quiz.currentResult.value.score }} / 5
                  <span class="result-mastery">{{ MASTERY_LABELS[quiz.currentResult.value.mastery] }}</span>
                </div>
                <div class="result-reason">{{ quiz.currentResult.value.reason }}</div>
              </div>
              <button class="next-question-btn" @click="quiz.nextQuestion()">
                {{ quiz.currentIndex.value + 1 >= quiz.questions.value.length ? '查看总结' : '下一题 →' }}
              </button>
            </div>

            <!-- finished: 本轮结束 -->
            <div v-if="quiz.phase.value === 'finished'" class="quiz-finished">
              <h3>✅ 本轮复习完成</h3>
              <div v-if="quiz.quizSummary.value" class="quiz-summary">
                <p>本次评估了 {{ quiz.quizSummary.value.total }} 道题：</p>
                <div class="summary-scores">
                  <span class="summary-chip mastery-again">🔄 重来: {{ quiz.quizSummary.value.scores.again }}</span>
                  <span class="summary-chip mastery-hard">😓 困难: {{ quiz.quizSummary.value.scores.hard }}</span>
                  <span class="summary-chip mastery-good">👍 良好: {{ quiz.quizSummary.value.scores.good }}</span>
                  <span class="summary-chip mastery-easy">⭐ 简单: {{ quiz.quizSummary.value.scores.easy }}</span>
                </div>
              </div>
              <div class="finish-actions">
                <button class="material-toggle" @click="showMaterial = !showMaterial">
                  📄 {{ showMaterial ? '收起' : '展开' }}学习材料
                </button>
                <button class="complete-btn" @click="finishQuizAndComplete">
                  完成复习 ✓
                </button>
              </div>
            </div>
          </template>

          <!-- ========== 手动模式 / 无题目时的默认模式 ========== -->
          <template v-if="!hasQuestions || activeMode === 'manual'">
            <!-- 材料区 -->
            <div v-if="material" class="material-section">
              <button class="material-toggle" @click="showMaterial = !showMaterial">
                📄 {{ showMaterial ? '收起' : '展开' }}学习材料
              </button>
              <pre v-if="showMaterial" class="material-content">{{ material }}</pre>
            </div>

            <!-- 历史 -->
            <div v-if="history.length" class="history-section">
              <div class="section-label">📊 历史评估</div>
              <div class="history-list">
                <span
                  v-for="(h, i) in history"
                  :key="i"
                  class="history-chip"
                  :class="`mastery-${h.level}`"
                >
                  {{ MASTERY_LABELS[h.level] }}
                </span>
              </div>
            </div>

            <!-- FSRS 状态 -->
            <div v-if="fsrsState" class="sm2-section">
              <div class="section-label">🧠 FSRS 记忆状态</div>
              <div class="sm2-stats">
                <span>稳定度: {{ fsrsState.stability.toFixed(1) }} 天</span>
                <span>·</span>
                <span>难度: {{ fsrsState.difficulty.toFixed(1) }} / 10</span>
                <span>·</span>
                <span>已复习: {{ fsrsState.reps }} 次</span>
                <span>·</span>
                <span>下次: {{ fsrsState.due }}</span>
              </div>
            </div>
            <div v-else-if="sm2State" class="sm2-section">
              <div class="section-label">🎯 SM-2 状态</div>
              <div class="sm2-stats">
                <span>难度因子: {{ sm2State.easinessFactor }}</span>
                <span>·</span>
                <span>已复习: {{ sm2State.repetitions }} 次</span>
                <span>·</span>
                <span>当前间隔: {{ sm2State.interval || 0 }} 天</span>
              </div>
            </div>

            <!-- AI 问答入口 (旧模式,无题目时) -->
            <div v-if="!hasQuestions" class="assess-section">
              <div class="section-label">🤖 AI 问答复习</div>
              <div class="ai-actions">
                <button class="ai-chat-btn" @click="openAIChat">
                  打开 AI 问答 — AI 基于学习材料提问并自动评估
                </button>
              </div>

              <div class="section-label" style="margin-top: 16px;">✍️ 手动掌握度评估</div>
              <div class="mastery-buttons">
                <button
                  v-for="opt in masteryOptions"
                  :key="opt.level"
                  class="mastery-btn"
                  :class="`mastery-${opt.level}`"
                  :disabled="submitting"
                  @click="assess(opt.level)"
                >
                  <span class="mastery-icon">{{ opt.icon }}</span>
                  <span class="mastery-label">{{ MASTERY_LABELS[opt.level] }}</span>
                  <span class="mastery-hint">{{ opt.hint }}</span>
                </button>
              </div>
            </div>
          </template>

          <!-- ========== 题目管理区(有题目时始终显示) ========== -->
          <div v-if="hasQuestions" class="questions-section">
            <button class="material-toggle" @click="showQuestionList = !showQuestionList">
              📋 {{ showQuestionList ? '收起' : '展开' }}题目列表 ({{ questions.length }})
            </button>

            <div v-if="showQuestionList" class="question-list">
              <div
                v-for="q in questions"
                :key="q.id"
                class="question-item"
              >
                <template v-if="editingQuestionId === q.id">
                  <input
                    v-model="editingQuestionText"
                    class="question-edit-input"
                    @keyup.enter="saveEditQuestion"
                  />
                  <div class="question-item-actions">
                    <button class="q-action-btn save" @click="saveEditQuestion">保存</button>
                    <button class="q-action-btn cancel" @click="editingQuestionId = null">取消</button>
                  </div>
                </template>
                <template v-else>
                  <span class="question-mastery-dot" :class="masteryClass(getQuestionMastery(q))"></span>
                  <span class="question-text-item">{{ q.text }}</span>
                  <div class="question-item-actions">
                    <button class="q-action-btn" @click="startEditQuestion(q)">编辑</button>
                    <button class="q-action-btn delete" @click="removeQuestion(q.id)">删除</button>
                  </div>
                </template>
              </div>
            </div>

            <!-- 添加题目 -->
            <div class="question-add-area">
              <button v-if="!showAddQuestion" class="add-question-btn" @click="showAddQuestion = true">
                + 添加题目
              </button>
              <div v-else class="add-question-form">
                <textarea
                  v-model="newQuestionText"
                  class="new-question-input"
                  placeholder="输入题目（每行一题）..."
                  rows="3"
                />
                <div class="add-question-actions">
                  <button class="submit-answer-btn" @click="addQuestion">添加</button>
                  <button class="q-action-btn cancel" @click="showAddQuestion = false; newQuestionText = ''">取消</button>
                </div>
              </div>

              <!-- AI 自动出题 -->
              <button
                v-if="material && !showGeneratedPreview"
                class="ai-generate-btn"
                :disabled="isGeneratingQuestions"
                @click="generateQuestionsFromAI"
              >
                {{ isGeneratingQuestions ? '🤖 AI 生成中...' : '🤖 AI 自动出题' }}
              </button>

              <!-- AI 生成结果预览 -->
              <div v-if="showGeneratedPreview" class="generated-preview">
                <div class="section-label">🤖 AI 生成了 {{ generatedQuestions.length }} 道题目（可编辑后确认）</div>
                <div
                  v-for="(g, i) in generatedQuestions"
                  :key="i"
                  class="generated-item"
                >
                  <input
                    v-model="g.question"
                    class="generated-input"
                    :placeholder="`题目 ${i + 1}`"
                  />
                  <input
                    v-model="g.answer"
                    class="generated-input answer"
                    placeholder="参考答案（可选）"
                  />
                  <button class="q-action-btn delete" @click="generatedQuestions.splice(i, 1)">×</button>
                </div>
                <div class="generated-actions">
                  <button class="submit-answer-btn" @click="confirmGeneratedQuestions">确认添加</button>
                  <button class="q-action-btn cancel" @click="showGeneratedPreview = false; generatedQuestions = []">取消</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
.review-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.review-panel {
  background: var(--bg-secondary);
  border-radius: 14px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.review-header {
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  h2 {
    margin: 6px 0 0;
    font-size: 18px;
    color: var(--text-primary);
  }
}

.review-badge {
  display: inline-block;
  padding: 3px 10px;
  background: rgba(108, 155, 235, 0.15);
  color: rgb(80, 130, 220);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.close-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-tertiary);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover { background: var(--bg-hover); }
}

.review-body {
  padding: 18px 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.material-section {
  .material-toggle {
    padding: 6px 12px;
    background: var(--bg-primary);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;

    &:hover { background: var(--bg-hover); }
  }

  .material-content {
    margin-top: 10px;
    background: var(--bg-primary);
    padding: 12px;
    border-radius: 8px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    color: var(--text-primary);
    max-height: 240px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.history-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.history-chip {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;

  &.mastery-again { background: rgba(240, 100, 100, 0.15); color: rgb(200, 70, 70); }
  &.mastery-hard  { background: rgba(240, 160, 60, 0.15); color: rgb(200, 130, 40); }
  &.mastery-good  { background: rgba(80, 180, 100, 0.15); color: rgb(60, 150, 80); }
  &.mastery-easy  { background: rgba(100, 155, 235, 0.15); color: rgb(80, 130, 220); }
}

.sm2-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--text-tertiary);
  font-size: 13px;
}

.mastery-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.mastery-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 10px;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.15s;
  min-height: 88px;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .mastery-icon { font-size: 22px; }
  .mastery-label { font-size: 14px; font-weight: 500; color: var(--text-primary); }
  .mastery-hint { font-size: 10px; color: var(--text-tertiary); text-align: center; line-height: 1.3; }

  &.mastery-again { border-color: rgba(240, 100, 100, 0.4); }
  &.mastery-hard  { border-color: rgba(240, 160, 60, 0.4); }
  &.mastery-good  { border-color: rgba(80, 180, 100, 0.4); }
  &.mastery-easy  { border-color: rgba(100, 155, 235, 0.4); }
}

.ai-hint {
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(108, 155, 235, 0.08);
  color: var(--text-tertiary);
  font-size: 12px;
  border-radius: 6px;
}

.ai-chat-btn {
  width: 100%;
  padding: 14px 16px;
  background: rgba(108, 155, 235, 0.15);
  color: rgb(80, 130, 220);
  border: 2px solid rgba(108, 155, 235, 0.3);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(108, 155, 235, 0.25);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
  }
}

.ai-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.voice-btn {
  width: 100%;
  padding: 12px 16px;
  background: rgba(240, 160, 60, 0.15);
  color: rgb(200, 130, 40);
  border: 2px solid rgba(240, 160, 60, 0.3);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: rgba(240, 160, 60, 0.25);
  }

  &:disabled {
    opacity: 0.7;
  }

  &.recording {
    background: rgba(240, 100, 100, 0.15);
    border-color: rgba(240, 100, 100, 0.3);
    color: rgb(200, 70, 70);
    animation: pulse 1s infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.transcript {
  margin-top: 10px;
  padding: 8px 12px;
  background: var(--bg-primary);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

/* ---- 模式切换 tabs ---- */
.mode-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-primary);
  padding: 4px;
  border-radius: 10px;
}

.mode-tab {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &.active {
    background: var(--bg-secondary);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  &:hover:not(.active) {
    color: var(--text-primary);
  }
}

/* ---- 问答模式 ---- */
.quiz-idle, .quiz-asking, .quiz-evaluating, .quiz-result, .quiz-finished {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.quiz-hint {
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.5;
}

.start-quiz-btn {
  width: 100%;
  padding: 14px 16px;
  background: rgba(108, 155, 235, 0.15);
  color: rgb(80, 130, 220);
  border: 2px solid rgba(108, 155, 235, 0.3);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(108, 155, 235, 0.25);
    transform: translateY(-1px);
  }
}

.quiz-progress {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.quiz-question {
  background: var(--bg-primary);
  padding: 14px;
  border-radius: 10px;
  border-left: 3px solid rgb(108, 155, 235);
}

.question-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}

.question-text {
  font-size: 15px;
  color: var(--text-primary);
  line-height: 1.5;
}

.answer-input {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.answer-textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;

  &:focus {
    outline: none;
    border-color: rgb(108, 155, 235);
  }
}

.answer-actions {
  display: flex;
  gap: 10px;
}

.submit-answer-btn {
  flex: 1;
  padding: 10px 16px;
  background: rgb(108, 155, 235);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: rgb(90, 140, 220);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.evaluating-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-top-color: rgb(108, 155, 235);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-card {
  padding: 16px;
  border-radius: 10px;
  border: 2px solid var(--border-color);

  &.mastery-again { border-color: rgba(240, 100, 100, 0.4); background: rgba(240, 100, 100, 0.05); }
  &.mastery-hard  { border-color: rgba(240, 160, 60, 0.4); background: rgba(240, 160, 60, 0.05); }
  &.mastery-good  { border-color: rgba(80, 180, 100, 0.4); background: rgba(80, 180, 100, 0.05); }
  &.mastery-easy  { border-color: rgba(100, 155, 235, 0.4); background: rgba(100, 155, 235, 0.05); }
}

.result-score {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.result-mastery {
  font-size: 14px;
  font-weight: 500;
  margin-left: 8px;
  opacity: 0.8;
}

.result-reason {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.next-question-btn {
  width: 100%;
  padding: 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--bg-hover);
    border-color: rgb(108, 155, 235);
  }
}

.quiz-summary {
  .summary-scores {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
}

.summary-chip {
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.finish-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.complete-btn {
  width: 100%;
  padding: 14px;
  background: rgba(80, 180, 100, 0.15);
  color: rgb(60, 150, 80);
  border: 2px solid rgba(80, 180, 100, 0.3);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: rgba(80, 180, 100, 0.25);
  }
}

.quiz-error {
  color: rgb(200, 70, 70);
  font-size: 13px;
  padding: 8px;
  background: rgba(240, 100, 100, 0.08);
  border-radius: 6px;
}

/* ---- 题目管理 ---- */
.questions-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.question-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-primary);
  border-radius: 8px;
}

.question-mastery-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.mastery-again { background: rgb(200, 70, 70); }
  &.mastery-hard  { background: rgb(200, 130, 40); }
  &.mastery-good  { background: rgb(60, 150, 80); }
  &.mastery-easy  { background: rgb(80, 130, 220); }
  &.mastery-new   { background: var(--text-tertiary); }
}

.question-text-item {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.q-action-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: var(--bg-hover);
  color: var(--text-secondary);

  &:hover { background: var(--border-color); }
  &.delete { color: rgb(200, 70, 70); }
  &.save { color: rgb(60, 150, 80); }
  &.cancel { color: var(--text-tertiary); }
}

.question-edit-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
}

.question-add-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-question-btn {
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;

  &:hover { border-color: rgb(108, 155, 235); color: rgb(108, 155, 235); }
}

.add-question-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.new-question-input {
  width: 100%;
  padding: 10px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  resize: vertical;
  font-family: inherit;

  &:focus { outline: none; border-color: rgb(108, 155, 235); }
}

.add-question-actions, .generated-actions {
  display: flex;
  gap: 8px;
}

.ai-generate-btn {
  padding: 10px 14px;
  background: rgba(108, 155, 235, 0.1);
  border: 1px solid rgba(108, 155, 235, 0.25);
  border-radius: 8px;
  font-size: 13px;
  color: rgb(80, 130, 220);
  cursor: pointer;

  &:hover:not(:disabled) { background: rgba(108, 155, 235, 0.2); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.generated-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.generated-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  padding-right: 30px;
}

.generated-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;

  &.answer { font-size: 12px; color: var(--text-secondary); }
  &:focus { outline: none; border-color: rgb(108, 155, 235); }
}

.generated-item .q-action-btn.delete {
  position: absolute;
  top: 0;
  right: 0;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .review-overlay { padding: 0; align-items: flex-end; }
  .review-panel {
    max-width: 100%;
    max-height: 94vh;
    border-radius: 16px 16px 0 0;
  }
  .mastery-buttons {
    grid-template-columns: repeat(2, 1fr);
  }
  .mastery-btn { min-height: 96px; }
}
</style>
