// 认知训练(Cognitive Construction)类型定义
// 目标:帮助用户主动构建和提升认知水平
// 核心机制:决策日记 + 思维挑战 + 认知偏差自检

// 决策日记条目
export interface DecisionEntry {
  id: string
  title: string                      // 决策标题,如"毕业方向选择"
  context: string                    // 背景描述:当时面临什么情况
  reasoning: string                  // 我的推理:为什么这么选
  expectedOutcome: string            // 预期结果:我认为会怎样
  actualOutcome?: string             // 实际结果:后来发生了什么(复盘时填)
  lessonLearned?: string             // 学到的东西:复盘总结
  status: 'pending' | 'reviewed'     // 待复盘 / 已复盘
  createdAt: number
  updatedAt: number
}

// 思维挑战:记录一次结构化的自我追问
export interface ThinkingChallenge {
  id: string
  topic: string                      // 主题,如"我该不该转行"
  initialBelief: string              // 我最初的信念/想法
  answers: ChallengeAnswer[]         // 对追问的回答
  insight?: string                   // 最终洞察:这次追问让我意识到什么
  createdAt: number
  updatedAt: number
}

// 思维挑战的追问回答
export interface ChallengeAnswer {
  questionId: string                 // 对应的问题 ID
  question: string                   // 问题文本
  answer: string                     // 用户的回答
}

// 认知偏差自检记录
export interface BiasCheck {
  id: string
  biasKey: string                    // 偏差的 key,如 'confirmation-bias'
  recognized: boolean                // 是否意识到自己正在犯
  reflection?: string                // 反思:什么时候犯的
  createdAt: number
}

// 认知训练统计
export interface CognitiveStats {
  totalDecisions: number
  reviewedDecisions: number
  pendingReviews: number
  totalChallenges: number
  recentActivity: number             // 最近 7 天活动次数
}
