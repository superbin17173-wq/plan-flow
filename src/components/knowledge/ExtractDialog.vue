<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { KnowledgePointDraft } from '../../types'
import { extractKnowledgePoints } from '../../utils/knowledgeExtractor'

const props = defineProps<{
  title: string
  content: string
  error: string
}>()

const emit = defineEmits<{
  (e: 'update:title', v: string): void
  (e: 'confirm', drafts: KnowledgePointDraft[]): void
  (e: 'cancel'): void
}>()

const drafts = ref<KnowledgePointDraft[]>([])
const previewOpen = ref(false)

// 初次挂载 + content 变化时自动抽取
function rerunExtract() {
  drafts.value = extractKnowledgePoints(props.content).map(d => ({ ...d }))
}

onMounted(rerunExtract)
watch(() => props.content, rerunExtract)

function addEmptyDraft() {
  drafts.value.push({ id: uuidv4(), question: '', answer: '' })
}

function removeDraft(idx: number) {
  // 标记 deleted(不立即 splice,让用户能反悔)。最终 confirm 时过滤掉 deleted
  drafts.value[idx].deleted = !drafts.value[idx].deleted
}

function restoreDraft(idx: number) {
  drafts.value[idx].deleted = false
}

function onConfirm() {
  emit('confirm', drafts.value)
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('cancel')">
      <div class="modal-content">
        <div class="modal-header">
          <h2>确认知识点</h2>
          <button class="close-btn" @click="emit('cancel')">×</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">文件标题</label>
            <input
              :value="title"
              @input="emit('update:title', ($event.target as HTMLInputElement).value)"
              type="text"
              class="form-input"
              maxlength="40"
              placeholder="给这个知识文件起个名"
            />
          </div>

          <div class="form-group">
            <div class="drafts-head">
              <label class="form-label">
                知识点列表 (共 {{ drafts.filter(d => !d.deleted).length }} 条)
              </label>
              <button type="button" class="mini-add" @click="addEmptyDraft">+ 补充一条</button>
            </div>
            <p class="hint">
              系统已按 md 自动切分。可删 / 改 / 补,确认后才入库。
            </p>

            <div v-if="!drafts.length" class="empty-inline">
              没有抽取出知识点,可能文件格式不匹配。可点右上「+ 补充一条」手工录入,或取消换一份文件。
            </div>

            <div class="drafts-list">
              <div
                v-for="(d, idx) in drafts"
                :key="d.id"
                class="draft-card"
                :class="{ deleted: d.deleted }"
              >
                <div class="draft-head">
                  <span class="draft-idx">#{{ idx + 1 }}</span>
                  <input
                    v-model="d.question"
                    type="text"
                    class="form-input draft-q"
                    placeholder="问题(标题)"
                    :disabled="d.deleted"
                  />
                  <button
                    v-if="!d.deleted"
                    type="button"
                    class="ghost-mini"
                    @click="removeDraft(idx)"
                    title="删除"
                  >×</button>
                  <button
                    v-else
                    type="button"
                    class="ghost-mini restore"
                    @click="restoreDraft(idx)"
                    title="恢复"
                  >↩</button>
                </div>
                <textarea
                  v-model="d.answer"
                  class="form-input draft-a"
                  placeholder="答案(问题下面的正文)"
                  rows="3"
                  :disabled="d.deleted"
                />
              </div>
            </div>
          </div>

          <div v-if="props.error" class="error-hint">{{ props.error }}</div>

          <details v-if="content" class="raw-toggle">
            <summary @click.prevent="previewOpen = !previewOpen">查看原始文件内容</summary>
            <pre v-if="previewOpen" class="raw-content">{{ content }}</pre>
          </details>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="emit('cancel')">取消</button>
            <button
              type="button"
              class="btn-primary"
              :disabled="!drafts.some(d => !d.deleted && d.question.trim())"
              @click="onConfirm"
            >
              确认并入库
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
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
  max-width: 640px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
.modal-body {
  padding: 18px 16px 22px;
  overflow-y: auto;
  flex: 1;
}
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
  &:focus {
    outline: none;
    border-color: var(--ios-blue);
    box-shadow: 0 0 0 3px rgba(0,122,255,0.15);
  }
}
.hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.drafts-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.mini-add {
  background: transparent;
  border: 0.5px solid var(--ios-blue);
  color: var(--ios-blue);
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  &:hover { background: rgba(0,122,255,0.08); }
}

.drafts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.draft-card {
  background: var(--bg-card);
  border: 0.5px solid var(--separator);
  border-radius: 12px;
  padding: 12px;
  &.deleted {
    opacity: 0.45;
    background: var(--bg-fill-quaternary, rgba(120,120,128,0.06));
  }
}
.draft-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.draft-idx {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}
.draft-q { flex: 1; font-weight: 600; }
.draft-a {
  resize: vertical;
  min-height: 60px;
  font-size: 14px;
}
.ghost-mini {
  width: 28px; height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 17px;
  &:hover { background: rgba(255,59,48,0.12); color: #ff3b30; }
  &.restore:hover { background: rgba(0,122,255,0.12); color: var(--ios-blue); }
}

.empty-inline {
  text-align: center;
  color: var(--text-secondary);
  padding: 20px;
  font-size: 13px;
}

.error-hint {
  color: #ff3b30;
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(255,59,48,0.08);
  border-radius: 8px;
  margin-bottom: 12px;
}

.raw-toggle {
  margin: 12px 0;
  font-size: 13px;
  color: var(--text-secondary);
  summary {
    cursor: pointer;
    user-select: none;
    &:hover { color: var(--ios-blue); }
  }
}
.raw-content {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px;
  background: var(--bg-fill-quaternary);
  border-radius: 8px;
  font-size: 12px;
  white-space: pre-wrap;
  color: var(--text-primary);
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
</style>
