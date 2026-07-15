<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCognitiveStore } from '../stores/cognitiveStore'
import type { DecisionEntry, ThinkingChallenge } from '../types'
import { analyzeDecision, generateFollowUpQuestions, identifyCognitiveBiases } from '../utils/cognitiveAI'
import dayjs from 'dayjs'

const router = useRouter()
const store = useCognitiveStore()

// 当前激活的模块
const activeModule = ref<'dashboard' | 'decision' | 'challenge' | 'bias'>('dashboard')

// ========== AI 相关 ==========
const aiLoading = ref(false)
const aiError = ref<string | null>(null)
const aiAnalysis = ref<string | null>(null)
const aiFollowUpQuestions = ref<string[]>([])
const showAIPanel = ref(false)

async function requestDecisionAnalysis(decision: DecisionEntry) {
  aiLoading.value = true
  aiError.value = null
  aiAnalysis.value = null
  showAIPanel.value = true

  try {
    aiAnalysis.value = await analyzeDecision(decision)
  } catch (error) {
    aiError.value = error instanceof Error ? error.message : '分析失败'
  } finally {
    aiLoading.value = false
  }
}

async function requestFollowUpQuestions(challenge: ThinkingChallenge, answer: string) {
  aiLoading.value = true
  aiError.value = null
  aiFollowUpQuestions.value = []

  try {
    aiFollowUpQuestions.value = await generateFollowUpQuestions(challenge, answer)
    showAIPanel.value = true
  } catch (error) {
    aiError.value = error instanceof Error ? error.message : '生成追问失败'
  } finally {
    aiLoading.value = false
  }
}

async function requestBiasIdentification(challenge: ThinkingChallenge) {
  aiLoading.value = true
  aiError.value = null
  aiAnalysis.value = null
  showAIPanel.value = true

  try {
    aiAnalysis.value = await identifyCognitiveBiases(challenge)
  } catch (error) {
    aiError.value = error instanceof Error ? error.message : '识别失败'
  } finally {
    aiLoading.value = false
  }
}

// ========== 决策日记 ==========
const showDecisionForm = ref(false)
const decisionDraft = ref({
  title: '',
  context: '',
  reasoning: '',
  expectedOutcome: '',
})
const reviewingDecision = ref<DecisionEntry | null>(null)
const reviewDraft = ref({
  actualOutcome: '',
  lessonLearned: '',
})

async function createDecision() {
  if (!decisionDraft.value.title.trim()) return
  await store.createDecision(decisionDraft.value)
  decisionDraft.value = { title: '', context: '', reasoning: '', expectedOutcome: '' }
  showDecisionForm.value = false
}

function startReview(decision: DecisionEntry) {
  reviewingDecision.value = decision
  reviewDraft.value = { actualOutcome: '', lessonLearned: '' }
}

async function submitReview() {
  if (!reviewingDecision.value) return
  await store.reviewDecision(reviewingDecision.value.id, reviewDraft.value)
  reviewingDecision.value = null
}

async function confirmDeleteDecision(decision: DecisionEntry) {
  if (!window.confirm(`删除决策「${decision.title}」？\n此操作不可撤销。`)) return
  await store.deleteDecision(decision.id)
}

// ========== 思维挑战 ==========
const showChallengeForm = ref(false)
const challengeStep = ref(0)
const challengeDraft = ref({
  topic: '',
  initialBelief: '',
  answers: [] as { questionId: string; question: string; answer: string }[],
  insight: '',
})

// 结构化的追问问题库
const challengeQuestions = [
  { id: 'q1', question: '你确定这个想法是对的吗？有什么证据支持它？', category: 'evidence' },
  { id: 'q2', question: '如果相反的观点是对的，会怎样？', category: 'opposite' },
  { id: 'q3', question: '这个想法的前提假设是什么？这个假设一定成立吗？', category: 'assumption' },
  { id: 'q4', question: '如果朋友有这个想法，你会怎么反驳他？', category: 'friend' },
  { id: 'q5', question: '五年后回看，这个想法还重要吗？', category: 'time' },
  { id: 'q6', question: '最坏的情况是什么？你能承受吗？', category: 'worst-case' },
  { id: 'q7', question: '有没有第三种可能性，既不是你原来想的，也不是相反的？', category: 'third-way' },
  { id: 'q8', question: '你的情绪（恐惧/焦虑/兴奋）在多大程度上影响了这个想法？', category: 'emotion' },
]

