<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useAIChat } from '../../composables/useAIChat'
import { useUiStore } from '../../stores/uiStore'
import type { AIMessage } from '../../types'
import dayjs from 'dayjs'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const uiStore = useUiStore()

const {
  messages,
  loading,
  currentError,
  storageMB,
  pendingDelete,
  currentSessionId,
  initChat,
  sendMessage,
  sendImage,
  clearAll,
  resolveDeleteConfirm,
  switchSession,
} = useAIChat()

const input = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)

// 待发送图片(选好但还没点发送)
const pendingImage = ref<{ file: File; previewUrl: string } | null>(null)

const isOpen = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

watch(isOpen, async open => {
  if (open) {
    // 如果 uiStore 指定了特定会话，切换到它
    const sessionId = uiStore.activeAiSessionId
    const extra = uiStore.aiSystemPromptExtra
    if (sessionId && sessionId !== currentSessionId.value) {
      await switchSession(sessionId, extra || undefined)
    } else {
      await initChat()
    }
    await scrollToBottom()
  }
})

watch(
  () => messages.value.length,
  () => scrollToBottom()
)

async function onSend() {
  if (loading.value) return
  const text = input.value.trim()
  // 有图片时:走豆包(把文字作为附言)
  if (pendingImage.value) {
    const file = pendingImage.value.file
    const previewUrl = pendingImage.value.previewUrl
    input.value = ''
    pendingImage.value = null
    // 释放 previewUrl(如果是 blob url)
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    await sendImage(file, text)
    return
  }
  // 无图片:必须有文字才发送到 DeepSeek
  if (!text) return
  input.value = ''
  await sendMessage(text)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    onSend()
  }
}

function onPickImage() {
  fileInputEl.value?.click()
}

async function onFileChange(e: Event) {
  const inputEl = e.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    alert('图片过大，请压缩到 5 MB 以内')
    inputEl.value = ''
    return
  }
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    inputEl.value = ''
    return
  }
  // 替换旧的待发送图片
  if (pendingImage.value?.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(pendingImage.value.previewUrl)
  }
  const previewUrl = URL.createObjectURL(file)
  pendingImage.value = { file, previewUrl }
  inputEl.value = ''
}

function cancelPendingImage() {
  if (!pendingImage.value) return
  if (pendingImage.value.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(pendingImage.value.previewUrl)
  }
  pendingImage.value = null
}

async function onClearHistory() {
  if (!confirm('确定清空全部对话历史？此操作不可撤销。')) return
  await clearAll()
}

function formatTime(ts: number): string {
  return dayjs(ts).format('HH:mm')
}

// 提取消息用于渲染：将 assistant 的 tool_calls 用简短提示表示
interface DisplayMsg {
  id: string
  side: 'user' | 'ai' | 'tool' | 'error'
  text: string
  time: number
  toolName?: string
  toolResult?: { success: boolean; error?: string }
  imageDataUrl?: string
}

const displayMessages = computed<DisplayMsg[]>(() => {
  const out: DisplayMsg[] = []
  for (const m of messages.value) {
    if (m.error) {
      out.push({ id: m.id, side: 'error', text: m.error, time: m.createdAt })
      continue
    }
    if (m.role === 'user') {
      // 图片消息:如果 content 是默认识别指令,不显示;附言则显示
      const isDefault = m.content === '[图片] 请识别这道菜并估算热量'
      out.push({
        id: m.id,
        side: 'user',
        text: m.imageDataUrl && isDefault ? '' : m.content,
        time: m.createdAt,
        imageDataUrl: m.imageDataUrl,
      })
    } else if (m.role === 'assistant') {
      if (m.content) {
        out.push({ id: m.id, side: 'ai', text: m.content, time: m.createdAt })
      }
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          out.push({
            id: m.id + '_' + tc.id,
            side: 'tool',
            text: `调用 ${describeTool(tc.function.name)}...`,
            time: m.createdAt,
            toolName: tc.function.name,
          })
        }
      }
    } else if (m.role === 'tool') {
      // 附加到最近一个 tool 显示条上（简化）
      let result: { success: boolean; error?: string } | undefined
      try {
        result = JSON.parse(m.content)
      } catch {
        // ignore
      }
      // 修改最近的 tool 消息（如果存在）
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i].side === 'tool' && out[i].toolName === m.name && !out[i].toolResult) {
          out[i].toolResult = result
          out[i].text = describeToolResult(m.name || '', result)
          break
        }
      }
    }
  }
  return out
})

function describeTool(name: string): string {
  const map: Record<string, string> = {
    addTask: '添加任务',
    updateTask: '修改任务',
    deleteTask: '删除任务',
    queryTasks: '查询任务',
    bulkAddTasks: '批量添加',
  }
  return map[name] || name
}

function describeToolResult(name: string, result?: { success: boolean; error?: string }): string {
  if (!result) return `${describeTool(name)} - 处理中`
  if (result.success) return `✓ ${describeTool(name)} 成功`
  if (result.error?.includes('取消')) return `× ${describeTool(name)} 已取消`
  return `× ${describeTool(name)} 失败: ${result.error || ''}`
}

