export interface ProjectEntry {
  id: string
  name: string
  description: string
  icon: string
  route: string
  color: string
  status: 'active' | 'wip' | 'planned'
  tags?: string[]
}

export const projects: ProjectEntry[] = [
  {
    id: 'planflow',
    name: 'PlanFlow',
    description: '日历化任务管理 · 提醒 · 健康记录 · AI 助手',
    icon: '📅',
    route: '/planflow',
    color: '#81C9D8',
    status: 'active',
    tags: ['日历', '任务', 'PWA', 'Android'],
  },
  {
    id: 'cognitive',
    name: '认知训练',
    description: '决策日记 · 思维挑战 · 认知偏差自检',
    icon: '🧠',
    route: '/cognitive',
    color: '#A78BFA',
    status: 'active',
    tags: ['认知', '决策', '思维'],
  },
]
