<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFlashcardStore } from '../stores/flashcardStore'
import type { FlashcardCard, FlashcardRating } from '../types'
import { RATING_LABELS, RATING_EMOJIS } from '../types'
import CelebrationOverlay from '../components/flashcard/CelebrationOverlay.vue'

const route = useRoute()
const router = useRouter()
const store = useFlashcardStore()

const deckId = route.params.deckId as string
const mode = route.query.mode as string

// 练习状态
const queue = ref<FlashcardCard[]>([])
const currentIndex = ref(0)
const revealed = ref(false)
const celebrating = ref(false)
const celebrateRating = ref<FlashcardRating>('correct')
const streak = ref(0)
const sessionRatings = ref<FlashcardRating[]>([])
const sessionStart = ref(Date.now())

// 练习完成
const finished = ref(false)

const currentCard = computed(() => queue.value[currentIndex.value] ?? null)
const total = computed(() => queue.value.length)
const progress = computed(() => total.value > 0 ? Math.round((currentIndex.value / total.value) * 100) : 0)
const deck = computed(() => store.getDeckById(deckId))

onMounted(async () => {
  await store.loadAll()
  if (mode === 'weakest') {
    queue.value = store.getWeakestCards(deckId, 10)
  } else {
    queue.value = store.getDueCards(deckId)
  }
  if (queue.value.length === 0) {
    finished.value = true
  }
})

