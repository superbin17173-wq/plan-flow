// AI 对话消息类型定义

export type AIRole = 'system' | 'user' | 'assistant' | 'tool'

export interface AIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string // JSON string
  }
}

export interface AIMessage {
  id: string // 前端生成的 UUID
  role: AIRole
  content: string
  tool_calls?: AIToolCall[] // assistant 消息可能带工具调用
  tool_call_id?: string // tool 角色消息必须有
  name?: string // tool 角色消息的工具名
  createdAt: number // 时间戳
  imageDataUrl?: string // 附带图片（食物识别用），仅前端展示
  kind?: 'text' | 'image' | 'foodResult' // 消息类型，用于渲染
  // UI 状态（非持久化）
  pending?: boolean
  error?: string
}
