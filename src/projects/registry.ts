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
]
