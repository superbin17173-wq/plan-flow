// AI 计划汇总
// 绕开 useAIChat 的 tool-loop / 全局 loading / default 会话,
// 直接调 chatWithDeepSeek 返回纯字符串,避免污染主聊天状态。

import type { Task, Plan } from '../types'
import { chatWithDeepSeek, type DeepSeekMessage } from './deepseek'
import { useSettingStore } from '../stores/settingStore'
import { usePlanStore } from '../stores/planStore'
import { useTaskStore } from '../stores/taskStore'
import { getCategoryById } from '../types/category'

// ============================================================================
// 汇总提示词(用户明确要求写在此处;是本 skill 的核心提示词)
// ============================================================================
export const SUMMARY_SYSTEM_PROMPT = `你是 PlanFlow 的「阶段回顾助手」。用户会给你一份 markdown 格式的计划任务清单,你的
唯一职责是把它翻译成一份**结构化的分点回顾报告**——不要提问,不要闲聊,不要生成
新任务。

# 输入约定
用户消息形如:
## 计划: <计划名>  区间: <YYYY-MM-DD>~<YYYY-MM-DD>
### <分类中文名>(共 X 条,完成 Y 条,完成率 Z%)
- [x] YYYY-MM-DD 标题(可能带 subject/muscleGroup/exercises 等附加信息)
- [ ] ...

任务前 [x] 表示已完成,[ ] 表示未完成。附加信息在括号里,你要读懂并用于总结。

# 输出格式(严格 markdown,不要额外前言)
# <计划名> · 阶段回顾

**时间范围**:<start> ~ <end>  **整体完成率**:<综合完成率>%

## 📚 学习模块
- **完成情况**:X / Y 条(N%)
- **主要覆盖主题**:根据 subject 字段聚合,列 3–6 个 bullet,每条给出该主题下完成
  了多少次(例如:「数组类算法:12 题」)
- **进度亮点**:找出连续完成天数最长的 subject、艾宾浩斯复习执行率最高的主题,
  最多 3 条
- **待补齐**:未完成任务按 subject 聚合,最多 5 条,每条附上未完成条数

## 💪 健身模块
- **完成情况**:X / Y 条(N%)
- **部位分布**:按 muscleGroup 聚合完成次数,例如:「胸:6 次 | 背:5 次 | 腿:2 次」
- **训练亮点**:哪个部位/动作累计次数最多,是否形成规律(如连续 4 周每周一练胸)
- **失衡提醒**:哪些部位明显偏少(相对最高部位低于 40%),友好指出

## 🗂 其他分类
把学习/健身之外的分类聚合成一段,列出主要活动即可,不要太细。

## 🎯 综合评估(≤ 120 字)
一段短评,重点回答三件事:
1. 这段时间用户是在推进什么核心目标(从任务标题/分类分布反推)
2. 执行质量如何(完成率 + 稳定性)
3. 下一阶段可以调整的 1 条具体建议

# 硬约束(违反即失败)
1. 不要编造清单里没有的任务、日期、数字。所有百分比必须能从输入算出。
2. 不要给"加油"、"太棒了"这类空话式鼓励。评价要具体、可举证。
3. 如果某个分类整段是空的,直接写"本阶段无相关记录",不要占位。
4. 输出全部使用中文。日期一律 YYYY-MM-DD 格式。
5. 不要输出思考过程、不要复述用户输入、不要 code fence 包裹整段回复。
`

// 将任务附加信息拼成尾巴,例如 "(subject=数组, muscleGroup=胸, 动作=胸推 x2)"
function buildTaskTail(t: Task): string {
  const parts: string[] = []
  if (t.study?.subject) parts.push(`subject=${t.study.subject}`)
  if (t.study?.ebbinghaus) parts.push(`复习第${t.study.ebbinghaus.reviewIndex}次`)
  if (t.workout && t.workout.length) {
    const groups = Array.from(new Set(t.workout.map(w => w.muscleGroup).filter(Boolean)))
    if (groups.length) parts.push(`muscleGroup=${groups.join('/')}`)
    const names = t.workout.map(w => w.name).slice(0, 3).join('/')
    if (names) parts.push(`动作=${names}${t.workout.length > 3 ? '等' : ''}`)
  }
  return parts.length ? `(${parts.join(', ')})` : ''
}

