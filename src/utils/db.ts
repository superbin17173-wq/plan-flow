// IndexedDB 操作封装
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Task, Category, Settings, WorkoutEntry, MeasurementEntry, MealEntry, AIMessage } from '../types'
import type { AIMemory } from '../types/memory'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../types'

interface SettingRow {
    key: string
    value: string
  }

interface PlanFlowDB extends DBSchema {
  tasks: {
    key: string
    value: Task
    indexes: { 'by-date': string; 'by-category': string }
  }
  categories: {
    key: string
    value: Category
  }
  settings: {
    key: string
    value: SettingRow
  }
  workouts: {
    key: string
    value: WorkoutEntry
    indexes: { 'by-date': string }
  }
  measurements: {
    key: string
    value: MeasurementEntry
    indexes: { 'by-date': string }
  }
  meals: {
    key: string
    value: MealEntry
    indexes: { 'by-date': string }
  }
  ai_messages: {
    key: string
    value: AIMessage
    indexes: { 'by-createdAt': number; 'by-session': string }
  }
  ai_memories: {
    key: string
    value: AIMemory
    indexes: { 'by-session': string; 'by-importance': number; 'by-createdAt': number }
  }
}

const DB_NAME = 'PlanFlowDB'
const DB_VERSION = 5

let dbPromise: Promise<IDBPDatabase<PlanFlowDB>> | null = null

export async function getDB(): Promise<IDBPDatabase<PlanFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PlanFlowDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' })
          taskStore.createIndex('by-date', 'date')
          taskStore.createIndex('by-category', 'category')

          db.createObjectStore('categories', { keyPath: 'id' })
          db.createObjectStore('settings', { keyPath: 'key' })
        }

        if (oldVersion < 2) {
          const w = db.createObjectStore('workouts', { keyPath: 'id' })
          w.createIndex('by-date', 'date')

          const m = db.createObjectStore('measurements', { keyPath: 'id' })
          m.createIndex('by-date', 'date')

          const ml = db.createObjectStore('meals', { keyPath: 'id' })
          ml.createIndex('by-date', 'date')
        }

        if (oldVersion < 3) {
          const ai = db.createObjectStore('ai_messages', { keyPath: 'id' })
          ai.createIndex('by-createdAt', 'createdAt')
          ai.createIndex('by-session', 'sessionId')
        }

        if (oldVersion < 5) {
          const mem = db.createObjectStore('ai_memories', { keyPath: 'id' })
          mem.createIndex('by-session', 'sessionId')
          mem.createIndex('by-importance', 'importance')
          mem.createIndex('by-createdAt', 'createdAt')
        }
      },
    })
  }
  return dbPromise
}

// V4 升级：为已存在的 ai_messages store 添加 by-session 索引
// 由于 idb 的 upgrade 在 transaction 内，无法在后续版本添加索引到已创建的 store
// 解决方案：检测索引缺失时，关闭数据库，重新打开并删除重建 store
export async function ensureSessionIndex(): Promise<void> {
  const db = await getDB()
  const store = db.transaction('ai_messages').objectStore('ai_messages')
  if (!store.indexNames.contains('by-session')) {
    // 索引不存在，需要手动处理（由于 idb 限制，这里暂时用内存过滤替代）
    console.warn('ai_messages.by-session 索引缺失，将使用内存过滤')
  }
}

// 初始化数据库（添加默认分类和设置）
export async function initDB(): Promise<void> {
  const db = await getDB()

  // 检查是否已有分类
  const existingCategories = await db.getAll('categories')
  if (existingCategories.length === 0) {
    // 添加默认分类
    for (const cat of DEFAULT_CATEGORIES) {
      await db.put('categories', cat)
    }
  }

  // 检查是否已有设置
  const existingSettings = await db.get('settings', 'theme')
  if (!existingSettings) {
    // 添加默认设置
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await db.put('settings', { key, value: String(value) })
    }
  }
}

// 任务操作
export async function getAllTasks(): Promise<Task[]> {
  const db = await getDB()
  return db.getAll('tasks')
}

export async function getTasksByDate(date: string): Promise<Task[]> {
  const db = await getDB()
  return db.getAllFromIndex('tasks', 'by-date', date)
}

export async function getTasksByDateRange(startDate: string, endDate: string): Promise<Task[]> {
  const db = await getDB()
  const allTasks = await db.getAll('tasks')
  return allTasks.filter(task => task.date >= startDate && task.date <= endDate)
}

export async function addTask(task: Task): Promise<void> {
  const db = await getDB()
  // 深拷贝以去除Vue reactive proxy，避免IndexedDB序列化失败
  // 注意: structuredClone 无法克隆Vue reactive proxy，改用JSON序列化
  await db.put('tasks', JSON.parse(JSON.stringify(task)))
}

