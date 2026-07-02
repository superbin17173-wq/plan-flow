// AI 对话本地存储（IndexedDB）
import { getDB } from './db'
import type { AIMessage } from '../types'

const MB = 1024 * 1024

// 保存消息
export async function saveAIMessage(msg: AIMessage): Promise<void> {
  const db = await getDB()
  await db.put('ai_messages', msg)
}

// 批量保存
export async function saveAIMessages(msgs: AIMessage[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('ai_messages', 'readwrite')
  for (const m of msgs) {
    await tx.store.put(m)
  }
  await tx.done
}

// 获取全部消息（按时间升序）
export async function getAllAIMessages(): Promise<AIMessage[]> {
  const db = await getDB()
  return db.getAllFromIndex('ai_messages', 'by-createdAt')
}

// 清空全部对话
export async function clearAIMessages(): Promise<void> {
  const db = await getDB()
  await db.clear('ai_messages')
}

// 估算总字节数
export async function estimateAIStorageBytes(): Promise<number> {
  const msgs = await getAllAIMessages()
  let bytes = 0
  for (const m of msgs) {
    // 粗略估算：JSON.stringify 后的字节长度
    bytes += new Blob([JSON.stringify(m)]).size
  }
  return bytes
}

// 检查并按需修剪：如果超过 limitMB，从最旧的开始删，直到低于阈值
export async function trimAIStorage(limitMB: number): Promise<{ trimmed: number; finalBytes: number }> {
  const limit = limitMB * MB
  let msgs = await getAllAIMessages()
  let bytes = 0
  const sizeMap = new Map<string, number>()
  for (const m of msgs) {
    const s = new Blob([JSON.stringify(m)]).size
    sizeMap.set(m.id, s)
    bytes += s
  }

  if (bytes <= limit) return { trimmed: 0, finalBytes: bytes }

  // 已按时间升序（最旧的在前面），逐个删除直到达标
  const db = await getDB()
  let trimmed = 0
  // 保留至少最近 2 条，避免上下文丢光
  const preserveTail = 2
  const removable = Math.max(0, msgs.length - preserveTail)
  for (let i = 0; i < removable; i++) {
    if (bytes <= limit) break
    const m = msgs[i]
    await db.delete('ai_messages', m.id)
    bytes -= sizeMap.get(m.id) || 0
    trimmed++
  }
  return { trimmed, finalBytes: bytes }
}
