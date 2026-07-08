// AI 聊天 composable - 多会话状态管理 + 消息发送 + 工具循环
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { AIMessage, Task, MealType } from '../types'
import { DEFAULT_SESSION_ID } from '../types/ai'
import { chatWithDeepSeek, toDeepSeekMessages, type DeepSeekMessage } from '../utils/deepseek'
import { AI_TOOLS, buildSystemPrompt, executeTool } from '../utils/aiTools'
import { analyzeFoodImage, fileToDataURL } from '../utils/doubao'
import {
  getMessagesBySession,
  saveAIMessage,
  saveAIMessages,
  clearSessionMessages,
  estimateAIStorageBytes,
  trimAIStorage,
} from '../utils/aiStorage'
import { useSettingStore } from '../stores/settingStore'
import { useHealthStore } from '../stores/healthStore'
import dayjs from 'dayjs'

// 多会话状态
const currentSessionId = ref(DEFAULT_SESSION_ID)
const systemPromptOverride = ref<string | null>(null)
const messages = ref<AIMessage[]>([])
const loading = ref(false)
const currentError = ref<string | null>(null)
const storageBytes = ref(0)
// 待确认的删除任务
const pendingDelete = ref<{ task: Task | undefined; taskId: string; resolve: (ok: boolean) => void } | null>(null)

// 已初始化的会话集合
const initializedSessions = new Set<string>()

// 允许 UI 显示的消息（不含 system）
const visibleMessages = computed(() => messages.value.filter(m => m.role !== 'system'))

// 初始化指定会话：从 IndexedDB 恢复
async function initSession(sessionId: string = currentSessionId.value): Promise<void> {
  if (initializedSessions.has(sessionId)) return
  const stored = await getMessagesBySession(sessionId)
  messages.value = stored
  storageBytes.value = await estimateAIStorageBytes()
  initializedSessions.add(sessionId)
}

// 切换会话（可选注入 system prompt override）
async function switchSession(sessionId: string, extraSystemPrompt?: string): Promise<void> {
  currentSessionId.value = sessionId
  systemPromptOverride.value = extraSystemPrompt || null
  await initSession(sessionId)
  // 切换后刷新消息列表
  messages.value = await getMessagesBySession(sessionId)
}

// 打开学习会话（自动注入学习材料）
async function openStudyChat(studySessionId: string, materialText?: string): Promise<void> {
  const extra = materialText
    ? `你正在帮助用户复习学习材料。以下是学习内容:\n\n${materialText}\n\n请基于这份材料提问用户,评估掌握情况。每次问答后给出质量评分(格式: [评估] 质量: N/5, 理由: ...),N 为 1-5 分。`
    : undefined
  await switchSession(studySessionId, extra)
}

// 发送用户消息
async function sendMessage(userText: string): Promise<void> {
  const settingStore = useSettingStore()
  const settings = settingStore.settings

  if (!settings.aiEnabled || !settings.aiApiKey) {
    currentError.value = '请先在设置中启用 AI 助手并填写 DeepSeek API Key'
    return
  }

  await initSession()

  // 加用户消息
  const userMsg: AIMessage = {
    id: uuidv4(),
    sessionId: currentSessionId.value,
    role: 'user',
    content: userText,
    createdAt: Date.now(),
  }
  messages.value.push(userMsg)
  await saveAIMessage(userMsg)

  loading.value = true
  currentError.value = null

  try {
    await runAILoop(settings.aiApiKey, settings.aiModel)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    currentError.value = msg
    // 记录一条错误消息（不发到 DeepSeek）
    const errMsg: AIMessage = {
      id: uuidv4(),
      sessionId: currentSessionId.value,
      role: 'assistant',
      content: '',
      error: msg,
      createdAt: Date.now(),
    }
    messages.value.push(errMsg)
  } finally {
    loading.value = false
    // 触发存储修剪（只修剪当前会话）
    const trimRes = await trimAIStorage(settings.aiHistoryLimitMB || 10)
    if (trimRes.trimmed > 0) {
      // 修剪后同步内存
      messages.value = await getMessagesBySession(currentSessionId.value)
    }
    storageBytes.value = await estimateAIStorageBytes()
  }
}

// AI 循环：调用 DeepSeek → 处理工具 → 再调 → 直到无工具
async function runAILoop(apiKey: string, model: string): Promise<void> {
  const maxRounds = 6

  for (let round = 0; round < maxRounds; round++) {
    // 构造发给 DeepSeek 的消息列表：system + 历史
    const systemContent = buildSystemPrompt(systemPromptOverride.value || undefined)
    const systemMsg: DeepSeekMessage = { role: 'system', content: systemContent }
    const historyMsgs = toDeepSeekMessages(messages.value)
    const dsMessages: DeepSeekMessage[] = [systemMsg, ...historyMsgs]

    const resp = await chatWithDeepSeek({
      apiKey,
      model,
      messages: dsMessages,
      tools: AI_TOOLS,
    })

    const choice = resp.choices[0]
    if (!choice) throw new Error('DeepSeek 返回为空')

    const assistantContent = choice.message.content || ''
    const toolCalls = choice.message.tool_calls

    // 保存 assistant 回复
    const assistantMsg: AIMessage = {
      id: uuidv4(),
      sessionId: currentSessionId.value,
      role: 'assistant',
      content: assistantContent,
      tool_calls: toolCalls,
      createdAt: Date.now(),
    }
    messages.value.push(assistantMsg)
    await saveAIMessage(assistantMsg)

    // 如果没有工具调用，结束循环
    if (!toolCalls || toolCalls.length === 0) return

    // 执行每个工具调用
    const toolResults: AIMessage[] = []
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.function.arguments)
      } catch {
        args = {}
      }

      const result = await executeTool(call.function.name, args, {
        onDeleteConfirm: async (task, taskId) => {
          return new Promise<boolean>(resolve => {
            pendingDelete.value = { task, taskId, resolve }
          })
        },
      })

      const toolMsg: AIMessage = {
        id: uuidv4(),
        sessionId: currentSessionId.value,
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: call.id,
        name: call.function.name,
        createdAt: Date.now(),
      }
      toolResults.push(toolMsg)
    }
    messages.value.push(...toolResults)
    await saveAIMessages(toolResults)
    // 继续下一轮，让 AI 看到工具结果
  }
}

