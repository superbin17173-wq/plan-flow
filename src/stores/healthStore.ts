// 健身/体重/饮食状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { WorkoutEntry, MeasurementEntry, MealEntry, MealType } from '../types'
import {
  getAllWorkouts, putWorkout, deleteWorkout,
  getAllMeasurements, putMeasurement, deleteMeasurement,
  getAllMeals, putMeal, deleteMeal,
} from '../utils/db'

export const useHealthStore = defineStore('health', () => {
  const workouts = ref<WorkoutEntry[]>([])
  const measurements = ref<MeasurementEntry[]>([])
  const meals = ref<MealEntry[]>([])
  const loaded = ref(false)

  async function loadAll() {
    const [w, m, ml] = await Promise.all([
      getAllWorkouts(), getAllMeasurements(), getAllMeals(),
    ])
    workouts.value = w
    measurements.value = m
    meals.value = ml
    loaded.value = true
  }

  // Workouts
  function getWorkoutsByDate(date: string): WorkoutEntry[] {
    return workouts.value.filter(w => w.date === date).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
  }

  async function saveWorkout(w: Omit<WorkoutEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<WorkoutEntry> {
    const now = Date.now()
    const existing = w.id ? workouts.value.find(x => x.id === w.id) : undefined
    const entry: WorkoutEntry = {
      id: w.id || uuidv4(),
      date: w.date,
      startTime: w.startTime,
      durationMin: w.durationMin,
      exercises: w.exercises,
      notes: w.notes,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }
    await putWorkout(entry)
    const idx = workouts.value.findIndex(x => x.id === entry.id)
    if (idx >= 0) workouts.value[idx] = entry
    else workouts.value.push(entry)
    return entry
  }

  async function removeWorkout(id: string) {
    await deleteWorkout(id)
    workouts.value = workouts.value.filter(x => x.id !== id)
  }

  // Measurements
  function getMeasurementByDate(date: string): MeasurementEntry | undefined {
    return measurements.value.find(m => m.date === date)
  }

  async function saveMeasurement(m: Omit<MeasurementEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<MeasurementEntry> {
    const now = Date.now()
    // 同日只保留一条,若存在则更新
    const existing = m.id
      ? measurements.value.find(x => x.id === m.id)
      : measurements.value.find(x => x.date === m.date)
    const entry: MeasurementEntry = {
      id: existing?.id || m.id || uuidv4(),
      date: m.date,
      weight: m.weight,
      bodyFat: m.bodyFat,
      chest: m.chest,
      waist: m.waist,
      hip: m.hip,
      arm: m.arm,
      thigh: m.thigh,
      notes: m.notes,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }
    await putMeasurement(entry)
    const idx = measurements.value.findIndex(x => x.id === entry.id)
    if (idx >= 0) measurements.value[idx] = entry
    else measurements.value.push(entry)
    return entry
  }

  async function removeMeasurement(id: string) {
    await deleteMeasurement(id)
    measurements.value = measurements.value.filter(x => x.id !== id)
  }

  // Meals
  function getMealsByDate(date: string): MealEntry[] {
    const order: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
    return meals.value
      .filter(m => m.date === date)
      .sort((a, b) => {
        const oa = order.indexOf(a.mealType)
        const ob = order.indexOf(b.mealType)
        if (oa !== ob) return oa - ob
        return (a.time || '').localeCompare(b.time || '')
      })
  }

  async function saveMeal(m: Omit<MealEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<MealEntry> {
    const now = Date.now()
    const existing = m.id ? meals.value.find(x => x.id === m.id) : undefined
    const entry: MealEntry = {
      id: m.id || uuidv4(),
      date: m.date,
      mealType: m.mealType,
      time: m.time,
      items: m.items,
      totalCalories: m.totalCalories,
      notes: m.notes,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }
    await putMeal(entry)
    const idx = meals.value.findIndex(x => x.id === entry.id)
    if (idx >= 0) meals.value[idx] = entry
    else meals.value.push(entry)
    return entry
  }

  async function removeMeal(id: string) {
    await deleteMeal(id)
    meals.value = meals.value.filter(x => x.id !== id)
  }

  return {
    workouts, measurements, meals, loaded,
    loadAll,
    getWorkoutsByDate, saveWorkout, removeWorkout,
    getMeasurementByDate, saveMeasurement, removeMeasurement,
    getMealsByDate, saveMeal, removeMeal,
  }
})