export async function updateTask(task: Task): Promise<void> {
  const db = await getDB()
  // 深拷贝以去除Vue reactive proxy
  await db.put('tasks', JSON.parse(JSON.stringify(task)))
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('tasks', id)
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  const db = await getDB()
  return db.get('tasks', id)
}

// 分类操作
export async function getAllCategories(): Promise<Category[]> {
  const db = await getDB()
  return db.getAll('categories')
}

export async function addCategory(category: Category): Promise<void> {
  const db = await getDB()
  await db.put('categories', category)
}

// 设置操作
export async function getSettings(): Promise<Settings> {
  const db = await getDB()
  const settingsKeys = ['theme', 'defaultView', 'defaultCategory', 'weekStartsOn', 'timeFormat', 'notificationsEnabled', 'defaultRemindAt', 'pushplusEnabled', 'pushplusToken', 'pushplusTopic', 'profileHeight', 'profileWeight', 'profileAge', 'profileGender', 'profileActivity', 'aiEnabled', 'aiApiKey', 'aiModel', 'aiHistoryLimitMB', 'doubaoEnabled', 'doubaoApiKey', 'doubaoModel']
  const result: Partial<Settings> = {}

  for (const key of settingsKeys) {
    const stored = await db.get('settings', key)
    if (stored) {
      const val = stored.value
      // 类型转换
      if (key === 'weekStartsOn' || key === 'defaultRemindAt' || key === 'profileHeight' || key === 'profileWeight' || key === 'profileAge' || key === 'aiHistoryLimitMB') {
        (result as Record<string, number>)[key] = Number(val)
      } else if (key === 'notificationsEnabled' || key === 'pushplusEnabled' || key === 'aiEnabled' || key === 'doubaoEnabled') {
        (result as Record<string, boolean>)[key] = val === 'true'
      } else {
        (result as Record<string, string>)[key] = val
      }
    }
  }

  return { ...DEFAULT_SETTINGS, ...result } as Settings
}

export async function updateSetting(key: keyof Settings, value: string | number | boolean): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key, value: String(value) })
}

// 导出数据
export async function exportData(): Promise<{ tasks: Task[]; categories: Category[]; settings: Settings }> {
  const tasks = await getAllTasks()
  const categories = await getAllCategories()
  const settings = await getSettings()
  return { tasks, categories, settings }
}

// 导入数据
export async function importData(data: { tasks?: Task[]; categories?: Category[]; settings?: Partial<Settings> }, mode: 'merge' | 'overwrite' = 'merge'): Promise<void> {
  const db = await getDB()

  if (mode === 'overwrite') {
    // 清空现有数据
    const tx = db.transaction(['tasks', 'categories', 'settings'], 'readwrite')
    await tx.objectStore('tasks').clear()
    await tx.objectStore('categories').clear()
    await tx.objectStore('settings').clear()
    await tx.done
  }

  // 导入任务
  if (data.tasks) {
    for (const task of data.tasks) {
      await db.put('tasks', JSON.parse(JSON.stringify(task)))
    }
  }

  // 导入分类
  if (data.categories) {
    for (const cat of data.categories) {
      await db.put('categories', JSON.parse(JSON.stringify(cat)))
    }
  }

  // 导入设置
  if (data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      await db.put('settings', { key, value: String(value) })
    }
  }
}

// 清空所有数据
export async function clearAllData(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['tasks', 'categories', 'settings', 'workouts', 'measurements', 'meals'], 'readwrite')
  await tx.objectStore('tasks').clear()
  await tx.objectStore('categories').clear()
  await tx.objectStore('settings').clear()
  await tx.objectStore('workouts').clear()
  await tx.objectStore('measurements').clear()
  await tx.objectStore('meals').clear()
  await tx.done
}

// 健身训练
export async function getAllWorkouts(): Promise<WorkoutEntry[]> {
  const db = await getDB()
  return db.getAll('workouts')
}
export async function putWorkout(w: WorkoutEntry): Promise<void> {
  const db = await getDB()
  await db.put('workouts', JSON.parse(JSON.stringify(w)))
}
export async function deleteWorkout(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('workouts', id)
}

// 体重与身体指标
export async function getAllMeasurements(): Promise<MeasurementEntry[]> {
  const db = await getDB()
  return db.getAll('measurements')
}
export async function putMeasurement(m: MeasurementEntry): Promise<void> {
  const db = await getDB()
  await db.put('measurements', JSON.parse(JSON.stringify(m)))
}
export async function deleteMeasurement(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('measurements', id)
}

// 饮食
export async function getAllMeals(): Promise<MealEntry[]> {
  const db = await getDB()
  return db.getAll('meals')
}
export async function putMeal(m: MealEntry): Promise<void> {
  const db = await getDB()
  await db.put('meals', JSON.parse(JSON.stringify(m)))
}
export async function deleteMeal(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('meals', id)
}