// 删除确认
function confirmDelete() {
  resolveDeleteConfirm(true)
}
function cancelDelete() {
  resolveDeleteConfirm(false)
}
</script>

<template>
  <Transition name="chat-slide">
    <div v-if="isOpen" class="chat-panel" @click.stop>
      <header class="chat-header">
        <div class="chat-title">
          <span class="chat-avatar">🤖</span>
          <div>
            <div class="name">AI 日程助手</div>
            <div class="sub">DeepSeek · {{ storageMB }} MB</div>
          </div>
        </div>
        <div class="chat-actions">
          <button class="icon-btn" @click="onClearHistory" title="清空对话">🗑</button>
          <button class="icon-btn" @click="isOpen = false" title="关闭">×</button>
        </div>
      </header>

      <div class="chat-messages" ref="messagesEl">
        <div v-if="displayMessages.length === 0" class="welcome">
          <p>你好！我可以帮你管理日程。试试对我说：</p>
          <ul>
            <li>"明天下午 3 点开产品评审会 1 小时"</li>
            <li>"这周三下午的会议改到周四"</li>
            <li>"帮我查这周还有哪些没完成的任务"</li>
            <li>"每周一早上 9 点开周会，连续 8 周"</li>
          </ul>
        </div>

        <div
          v-for="m in displayMessages"
          :key="m.id"
          class="msg"
          :class="['msg-' + m.side]"
        >
          <div class="msg-bubble">
            <img v-if="m.imageDataUrl" :src="m.imageDataUrl" class="msg-image" />
            <span v-if="m.text" class="msg-text">{{ m.text }}</span>
          </div>
          <div class="msg-time">{{ formatTime(m.time) }}</div>
        </div>

        <div v-if="loading" class="msg msg-ai">
          <div class="msg-bubble typing">
            <span></span><span></span><span></span>
          </div>
        </div>

        <div v-if="currentError" class="error-hint">
          {{ currentError }}
        </div>
      </div>

      <!-- 删除确认对话框 -->
      <Transition name="fade">
        <div v-if="pendingDelete" class="confirm-overlay">
          <div class="confirm-box">
            <h4>确认删除？</h4>
            <p v-if="pendingDelete.task">
              <b>{{ pendingDelete.task.title }}</b><br />
              {{ pendingDelete.task.date }} {{ pendingDelete.task.startTime || (pendingDelete.task.durationMinutes ? pendingDelete.task.durationMinutes + 'm' : '全天') }}
            </p>
            <p v-else>任务 ID: {{ pendingDelete.taskId }}</p>
            <div class="confirm-actions">
              <button class="btn cancel" @click="cancelDelete">取消</button>
              <button class="btn danger" @click="confirmDelete">删除</button>
            </div>
          </div>
        </div>
      </Transition>

      <footer class="chat-input">
        <input
          ref="fileInputEl"
          type="file"
          accept="image/*"
          style="display: none"
          @change="onFileChange"
        />

        <!-- 待发送图片预览 -->
        <div v-if="pendingImage" class="pending-image">
          <img :src="pendingImage.previewUrl" class="pending-thumb" />
          <div class="pending-tip">
            <div class="pt-title">📸 待识别图片</div>
            <div class="pt-hint">
              可以在下方输入附言(如"我只吃了一半"、"这是低脂版"),然后点发送
            </div>
          </div>
          <button class="pending-remove" @click="cancelPendingImage" title="移除">×</button>
        </div>

        <div class="input-row">
          <button
            class="icon-input-btn"
            @click="onPickImage"
            :disabled="loading"
            :title="pendingImage ? '换一张图片' : '发送食物图片'"
          >
            📎
          </button>
          <textarea
            v-model="input"
            @keydown="onKeyDown"
            :disabled="loading"
            rows="2"
            :placeholder="pendingImage ? '给这张图片加一句附言(可留空,Enter 发送)' : '告诉我你想安排什么...(Enter 发送)'"
          ></textarea>
          <button
            class="send-btn"
            :disabled="(!input.trim() && !pendingImage) || loading"
            @click="onSend"
          >
            {{ loading ? '...' : '发送' }}
          </button>
        </div>
      </footer>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.chat-panel {
  position: fixed;
  bottom: 90px;
  right: 20px;
  width: 380px;
  height: 560px;
  max-height: calc(100vh - 120px);
  background: var(--bg-elevated);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  z-index: 2500;
  overflow: hidden;
  border: 0.5px solid var(--separator);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--separator);
  background: var(--material-regular);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 10px;

  .chat-avatar { font-size: 22px; }
  .name {
    font-size: var(--font-size-sub);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .sub {
    font-size: var(--font-size-caption2);
    color: var(--text-tertiary);
  }
}

.chat-actions { display: flex; gap: 4px; }

.icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 14px;
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg-card);
}

.welcome {
  color: var(--text-secondary);
  font-size: var(--font-size-footnote);
  line-height: 1.6;

  ul {
    margin: 8px 0 0 0;
    padding-left: 20px;
    color: var(--text-tertiary);
    li { margin-bottom: 4px; }
  }
}

