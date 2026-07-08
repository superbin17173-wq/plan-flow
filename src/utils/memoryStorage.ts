// AI 记忆本地存储（IndexedDB）
import { getDB } from './db'
import type { AIMemory } from '../types/memory'
import { v4 as uuidv4 } from 'uuid'

// 保存记忆
export async function saveAIMemory(mem: AIMemory): Promise<void> {
  const db = await getDB()
  await db.put('ai_memories', mem)
}

// 批量保存
export async function saveAIMemories(mems: AIMemory[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('ai_memories', 'readwrite')
  for (const m of mems) {
    await tx.store.put(m)
  }
  await tx.done
}

// 获取指定会话的记忆（按重要性排序）
export async function getMemoriesBySession(sessionId: string): Promise<AIMemory[]> {
  const db = await getDB()
  try {
    const mems = await db.getAllFromIndex('ai_memories', 'by-session', sessionId)
    return mems.sort((a, b) => b.importance - a.importance)
  } catch {
    // 索引不存在时 fallback
    const all = await db.getAll('ai_memories') as AIMemory[]
    return all.filter(m => m.sessionId === sessionId).sort((a, b) => b.importance - a.importance)
  }
}

// 获取 Top-N 重要记忆
export async function getTopMemories(sessionId: string, n: number = 10): Promise<AIMemory[]> {
  const mems = await getMemoriesBySession(sessionId)
  return mems.slice(0, n)
}

// 删除指定记忆
export async function deleteAIMemory(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('ai_memories', id)
}

// 清空指定会话的记忆
export async function clearSessionMemories(sessionId: string): Promise<void> {
  const db = await getDB()
  const mems = await getMemoriesBySession(sessionId)
  const tx = db.transaction('ai_memories', 'readwrite')
  for (const m of mems) {
    await tx.store.delete(m.id)
  }
  await tx.done
}

// 创建新记忆
export function createMemory(
  sessionId: string,
  kind: AIMemory['kind'],
  content: string,
  importance: number = 3,
  sourceMsgIds?: string[]
): AIMemory {
  return {
    id: uuidv4(),
    sessionId,
    kind,
    content,
    importance,
    reviewCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sourceMsgIds,
  }
}

// 衰减记忆引用次数（每调用一次 reviewCount-1，低于 0 的删除）
export async function decayMemories(sessionId: string): Promise<void> {
  const db = await getDB()
  const mems = await getMemoriesBySession(sessionId)
  const tx = db.transaction('ai_memories', 'readwrite')
  for (const m of mems) {
    m.reviewCount -= 1
    if (m.reviewCount < 0) {
      await tx.store.delete(m.id)
    } else {
      m.updatedAt = Date.now()
      await tx.store.put(m)
    }
  }
  await tx.done
}