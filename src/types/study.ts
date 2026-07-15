// 学习任务专用类型定义
import type { FSRSCardState } from '../utils/fsrs'

// 掌握度评级 (Anki 风格 4 档)
export type MasteryLevel = 'again' | 'hard' | 'good' | 'easy'

// MasteryLevel -> SM-2 quality (0-5)
export const MASTERY_TO_QUALITY: Record<MasteryLevel, number> = {
  again: 1, // 完全忘记，重来
  hard: 3,  // 勉强记住
  good: 4,  // 顺利记住
  easy: 5,  // 完美
}

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  again: '重来',
  hard: '困难',
  good: '良好',
  easy: '简单',
}

// SM-2 算法状态
export interface SM2State {
  easinessFactor: number // 初始 2.5, 最低 1.3
  repetitions: number    // 已成功复习次数
  interval: number       // 上次到本次的间隔天数
}

// 每次复习的评估记录
export interface MasteryRecord {
  date: string           // YYYY-MM-DD
  level: MasteryLevel
  quality: number        // SM-2 quality (0-5)
  source: 'manual' | 'ai'
  aiReason?: string      // AI 评估时的理由
}

// 单道题目,有自己的 FSRS 状态和评估历史
export interface StudyQuestion {
  id: string                      // UUID
  text: string                    // 题目文本
  referenceAnswer?: string        // 参考答案(可选)
  fsrs: FSRSCardState             // 独立的 FSRS 卡片状态
  masteryHistory: MasteryRecord[] // 本题的评估历史
}

// 学习任务的学习专属数据
export interface StudySession {
  subject: string                // 主题("GRE List 1" / "计算机八股文")
  materialText?: string          // 学习材料原文 (MD / 纯文本) —— 老路径,新任务应走 knowledgeRef
  materialFileName?: string      // 原始文件名(可选)

  // ---- 新版:关联到知识库的某个具体知识点 ----
  // 指向 KnowledgePoint.id,ReviewDialog 会按知识点做问答(直接展示 question/answer)
  knowledgeRef?: string

  // ---- 题目列表(可选,有题目时走 AI 问答模式) ----
  questions?: StudyQuestion[]

  // ---- Ebbinghaus 相关(可选) ----
  // 2026-07 起首推 FSRS(ts-fsrs), 老数据里的 sm2 字段保留,兼容存量任务
  ebbinghaus?: {
    enabled: true
    studyGroupId: string         // 同一学习计划的所有复习任务共享此 ID
    originTaskId: string         // 首次学习的任务 ID (复习任务反向指向它)
    reviewIndex: number          // 第几次复习 (0=首学, 1=第1次复习...)
    fsrs?: FSRSCardState         // 新版:FSRS 卡片状态(首推)
    sm2?: SM2State               // 老版:SM-2 状态(仅存量数据仍在用)
    masteryHistory: MasteryRecord[]
    aiSessionId?: string         // 关联的 AI 会话 ID (阶段2/3使用)
  }

  // ---- 知识库合并相关(阶段2.5) ----
  isMerged?: boolean             // 本条已被合并归档
  mergedTo?: string              // 合并到目标 taskId
  mergedFrom?: {                 // 从哪些学习任务合并而来的历史
    taskId: string
    subject: string
    mergedAt: number             // 合并时间戳
  }[]
}

// 默认 SM-2 状态
export function defaultSM2State(): SM2State {
  return {
    easinessFactor: 2.5,
    repetitions: 0,
    interval: 0,
  }
}
