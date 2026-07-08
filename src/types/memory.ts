// AI 记忆类型定义

// 记忆类型
export type MemoryKind = 'knowledge' | 'weakness' | 'strength' | 'context'

// 单条记忆
export interface AIMemory {
  id: string
  sessionId: string // 所属会话
  kind: MemoryKind
  content: string // 记忆内容（关键知识点、薄弱点等）
  importance: number // AI 评估的重要性 1-5
  reviewCount: number // 被引用次数（自动衰减）
  createdAt: number
  updatedAt: number
  // 来源消息 ID（可选，用于追溯）
  sourceMsgIds?: string[]
}