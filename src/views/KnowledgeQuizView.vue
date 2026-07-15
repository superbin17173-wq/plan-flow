<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { KnowledgePoint, KnowledgeMastery } from '../types'

const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()

const fileId = computed(() => route.params.fileId as string)
const file = computed(() => store.getFileById(fileId.value))
const points = computed(() => store.getPointsByFile(fileId.value))

const currentIndex = ref(0)
const showAnswer = ref(false)
const finished = ref(false)

const currentPoint = computed<KnowledgePoint | null>(() => {
  if (finished.value) return null
  return points.value[currentIndex.value] || null
})

const progress = computed(() => ({
  current: Math.min(currentIndex.value + 1, points.value.length),
  total: points.value.length,
  percent: points.value.length
    ? Math.round((currentIndex.value / points.value.length) * 100)
    : 0,
}))

onMounted(async () => {
  await store.loadAll()
  if (!file.value || !points.value.length) {
    router.replace('/knowledge')
  }
})

function toggleAnswer() {
  showAnswer.value = !showAnswer.value
}

async function assess(level: KnowledgeMastery) {
  if (!currentPoint.value) return
  await store.recordReview(currentPoint.value.id, level)
  advance()
}

function advance() {
  showAnswer.value = false
  if (currentIndex.value + 1 >= points.value.length) {
    finished.value = true
  } else {
    currentIndex.value++
  }
}

function restart() {
  currentIndex.value = 0
  showAnswer.value = false
  finished.value = false
}

function goFile() {
  router.push(`/knowledge/${fileId.value}`)
}

function goHome() {
  router.push('/knowledge')
}
</script>

<template>
  <div class="quiz-view">
    <header class="qz-header">
      <button class="back-btn" @click="goFile">‹ 返回</button>
      <h1>{{ file?.title || '知识问答' }}</h1>
      <button class="header-btn" @click="restart">↻ 重头</button>
    </header>

    <main v-if="file" class="qz-main">
      <!-- 进度条 -->
      <div class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress.percent + '%' }"></div>
        </div>
        <div class="progress-label">{{ progress.current }} / {{ progress.total }}</div>
      </div>

      <!-- 已结束 -->
      <section v-if="finished" class="finish-card">
        <div class="finish-emoji">🎉</div>
        <h2>本轮问答结束</h2>
        <p class="finish-sub">共 {{ progress.total }} 条知识点,全部过了一遍</p>
        <div class="finish-actions">
          <button class="primary-btn" @click="restart">再来一轮</button>
          <button class="secondary-btn" @click="goFile">回文件</button>
          <button class="secondary-btn" @click="goHome">回列表</button>
        </div>
      </section>

      <!-- 进行中 -->
      <section v-else-if="currentPoint" class="quiz-card" :key="currentPoint.id">
        <div class="question-block">
          <div class="q-label">Question {{ currentIndex + 1 }}</div>
          <h2 class="q-text">{{ currentPoint.question }}</h2>
        </div>

        <div v-if="!showAnswer" class="reveal-wrap">
          <p class="reveal-hint">先想一想,准备好了再点按钮</p>
          <button class="reveal-btn" @click="toggleAnswer">显示答案</button>
        </div>

        <div v-else class="answer-block">
          <div class="a-label">Answer</div>
          <pre class="a-text">{{ currentPoint.answer }}</pre>

          <div class="assess-section">
            <p class="assess-hint">刚才的回答怎么样?</p>
            <div class="assess-row">
              <button class="assess-btn forgot" @click="assess('unseen')">
                <span class="a-icon">😵</span>
                <span class="a-text">没记住</span>
              </button>
              <button class="assess-btn fuzzy" @click="assess('learning')">
                <span class="a-icon">🤔</span>
                <span class="a-text">模糊</span>
              </button>
              <button class="assess-btn solid" @click="assess('mastered')">
                <span class="a-icon">😎</span>
                <span class="a-text">记住了</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped lang="scss">