function startChallenge() {
  challengeDraft.value = {
    topic: '',
    initialBelief: '',
    answers: challengeQuestions.map(q => ({
      questionId: q.id,
      question: q.question,
      answer: '',
    })),
    insight: '',
  }
  challengeStep.value = 0
  showChallengeForm.value = true
}

function nextStep() {
  if (challengeStep.value < challengeQuestions.length + 1) {
    challengeStep.value++
  }
}

function prevStep() {
  if (challengeStep.value > 0) {
    challengeStep.value--
  }
}

async function submitChallenge() {
  if (!challengeDraft.value.topic.trim()) return
  await store.createChallenge({
    topic: challengeDraft.value.topic,
    initialBelief: challengeDraft.value.initialBelief,
    answers: challengeDraft.value.answers,
    insight: challengeDraft.value.insight,
  })
  showChallengeForm.value = false
  challengeStep.value = 0
}

async function confirmDeleteChallenge(challenge: ThinkingChallenge) {
  if (!window.confirm(`删除思维挑战「${challenge.topic}」？\n此操作不可撤销。`)) return
  await store.deleteChallenge(challenge.id)
}

// ========== 认知偏差 ==========
const cognitiveBiases = [
  { key: 'confirmation-bias', name: '确认偏差', description: '只关注支持自己观点的信息，忽略反面证据' },
  { key: 'sunk-cost', name: '沉没成本谬误', description: '因为已经投入了时间/金钱，就继续坚持错误的选择' },
  { key: 'status-quo', name: '现状偏见', description: '倾向于保持现状，即使改变可能更好' },
  { key: 'anchoring', name: '锚定效应', description: '过度依赖最初获得的信息来做判断' },
  { key: 'availability', name: '可得性偏差', description: '越容易想到的事情，就越觉得它常见/重要' },
  { key: 'dunning-kruger', name: '达克效应', description: '能力不足的人往往高估自己，能力强的人反而低估自己' },
  { key: 'survivorship', name: '幸存者偏差', description: '只看到成功的案例，忽略了大量失败的案例' },
  { key: 'fundamental-attribution', name: '基本归因错误', description: '别人的失败归因于性格，自己的失败归因于环境' },
  { key: 'halo-effect', name: '光环效应', description: '因为某人某方面好，就认为他其他方面也好' },
  { key: 'bandwagon', name: '从众效应', description: '因为很多人这样做，就认为这是对的' },
]

const showBiasReflection = ref<{ key: string; name: string } | null>(null)
const biasReflection = ref('')
const biasRecognized = ref(false)

async function submitBiasCheck(recognized: boolean) {
  if (!showBiasReflection.value) return
  await store.recordBiasCheck(
    showBiasReflection.value.key,
    recognized,
    biasReflection.value || undefined
  )
  showBiasReflection.value = null
  biasReflection.value = ''
  biasRecognized.value = false
}

// ========== 格式化 ==========
function formatDate(timestamp: number): string {
  return dayjs(timestamp).format('YYYY-MM-DD')
}

