// 知识库:从 md/txt 文件中提取知识点(Q&A 对)
// 规则简单直接,因为用户会自己把内容"直接分点展示在 md 上"
// 这里只做轻量切分,不做 AI 二次加工
//
// 支持的格式(按优先级):
// 1. 标题 + 正文:    # / ## / ### 开头 → 问题,下面的正文 → 答案
// 2. 粗体问句:      **问题**? / **问题**: → 一行即问题,后面到下一个分隔为止 → 答案
// 3. 带列表符:       - 问题\n  答案  / 1. 问题\n  答案
// 4. 问号结尾的行:   单行以 ? 结尾 → 该行即问题,后面正文 → 答案
// 5. 空行分隔的块:   每块首行 = 问题,剩余 = 答案

import type { KnowledgePointDraft } from '../types'
import { v4 as uuidv4 } from 'uuid'

interface RawBlock {
  question: string
  answer: string
}

function isHeaderLine(line: string): boolean {
  return /^#{1,6}\s+/.test(line.trim())
}

function stripHeader(line: string): string {
  return line.trim().replace(/^#{1,6}\s+/, '').trim()
}

function isQuestionLine(line: string): boolean {
  const t = line.trim()
  return t.endsWith('?') || t.endsWith('?')
}

function isBoldQuestionLine(line: string): boolean {
  // **xxx** 或 **xxx**? 或 **xxx**:
  return /^\*\*.+\*\*[?:：]?\s*$/.test(line.trim())
}

function stripBold(line: string): string {
  // 匹配 **xxx** 可选尾部 ?/:/:
  const m = line.trim().match(/^\*\*(.+?)\*\*([?:：]*)$/)
  if (m) return m[1].trim()
  // 兜底:去首尾 ** 再清标点
  return line.trim().replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/[?:：]+$/, '').trim()
}

function isListItemLine(line: string): boolean {
  const t = line.trim()
  return /^[-*+]\s+/.test(t) || /^\d+[.)]\s+/.test(t)
}

function stripListItem(line: string): string {
  return line.trim().replace(/^[-*+]\s+/, '').replace(/^\d+[.)]\s+/, '').trim()
}

function isBlank(line: string): boolean {
  return line.trim().length === 0
}

// 第一遍:按空行切块,再对每块做解析
function splitIntoBlocks(text: string): string[] {
  const lines = text.split(/\r?\n/)
  const blocks: string[] = []
  let buf: string[] = []

  const flush = () => {
    if (buf.length) {
      blocks.push(buf.join('\n'))
      buf = []
    }
  }

  for (const raw of lines) {
    if (isBlank(raw)) {
      flush()
    } else {
      buf.push(raw)
    }
  }
  flush()
  return blocks
}

function parseBlock(block: string): RawBlock | null {
  const lines = block.split('\n')
  if (!lines.length) return null

  // 跳过代码块 / 引用块(避免误切)
  const first = lines[0]
  if (first.trim().startsWith('```') || first.trim().startsWith('>') || first.trim().startsWith('---')) {
    return null
  }

  // 情况 A:标题行
  if (isHeaderLine(first)) {
    const q = stripHeader(first)
    if (!q) return null
    const answer = lines.slice(1).map(l => l.trim()).filter(Boolean).join('\n')
    return { question: q, answer }
  }

  // 情况 B:粗体问句
  if (isBoldQuestionLine(first)) {
    const q = stripBold(first)
    if (!q) return null
    const answer = lines.slice(1).map(l => l.trim()).filter(Boolean).join('\n')
    return { question: q, answer }
  }

  // 情况 C:问号结尾的问句(单行)
  if (lines.length === 1 && isQuestionLine(first)) {
    return { question: stripListItem(first), answer: '' }
  }

  // 情况 D:列表项(- / 1.) + 可能跨行
  if (isListItemLine(first)) {
    const q = stripListItem(first)
    if (!q) return null
    const rest = lines.slice(1).map(l => l.trim()).filter(Boolean)
    // 如果剩余行又是新的列表项,说明每个列表项都是一个独立点 → 这个 case 不该在这走
    // 而是在上层按"多个列表项 = 多个问题"处理(见 extractKnowledgePoints 外层逻辑)
    if (rest.length && isListItemLine(rest[0])) {
      // 把 first 单独当一条,答案留空,后续块再走外层多列表处理
      return { question: q, answer: '' }
    }
    const answer = rest.join('\n')
    return { question: q, answer }
  }

  // 情况 E:问号结尾 + 后面正文
  if (isQuestionLine(first)) {
    const q = first.trim()
    const answer = lines.slice(1).map(l => l.trim()).filter(Boolean).join('\n')
    return { question: q, answer }
  }

  // 情况 F:兜底——首行当问题,后面当答案(哪怕答案可能空)
  const q = first.trim()
  if (!q) return null
  const answer = lines.slice(1).map(l => l.trim()).filter(Boolean).join('\n')
  return { question: q, answer }
}

// 主入口:从 md/txt 内容提取知识点 draft 列表
export function extractKnowledgePoints(content: string): KnowledgePointDraft[] {
  const text = content.replace(/\r\n/g, '\n').trim()
  if (!text) return []

  const rawBlocks = splitIntoBlocks(text)
  const result: KnowledgePointDraft[] = []
  const seenQ = new Set<string>()

  for (const block of rawBlocks) {
    const parsed = parseBlock(block)
    if (!parsed) continue
    const q = parsed.question.trim()
    const a = parsed.answer.trim()
    if (!q) continue
    // 去重(同标题只保留第一次)
    if (seenQ.has(q)) continue
    seenQ.add(q)
    result.push({
      id: uuidv4(),
      question: q,
      answer: a,
    })
  }

  return result
}

// 预览:仅返回数量和前几条,供 UI 显示
export function previewKnowledgeExtraction(content: string): { count: number; samples: KnowledgePointDraft[] } {
  const all = extractKnowledgePoints(content)
  return { count: all.length, samples: all.slice(0, 5) }
}
