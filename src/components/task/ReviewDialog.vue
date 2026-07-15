<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Task } from '../../types'
import type { MasteryLevel } from '../../types/study'
import { MASTERY_LABELS } from '../../types/study'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { startSpeechRecognition, recordSinglePhrase } from '../../utils/speechRecognition'
import { useAIChat } from '../../composables/useAIChat'

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
const submitting = ref(false)
const showMaterial = ref(false)
const isRecording = ref(false)
const transcriptText = ref('')

const reviewIndex = computed(() => props.task.study?.ebbinghaus?.reviewIndex ?? 0)
const subject = computed(() => props.task.study?.subject ?? props.task.title)
const material = computed(() => props.task.study?.materialText ?? '')
const sm2State = computed(() => props.task.study?.ebbinghaus?.sm2)
const fsrsState = computed(() => props.task.study?.ebbinghaus?.fsrs)
const history = computed(() => props.task.study?.ebbinghaus?.masteryHistory ?? [])
const aiSessionId = computed(() => props.task.study?.ebbinghaus?.aiSessionId)

const masteryOptions: { level: MasteryLevel; icon: string; hint: string }[] = [
  { level: 'again', icon: '🔄', hint: '完全忘记 · 1 天后再来' },
  { level: 'hard', icon: '😓', hint: '勉强记住 · 缩短间隔' },
  { level: 'good', icon: '👍', hint: '顺利记住 · 正常间隔' },
  { level: 'easy', icon: '⭐', hint: '完美掌握 · 拉长间隔' },
]

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

// 语音回答
async function startVoiceAnswer() {
  if (isRecording.value) return
  isRecording.value = true
  transcriptText.value = ''

  try {
    const text = await recordSinglePhrase('zh-CN', 15000)
    transcriptText.value = text
    // 自动发送到 AI
    await aiChat.sendMessage(text)
  } catch (err) {
    console.error('语音识别失败:', err)
  } finally {
    isRecording.value = false
  }
}

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
          <div v-if="material" class="material-section">
            <button class="material-toggle" @click="showMaterial = !showMaterial">
              📄 {{ showMaterial ? '收起' : '展开' }}学习材料
            </button>
            <pre v-if="showMaterial" class="material-content">{{ material }}</pre>
          </div>

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

          <div class="assess-section">
            <div class="section-label">🤖 AI 问答复习</div>
            <div class="ai-actions">
              <button class="ai-chat-btn" @click="openAIChat">
                打开 AI 问答 — AI 基于学习材料提问并自动评估
              </button>
              <button
                class="voice-btn"
                :class="{ recording: isRecording }"
                :disabled="isRecording"
                @click="startVoiceAnswer"
              >
                {{ isRecording ? '🎤 正在录音...' : '🎤 语音回答' }}
              </button>
            </div>
            <p v-if="transcriptText" class="transcript">识别结果: {{ transcriptText }}</p>

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
