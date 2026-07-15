<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { KnowledgeFile, KnowledgePointDraft } from '../types'
import { extractKnowledgePoints } from '../utils/knowledgeExtractor'
import { isPDFFile, extractTextFromPDF } from '../utils/pdfParser'
import ExtractDialog from '../components/knowledge/ExtractDialog.vue'

const router = useRouter()
const store = useKnowledgeStore()

// 上传弹窗
const showUpload = ref(false)
const uploadDraft = ref<{
  fileName: string
  title: string
  content: string
} | null>(null)
const uploadError = ref('')
const uploadLoading = ref(false)

// 编辑弹窗
const editingFile = ref<KnowledgeFile | null>(null)
const editingTitle = ref('')

onMounted(async () => {
  await store.loadAll()
})

const files = computed(() => store.files)

function fileStats(file: KnowledgeFile) {
  return store.getStatsByFile(file.id)
}

function masteryRate(file: KnowledgeFile): number {
  const s = fileStats(file)
  if (s.total === 0) return 0
  return Math.round((s.mastered / s.total) * 100)
}

function goFile(fileId: string) {
  router.push(`/knowledge/${fileId}`)
}

function goQuiz(fileId: string) {
  router.push(`/knowledge-quiz/${fileId}`)
}

async function openUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.txt,.markdown,.pdf'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    uploadLoading.value = true
    uploadError.value = ''
    try {
      let content = ''
      if (isPDFFile(file)) {
        content = await extractTextFromPDF(file)
      } else {
        content = await file.text()
      }
      if (!content.trim()) {
        uploadError.value = '文件内容为空,或解析失败'
        return
      }
      // 默认标题:文件名去后缀
      const base = file.name.replace(/\.[^.]+$/, '')
      uploadDraft.value = {
        fileName: file.name,
        title: base,
        content,
      }
      showUpload.value = true
    } catch (e: any) {
      uploadError.value = e?.message || '读取文件失败'
    } finally {
      uploadLoading.value = false
    }
  }
  input.click()
}

// ExtractDialog 确认后:落库文件 + 知识点
async function onConfirmExtract(drafts: KnowledgePointDraft[]) {
  if (!uploadDraft.value) return
  const kept = drafts.filter(d => !d.deleted && d.question.trim())
  if (!kept.length) {
    uploadError.value = '至少保留一条知识点'
    return
  }
  const file = await store.createFile({
    title: uploadDraft.value.title,
    sourceFileName: uploadDraft.value.fileName,
    content: uploadDraft.value.content,
  })
  await store.addPoints(file.id, kept.map(d => ({
    question: d.question.trim(),
    answer: d.answer.trim(),
  })))
  showUpload.value = false
  uploadDraft.value = null
}

function cancelUpload() {
  showUpload.value = false
  uploadDraft.value = null
  uploadError.value = ''
}

function openEdit(file: KnowledgeFile) {
  editingFile.value = file
  editingTitle.value = file.title
}

async function saveEdit() {
  if (!editingFile.value) return
  if (!editingTitle.value.trim()) return
  await store.editFile(editingFile.value.id, { title: editingTitle.value.trim() })
  editingFile.value = null
}

async function onConfirmDelete(file: KnowledgeFile) {
  const ok = window.confirm(
    `删除知识文件「${file.title}」?\n\n会一起删掉该文件下所有 ${fileStats(file).total} 条知识点。\n此操作不可撤销。`,
  )
  if (!ok) return
  await store.deleteFile(file.id)
}
</script>

