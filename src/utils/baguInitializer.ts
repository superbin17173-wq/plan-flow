// 八股文预置题库初始化器
// 应用首次启动时,将 10 个八股文 md 文件解析为 Q&A 对,导入知识库
// 幂等:已导入过则自动跳过

import { useKnowledgeStore } from '../stores/knowledgeStore'
import { extractBaguPoints } from './baguExtractor'
import { getBaguFiles } from '../data/八股文'

// 标记来源,用于检测是否已导入
const BAGU_MARKER = 'bagu-preset'

// 全局标志,避免同一次会话重复调用
let initialized = false

/**
 * 初始化八股文题库到知识库
 * 在 App.vue 的 onMounted 中调用
 * 仅在首次启动时执行导入 (后续启动检测到已导入则跳过)
 */
export async function initBaguQuestions(): Promise<void> {
  if (initialized) return
  initialized = true

  const store = useKnowledgeStore()

  // 确保 store 已加载
  if (store.files.length === 0 && !store.loading) {
    await store.loadAll()
  }

  // 检查是否已经导入过 (通过 sourceFileName 匹配)
  const alreadyImported = store.files.some(
    f => f.sourceFileName === BAGU_MARKER,
  )
  if (alreadyImported) return

  try {
    const baguFiles = await getBaguFiles()

    // 创建一条总的 KnowledgeFile 记录
    const file = await store.createFile({
      title: '计算机八股文题库',
      sourceFileName: BAGU_MARKER,
      content: '预置的计算机面试八股文题库,包含 MySQL、Redis、多线程、JVM、Spring、微服务等 10 个专题',
    })

    // 逐个文件解析并导入知识点
    let totalPoints = 0
    for (const bf of baguFiles) {
      const qaPairs = extractBaguPoints(bf.content)
      if (qaPairs.length === 0) continue

      // 给每个 Q&A 加上专题前缀,方便溯源
      const drafts = qaPairs.map(qa => ({
        question: qa.question,
        answer: qa.answer,
      }))

      await store.addPoints(file.id, drafts)
      totalPoints += qaPairs.length
    }

    // 标记提取时间
    await store.editFile(file.id, {
      content: file.content + `\n\n共导入 ${totalPoints} 个知识点`,
    })

    console.log(`[八股文] 导入完成: ${baguFiles.length} 个文件, ${totalPoints} 个知识点`)
  } catch (err) {
    console.error('[八股文] 导入失败:', err)
  }
}