// 分组:学习 / 健身 / 其他
function groupTasks(tasks: Task[]): Record<'学习' | '健身' | '其他', Task[]> {
  const g: Record<'学习' | '健身' | '其他', Task[]> = { 学习: [], 健身: [], 其他: [] }
  for (const t of tasks) {
    if (t.category === 'study') g['学习'].push(t)
    else if (t.category === 'fitness') g['健身'].push(t)
    else g['其他'].push(t)
  }
  return g
}

// 把任务预格式化成 markdown(不让 AI 自己算完成率,减少幻觉)
export function buildSummaryMarkdown(plan: Plan, tasks: Task[]): string {
  const grouped = groupTasks(tasks)
  const lines: string[] = []
  lines.push(`## 计划: ${plan.name}  区间: ${plan.startDate}~${plan.endDate}`)

  const sections: Array<{ key: '学习' | '健身' | '其他'; label: string }> = [
    { key: '学习', label: '学习' },
    { key: '健身', label: '健身' },
    { key: '其他', label: '其他' },
  ]

  for (const s of sections) {
    const list = grouped[s.key].slice().sort((a, b) => a.date.localeCompare(b.date))
    const total = list.length
    const done = list.filter(t => t.isCompleted).length
    const rate = total > 0 ? Math.round((done / total) * 100) : 0

    // 其他分类如果为空,也保留标题,让 AI 明确写"本阶段无相关记录"
    if (s.key === '其他' && total === 0) {
      lines.push(``)
      lines.push(`### ${s.label}(共 0 条,完成 0 条,完成率 0%)`)
      continue
    }

    lines.push(``)
    lines.push(`### ${s.label}(共 ${total} 条,完成 ${done} 条,完成率 ${rate}%)`)
    for (const t of list) {
      const box = t.isCompleted ? '[x]' : '[ ]'
      const cat = getCategoryById(t.category)
      const catTag = s.key === '其他' && cat ? `[${cat.name}] ` : ''
      lines.push(`- ${box} ${t.date} ${catTag}${t.title}${buildTaskTail(t)}`)
    }
  }
  return lines.join('\n')
}

// 生成 AI 汇总(纯字符串)
export async function generatePlanSummary(
  planId: string,
  opts?: { signal?: AbortSignal },
): Promise<string> {
  const settingStore = useSettingStore()
  const s = settingStore.settings

  if (!s.aiEnabled || !s.aiApiKey) {
    throw new Error('请先在设置中启用 AI 助手并填写 DeepSeek API Key')
  }

  const planStore = usePlanStore()
  const taskStore = useTaskStore()

  const plan = planStore.getPlanById(planId)
  if (!plan) throw new Error('找不到该计划')

  // 拉数据:该计划时间范围内、planId 匹配的所有任务
  const tasks = taskStore
    .getTasksInRange(plan.startDate, plan.endDate)
    .filter(t => t.planId === planId)

  if (!tasks.length) {
    // 不发起 AI 请求,直接给出提示
    return `# ${plan.name} · 阶段回顾\n\n**时间范围**:${plan.startDate} ~ ${plan.endDate}\n\n本计划暂无任何关联任务。请先添加模板并展开生成日任务后再来汇总。`
  }

  const userContent = buildSummaryMarkdown(plan, tasks)
  const messages: DeepSeekMessage[] = [
    { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]

  const res = await chatWithDeepSeek({
    apiKey: s.aiApiKey,
    model: s.aiModel || 'deepseek-chat',
    messages,
    temperature: 0.4,
    signal: opts?.signal,
  })

  const content = res.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 未返回有效内容')
  return content
}