function formatAIContent(text: string): string {
  // 简单的 markdown 格式化：换行转 <br>，加粗用 <strong>
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

onMounted(async () => {
  await store.loadAll()
})
</script>

<template>
  <div class="cognitive-view">
    <!-- 顶部导航 -->
    <header class="cv-header">
      <button class="back-btn" @click="router.push('/')">‹ 返回</button>
      <h1>🧠 认知训练</h1>
      <div class="header-spacer"></div>
    </header>

    <!-- 模块切换 -->
    <nav class="module-nav">
      <button
        :class="['nav-btn', { active: activeModule === 'dashboard' }]"
        @click="activeModule = 'dashboard'"
      >
        总览
      </button>
      <button
        :class="['nav-btn', { active: activeModule === 'decision' }]"
        @click="activeModule = 'decision'"
      >
        决策日记
      </button>
      <button
        :class="['nav-btn', { active: activeModule === 'challenge' }]"
        @click="activeModule = 'challenge'"
      >
        思维挑战
      </button>
      <button
        :class="['nav-btn', { active: activeModule === 'bias' }]"
        @click="activeModule = 'bias'"
      >
        偏差自检
      </button>
    </nav>

    <main class="cv-main">
      <!-- ========== 总览 ========== -->
      <section v-if="activeModule === 'dashboard'" class="dashboard-section">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ store.stats.totalDecisions }}</div>
            <div class="stat-label">决策记录</div>
          </div>
          <div class="stat-card highlight">
            <div class="stat-value">{{ store.stats.pendingReviews }}</div>
            <div class="stat-label">待复盘</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ store.stats.totalChallenges }}</div>
            <div class="stat-label">思维挑战</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ store.stats.recentActivity }}</div>
            <div class="stat-label">近7天活动</div>
          </div>
        </div>

        <div class="module-cards">
          <div class="module-card" @click="activeModule = 'decision'">
            <div class="mc-icon">📝</div>
            <div class="mc-content">
              <h3>决策日记</h3>
              <p>记录你的决策和推理过程，事后复盘结果</p>
            </div>
            <div class="mc-arrow">›</div>
          </div>

          <div class="module-card" @click="activeModule = 'challenge'">
            <div class="mc-icon">💡</div>
            <div class="mc-content">
              <h3>思维挑战</h3>
              <p>结构化追问，暴露你的思维盲区和逻辑漏洞</p>
            </div>
            <div class="mc-arrow">›</div>
          </div>

          <div class="module-card" @click="activeModule = 'bias'">
            <div class="mc-icon">🔍</div>
            <div class="mc-content">
              <h3>认知偏差自检</h3>
              <p>识别常见的认知偏差，觉察自己的思维陷阱</p>
            </div>
            <div class="mc-arrow">›</div>
          </div>
        </div>

        <div class="intro-card">
          <h3>为什么要做认知训练？</h3>
          <p>
            认知升级的核心不是"学更多知识"，而是<strong>让自己的思维被挑战</strong>。
            这三个模块帮你做到三件事：
          </p>
          <ul>
            <li><strong>决策日记</strong>：追踪你的判断质量，从结果中学习</li>
            <li><strong>思维挑战</strong>：主动质疑自己的想法，打破思维惯性</li>
            <li><strong>偏差自检</strong>：识别常见的认知陷阱，减少重复犯错</li>
          </ul>
        </div>
      </section>

      <!-- ========== 决策日记 ========== -->
      <section v-if="activeModule === 'decision'" class="decision-section">
        <div class="section-header">
          <h2>决策日记</h2>
          <button class="primary-btn" @click="showDecisionForm = !showDecisionForm">
            {{ showDecisionForm ? '取消' : '+ 新决策' }}
          </button>
        </div>

        <!-- 新建决策表单 -->
        <div v-if="showDecisionForm" class="form-card">
          <h3>记录一个新决策</h3>
          <div class="form-group">
            <label>决策标题</label>
            <input
              v-model="decisionDraft.title"
              type="text"
              class="form-input"
              placeholder="如：选择 XX 公司的工作"
            />
          </div>
          <div class="form-group">
            <label>背景情况</label>
            <textarea
              v-model="decisionDraft.context"
              class="form-textarea"
              rows="3"
              placeholder="当时面临什么情况？有哪些选项？"
            ></textarea>
          </div>
          <div class="form-group">
            <label>我的推理</label>
            <textarea
              v-model="decisionDraft.reasoning"
              class="form-textarea"
              rows="4"
              placeholder="为什么这么选？理由是什么？"
            ></textarea>
          </div>
          <div class="form-group">
            <label>预期结果</label>
            <textarea
              v-model="decisionDraft.expectedOutcome"
              class="form-textarea"
              rows="2"
              placeholder="你认为会怎样？"
            ></textarea>
          </div>
          <div class="form-actions">
            <button class="btn-secondary" @click="showDecisionForm = false">取消</button>
            <button class="btn-primary" @click="createDecision">保存</button>
          </div>
        </div>

        <!-- 决策列表 -->
        <div class="decision-list">
          <article v-for="d in store.decisions" :key="d.id" class="decision-card">
            <header class="dc-header">
              <div class="dc-title-wrap">
                <h3>{{ d.title }}</h3>
                <div class="dc-meta">
                  <span :class="['status-badge', d.status]">
                    {{ d.status === 'pending' ? '待复盘' : '已复盘' }}
                  </span>
                  <span class="dc-date">{{ formatDate(d.createdAt) }}</span>
                </div>
              </div>
              <button class="ghost-btn" @click="confirmDeleteDecision(d)" title="删除">🗑</button>
            </header>

            <div class="dc-content">
              <div class="dc-block">
                <strong>背景：</strong>{{ d.context }}
              </div>
              <div class="dc-block">
                <strong>推理：</strong>{{ d.reasoning }}
              </div>
              <div class="dc-block">
                <strong>预期：</strong>{{ d.expectedOutcome }}
              </div>

              <template v-if="d.status === 'reviewed' && d.actualOutcome">
                <div class="dc-block reviewed">
                  <strong>实际结果：</strong>{{ d.actualOutcome }}
                </div>
                <div v-if="d.lessonLearned" class="dc-block reviewed">
                  <strong>学到什么：</strong>{{ d.lessonLearned }}
                </div>
              </template>

              <div v-else class="dc-actions">
                <button class="btn-secondary" @click="startReview(d)">复盘</button>
                <button class="ai-btn" @click="requestDecisionAnalysis(d)">🤖 AI 分析</button>
              </div>
            </div>
          </article>

          <div v-if="store.decisions.length === 0 && !showDecisionForm" class="empty-state">
            <p>还没有决策记录。</p>
            <p class="hint">记录你的重要决策，事后复盘结果，提升判断力。</p>
          </div>
        </div>

        <!-- 复盘弹窗 -->
        <Teleport to="body">
          <div v-if="reviewingDecision" class="modal-overlay" @click.self="reviewingDecision = null">
            <div class="modal-content">
              <div class="modal-header">
                <h2>复盘决策：{{ reviewingDecision.title }}</h2>
                <button class="close-btn" @click="reviewingDecision = null">×</button>
              </div>
              <div class="modal-body">
                <div class="review-summary">
                  <p><strong>背景：</strong>{{ reviewingDecision.context }}</p>
                  <p><strong>推理：</strong>{{ reviewingDecision.reasoning }}</p>
                  <p><strong>预期：</strong>{{ reviewingDecision.expectedOutcome }}</p>
                </div>
                <div class="form-group">
                  <label>实际结果是什么？</label>
                  <textarea
                    v-model="reviewDraft.actualOutcome"
                    class="form-textarea"
                    rows="3"
                    placeholder="后来实际发生了什么？"
                  ></textarea>
                </div>
                <div class="form-group">
                  <label>从中学到了什么？</label>
                  <textarea
                    v-model="reviewDraft.lessonLearned"
                    class="form-textarea"
                    rows="3"
                    placeholder="如果重来，你会怎么做？"
                  ></textarea>
                </div>
                <div class="modal-footer">
                  <button class="btn-secondary" @click="reviewingDecision = null">取消</button>
                  <button class="btn-primary" @click="submitReview">保存复盘</button>
                </div>
              </div>
            </div>
          </div>
        </Teleport>
      </section>

      <!-- ========== 思维挑战 ========== -->
      <section v-if="activeModule === 'challenge'" class="challenge-section">
        <div class="section-header">
          <h2>思维挑战</h2>
          <button class="primary-btn" @click="showChallengeForm ? (showChallengeForm = false) : startChallenge()">
            {{ showChallengeForm ? '取消' : '+ 新挑战' }}
          </button>
        </div>

        <!-- 挑战表单（分步） -->
        <div v-if="showChallengeForm" class="form-card challenge-form">
          <div class="step-indicator">
            步骤 {{ challengeStep + 1 }} / {{ challengeQuestions.length + 2 }}
          </div>

          <!-- Step 0: 主题 -->
          <div v-if="challengeStep === 0" class="step-content">
            <h3>你想挑战什么想法？</h3>
            <p class="hint">写下一个你正在纠结的想法、决定，或者你"确信"的观点。</p>
            <div class="form-group">
              <label>主题</label>
              <input
                v-model="challengeDraft.topic"
                type="text"
                class="form-input"
                placeholder="如：我该不该转行"
              />
            </div>
            <div class="form-group">
              <label>你最初的想法/信念</label>
              <textarea
                v-model="challengeDraft.initialBelief"
                class="form-textarea"
                rows="4"
                placeholder="详细描述你的想法..."
              ></textarea>
            </div>
          </div>

          <!-- Step 1-8: 追问 -->
          <div v-else-if="challengeStep <= challengeQuestions.length" class="step-content">
            <h3>{{ challengeQuestions[challengeStep - 1].question }}</h3>
            <textarea
              v-model="challengeDraft.answers[challengeStep - 1].answer"
              class="form-textarea large"
              rows="6"
              placeholder="认真思考，写下你的回答..."
            ></textarea>
          </div>

          <!-- Step 9: 洞察 -->
          <div v-else class="step-content">
            <h3>最终洞察</h3>
            <p class="hint">经过这一轮追问，你意识到了什么？你的想法有变化吗？</p>
            <textarea
              v-model="challengeDraft.insight"
              class="form-textarea large"
              rows="6"
              placeholder="写下你的洞察..."
            ></textarea>
          </div>

          <div class="step-actions">
            <button v-if="challengeStep > 0" class="btn-secondary" @click="prevStep">上一步</button>
            <div class="spacer"></div>
            <button v-if="challengeStep < challengeQuestions.length + 1" class="btn-primary" @click="nextStep">
              下一步
            </button>
            <button v-else class="btn-primary" @click="submitChallenge">
              完成
            </button>
          </div>
        </div>

        <!-- 挑战历史 -->
        <div class="challenge-list">
          <article v-for="c in store.challenges" :key="c.id" class="challenge-card">
            <header class="cc-header">
              <h3>{{ c.topic }}</h3>
              <div class="cc-meta">
                <span class="cc-date">{{ formatDate(c.createdAt) }}</span>
                <button class="ghost-btn" @click="confirmDeleteChallenge(c)" title="删除">🗑</button>
              </div>
            </header>
            <div class="cc-content">
              <div class="cc-block">
                <strong>最初想法：</strong>{{ c.initialBelief }}
              </div>
              <div v-if="c.insight" class="cc-block insight">
                <strong>洞察：</strong>{{ c.insight }}
              </div>
              <div class="cc-actions">
                <button class="ai-btn" @click="requestBiasIdentification(c)">🤖 AI 识别偏差</button>
              </div>
            </div>
          </article>

          <div v-if="store.challenges.length === 0 && !showChallengeForm" class="empty-state">
            <p>还没有思维挑战记录。</p>
            <p class="hint">挑战你"确信"的想法，暴露思维盲区。</p>
          </div>
        </div>
      </section>

      <!-- ========== 认知偏差 ========== -->
      <section v-if="activeModule === 'bias'" class="bias-section">
        <div class="section-header">
          <h2>认知偏差自检</h2>
        </div>

        <p class="intro-text">
          认知偏差是大脑的"思维捷径"，会导致系统性判断错误。
          定期自检，觉察自己是否正在陷入这些陷阱。
        </p>

        <div class="bias-list">
          <article v-for="b in cognitiveBiases" :key="b.key" class="bias-card">
            <div class="bc-content" @click="showBiasReflection = { key: b.key, name: b.name }">
              <h3>{{ b.name }}</h3>
              <p>{{ b.description }}</p>
            </div>
          </article>
        </div>

        <!-- 偏差自检弹窗 -->
        <Teleport to="body">
          <div v-if="showBiasReflection" class="modal-overlay" @click.self="showBiasReflection = null">
            <div class="modal-content">
              <div class="modal-header">
                <h2>{{ showBiasReflection.name }}</h2>
                <button class="close-btn" @click="showBiasReflection = null">×</button>
              </div>
              <div class="modal-body">
                <p class="bias-desc">
                  {{ cognitiveBiases.find(b => b.key === showBiasReflection?.key)?.description }}
                </p>
                <div class="form-group">
                  <label>你最近有陷入这个偏差吗？</label>
                  <div class="bias-choice">
                    <button
                      :class="['choice-btn', { selected: biasRecognized }]"
                      @click="biasRecognized = true"
                    >
                      是，我有
                    </button>
                    <button
                      :class="['choice-btn', { selected: !biasRecognized }]"
                      @click="biasRecognized = false"
                    >
                      没有/不确定
                    </button>
                  </div>
                </div>
                <div class="form-group">
                  <label>反思（可选）</label>
                  <textarea
                    v-model="biasReflection"
                    class="form-textarea"
                    rows="3"
                    placeholder="什么时候犯的？怎么察觉的？"
                  ></textarea>
                </div>
                <div class="modal-footer">
                  <button class="btn-secondary" @click="showBiasReflection = null">取消</button>
                  <button class="btn-primary" @click="submitBiasCheck(biasRecognized)">记录</button>
                </div>
              </div>
            </div>
          </div>
        </Teleport>
      </section>
    </main>

    <!-- AI 分析面板 -->
    <Teleport to="body">
      <div v-if="showAIPanel" class="modal-overlay" @click.self="showAIPanel = false">
        <div class="modal-content ai-panel">
          <div class="modal-header">
            <h2>🤖 AI 认知教练</h2>
            <button class="close-btn" @click="showAIPanel = false">×</button>
          </div>
          <div class="modal-body">
            <div v-if="aiLoading" class="ai-loading">
              <div class="loading-spinner"></div>
              <p>AI 正在分析...</p>
            </div>

            <div v-else-if="aiError" class="ai-error">
              <p>{{ aiError }}</p>
              <button class="btn-secondary" @click="showAIPanel = false">关闭</button>
            </div>

            <div v-else-if="aiAnalysis" class="ai-analysis">
              <div class="ai-content" v-html="formatAIContent(aiAnalysis)"></div>
              <div class="ai-footer">
                <button class="btn-secondary" @click="showAIPanel = false">关闭</button>
              </div>
            </div>

            <div v-else-if="aiFollowUpQuestions.length > 0" class="ai-questions">
              <h3>AI 生成的深入追问：</h3>
              <ul class="question-list">
                <li v-for="(q, i) in aiFollowUpQuestions" :key="i">{{ q }}</li>
              </ul>
              <div class="ai-footer">
                <button class="btn-secondary" @click="showAIPanel = false">关闭</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.cognitive-view {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: calc(24px + var(--safe-bottom, 0px));
}

