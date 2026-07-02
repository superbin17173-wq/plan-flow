// AI 聊天 composable - 状态管理 + 消息发送 + 工具循环
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { AIMessage, Task, MealType } from '../types'
import { chatWithDeepSeek, toDeepSeekMessages, type DeepSeekMessage } from '../utils/deepseek'
import { AI_TOOLS, buildSystemPrompt, executeTool } from '../utils/aiTools'
import { analyzeFoodImage, fileToDataURL } from '../utils/doubao'
import {
  getAllAIMessages,
  saveAIMessage,
  saveAIMessages,
  clearAIMessages,
  estimateAIStorageBytes,
  trimAIStorage,
} from '../utils/aiStorage'
import { useSettingStore } from '../stores/settingStore'
import { useHealthStore } from '../stores/healthStore'
import dayjs from 'dayjs'

// 单例状态
const messages = ref<AIMessage[]>([])
const loading = ref(false)
const currentError = ref<string | null>(null)
const storageBytes = ref(0)
// 待确认的删除任务
const pendingDelete = ref<{ task: Task | undefined; taskId: string; resolve: (ok: boolean) => void } | null>(null)

let initialized = false

// 允许 UI 显示的消息（不含 system）
const visibleMessages = computed(() => messages.value.filter(m => m.role !== 'system'))

// 初始化：从 IndexedDB 恢复对话
async function initChat() {
  if (initialized) return
  const stored = await getAllAIMessages()
  messages.value = stored
  storageBytes.value = await estimateAIStorageBytes()
  initialized = true
}

// 发送用户消息
async function sendMessage(userText: string) {
  const settingStore = useSettingStore()
  const settings = settingStore.settings

  if (!settings.aiEnabled || !settings.aiApiKey) {
    currentError.value = '请先在设置中启用 AI 助手并填写 DeepSeek API Key'
    return
  }

  await initChat()

  // 加用户消息
  const userMsg: AIMessage = {
    id: uuidv4(),
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
      role: 'assistant',
      content: '',
      error: msg,
      createdAt: Date.now(),
    }
    messages.value.push(errMsg)
  } finally {
    loading.value = false
    // 触发存储修剪
    const trimRes = await trimAIStorage(settings.aiHistoryLimitMB || 10)
    if (trimRes.trimmed > 0) {
      // 修剪后同步内存
      messages.value = await getAllAIMessages()
    }
    storageBytes.value = await estimateAIStorageBytes()
  }
}

// AI 循环：调用 DeepSeek → 处理工具 → 再调 → 直到无工具
async function runAILoop(apiKey: string, model: string) {
  const maxRounds = 6

  for (let round = 0; round < maxRounds; round++) {
    // 构造发给 DeepSeek 的消息列表：system + 历史
    const systemMsg: DeepSeekMessage = { role: 'system', content: buildSystemPrompt() }
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
function resolveDeleteConfirm(confirmed: boolean) {
  if (pendingDelete.value) {
    pendingDelete.value.resolve(confirmed)
    pendingDelete.value = null
  }
}

// 清空全部对话
async function clearAll() {
  await clearAIMessages()
  messages.value = []
  storageBytes.value = 0
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
async function sendImage(file: File, caption?: string) {
  const settingStore = useSettingStore()
  const healthStore = useHealthStore()
  const settings = settingStore.settings

  if (!settings.doubaoEnabled || !settings.doubaoApiKey || !settings.doubaoModel) {
    currentError.value = '请先在设置中启用豆包并填写 API Key 和模型/接入点 ID'
    return
  }

  await initChat()

  const dataUrl = await fileToDataURL(file)
  const trimmedCaption = (caption || '').trim()

  // 加一条用户"图片"消息(如果有附言,把附言当作 content 显示在图片下)
  const userMsg: AIMessage = {
    id: uuidv4(),
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
      messages.value = await getAllAIMessages()
    }
    storageBytes.value = await estimateAIStorageBytes()
  }
}

// 存储用量（MB）
const storageMB = computed(() => (storageBytes.value / (1024 * 1024)).toFixed(2))

export function useAIChat() {
  return {
    messages: visibleMessages,
    rawMessages: messages,
    loading,
    currentError,
    storageBytes,
    storageMB,
    pendingDelete,
    initChat,
    sendMessage,
    sendImage,
    clearAll,
    resolveDeleteConfirm,
  }
}
