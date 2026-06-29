// IndexedDB 操作封装
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Task, Category, Settings } from '../types'
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
}

const DB_NAME = 'PlanFlowDB'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<PlanFlowDB>> | null = null

export async function getDB(): Promise<IDBPDatabase<PlanFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PlanFlowDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 任务存储
        const taskStore = db.createObjectStore('tasks', { keyPath: 'id' })
        taskStore.createIndex('by-date', 'date')
        taskStore.createIndex('by-category', 'category')

        // 分类存储
        db.createObjectStore('categories', { keyPath: 'id' })

        // 设置存储
        db.createObjectStore('settings', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
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
  await db.put('tasks', task)
}

export async function updateTask(task: Task): Promise<void> {
  const db = await getDB()
  await db.put('tasks', task)
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
  const settingsKeys = ['theme', 'defaultView', 'defaultCategory', 'weekStartsOn', 'timeFormat', 'notificationsEnabled', 'defaultRemindAt']
  const result: Partial<Settings> = {}

  for (const key of settingsKeys) {
    const stored = await db.get('settings', key)
    if (stored) {
      const val = stored.value
      // 类型转换
      if (key === 'weekStartsOn' || key === 'defaultRemindAt') {
        (result as Record<string, number>)[key] = Number(val)
      } else if (key === 'notificationsEnabled') {
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
      await db.put('tasks', task)
    }
  }

  // 导入分类
  if (data.categories) {
    for (const cat of data.categories) {
      await db.put('categories', cat)
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
  const tx = db.transaction(['tasks', 'categories', 'settings'], 'readwrite')
  await tx.objectStore('tasks').clear()
  await tx.objectStore('categories').clear()
  await tx.objectStore('settings').clear()
  await tx.done
}