// 键盘快捷键
function onKeydown(e: KeyboardEvent) {
  if (finished.value || celebrating.value) return
  if (e.code === 'Space' && !revealed.value) {
    e.preventDefault()
    revealed.value = true
  } else if (revealed.value) {
    const map: Record<string, FlashcardRating> = {
      'Digit1': 'forgot', 'Digit2': 'hesitated',
      'Digit3': 'correct', 'Digit4': 'instant',
    }
    if (map[e.code]) {
      handleRating(map[e.code])
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

function reveal() {
  revealed.value = true
}

async function handleRating(rating: FlashcardRating) {
  const card = currentCard.value
  if (!card) return

  sessionRatings.value.push(rating)

  // 更新 FSRS
  await store.recordRating(card.id, rating)

  // 正确/秒答 → 庆祝
  if (rating === 'correct' || rating === 'instant') {
    streak.value++
    celebrateRating.value = rating
    celebrating.value = true
    // 触觉反馈
    if (navigator.vibrate) navigator.vibrate(50)
    setTimeout(() => {
      celebrating.value = false
      advance()
    }, 1200)
  } else {
    streak.value = 0
    // 轻微震动
    if (navigator.vibrate) navigator.vibrate([30, 50, 30])
    advance()
  }
}

function advance() {
  if (currentIndex.value >= total.value - 1) {
    finishSession()
  } else {
    currentIndex.value++
    revealed.value = false
  }
}

async function finishSession() {
  finished.value = true
  const duration = Math.round((Date.now() - sessionStart.value) / 1000)
  const correctCount = sessionRatings.value.filter(r => r === 'correct' || r === 'instant').length
  await store.recordSession(deckId, total.value, correctCount, duration, sessionRatings.value)
}

function restart() {
  currentIndex.value = 0
  revealed.value = false
  celebrating.value = false
  finished.value = false
  sessionRatings.value = []
  sessionStart.value = Date.now()
  streak.value = 0
  // 重新洗牌
  if (mode === 'weakest') {
    queue.value = store.getWeakestCards(deckId, 10)
  } else {
    queue.value = store.getDueCards(deckId)
  }
}

function goBack() {
  router.push(`/flashcards/${deckId}`)
}

const sessionCorrect = computed(() =>
  sessionRatings.value.filter(r => r === 'correct' || r === 'instant').length
)
const sessionAccuracy = computed(() =>
  sessionRatings.value.length > 0
    ? Math.round((sessionCorrect.value / sessionRatings.value.length) * 100)
    : 0
)
const sessionDuration = computed(() => {
  const sec = Math.round((Date.now() - sessionStart.value) / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}分${s}秒` : `${s}秒`
})
</script>

<template>
  <div class="practice-view">
    <!-- Header -->
    <div class="view-header">
      <button class="back-btn" @click="goBack">✕ 退出</button>
      <span class="header-progress" v-if="!finished">
        {{ currentIndex + 1 }} / {{ total }}
      </span>
      <span class="header-done" v-else>完成!</span>
      <button class="action-btn" v-if="!finished && currentIndex > 0" @click="restart">↻ 重来</button>
    </div>

    <!-- 进度条 -->
    <div class="progress-bar-wrap" v-if="!finished">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }" />
      </div>
    </div>

    <div class="practice-content" v-if="!finished && currentCard">
      <!-- 卡牌 -->
      <div class="flashcard" :class="{ revealed }">
        <div class="flashcard-inner">
          <!-- 正面 -->
          <div class="flashcard-front">
            <div class="card-label">Q</div>
            <div class="card-text">{{ currentCard.front }}</div>
            <div class="card-meta">
              已复习 {{ currentCard.reviewCount }} 次
            </div>
          </div>
          <!-- 背面 -->
          <div class="flashcard-back">
            <div class="card-label card-label-a">A</div>
            <div class="card-text">{{ currentCard.back }}</div>
          </div>
        </div>
      </div>

      <!-- 翻牌按钮 -->
      <button
        v-if="!revealed"
        class="ios-btn ios-btn-lg reveal-btn"
        @click="reveal"
      >
        👁 显示答案
      </button>
      <span class="reveal-hint" v-if="!revealed">
        先想一想,准备好了再点按钮
      </span>

      <!-- 评分按钮 -->
      <div v-if="revealed" class="rating-section">
        <div class="rating-title">刚才的回答怎么样?</div>
        <div class="rating-buttons">
          <button
            v-for="(label, key) in RATING_LABELS"
            :key="key"
            class="rating-btn"
            :class="'rating-' + key"
            @click="handleRating(key as FlashcardRating)"
          >
            <span class="rating-emoji">{{ RATING_EMOJIS[key as FlashcardRating] }}</span>
            <span class="rating-text">{{ label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 完成页 -->
    <div class="finish-section" v-if="finished">
      <div class="finish-icon">🎉</div>
      <div class="finish-title">练习完成!</div>

      <div class="finish-stats">
        <div class="finish-stat">
          <span class="finish-num">{{ total }}</span>
          <span class="finish-label">总卡牌</span>
        </div>
        <div class="finish-stat">
          <span class="finish-num" style="color: #34C759">{{ sessionCorrect }}</span>
          <span class="finish-label">正确</span>
        </div>
        <div class="finish-stat">
          <span class="finish-num" style="color: #5AC8FA">{{ sessionAccuracy }}%</span>
          <span class="finish-label">正确率</span>
        </div>
        <div class="finish-stat">
          <span class="finish-num">{{ sessionDuration }}</span>
          <span class="finish-label">用时</span>
        </div>
      </div>

      <div class="finish-actions">
        <button class="ios-btn ios-btn-block" @click="restart">↻ 再来一轮</button>
        <button class="ios-btn ios-btn-secondary ios-btn-block" @click="goBack">返回牌组</button>
      </div>
    </div>

    <!-- 庆祝动画 -->
    <CelebrationOverlay
      :show="celebrating"
      :rating="celebrateRating"
      :streak="streak"
    />
  </div>
</template>

<style scoped lang="scss">
.practice-view {
  min-height: 100vh;
  background: var(--bg-primary, #f2f2f7);
}
.view-header {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  background: var(--material-regular, rgba(249,249,249,0.94));
  backdrop-filter: var(--backdrop-blur, blur(20px));
  border-bottom: 0.5px solid var(--separator-color, #e5e5e5);
}
.back-btn {
  background: none; border: none; cursor: pointer;
  font-size: 15px; color: #FF3B30; font-weight: 500;
}
.header-progress {
  font-size: 15px; font-weight: 600;
  color: var(--text-secondary, #8e8e93);
}
.header-done {
  font-size: 15px; font-weight: 700;
  color: #34C759;
}
.action-btn {
  background: none; border: none; cursor: pointer;
  font-size: 16px; color: var(--accent-color, #007AFF);
}

/* 进度条 */
.progress-bar-wrap { padding: 8px 16px 0; }
.progress-bar {
  height: 4px; background: var(--separator-color, #e5e5e5);
  border-radius: 2px; overflow: hidden;
}
.progress-fill {
  height: 100%; background: var(--accent-color, #007AFF);
  border-radius: 2px;
  transition: width 0.4s ease;
}

.practice-content {
  max-width: 500px; margin: 0 auto; padding: 20px 16px;
}

/* 卡牌 */
.flashcard {
  perspective: 800px;
  margin-bottom: 24px;
}
.flashcard-inner {
  position: relative;
  min-height: 200px;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}
.flashcard.revealed .flashcard-inner {
  transform: rotateY(180deg);
}
.flashcard-front, .flashcard-back {
  position: absolute; inset: 0;
  backface-visibility: hidden;
  border-radius: 16px;
  padding: 24px 20px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
}
.flashcard-front {
  background: var(--card-bg, #fff);
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.flashcard-back {
  background: var(--card-bg, #fff);
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  transform: rotateY(180deg);
}
.card-label {
  font-size: 14px; font-weight: 700;
  color: var(--accent-color, #007AFF);
  margin-bottom: 12px;
  width: 32px; height: 32px;
  border-radius: 8px;
  background: var(--accent-color, #007AFF) + '15';
  display: flex; align-items: center; justify-content: center;
}
.card-label-a {
  color: #34C759;
  background: #34C75915;
}
.card-text {
  font-size: 18px; line-height: 1.6;
  color: var(--text-primary, #1c1c1e);
  word-break: break-word;
}
.card-meta {
  font-size: 12px; color: var(--text-secondary, #8e8e93);
  margin-top: 12px;
}

/* 翻牌按钮 */
.reveal-btn {
  width: 100%;
}
.reveal-hint {
  display: block; text-align: center;
  font-size: 13px; color: var(--text-secondary, #8e8e93);
  margin-top: 8px;
}

/* 评分 */
.rating-section { margin-top: 8px; }
.rating-title {
  font-size: 15px; font-weight: 600;
  text-align: center; margin-bottom: 14px;
  color: var(--text-primary, #1c1c1e);
}
.rating-buttons {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
}
.rating-btn {
  display: flex; flex-direction: column;
  align-items: center; gap: 4px;
  padding: 12px 4px;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
  &:active { transform: scale(0.95); }
}
.rating-emoji { font-size: 24px; }
.rating-text { font-size: 13px; font-weight: 600; }

.rating-forgot {
  background: #FF3B3015; color: #FF3B30;
  &:active { border-color: #FF3B30; }
}
.rating-hesitated {
  background: #FF950015; color: #FF9500;
  &:active { border-color: #FF9500; }
}
.rating-correct {
  background: #34C75915; color: #34C759;
  &:active { border-color: #34C759; }
}
.rating-instant {
  background: #5AC8FA15; color: #5AC8FA;
  &:active { border-color: #5AC8FA; }
}

/* 完成页 */
.finish-section {
  max-width: 400px; margin: 0 auto;
  padding: 60px 16px; text-align: center;
}
.finish-icon { font-size: 64px; margin-bottom: 12px; }
.finish-title {
  font-size: 24px; font-weight: 700;
  color: var(--text-primary, #1c1c1e);
  margin-bottom: 24px;
}
.finish-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  margin-bottom: 32px;
}
.finish-stat {
  background: var(--card-bg, #fff);
  border-radius: 12px; padding: 14px 4px;
}
.finish-num {
  display: block; font-size: 20px; font-weight: 700;
  color: var(--text-primary, #1c1c1e);
}
.finish-label {
  font-size: 11px; color: var(--text-secondary, #8e8e93);
  margin-top: 2px;
}
.finish-actions {
  display: flex; flex-direction: column; gap: 10px;
}
</style>