.cv-header {
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
  -webkit-backdrop-filter: var(--backdrop-blur);
  border-bottom: 0.5px solid var(--separator);
  h1 {
    flex: 1;
    text-align: center;
    font-size: var(--font-size-headline);
    font-weight: 700;
    color: var(--text-primary);
  }
}

.header-spacer { width: 60px; }

.back-btn {
  background: transparent;
  border: none;
  color: var(--ios-blue);
  font-size: 17px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  &:hover { background: var(--bg-hover); }
}

.module-nav {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 0.5px solid var(--separator);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.nav-btn {
  flex: 1;
  min-width: fit-content;
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;

  &:hover { background: var(--bg-hover); }
  &.active {
    background: var(--ios-blue);
    color: #fff;
    font-weight: 600;
  }
}

.cv-main {
  max-width: 780px;
  margin: 0 auto;
  padding: 16px;
}

// ========== 总览 ==========
.dashboard-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 16px;
  text-align: center;
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-sm);

  &.highlight {
    background: linear-gradient(135deg, rgba(245, 169, 98, 0.1), rgba(245, 169, 98, 0.05));
    border-color: rgba(245, 169, 98, 0.3);
  }
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.module-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.module-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--bg-card);
  border-radius: 14px;
  padding: 16px;
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all 0.15s;

  &:hover { box-shadow: var(--shadow-md); }
  &:active { transform: scale(0.99); }
}

