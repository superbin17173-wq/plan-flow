<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { generatePlanSummary } from '../../utils/aiSummary'

const props = defineProps<{ planId: string }>()
const emit = defineEmits<{ close: [] }>()

const loading = ref(false)
const error = ref('')
const result = ref('')
let abortCtrl: AbortController | null = null

async function runSummary() {
  loading.value = true
  error.value = ''
  result.value = ''
  abortCtrl = new AbortController()
  try {
    result.value = await generatePlanSummary(props.planId, { signal: abortCtrl.signal })
  } catch (e: any) {
    error.value = e?.message || 'AI 汇总失败'
  } finally {
    loading.value = false
    abortCtrl = null
  }
}

async function copyResult() {
  if (!result.value) return
  try {
    await navigator.clipboard.writeText(result.value)
    window.alert('已复制到剪贴板')
  } catch {
    window.alert('复制失败,请手动选中文本复制')
  }
}

function exportMd() {
  if (!result.value) return
  const blob = new Blob([result.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plan-summary-${props.planId.slice(0, 8)}.md`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

function handleClose() {
  if (abortCtrl) abortCtrl.abort()
  emit('close')
}

onMounted(() => {
  runSummary()
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="handleClose">
      <div class="modal-content wider">
        <div class="modal-header">
          <h2>🤖 AI 阶段回顾</h2>
          <button class="close-btn" @click="handleClose">×</button>
        </div>

        <div class="modal-body">
          <div v-if="loading" class="loading-block">
            <div class="spinner"></div>
            <p>DeepSeek 正在生成回顾报告,通常需要 5–20 秒...</p>
          </div>

          <div v-else-if="error" class="error-block">
            <p class="error-hint">{{ error }}</p>
            <button class="btn-secondary" @click="runSummary">重试</button>
          </div>

          <div v-else class="result-block">
            <pre class="result-pre">{{ result }}</pre>
          </div>

          <div v-if="!loading" class="modal-footer">
            <button class="btn-secondary" @click="handleClose">关闭</button>
            <button v-if="result" class="btn-secondary" @click="copyResult">📋 复制</button>
            <button v-if="result" class="btn-secondary" @click="exportMd">💾 导出 .md</button>
            <button v-if="result" class="btn-primary" @click="runSummary">🔄 重新生成</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@import './planDialog.shared.scss';

.modal-content.wider { max-width: 680px; }

.loading-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  gap: 16px;
  color: var(--text-secondary);
  font-size: 14px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--separator);
  border-top-color: var(--ios-blue);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error-block {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.result-block {
  padding: 4px;
}
.result-pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
  background: var(--bg-card);
  border-radius: 10px;
  padding: 16px;
  border: 0.5px solid var(--separator);
  max-height: 60vh;
  overflow-y: auto;
}
</style>
