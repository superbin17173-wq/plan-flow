// 知识库状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { KnowledgeFile, KnowledgePoint, KnowledgeMastery, KnowledgeFileStats } from '../types'
import {
  initDB,
  getAllKnowledgeFiles,
  getAllKnowledgePoints,
  getKnowledgePointsByFileId,
  putKnowledgeFile,
  deleteKnowledgeFileRow,
  putKnowledgePoint,
  deleteKnowledgePointRow,
} from '../utils/db'
import dayjs from 'dayjs'

export const useKnowledgeStore = defineStore('knowledge', () => {
  const files = ref<KnowledgeFile[]>([])
  const points = ref<KnowledgePoint[]>([])
  const loading = ref(false)

  async function loadAll() {
    loading.value = true
    try {
      await initDB()
      const [fs, ps] = await Promise.all([getAllKnowledgeFiles(), getAllKnowledgePoints()])
      files.value = fs.sort((a, b) => b.createdAt - a.createdAt)
      points.value = ps
    } finally {
      loading.value = false
    }
  }

  function getFileById(id: string): KnowledgeFile | undefined {
    return files.value.find(f => f.id === id)
  }

  function getPointsByFile(fileId: string): KnowledgePoint[] {
    return points.value
      .filter(p => p.fileId === fileId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
  }

  function getPointById(id: string): KnowledgePoint | undefined {
    return points.value.find(p => p.id === id)
  }

  function getStatsByFile(fileId: string): KnowledgeFileStats {
    const list = getPointsByFile(fileId)
    return {
      total: list.length,
      unseen: list.filter(p => p.mastery === 'unseen').length,
      learning: list.filter(p => p.mastery === 'learning').length,
      mastered: list.filter(p => p.mastery === 'mastered').length,
      lastReviewedDate: list
        .map(p => p.lastReviewDate)
        .filter((d): d is string => !!d)
        .sort()
        .slice(-1)[0],
    }
  }

  // ---------- 文件 CRUD ----------

  async function createFile(data: {
    title: string
    sourceFileName?: string
    content: string
  }): Promise<KnowledgeFile> {
    const now = Date.now()
    const file: KnowledgeFile = {
      id: uuidv4(),
      title: data.title,
      sourceFileName: data.sourceFileName,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    }
    await putKnowledgeFile(file)
    files.value.unshift(file)
    return file
  }

  async function editFile(id: string, patch: Partial<Pick<KnowledgeFile, 'title' | 'content'>>): Promise<KnowledgeFile | null> {
    const idx = files.value.findIndex(f => f.id === id)
    if (idx < 0) return null
    const updated: KnowledgeFile = {
      ...files.value[idx],
      ...patch,
      updatedAt: Date.now(),
    }
    await putKnowledgeFile(updated)
    files.value[idx] = updated
    return updated
  }

  // 删文件 → 级联删该文件下所有知识点
  async function deleteFile(id: string): Promise<void> {
    const relatedPoints = points.value.filter(p => p.fileId === id)
    for (const p of relatedPoints) {
      await deleteKnowledgePointRow(p.id)
    }
    points.value = points.value.filter(p => p.fileId !== id)
    await deleteKnowledgeFileRow(id)
    files.value = files.value.filter(f => f.id !== id)
  }

  // ---------- 知识点 CRUD ----------

  async function addPoints(fileId: string, drafts: Array<{ question: string; answer: string }>): Promise<KnowledgePoint[]> {
    const now = Date.now()
    // 新加的点顺序接在已有之后
    const existingCount = points.value.filter(p => p.fileId === fileId).length
    const created: KnowledgePoint[] = drafts.map((d, i) => ({
      id: uuidv4(),
      fileId,
      order: existingCount + i,
      question: d.question,
      answer: d.answer,
      mastery: 'unseen',
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    }))
    for (const p of created) {
      await putKnowledgePoint(p)
    }
    points.value.push(...created)

    // 更新文件 extractedAt
    const fidx = files.value.findIndex(f => f.id === fileId)
    if (fidx >= 0) {
      const updated = { ...files.value[fidx], extractedAt: now, updatedAt: now }
      await putKnowledgeFile(updated)
      files.value[fidx] = updated
    }
    return created
  }

  async function editPoint(id: string, patch: Partial<Pick<KnowledgePoint, 'question' | 'answer'>>): Promise<KnowledgePoint | null> {
    const idx = points.value.findIndex(p => p.id === id)
    if (idx < 0) return null
    const updated: KnowledgePoint = {
      ...points.value[idx],
      ...patch,
      updatedAt: Date.now(),
    }
    await putKnowledgePoint(updated)
    points.value[idx] = updated
    return updated
  }

  async function deletePoint(id: string): Promise<void> {
    await deleteKnowledgePointRow(id)
    points.value = points.value.filter(p => p.id !== id)
  }

  // 记录一次问答自评
  async function recordReview(id: string, mastery: KnowledgeMastery): Promise<KnowledgePoint | null> {
    const idx = points.value.findIndex(p => p.id === id)
    if (idx < 0) return null
    const updated: KnowledgePoint = {
      ...points.value[idx],
      mastery,
      reviewCount: points.value[idx].reviewCount + 1,
      lastReviewDate: dayjs().format('YYYY-MM-DD'),
      updatedAt: Date.now(),
    }
    await putKnowledgePoint(updated)
    points.value[idx] = updated
    return updated
  }

  // 统计
  const totalStats = computed<KnowledgeFileStats>(() => {
    const all = points.value
    return {
      total: all.length,
      unseen: all.filter(p => p.mastery === 'unseen').length,
      learning: all.filter(p => p.mastery === 'learning').length,
      mastered: all.filter(p => p.mastery === 'mastered').length,
      lastReviewedDate: all
        .map(p => p.lastReviewDate)
        .filter((d): d is string => !!d)
        .sort()
        .slice(-1)[0],
    }
  })

  return {
    files,
    points,
    loading,
    loadAll,
    getFileById,
    getPointsByFile,
    getPointById,
    getStatsByFile,
    createFile,
    editFile,
    deleteFile,
    addPoints,
    editPoint,
    deletePoint,
    recordReview,
    totalStats,
  }
})