.mc-icon {
  font-size: 28px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-fill-quaternary);
  border-radius: 12px;
}

.mc-content {
  flex: 1;
  h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }
  p {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.4;
  }
}

.mc-arrow {
  font-size: 24px;
  color: var(--text-tertiary);
}

.intro-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 18px;
  border: 0.5px solid var(--separator);

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 10px;
  }
  p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 10px;
  }
  ul {
    margin: 0;
    padding-left: 20px;
    li {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.8;
    }
  }
}

// ========== 通用表单样式 ==========
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  h2 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
  }
}

.primary-btn {
  background: var(--ios-blue);
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 122, 255, 0.28);
  &:hover { filter: brightness(1.05); }
  &:active { transform: scale(0.97); }
}

.btn-primary {
  background: var(--ios-blue);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  &:hover { filter: brightness(1.05); }
}

.btn-secondary {
  background: var(--bg-fill-quaternary);
  border: none;
  padding: 10px 18px;
  border-radius: 10px;
  color: var(--text-primary);
  cursor: pointer;
}

.form-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 18px;
  border: 0.5px solid var(--separator);
  margin-bottom: 16px;

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 14px;
  }
}

.form-group {
  margin-bottom: 14px;

  label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 6px;
  }
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 0.5px solid var(--separator);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: 10px;
  font-size: 15px;
  font-family: inherit;
  &:focus {
    outline: none;
    border-color: var(--ios-blue);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
  }
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 0.5px solid var(--separator);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: 10px;
  font-size: 15px;
  font-family: inherit;
  resize: vertical;
  &:focus {
    outline: none;
    border-color: var(--ios-blue);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
  }
  &.large {
    min-height: 150px;
  }
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 10px;
}

.hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  line-height: 1.5;
}

// ========== 决策日记 ==========
.decision-list, .challenge-list, .bias-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.decision-card, .challenge-card, .bias-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 16px;
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-sm);
}

.dc-header, .cc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
  }
}

.dc-title-wrap, .cc-meta {
  flex: 1;
}

.dc-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 500;

  &.pending {
    background: rgba(245, 169, 98, 0.15);
    color: #F5A962;
  }
  &.reviewed {
    background: rgba(123, 196, 127, 0.15);
    color: #7BC47F;
  }
}

.dc-date, .cc-date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.dc-content, .cc-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dc-block, .cc-block {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;

  strong {
    color: var(--text-primary);
    font-weight: 500;
  }

  &.reviewed, &.insight {
    background: rgba(123, 196, 127, 0.08);
    padding: 10px 12px;
    border-radius: 8px;
    border-left: 3px solid #7BC47F;
  }
}

.dc-actions {
  margin-top: 8px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);

  p {
    margin-bottom: 8px;
    &:last-child { margin-bottom: 0; }
  }
  .hint {
    font-size: 13px;
    color: var(--text-tertiary);
  }
}

// ========== 思维挑战 ==========
.challenge-form {
  .step-indicator {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .step-content {
    margin-bottom: 20px;

    h3 {
      font-size: 17px;
      line-height: 1.5;
      margin-bottom: 14px;
    }
  }

  .step-actions {
    display: flex;
    align-items: center;
    gap: 10px;

    .spacer { flex: 1; }
  }
}

// ========== 认知偏差 ==========
.intro-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}

