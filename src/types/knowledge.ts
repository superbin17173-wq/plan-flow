// 知识库(Knowledge Base)类型定义
// 用户希望:上传知识文件 → 提取知识点 → 专门页面做问答测试
// 与旧的「学习任务 study.materialText」路径完全替代(新路径不再用 materialText)

// 掌握度:三档自评(用户在问答页答完后自己选)
export type KnowledgeMastery = 'unseen' | 'learning' | 'mastered'

// 知识文件:一个上传文件 = 一条记录
export interface KnowledgeFile {
  id: string
  title: string                    // 显示标题(可被用户改名)
  sourceFileName?: string          // 上传时的原始文件名
  content: string                  // 全文(md/txt/pdf 解析后)
  extractedAt?: number             // 最后一次跑提取的时间
  createdAt: number
  updatedAt: number
}

// 知识点:从知识文件里抽出来的一个原子 Q&A
export interface KnowledgePoint {
  id: string
  fileId: string                   // 归属文件
  order: number                    // 在该文件中的顺序(从 0 开始,稳定)
  question: string                 // 问题(标题行)
  answer: string                   // 答案(问题下面的正文)
  sourceExcerpt?: string           // 原文片段(可选,溯源用)
  mastery: KnowledgeMastery        // 三档自评
  reviewCount: number              // 累计问过多少次
  lastReviewDate?: string          // YYYY-MM-DD,最后一次问答的日期
  createdAt: number
  updatedAt: number
}

// 上传文件后、抽取前:让用户编辑的中间态(ExtractDialog 内部用)
export interface KnowledgePointDraft {
  id: string                       // 前端临时 id
  question: string
  answer: string
  // 标记用户是否改过 / 想删掉
  dirty?: boolean
  deleted?: boolean
}

// 给统计/仪表盘用
export interface KnowledgeFileStats {
  total: number
  unseen: number
  learning: number
  mastered: number
  lastReviewedDate?: string
}