// 用户确认/取消删除
function resolveDeleteConfirm(confirmed: boolean): void {
  if (pendingDelete.value) {
    pendingDelete.value.resolve(confirmed)
    pendingDelete.value = null
  }
}

// 清空当前会话对话
async function clearCurrentSession(): Promise<void> {
  await clearSessionMessages(currentSessionId.value)
  messages.value = []
  initializedSessions.delete(currentSessionId.value)
  storageBytes.value = await estimateAIStorageBytes()
  currentError.value = null
}

// 根据时间推断餐次
function inferMealType(): MealType {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 14) return 'lunch'
  if (h < 18) return 'snack'
  return 'dinner'
}

// 发送图片（食物识别，可携带用户附言）
async function sendImage(file: File, caption?: string): Promise<void> {
  const settingStore = useSettingStore()
  const healthStore = useHealthStore()
  const settings = settingStore.settings

  if (!settings.doubaoEnabled || !settings.doubaoApiKey || !settings.doubaoModel) {
    currentError.value = '请先在设置中启用豆包并填写 API Key 和模型/接入点 ID'
    return
  }

  await initSession()

  const dataUrl = await fileToDataURL(file)
  const trimmedCaption = (caption || '').trim()

  // 加一条用户"图片"消息(如果有附言,把附言当作 content 显示在图片下)
  const userMsg: AIMessage = {
    id: uuidv4(),
    sessionId: currentSessionId.value,
    role: 'user',
    content: trimmedCaption || '[图片] 请识别这道菜并估算热量',
    imageDataUrl: dataUrl,
    kind: 'image',
    createdAt: Date.now(),
  }
  messages.value.push(userMsg)
  await saveAIMessage(userMsg)

  loading.value = true
  currentError.value = null

  try {
    // 组装给豆包的 prompt:附言 + 默认识别指令
    const prompt = trimmedCaption
      ? `用户附言: ${trimmedCaption}\n\n请识别这张图中的食物，估算热量和营养素;结合上方附言给出合理估算(比如附言说明了份量或只吃一半)。`
      : '请识别这张图中的食物，估算热量和营养素。'

    const result = await analyzeFoodImage({
      apiKey: settings.doubaoApiKey,
      model: settings.doubaoModel,
      imageDataUrl: dataUrl,
      extraPrompt: prompt,
    })

    if (result.items.length === 0) {
      const noFoodMsg: AIMessage = {
        id: uuidv4(),
        sessionId: currentSessionId.value,
        role: 'assistant',
        content: '未识别到食物，请换一张更清晰的餐食照片',
        createdAt: Date.now(),
      }
      messages.value.push(noFoodMsg)
      await saveAIMessage(noFoodMsg)
      return
    }

    // 自动保存为今日膳食
    const today = dayjs().format('YYYY-MM-DD')
    const mealType = inferMealType()
    const time = dayjs().format('HH:mm')
    const entry = await healthStore.saveMeal({
      date: today,
      mealType,
      time,
      items: result.items,
      totalCalories: result.totalCalories,
      notes: trimmedCaption || undefined,
    })

    const mealTypeLabel = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[mealType]
    const summary = result.items
      .map(it => `• ${it.name}${it.amount ? ` (${it.amount})` : ''}${it.calories ? ` ≈ ${it.calories} kcal` : ''}`)
      .join('\n')

    const resultMsg: AIMessage = {
      id: uuidv4(),
      sessionId: currentSessionId.value,
      role: 'assistant',
      content: `识别结果：\n${summary}\n\n总计约 ${result.totalCalories || 0} kcal，已记录到今日${mealTypeLabel}。`,
      kind: 'foodResult',
      createdAt: Date.now(),
    }
    messages.value.push(resultMsg)
    await saveAIMessage(resultMsg)
    void entry
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    currentError.value = msg
    const errMsg: AIMessage = {
      id: uuidv4(),
      sessionId: currentSessionId.value,
      role: 'assistant',
      content: '',
      error: msg,
      createdAt: Date.now(),
    }
    messages.value.push(errMsg)
  } finally {
    loading.value = false
    const trimRes = await trimAIStorage(settings.aiHistoryLimitMB || 10)
    if (trimRes.trimmed > 0) {
      messages.value = await getMessagesBySession(currentSessionId.value)
    }
    storageBytes.value = await estimateAIStorageBytes()
  }
}

// 存储用量（MB）
const storageMB = computed(() => (storageBytes.value / (1024 * 1024)).toFixed(2))

export function useAIChat() {
  return {
    // 状态
    currentSessionId,
    messages: visibleMessages,
    rawMessages: messages,
    loading,
    currentError,
    storageBytes,
    storageMB,
    pendingDelete,
    // 操作
    initChat: initSession,
    sendMessage,
    sendImage,
    clearAll: clearCurrentSession,
    resolveDeleteConfirm,
    // 多会话 API
    switchSession,
    openStudyChat,
  }
}