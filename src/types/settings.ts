// 用户设置类型定义
export interface Settings {
  theme: 'light' | 'dark' | 'auto'
  defaultView: 'month' | 'week' | 'day'
  defaultCategory: string
  weekStartsOn: 0 | 1 // 0=周日开始, 1=周一开始
  timeFormat: '24h' | '12h'
  notificationsEnabled: boolean
  defaultRemindAt: number // 默认提醒时间（分钟）
  // PushPlus 微信推送
  pushplusEnabled: boolean
  pushplusToken: string
  pushplusTopic: string // 群组编码，可选（留空则推送到个人）
  // 个人资料(用于 BMR / TDEE 计算)
  profileHeight: number // cm, 0 表示未填
  profileWeight: number // kg, 0 表示未填(优先使用最新体重记录)
  profileAge: number // 岁, 0 表示未填
  profileGender: 'male' | 'female' | ''
  profileActivity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  // DeepSeek AI 助手
  aiEnabled: boolean
  aiApiKey: string
  aiModel: string // deepseek-chat | deepseek-reasoner
  aiHistoryLimitMB: number // 对话历史本地存储上限（MB）
  // 豆包（Doubao）视觉模型 - 用于食物识图算热量
  doubaoEnabled: boolean
  doubaoApiKey: string
  doubaoModel: string // 用户在火山方舟创建的接入点 ID (ep-xxxxx) 或模型名
}

// 默认设置
export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  defaultView: 'month',
  defaultCategory: 'work',
  weekStartsOn: 1,
  timeFormat: '24h',
  notificationsEnabled: false, // 默认关闭全局推送,任务默认不提醒;需要单独开启的任务在表单里手动打开
  defaultRemindAt: 15,
  pushplusEnabled: false,
  pushplusToken: '',
  pushplusTopic: '',
  profileHeight: 0,
  profileWeight: 0,
  profileAge: 0,
  profileGender: '',
  profileActivity: 'moderate',
  aiEnabled: false,
  aiApiKey: '',
  aiModel: 'deepseek-chat',
  aiHistoryLimitMB: 10,
  doubaoEnabled: false,
  doubaoApiKey: '',
  doubaoModel: '',
}