.bc-content {
  cursor: pointer;

  h3 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
  }
  p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
}

.bias-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg-fill-quaternary);
  border-radius: 8px;
}

.bias-choice {
  display: flex;
  gap: 10px;
}

.choice-btn {
  flex: 1;
  padding: 12px;
  border: 1.5px solid var(--separator);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { border-color: var(--ios-blue); }
  &.selected {
    border-color: var(--ios-blue);
    background: rgba(0, 122, 255, 0.08);
    color: var(--ios-blue);
    font-weight: 500;
  }
}

// ========== Modal ==========
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1200;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 500px;
  overflow: hidden;
  padding-bottom: var(--safe-bottom, 0px);
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px;
  background: var(--bg-card);
  border-bottom: 0.5px solid var(--separator);
  position: relative;

  h2 {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .close-btn {
    position: absolute;
    right: 12px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--bg-fill-quaternary);
    color: var(--text-secondary);
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
  }
}

.modal-body {
  padding: 18px 16px 22px;
}

.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 14px;
  margin-top: 14px;
  border-top: 0.5px solid var(--separator);
}

.review-summary {
  background: var(--bg-fill-quaternary);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;

  p {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 6px;
    &:last-child { margin-bottom: 0; }

    strong {
      color: var(--text-primary);
    }
  }
}

.ghost-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  &:hover { background: var(--bg-hover); }
}

@media (min-width: 640px) {
  .modal-overlay {
    align-items: center;
    padding: 16px;
  }
  .modal-content {
    border-radius: 20px;
  }
}

@media (max-width: 640px) {
  .module-nav {
    padding: 10px 12px;
    gap: 6px;
  }
  .nav-btn {
    padding: 7px 12px;
    font-size: 13px;
  }
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
}

// ========== AI 相关样式 ==========
.ai-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  &:active {
    transform: translateY(0);
  }
}

.dc-actions, .cc-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.ai-panel {
  max-width: 600px;
}

.ai-loading {
  text-align: center;
  padding: 40px 20px;

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--bg-fill-quaternary);
    border-top-color: var(--ios-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }

  p {
    color: var(--text-secondary);
    font-size: 14px;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ai-error {
  padding: 20px;
  text-align: center;

  p {
    color: #ff3b30;
    margin-bottom: 16px;
    font-size: 14px;
  }
}

.ai-analysis, .ai-questions {
  .ai-content {
    background: var(--bg-fill-quaternary);
    padding: 16px;
    border-radius: 10px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-primary);
    margin-bottom: 16px;
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 12px;
  }

  .question-list {
    list-style: none;
    padding: 0;
    margin: 0 0 16px;

    li {
      background: var(--bg-fill-quaternary);
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 8px;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-primary);
      border-left: 3px solid #667eea;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  .ai-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 12px;
    border-top: 0.5px solid var(--separator);
  }
}
</style>
