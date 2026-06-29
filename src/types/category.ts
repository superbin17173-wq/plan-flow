// 分类类型定义
export interface Category {
  id: string
  name: string
  color: string
  icon?: string
  order: number
}

// 预设分类
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work', name: '工作', color: '#81C9D8', icon: 'Briefcase', order: 1 },
  { id: 'study', name: '学习', color: '#7BC47F', icon: 'Reading', order: 2 },
  { id: 'life', name: '生活', color: '#F5A962', icon: 'Home', order: 3 },
  { id: 'health', name: '健康', color: '#E8A0BF', icon: 'Heart', order: 4 },
  { id: 'social', name: '社交', color: '#B8A9C9', icon: 'User', order: 5 },
  { id: 'other', name: '其他', color: '#A8A8A8', icon: 'More', order: 6 },
]

// 根据分类ID获取颜色
export function getCategoryColor(categoryId: string): string {
  const cat = DEFAULT_CATEGORIES.find(c => c.id === categoryId)
  return cat?.color || '#A8A8A8'
}

// 根据分类ID获取分类对象
export function getCategoryById(categoryId: string): Category | undefined {
  return DEFAULT_CATEGORIES.find(c => c.id === categoryId)
}