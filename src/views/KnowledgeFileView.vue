<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { KnowledgePoint } from '../types'

const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()

const fileId = computed(() => route.params.fileId as string)
const file = computed(() => store.getFileById(fileId.value))
const points = computed(() => store.getPointsByFile(fileId.value))
const stats = computed(() => store.getStatsByFile(fileId.value))

onMounted(async () => {
  await store.loadAll()
  if (!file.value) {
    router.replace('/knowledge')
  }
})

// 编辑/新增弹窗
const showEditDialog = ref(false)
const editingPoint = ref<KnowledgePoint | null>(null)
const editingQ = ref('')
const editingA = ref('')
const isNew = ref(false)

function openNewPoint() {
  isNew.value = true
  editingPoint.value = null
  editingQ.value = ''
  editingA.value = ''
  showEditDialog.value = true
}

function openEditPoint(p: KnowledgePoint) {
  isNew.value = false
  editingPoint.value = p
  editingQ.value = p.question
  editingA.value = p.answer
  showEditDialog.value = true
}

async function savePoint() {
  if (!editingQ.value.trim() || !editingA.value.trim()) return
  if (isNew.value) {
    // 复用 addPoints 接口传一条
    await store.addPoints(fileId.value, [{
      question: editingQ.value.trim(),
      answer: editingA.value.trim(),
    }])
  } else if (editingPoint.value) {
    await store.editPoint(editingPoint.value.id, {
      question: editingQ.value.trim(),
      answer: editingA.value.trim(),
    })
  }
  showEditDialog.value = false
  editingPoint.value = null
}

async function onConfirmDelete(p: KnowledgePoint) {
  const ok = window.confirm(`删除知识点「${p.question}」?此操作不可撤销。`)
  if (!ok) return
  await store.deletePoint(p.id)
}

function goQuiz() {
  router.push(`/knowledge-quiz/${fileId.value}`)
}

function masteryClass(m: string) {
  return {
    unseen: 'm-unseen',
    learning: 'm-learning',
    mastered: 'm-mastered',
  }[m] || ''
}

function masteryLabel(m: string) {
  return {
    unseen: '未见',
    learning: '学习中',
    mastered: '已掌握',
  }[m] || m
}
</script>