<template>
  <div class="knowledge-view">
    <header class="kv-header">
      <button class="back-btn" @click="router.push('/')">‹ 返回</button>
      <h1>📚 知识库</h1>
      <button class="primary-btn" @click="openUpload">+ 上传知识文件</button>
    </header>

    <main class="kv-main">
      <p class="hint">
        上传 md/txt/pdf 文件,系统自动按行切分知识点,然后在「知识问答」页里逐条刷题。
      </p>

      <!-- 总览统计 -->
      <section v-if="store.totalStats.total" class="overview">
        <div class="stat-pill">共 {{ store.totalStats.total }} 条</div>
        <div class="stat-pill unseen">未见 {{ store.totalStats.unseen }}</div>
        <div class="stat-pill learning">学习中 {{ store.totalStats.learning }}</div>
        <div class="stat-pill mastered">已掌握 {{ store.totalStats.mastered }}</div>
      </section>

      <!-- 文件列表 -->
      <section v-if="files.length" class="file-section">
        <div class="file-list">
          <article v-for="f in files" :key="f.id" class="file-card" @click="goFile(f.id)">
            <header class="fc-head">
              <div class="fc-title-wrap">
                <h3>{{ f.title }}</h3>
                <p class="fc-meta">
                  {{ fileStats(f).total }} 条知识点
                  <template v-if="f.sourceFileName"> · {{ f.sourceFileName }}</template>
                </p>
              </div>
              <div class="fc-actions" @click.stop>
                <button class="ghost-btn" @click="openEdit(f)" title="改名">✎</button>
                <button class="ghost-btn" @click="goQuiz(f.id)" title="问答">🎯</button>
                <button class="ghost-btn danger" @click="onConfirmDelete(f)" title="删除">🗑</button>
              </div>
            </header>

            <div class="fc-progress-row">
              <div class="progress-bar">
                <div class="progress-mastered" :style="{ width: masteryRate(f) + '%' }"></div>
              </div>
              <span class="mastery-label">{{ masteryRate(f) }}%</span>
            </div>
          </article>
        </div>
      </section>

      <div v-else class="empty-hero">
        <p>还没有知识文件。</p>
        <button class="primary-btn" @click="openUpload">+ 上传你的第一个知识文件</button>
      </div>
    </main>

    <!-- 上传抽取确认弹窗 -->
    <ExtractDialog
      v-if="showUpload && uploadDraft"
      :title="uploadDraft.title"
      :content="uploadDraft.content"
      :error="uploadError"
      @update:title="v => uploadDraft!.title = v"
      @confirm="onConfirmExtract"
      @cancel="cancelUpload"
    />

    <!-- 改名弹窗 -->
    <Teleport to="body">
      <div v-if="editingFile" class="modal-overlay" @click.self="editingFile = null">
        <div class="modal-content small">
          <div class="modal-header">
            <h2>重命名知识文件</h2>
            <button class="close-btn" @click="editingFile = null">×</button>
          </div>
          <div class="modal-body">
            <input
              v-model="editingTitle"
              type="text"
              class="form-input"
              maxlength="40"
              autofocus
              @keydown.enter="saveEdit"
            />
            <div class="modal-footer">
              <button class="btn-secondary" @click="editingFile = null">取消</button>
              <button class="btn-primary" @click="saveEdit">保存</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.knowledge-view {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: calc(24px + var(--safe-bottom, 0px));
}

.kv-header {
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
  box-shadow: 0 1px 3px rgba(0, 122, 255, 0.28);
  &:hover { filter: brightness(1.05); }
  &:active { transform: scale(0.97); }
}

.kv-main {
  max-width: 780px;
  margin: 0 auto;
  padding: 16px;
}

.hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 14px;
  line-height: 1.5;
}

.overview {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.stat-pill {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--bg-card);
  border: 0.5px solid var(--separator);
  font-size: 13px;
  color: var(--text-primary);
  &.unseen { color: var(--text-secondary); }
  &.learning { color: #F5A962; border-color: rgba(245,169,98,0.3); }
  &.mastered { color: #7BC47F; border-color: rgba(123,196,127,0.3); }
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg, 14px);
  padding: 14px 16px;
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06));
  border: 0.5px solid var(--separator);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.15s;
  &:hover { box-shadow: var(--shadow-md, 0 2px 8px rgba(0,0,0,0.08)); }
  &:active { transform: scale(0.99); }
}

.fc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  h3 {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
  }
}
.fc-title-wrap { flex: 1; min-width: 0; }
.fc-meta {
  font-size: 13px;
  color: var(--text-secondary);
}
.fc-actions {
  display: flex;
  gap: 4px;
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
  &.danger:hover { background: rgba(255,59,48,0.12); }
}

.fc-progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-fill-quaternary, rgba(120,120,128,0.12));
  border-radius: 3px;
  overflow: hidden;
}
.progress-mastered {
  height: 100%;
  background: linear-gradient(90deg, #7BC47F, #4ea85a);
  transition: width 0.3s;
}
.mastery-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  min-width: 38px;
  text-align: right;
}

.empty-hero {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
  p { margin-bottom: 16px; font-size: 15px; }
}

// 共用 modal 样式(改名弹窗用)
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
  max-width: 440px;
  overflow: hidden;
  padding-bottom: var(--safe-bottom, 0px);
  box-shadow: var(--shadow-xl);
  &.small { max-width: 420px; }
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
.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 0.5px solid var(--separator);
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 10px;
  font-size: 15px;
  font-family: inherit;
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
  .kv-header h1 { font-size: 15px; }
  .primary-btn { padding: 7px 10px; font-size: 13px; }
}
</style>
