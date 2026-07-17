// 八股文专用解析器
// 从 src/data/八股文/*.md 文件中提取 Q&A 对
// 支持两种主要格式:
//   格式 A (候选人式): MySQL/Redis/SSM/微服务/消息中间件
//     ##### 问题 → **候选人**: 答案
//   格式 B (教程星级式): 多线程/常见集合/JVM/设计模式
//     ### 问题 → 难易/频率星级 → 讲解 → **参考回答** → 精简答案
//   格式 C (场景混合式): 技术场景
//     ### 问题 → 概述/详细/回答要点

export interface BaguQA {
  question: string
  answer: string
}

// 去除 markdown 中的飞书/内部图片链接 (外链已失效)
function stripBrokenImages(text: string): string {
  return text.replace(/!\[Image\]\(https:\/\/internal-api-drive-stream[^)]*\)/g, '').trim()
}

// 去除候选人前缀的各种变体
function stripCandidatePrefix(text: string): string {
  // 匹配 **候选人**： / **候****选人**： / **候选人:** 等
  return text.replace(/^\*\*候\*{0,2}选\*{0,2}人\*{0,2}\*\*\s*[：:]\s*/m, '').trim()
}

// 清理 markdown 加粗标记中的零宽碎片 (如 **候****选人** → 候选人)
function cleanFragmentedBold(text: string): string {
  // **A****B** → **AB**
  return text.replace(/\*\*\s*\*\*/g, '')
}

// 去除标题中的 markdown 加粗标记
function cleanHeaderTitle(title: string): string {
  let t = title
  // 去掉 **xxx** 标记
  t = t.replace(/\*\*/g, '')
  // 去掉转义的反斜杠 (如 \+ \- \. \( \))
  t = t.replace(/\\([+\-.*():_])/g, '$1')
  return t.trim()
}

// 去除难度/频率引用块
function stripRatingBlocks(text: string): string {
  // 匹配 > 难易程度：☆☆ ... > 出现频率：☆☆☆ 整个引用块
  return text
    .replace(/>\s*难易程度[：:].*\n(?:>\s*\n)*>\s*出现频率[：:].*\n(?:>\s*\n)*/g, '')
    .replace(/>\s*难易程度[：:].*\n/g, '')
    .replace(/>\s*出现频率[：:].*\n/g, '')
    .trim()
}

// 提取 "**参考回答**" 之后的精简答案
function extractReferenceAnswer(body: string): string {
  // 匹配 **参考回答** 或 参考回答： 或 参考回答
  const patterns = [
    /\*\*参考回答\*\*\s*\n([\s\S]*?)$/m,
    /参考回答\s*[：:]?\s*\n([\s\S]*?)$/m,
  ]
  for (const pat of patterns) {
    const m = body.match(pat)
    if (m) {
      const answer = m[1].trim()
      if (answer.length > 0) return answer
    }
  }
  return ''
}

// 提取 "**回答要点**" 之后的内容
function extractAnswerPoints(body: string): string {
  const patterns = [
    /\*\*回答要点\*\*\s*\n([\s\S]*?)$/m,
    /回答要点\s*[：:]?\s*\n([\s\S]*?)$/m,
  ]
  for (const pat of patterns) {
    const m = body.match(pat)
    if (m) {
      const answer = m[1].trim()
      if (answer.length > 0) return answer
    }
  }
  return ''
}

