// DeepSeek Chat API 客户端（OpenAI 兼容格式）
// https://api-docs.deepseek.com/

import type { AIMessage } from '../types'

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'

export interface DeepSeekTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

export interface DeepSeekChatRequest {
  model: string
  messages: DeepSeekMessage[]
  tools?: DeepSeekTool[]
  tool_choice?: 'auto' | 'none' | 'required'
  temperature?: number
  stream?: boolean
}

export interface DeepSeekChatResponse {
  id: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }>
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    prompt_cache_hit_tokens?: number
    prompt_cache_miss_tokens?: number
  }
}

// AIMessage → DeepSeek message 格式
export function toDeepSeekMessages(msgs: AIMessage[]): DeepSeekMessage[] {
  return msgs
    // 过滤图片消息和食物识别结果（属于豆包流程，不发给 DeepSeek）
    .filter(m => !m.pending && !m.error && m.kind !== 'image' && m.kind !== 'foodResult')
    .map(m => {
      const base: DeepSeekMessage = { role: m.role, content: m.content || '' }
      if (m.tool_calls) base.tool_calls = m.tool_calls
      if (m.tool_call_id) base.tool_call_id = m.tool_call_id
      if (m.name) base.name = m.name
      return base
    })
}

// 调用 DeepSeek Chat API
export async function chatWithDeepSeek(opts: {
  apiKey: string
  model: string
  messages: DeepSeekMessage[]
  tools?: DeepSeekTool[]
  temperature?: number
  signal?: AbortSignal
}): Promise<DeepSeekChatResponse> {
  const { apiKey, model, messages, tools, temperature = 0.3, signal } = opts

  const body: DeepSeekChatRequest = {
    model,
    messages,
    temperature,
  }
  if (tools && tools.length > 0) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

  const res = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let errMsg = `HTTP ${res.status}`
    try {
      const errJson = JSON.parse(text)
      errMsg = errJson.error?.message || errJson.message || errMsg
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(`DeepSeek API 错误: ${errMsg}`)
  }

  return (await res.json()) as DeepSeekChatResponse
}