.msg {
  display: flex;
  flex-direction: column;
  max-width: 82%;
}

.msg-user {
  align-self: flex-end;
  align-items: flex-end;

  .msg-bubble {
    background: var(--ios-blue);
    color: #fff;
    border-radius: 18px 18px 4px 18px;
    box-shadow: 0 1px 2px rgba(0, 122, 255, 0.16);
  }
}

.msg-ai {
  align-self: flex-start;

  .msg-bubble {
    background: var(--bg-fill-quaternary);
    color: var(--text-primary);
    border-radius: 18px 18px 18px 4px;
  }
}

.msg-tool {
  align-self: flex-start;

  .msg-bubble {
    background: transparent;
    border: 1px dashed var(--separator);
    color: var(--text-tertiary);
    font-size: var(--font-size-caption);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
  }
}

.msg-error {
  align-self: center;

  .msg-bubble {
    background: rgba(255, 59, 48, 0.14);
    color: var(--ios-red);
    font-size: var(--font-size-caption);
    border-radius: var(--radius-sm);
  }
}

.msg-bubble {
  padding: 8px 14px;
  font-size: var(--font-size-footnote);
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.msg-image {
  max-width: 220px;
  max-height: 220px;
  border-radius: var(--radius-sm);
  display: block;
}

.msg-bubble .msg-image + .msg-text {
  display: block;
  margin-top: 6px;
}

.msg-text { display: block; }

.msg-time {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 3px;
  padding: 0 4px;
}

.typing {
  display: inline-flex;
  gap: 4px;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-tertiary);
    animation: typing-bounce 1.4s infinite ease-in-out;

    &:nth-child(2) { animation-delay: 0.15s; }
    &:nth-child(3) { animation-delay: 0.3s; }
  }
}

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.error-hint {
  padding: 8px 12px;
  background: rgba(255, 59, 48, 0.14);
  color: var(--ios-red);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-caption);
}

.chat-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px calc(10px + var(--safe-bottom));
  border-top: 0.5px solid var(--separator);
  background: var(--bg-elevated);
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;

  textarea {
    flex: 1;
    border: 0.5px solid transparent;
    border-radius: var(--radius-md);
    padding: 9px 12px;
    background: var(--bg-fill-quaternary);
    color: var(--text-primary);
    font-size: var(--font-size-footnote);
    font-family: inherit;
    resize: none;

    &::placeholder { color: var(--text-tertiary); }
    &:focus {
      outline: none;
      background: var(--bg-card);
      border-color: var(--ios-blue);
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.14);
    }
    &:disabled { opacity: 0.6; }
  }
}

.pending-image {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--bg-card);
  border: 1px dashed var(--ios-blue);
  border-radius: var(--radius-md);
  position: relative;
}

.pending-thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
}

.pending-tip {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  .pt-title {
    font-size: var(--font-size-footnote);
    font-weight: 600;
    color: var(--ios-blue);
  }
  .pt-hint {
    font-size: var(--font-size-caption2);
    color: var(--text-tertiary);
    line-height: 1.4;
  }
}

.pending-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-fill-quaternary);
  color: var(--text-secondary);
  font-size: 14px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover { background: rgba(255, 59, 48, 0.14); color: var(--ios-red); }
}

.send-btn {
  padding: 8px 18px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--ios-blue);
  color: #fff;
  font-size: var(--font-size-footnote);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform var(--spring), filter var(--transition-fast);
  box-shadow: 0 2px 6px rgba(0, 122, 255, 0.24);

  &:hover:not(:disabled) { filter: brightness(1.06); }
  &:active:not(:disabled) { transform: scale(0.96); }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
}

.icon-input-btn {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--bg-fill-quaternary);
  color: var(--text-secondary);
  font-size: 16px;
  border: none;
  cursor: pointer;

  &:hover:not(:disabled) { background: var(--bg-hover); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.confirm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  padding: 20px;
}

.confirm-box {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: 18px 20px;
  width: 100%;
  max-width: 300px;
  box-shadow: var(--shadow-lg);

  h4 {
    margin: 0 0 10px 0;
    font-size: var(--font-size-callout);
    color: var(--text-primary);
    font-weight: 700;
  }

  p {
    font-size: var(--font-size-footnote);
    color: var(--text-secondary);
    margin: 0 0 14px 0;
    line-height: 1.5;
  }
}

.confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;

  .btn {
    padding: 7px 16px;
    min-height: 32px;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-footnote);
    font-weight: 600;
    border: none;
    cursor: pointer;

    &.cancel {
      background: var(--bg-fill-quaternary);
      color: var(--text-primary);
    }
    &.danger {
      background: var(--ios-red);
      color: #fff;
    }
  }
}

.chat-slide-enter-active, .chat-slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s;
}
.chat-slide-enter-from, .chat-slide-leave-to {
  opacity: 0;
  transform: translateY(24px) scale(0.96);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .chat-panel {
    right: 10px;
    left: 10px;
    width: auto;
    bottom: 84px;
    height: calc(100vh - 110px);
  }
}
</style>
