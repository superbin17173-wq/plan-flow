// 用户设置类型定义
export interface Settings {
  theme: 'light' | 'dark' | 'auto'
  defaultView: 'month' | 'week' | 'day'
  defaultCategory: string
  weekStartsOn: 0 | 1 // 0=周日开始, 1=周一开始
  timeFormat: '24h' | '12h'
  notificationsEnabled: boolean
  defaultRemindAt: number // 默认提醒时间（分钟）
}

// 默认设置
export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  defaultView: 'month',
  defaultCategory: 'work',
  weekStartsOn: 1,
  timeFormat: '24h',
  notificationsEnabled: true,
  defaultRemindAt: 15,
}