.quiz-view {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: calc(24px + var(--safe-bottom, 0px));
}
.qz-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px calc(10px + var(--safe-top, 0px));
  padding-top: calc(10px + var(--safe-top, 0px));
  background: var(--material-regular);
  backdrop-filter: var(--backdrop-blur);
  border-bottom: 0.5px solid var(--separator);
  h1 {
    flex: 1;
    text-align: center;
    font-size: var(--font-size-headline);
    font-weight: 700;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.back-btn, .header-btn {
  background: transparent;
  border: none;
  color: var(--ios-blue);
  font-size: 15px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  &:hover { background: var(--bg-hover); }
}

.qz-main {
  max-width: 640px;
  margin: 0 auto;
  padding: 16px;
}

.progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-fill-quaternary, rgba(120,120,128,0.12));
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--ios-blue), #4b8bf5);
  transition: width 0.3s;
}
.progress-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  min-width: 50px;
  text-align: right;
}

.quiz-card {
  background: var(--bg-card);
  border-radius: var(--radius-xxl, 20px);
  padding: 22px 20px;
  box-shadow: var(--shadow-md, 0 2px 8px rgba(0,0,0,0.08));
  border: 0.5px solid var(--separator);
}

.question-block { margin-bottom: 20px; }
.q-label {
  font-size: 12px;
  color: var(--ios-blue);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.q-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.4;
  letter-spacing: -0.01em;
}

.reveal-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 0;
}
.reveal-hint {
  font-size: 14px;
  color: var(--text-secondary);
}
.reveal-btn {
  background: var(--ios-blue);
  color: #fff;
  border: none;
  padding: 12px 32px;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,122,255,0.28);
  transition: transform 0.1s, box-shadow 0.15s;
  &:hover { filter: brightness(1.05); }
  &:active { transform: scale(0.96); }
}

.answer-block {
  border-top: 0.5px dashed var(--separator);
  padding-top: 18px;
}
.a-label {
  font-size: 12px;
  color: #7BC47F;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.a-text {
  font-size: 15px;
  color: var(--text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
  padding: 14px;
  background: var(--bg-fill-quaternary, rgba(120,120,128,0.06));
  border-radius: 12px;
  margin-bottom: 20px;
  font-family: inherit;
}

.assess-section {
  border-top: 0.5px dashed var(--separator);
  padding-top: 18px;
}
.assess-hint {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 12px;
}
.assess-row {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.assess-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 10px;
  border-radius: 14px;
  border: 0.5px solid var(--separator);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: transform 0.1s, border-color 0.15s, background 0.15s;
  .a-icon { font-size: 22px; }
  .a-text { font-size: 13px; font-weight: 600; }
  &:hover { background: var(--bg-hover); }
  &:active { transform: scale(0.96); }

  &.forgot:hover {
    border-color: #ff3b30;
    background: rgba(255,59,48,0.06);
  }
  &.fuzzy:hover {
    border-color: #F5A962;
    background: rgba(245,169,98,0.06);
  }
  &.solid:hover {
    border-color: #7BC47F;
    background: rgba(123,196,127,0.08);
  }
}

.finish-card {
  background: var(--bg-card);
  border-radius: var(--radius-xxl, 20px);
  padding: 32px 20px;
  box-shadow: var(--shadow-md, 0 2px 8px rgba(0,0,0,0.08));
  border: 0.5px solid var(--separator);
  text-align: center;
  .finish-emoji {
    font-size: 48px;
    margin-bottom: 12px;
  }
  h2 {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 6px;
  }
  .finish-sub {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 20px;
  }
}
.finish-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}
.primary-btn {
  background: var(--ios-blue);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,122,255,0.28);
  &:hover { filter: brightness(1.05); }
}
.secondary-btn {
  background: var(--bg-fill-quaternary);
  color: var(--text-primary);
  border: none;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: var(--bg-hover); }
}

@media (max-width: 640px) {
  .qz-header h1 { font-size: 15px; }
  .q-text { font-size: 18px; }
  .assess-btn .a-text { font-size: 12px; }
}
</style>
