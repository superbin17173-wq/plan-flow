// 健身、体重、饮食记录类型

export interface WorkoutSet {
  reps: number
  weight?: number // kg,自重可为空
  duration?: number // 秒(有氧/静态动作)
  distance?: number // km(有氧)
  rpe?: number // 感知强度 1-10
}

export interface WorkoutExercise {
  id: string
  name: string
  muscleGroup?: string // 部位:胸/背/腿/肩/臂/核心/有氧/其他
  sets: WorkoutSet[]
}

export interface WorkoutEntry {
  id: string
  date: string // YYYY-MM-DD
  startTime?: string // HH:mm
  durationMin?: number
  exercises: WorkoutExercise[]
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface MeasurementEntry {
  id: string
  date: string // YYYY-MM-DD
  weight?: number // kg
  bodyFat?: number // %
  chest?: number
  waist?: number
  hip?: number
  arm?: number
  thigh?: number
  notes?: string
  createdAt: number
  updatedAt: number
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface MealItem {
  name: string
  amount?: string // "1 份/200g"
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

export interface MealEntry {
  id: string
  date: string
  mealType: MealType
  time?: string
  items: MealItem[]
  totalCalories?: number
  notes?: string
  createdAt: number
  updatedAt: number
}

export const MUSCLE_GROUPS = ['胸', '背', '肩', '腿', '臂', '核心', '有氧', '其他'] as const

// 每个部位常用动作(下拉选项)
export const EXERCISES_BY_GROUP: Record<string, string[]> = {
  '胸': ['卧推', '上斜卧推', '下斜卧推', '哑铃卧推', '哑铃飞鸟', '器械夹胸', '双杠臂屈伸', '俯卧撑'],
  '背': ['引体向上', '高位下拉', '坐姿划船', '俯身杠铃划船', '单臂哑铃划船', 'T杠划船', '硬拉', '直臂下压'],
  '肩': ['杠铃推举', '哑铃推举', '阿诺德推举', '侧平举', '前平举', '反向飞鸟', '面拉', '耸肩'],
  '腿': ['深蹲', '腿举', '罗马尼亚硬拉', '腿弯举', '腿屈伸', '箭步蹲', '保加利亚分腿蹲', '小腿提踵', '臀推'],
  '臂': ['杠铃弯举', '哑铃弯举', '锤式弯举', '集中弯举', '三头下压', '窄距卧推', '绳索三头', '仰卧臂屈伸'],
  '核心': ['卷腹', '平板支撑', '悬垂举腿', '俄罗斯转体', '仰卧起坐', '臀桥', '死虫', '登山者'],
  '有氧': ['跑步', '快走', '椭圆机', '划船机', '动感单车', '跳绳', '游泳', 'HIIT'],
  '其他': ['自定义'],
}

// 重量下拉预设(kg),0 表示自重
export const WEIGHT_OPTIONS = [
  0,
  2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50,
  55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
  110, 120, 130, 140, 150, 160, 180, 200,
]

// 次数下拉预设
export const REP_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 20, 25, 30, 40, 50, 60, 80, 100]

// 每个部位默认重量(新增一组时的初始值)
export const DEFAULT_WEIGHT_BY_GROUP: Record<string, number> = {
  '胸': 40, '背': 40, '肩': 15, '腿': 60, '臂': 15,
  '核心': 0, '有氧': 0, '其他': 20,
}

// 每个部位默认次数
export const DEFAULT_REPS_BY_GROUP: Record<string, number> = {
  '胸': 10, '背': 10, '肩': 12, '腿': 10, '臂': 12,
  '核心': 15, '有氧': 20, '其他': 10,
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

// 汇总一次训练的总容量(kg × reps)
export function calcWorkoutVolume(w: WorkoutEntry): number {
  let vol = 0
  for (const ex of w.exercises) {
    for (const s of ex.sets) {
      if (s.weight != null && s.reps != null) vol += s.weight * s.reps
    }
  }
  return vol
}

// 汇总一餐总热量(优先 totalCalories,否则 items 累加)
export function calcMealCalories(m: MealEntry): number {
  if (m.totalCalories != null) return m.totalCalories
  return m.items.reduce((s, it) => s + (it.calories || 0), 0)
}