// 提取概述部分(技术场景篇)
function extractOverview(body: string): string {
  // 从开头到下一个 #### 或 ### 之前
  const m = body.match(/^([\s\S]*?)(?=^#{2,4}\s)/m)
  if (m) return m[1].trim()
  return body.trim()
}

// =================== 主解析函数 ===================

// 提取 "回答要点" 下的完整内容(包括子标题下的文字)
function extractAnswerPointsFull(body: string): string {
  const patterns = [
    /\*\*回答要点\*\*\s*\n([\s\S]*)$/m,
    /####?\s*回答要点\s*\n([\s\S]*)$/m,
  ]
  for (const pat of patterns) {
    const m = body.match(pat)
    if (m && m[1].trim().length > 0) return m[1].trim()
  }
  return ''
}

// 提取 "概述" 到下一个同级标题之间的内容
function extractOverviewSection(body: string): string {
  const patterns = [
    /\*\*概述\*\*\s*\n([\s\S]*?)(?=^#{2,4}\s)/m,
    /####?\s*概述\s*\n([\s\S]*?)(?=^#{2,4}\s)/m,
  ]
  for (const pat of patterns) {
    const m = body.match(pat)
    if (m && m[1].trim().length > 20) return m[1].trim()
  }
  return ''
}

export function extractBaguPoints(content: string): BaguQA[] {
  const text = content.replace(/\r\n/g, '\n').trim()
  if (!text) return []

  const results: BaguQA[] = []
  const seenQ = new Set<string>()

  function addQA(q: string, a: string) {
    const cleaned = cleanHeaderTitle(q)
    if (!cleaned || cleaned.length < 2) return
    if (seenQ.has(cleaned)) return
    const trimmedA = a.trim()
    if (!trimmedA || trimmedA.length < 5) return
    seenQ.add(cleaned)
    results.push({ question: cleaned, answer: trimmedA })
  }

  // ---- 检测文件格式 ----
  const hasH5 = /^#{5}\s+/m.test(text)
  const hasH3 = /^###\s+/m.test(text)

  // 纯格式 A: 只有 ##### (MySQL/Redis/SSM/微服务/消息中间件)
  if (hasH5 && !hasH3) {
    const sections = splitByHeader(text, /^#{5}\s+.*/gm)
    for (const { title, body } of sections) {
      let answer = body
      answer = stripCandidatePrefix(answer)
      answer = cleanFragmentedBold(answer)
      answer = stripBrokenImages(answer)
      addQA(title, answer)
    }
    return results
  }

  // 格式 B/C 或混合: 按 ### 切分, 再处理内部
  if (hasH3) {
    const sections = splitByHeader(text, /^###\s+.*/gm)
    for (const { title, body } of sections) {
      const q = cleanHeaderTitle(title)
      if (!q || q.length < 2) continue
      // 跳过纯导航/介绍性标题
      if (/^(导学|前言|目录)/.test(q)) continue
      // 跳过纯分类标题 (没有问号的极短标题,且下面没有参考回答)
      const isQuestion = /[？?]/.test(q) || /吗|呢|如何|怎么|什么|哪些|为什么|多少/.test(q)

      let cleaned = body
      cleaned = stripRatingBlocks(cleaned)
      cleaned = stripBrokenImages(cleaned)
      cleaned = cleanFragmentedBold(cleaned)

      // 检查内部是否有 ##### 子问题 (混合格式,如 JVM)
      const subH5 = /^#{5}\s+/m.test(cleaned)
      if (subH5) {
        // 提取每个 ##### 子问题 (Format A 逻辑)
        const subSections = splitByHeader(cleaned, /^#{5}\s+.*/gm)
        let hasSubQA = false
        for (const sub of subSections) {
          let subAnswer = sub.body
          subAnswer = stripCandidatePrefix(subAnswer)
          subAnswer = cleanFragmentedBold(subAnswer)
          subAnswer = stripBrokenImages(subAnswer)
          if (subAnswer.trim().length >= 10) {
            addQA(sub.title, subAnswer)
            hasSubQA = true
          }
        }
        // 如果 ##### 子问题没有产出, 尝试从整个 section 提取
        if (!hasSubQA && isQuestion) {
          let answer = extractReferenceAnswer(cleaned)
          if (!answer) answer = extractAnswerPointsFull(cleaned)
          if (!answer) {
            // 取概述部分
            const overview = extractOverviewSection(cleaned)
            if (overview) answer = overview
          }
          if (!answer) answer = cleaned.trim()
          addQA(title, answer)
        }
        continue
      }

      // 没有 ##### 子问题: Format B/C 逻辑
      // 只跳过明显的纯分类标题(太短且没有任何知识点内容)
      if (!isQuestion && q.length < 3 && !cleaned.includes('参考回答') && !cleaned.includes('回答要点')) {
        // 纯分类标题(2字以下),跳过
        continue
      }

      // 尝试提取精简答案
      let answer = extractReferenceAnswer(cleaned)
      if (!answer) {
        answer = extractAnswerPointsFull(cleaned)
      }
      if (!answer) {
        // 技术场景篇: 合并概述 + 回答要点
        const overview = extractOverviewSection(cleaned)
        const points = extractAnswerPointsFull(cleaned)
        if (overview || points) {
          answer = [overview, points].filter(Boolean).join('\n\n')
        }
      }
      // 兜底: 取清理后的全文 (去掉子标题下的详细代码块)
      if (!answer || answer.length < 10) {
        // 去掉代码块,只保留文字
        let simplified = cleaned.replace(/```[\s\S]*?```/g, '').trim()
        if (simplified.length >= 10) answer = simplified
      }

      addQA(title, answer || '')
    }
    return results
  }

  // 兜底: 按 ## 分割
  if (/^##\s+/m.test(text)) {
    const sections = splitByHeader(text, /^##\s+.*/gm)
    for (const { title, body } of sections) {
      let answer = stripBrokenImages(body).trim()
      answer = stripRatingBlocks(answer)
      answer = cleanFragmentedBold(answer)
      addQA(title, answer)
    }
  }

  return results
}

// 按标题行分割文本,返回 [{title, body}]
function splitByHeader(
  text: string,
  pattern: RegExp,
): Array<{ title: string; body: string }> {
  const lines = text.split('\n')
  const sections: Array<{ title: string; body: string }> = []
  let currentTitle = ''
  let currentLines: string[] = []

  for (const line of lines) {
    if (pattern.test(line)) {
      // 保存前一个 section
      if (currentTitle) {
        sections.push({ title: currentTitle, body: currentLines.join('\n') })
      }
      // 提取标题文字
      currentTitle = line.replace(/^#+\s+/, '').trim()
      currentLines = []
      // 重置 regex lastIndex
      pattern.lastIndex = 0
    } else {
      currentLines.push(line)
    }
  }
  // 保存最后一个
  if (currentTitle) {
    sections.push({ title: currentTitle, body: currentLines.join('\n') })
  }

  return sections
}

// 预览:返回数量和前几条
export function previewBaguExtraction(content: string): { count: number; samples: BaguQA[] } {
  const all = extractBaguPoints(content)
  return { count: all.length, samples: all.slice(0, 5) }
}
