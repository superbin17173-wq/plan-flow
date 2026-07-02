// BMR / TDEE / 训练消耗 / 饮食计算
import type { Task, WorkoutExercise, MeasurementEntry, Settings } from '../types'

// 部位默认 MET (代谢当量,基于 Compendium of Physical Activities)
export const MET_BY_GROUP: Record<string, number> = {
  '胸': 6.0,
  '背': 6.0,
  '腿': 6.5,
  '肩': 5.0,
  '臂': 5.0,
  '核心': 4.0,
  '有氧': 8.0, // 中等强度有氧默认
  '其他': 5.0,
}

// 活动系数(乘以 BMR 得 TDEE)
export const ACTIVITY_FACTOR: Record<Settings['profileActivity'], number> = {
  sedentary: 1.2, // 久坐,几乎不运动
  light: 1.375, // 每周 1-3 次轻度
  moderate: 1.55, // 每周 3-5 次中等
  active: 1.725, // 每周 6-7 次
  very_active: 1.9, // 体力工作 / 每天两次训练
}

export const ACTIVITY_LABEL: Record<Settings['profileActivity'], string> = {
  sedentary: '久坐(几乎不动)',
  light: '轻度(每周 1-3 次)',
  moderate: '中等(每周 3-5 次)',
  active: '较高(每周 6-7 次)',
  very_active: '很高(体力劳动)',
}

// 取用户当前体重:优先最新体重记录,否则用 profile 里的,再否则 70kg
export function currentWeight(settings: Settings, latestMeasurement?: MeasurementEntry): number {
  if (latestMeasurement?.weight && latestMeasurement.weight > 0) return latestMeasurement.weight
  if (settings.profileWeight > 0) return settings.profileWeight
  return 70
}

// Mifflin-St Jeor 公式计算 BMR (kcal/日)
export function calcBMR(settings: Settings, latestMeasurement?: MeasurementEntry): number | null {
  const w = latestMeasurement?.weight && latestMeasurement.weight > 0
    ? latestMeasurement.weight
    : settings.profileWeight
  const h = settings.profileHeight
  const age = settings.profileAge
  const gender = settings.profileGender
  if (!w || !h || !age || !gender) return null
  const base = 10 * w + 6.25 * h - 5 * age
  return Math.round(gender === 'male' ? base + 5 : base - 161)
}

// TDEE = BMR × 活动系数
export function calcTDEE(settings: Settings, latestMeasurement?: MeasurementEntry): number | null {
  const bmr = calcBMR(settings, latestMeasurement)
  if (bmr === null) return null
  return Math.round(bmr * ACTIVITY_FACTOR[settings.profileActivity])
}

// 计算一个动作在一次训练中的近似 MET(默认取部位默认,后续可根据重量/次数微调)
function metForExercise(ex: WorkoutExercise): number {
  return MET_BY_GROUP[ex.muscleGroup || '其他'] ?? 5.0
}

// 计算一个训练任务(fitness task)预估消耗 kcal
//   kcal = MET × 体重(kg) × 时长(小时)
// 时长以任务的 startTime → endTime 为准,若不可用则用总组数 × 3 分钟兜底
export function calcTaskCalories(task: Task, weightKg: number): number {
  if (!task.workout || task.workout.length === 0) return 0

  const durationMin = taskDurationMin(task)
  const totalSets = task.workout.reduce((s, e) => s + e.sets.length, 0)
  const effectiveMin = durationMin > 0 ? durationMin : Math.max(15, totalSets * 3)

  // 各动作按其 MET 平均加权,乘总时长
  let weightedMet = 0
  let sets = 0
  for (const ex of task.workout) {
    const met = metForExercise(ex)
    for (const _s of ex.sets) {
      weightedMet += met
      sets++
    }
  }
  if (sets === 0) return 0
  const avgMet = weightedMet / sets
  return Math.round(avgMet * weightKg * (effectiveMin / 60))
}

function taskDurationMin(task: Task): number {
  const [sh, sm] = task.startTime.split(':').map(Number)
  const [eh, em] = task.endTime.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

// 汇总某日所有训练任务的消耗
export function sumDailyBurn(tasks: Task[], date: string, weightKg: number): number {
  let total = 0
  for (const t of tasks) {
    if (t.category === 'fitness' && t.date === date && t.workout) {
      total += calcTaskCalories(t, weightKg)
    }
  }
  return total
}
