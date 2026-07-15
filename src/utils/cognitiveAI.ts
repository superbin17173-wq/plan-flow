// 认知训练 AI 分析工具
import { chatWithDeepSeek, toDeepSeekMessages, type DeepSeekMessage } from './deepseek'
import type { DecisionEntry, ThinkingChallenge } from '../types'
import { useSettingStore } from '../stores/settingStore'

// 分析决策的推理过程
export async function analyzeDecision(decision: DecisionEntry): Promise<string> {
  const settingStore = useSettingStore()
  const settings = settingStore.settings

  if (!settings.aiEnabled || !settings.aiApiKey) {
    throw new Error('请先在设置中启用 AI 助手并填写 API Key')
  }

  const systemPrompt = `你是一位认知训练教练，帮助用户提升思维质量。你的任务是：
1. 分析用户的决策推理过程
2. 指出可能的逻辑漏洞、认知偏差、或遗漏的考虑
3. 提出 2-3 个深入的问题，帮助用户进一步反思
4. 语气要友好但直接，不要过度恭维

请用中文回复，保持简洁（300字以内）。`

  const userMessage = `请分析我的这个决策：

**决策标题**：${decision.title}

**背景情况**：${decision.context}

**我的推理**：${decision.reasoning}

**预期结果**：${decision.expectedOutcome}

${decision.actualOutcome ? `**实际结果**：${decision.actualOutcome}` : ''}

请指出我的推理中可能存在的问题，并提出深入的问题帮我反思。`

  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  try {
    const response = await chatWithDeepSeek({
      apiKey: settings.aiApiKey,
      model: settings.aiModel || 'deepseek-chat',
      messages,
      temperature: 0.7,
    })

    return response.choices[0]?.message?.content || '分析失败，请重试'
  } catch (error) {
    throw new Error(`AI 分析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

// 分析思维挑战，生成动态追问
export async function generateFollowUpQuestions(
  challenge: ThinkingChallenge,
  userAnswer: string
): Promise<string[]> {
  const settingStore = useSettingStore()
  const settings = settingStore.settings

  if (!settings.aiEnabled || !settings.aiApiKey) {
    throw new Error('请先在设置中启用 AI 助手并填写 API Key')
  }

  const systemPrompt = `你是一位苏格拉底式思维教练。用户正在挑战自己的想法，你需要：
1. 根据用户的回答，生成 2-3 个深入的追问
2. 问题要能暴露思维盲区、逻辑漏洞、或未考虑的假设
3. 问题要具体、有针对性，不要泛泛而谈
4. 语气友好但直接

请用中文输出，每行一个问题，不要编号。`

  const userMessage = `用户正在挑战的想法：${challenge.topic}

用户的初始信念：${challenge.initialBelief}

之前的追问和回答：
${challenge.answers
  .filter(a => a.answer.trim())
  .map(a => `问：${a.question}\n答：${a.answer}`)
  .join('\n\n')}

用户刚才的回答：${userAnswer}

请生成 2-3 个深入的追问。`

  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  try {
    const response = await chatWithDeepSeek({
      apiKey: settings.aiApiKey,
      model: settings.aiModel || 'deepseek-chat',
      messages,
      temperature: 0.8,
    })

    const content = response.choices[0]?.message?.content || ''
    // 按行分割，过滤空行
    return content.split('\n').filter(q => q.trim().length > 5).slice(0, 3)
  } catch (error) {
    throw new Error(`生成追问失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

// 识别可能的认知偏差
export async function identifyCognitiveBiases(
  challenge: ThinkingChallenge
): Promise<string> {
  const settingStore = useSettingStore()
  const settings = settingStore.settings

  if (!settings.aiEnabled || !settings.aiApiKey) {
    throw new Error('请先在设置中启用 AI 助手并填写 API Key')
  }

  const systemPrompt = `你是一位认知心理学专家。分析用户的思维过程，识别可能存在的认知偏差。

常见认知偏差包括：
- 确认偏差：只关注支持自己观点的信息
- 沉没成本谬误：因为已投入而继续坚持
- 现状偏见：倾向于保持现状
- 锚定效应：过度依赖最初信息
- 可得性偏差：越容易想到就越觉得重要
- 达克效应：能力不足却高估自己
- 幸存者偏差：只看成功案例
- 从众效应：因为很多人做就认为对

请分析用户的思维，指出最可能存在的 1-2 个认知偏差，解释为什么，并给出建议。
用中文回复，保持简洁（200字以内）。`

  const userMessage = `请分析这个思维挑战，识别可能的认知偏差：

主题：${challenge.topic}

初始信念：${challenge.initialBelief}

追问回答：
${challenge.answers
  .filter(a => a.answer.trim())
  .map(a => `问：${a.question}\n答：${a.answer}`)
  .join('\n\n')}

${challenge.insight ? `用户的洞察：${challenge.insight}` : ''}

请指出可能存在的认知偏差。`

  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  try {
    const response = await chatWithDeepSeek({
      apiKey: settings.aiApiKey,
      model: settings.aiModel || 'deepseek-chat',
      messages,
      temperature: 0.7,
    })

    return response.choices[0]?.message?.content || '分析失败，请重试'
  } catch (error) {
    throw new Error(`识别偏差失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}