<template>
  <div class="knowledge-file-view">
    <header class="kf-header">
      <button class="back-btn" @click="router.push('/knowledge')">‹ 返回</button>
      <h1>{{ file?.title || '加载中…' }}</h1>
      <button class="primary-btn" @click="goQuiz" :disabled="!points.length">🎯 开始问答</button>
    </header>

    <main v-if="file" class="kf-main">
      <section class="stats-row">
        <div class="stat-chip">共 {{ stats.total }}</div>
        <div class="stat-chip unseen">未见 {{ stats.unseen }}</div>
        <div class="stat-chip learning">学习中 {{ stats.learning }}</div>
        <div class="stat-chip mastered">已掌握 {{ stats.mastered }}</div>
        <button class="add-btn" @click="openNewPoint">+ 新增知识点</button>
      </section>

      <div v-if="!points.length" class="empty-inline">
        这个文件还没有知识点。点上方「+ 新增知识点」手工加,或者回到文件列表重新上传触发抽取。
      </div>

      <div class="points-list">
        <article
          v-for="(p, idx) in points"
          :key="p.id"
          class="point-card"
        >
          <header class="pc-head">
            <span class="pc-idx">Q{{ idx + 1 }}</span>
            <h3>{{ p.question }}</h3>
            <span class="mastery-tag" :class="masteryClass(p.mastery)">{{ masteryLabel(p.mastery) }}</span>
          </header>
          <div class="pc-answer">{{ p.answer }}</div>
          <div class="pc-meta" v-if="p.lastReviewDate || p.reviewCount">
            复习 {{ p.reviewCount }} 次
            <template v-if="p.lastReviewDate"> · 最近 {{ p.lastReviewDate }}</template>
          </div>
          <div class="pc-actions">
            <button class="mini-btn" @click="openEditPoint(p)">编辑</button>
            <button class="mini-btn danger" @click="onConfirmDelete(p)">删除</button>
          </div>
        </article>
      </div>
    </main>

    <!-- 编辑/新增弹窗 -->
    <Teleport to="body">
      <div v-if="showEditDialog" class="modal-overlay" @click.self="showEditDialog = false">
        <div class="modal-content small">
          <div class="modal-header">
            <h2>{{ isNew ? '新增知识点' : '编辑知识点' }}</h2>
            <button class="close-btn" @click="showEditDialog = false">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">问题</label>
              <input
                v-model="editingQ"
                type="text"
                class="form-input"
                maxlength="100"
                placeholder="问什么?"
                autofocus
              />
            </div>
            <div class="form-group">
              <label class="form-label">答案</label>
              <textarea
                v-model="editingA"
                class="form-input textarea"
                rows="5"
                maxlength="2000"
                placeholder="答什么?"
              />
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" @click="showEditDialog = false">取消</button>
              <button
                class="btn-primary"
                :disabled="!editingQ.trim() || !editingA.trim()"
                @click="savePoint"
              >保存</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.knowledge-file-view {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: calc(24px + var(--safe-bottom, 0px));
}
.kf-header {
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
.primary-btn {
  background: var(--ios-blue);
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,122,255,0.28);
  &:hover:not(:disabled) { filter: brightness(1.05); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.kf-main {
  max-width: 780px;
  margin: 0 auto;
  padding: 16px;
}

.stats-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 16px;
}
.stat-chip {
  padding: 5px 11px;
  border-radius: 999px;
  background: var(--bg-card);
  border: 0.5px solid var(--separator);
  font-size: 12px;
  color: var(--text-primary);
  &.unseen { color: var(--text-secondary); }
  &.learning { color: #F5A962; border-color: rgba(245,169,98,0.3); }
  &.mastered { color: #7BC47F; border-color: rgba(123,196,127,0.3); }
}
.add-btn {
  margin-left: auto;
  background: transparent;
  border: 0.5px solid var(--ios-blue);
  color: var(--ios-blue);
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  &:hover { background: rgba(0,122,255,0.08); }
}

.empty-inline {
  text-align: center;
  color: var(--text-secondary);
  padding: 40px 20px;
  font-size: 14px;
}

.points-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.point-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg, 14px);
  padding: 14px 16px;
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06));
}
.pc-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
  h3 {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.4;
  }
}
.pc-idx {
  color: var(--ios-blue);
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.mastery-tag {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  &.m-unseen { background: var(--bg-fill-quaternary); color: var(--text-secondary); }
  &.m-learning { background: rgba(245,169,98,0.15); color: #F5A962; }
  &.m-mastered { background: rgba(123,196,127,0.18); color: #4ea85a; }
}
.pc-answer {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  padding: 8px 10px;
  background: var(--bg-fill-quaternary, rgba(120,120,128,0.06));
  border-radius: 8px;
  margin-bottom: 8px;
}
.pc-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.pc-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
.mini-btn {
  background: transparent;
  border: 0.5px solid var(--separator);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  &:hover { background: var(--bg-hover); }
  &.danger { color: #ff3b30; border-color: rgba(255,59,48,0.3); }
}

// modal 复用
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1200;
}
.modal-content {
  background: var(--bg-primary);
  border-radius: var(--radius-xxl, 20px) var(--radius-xxl, 20px) 0 0;
  width: 100%;
  max-width: 520px;
  overflow: hidden;
  padding-bottom: var(--safe-bottom, 0px);
  box-shadow: var(--shadow-xl);
  &.small { max-width: 480px; }
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px;
  background: var(--bg-card);
  border-bottom: 0.5px solid var(--separator);
  position: relative;
  h2 { font-size: 17px; font-weight: 700; color: var(--text-primary); }
  .close-btn {
    position: absolute;
    right: 12px;
    width: 30px; height: 30px;
    border-radius: 50%;
    background: var(--bg-fill-quaternary);
    color: var(--text-secondary);
    font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    border: none; cursor: pointer;
  }
}
.modal-body { padding: 18px 16px 22px; }
.form-group { margin-bottom: 16px; }
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 0.5px solid var(--separator);
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 10px;
  font-size: 15px;
  font-family: inherit;
  &.textarea { resize: vertical; min-height: 80px; }
  &:focus {
    outline: none;
    border-color: var(--ios-blue);
    box-shadow: 0 0 0 3px rgba(0,122,255,0.15);
  }
}
.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 14px;
  margin-top: 14px;
  border-top: 0.5px solid var(--separator);
}
.btn-primary {
  background: var(--ios-blue);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}
.btn-secondary {
  background: var(--bg-fill-quaternary);
  border: none;
  padding: 10px 18px;
  border-radius: 10px;
  color: var(--text-primary);
  cursor: pointer;
}

@media (min-width: 640px) {
  .modal-overlay { align-items: center; padding: 16px; }
  .modal-content { border-radius: 20px; }
}

@media (max-width: 640px) {
  .kf-header h1 { font-size: 15px; }
  .primary-btn { padding: 7px 10px; font-size: 13px; }
}
</style>
