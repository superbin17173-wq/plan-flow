// 任务状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { Task, TaskFormData } from '../types'
import { DEFAULT_TASK } from '../types'
import { getCategoryColor } from '../types/category'
import { getAllTasks, addTask as dbAddTask, updateTask as dbUpdateTask, deleteTask as dbDeleteTask, getTasksByDateRange, initDB } from '../utils/db'
import dayjs from 'dayjs'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const loading = ref(false)

  // 初始化加载所有任务
  async function loadTasks() {
    loading.value = true
    try {
      await initDB()
      tasks.value = await getAllTasks()
    } finally {
      loading.value = false
    }
  }

  // 按日期获取任务
  function getTasksByDate(date: string): Task[] {
    return tasks.value
      .filter(t => t.date === date)
      .sort((a, b) => {
        if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime)
        return a.endTime.localeCompare(b.endTime)
      })
  }

  // 按日期范围获取任务
  function getTasksInRange(startDate: string, endDate: string): Task[] {
    return tasks.value
      .filter(t => t.date >= startDate && t.date <= endDate)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.startTime.localeCompare(b.startTime)
      })
  }

  // 获取某天的未完成任务数
  function getIncompleteCount(date: string): number {
    return tasks.value.filter(t => t.date === date && !t.isCompleted).length
  }

  // 创建新任务
  async function createTask(formData: TaskFormData, date?: string): Promise<Task> {
    const task: Task = {
      id: uuidv4(),
      title: formData.title,
      description: formData.description,
      category: formData.category,
      priority: formData.priority,
      date: date || formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      color: getCategoryColor(formData.category),
      isCompleted: false,
      recurrence: formData.recurrence,
      remindAt: formData.remindAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await dbAddTask(task)
    tasks.value.push(task)

    // 处理重复任务：预生成近3个月的重复实例
    if (task.recurrence) {
      const rangeEnd = dayjs().add(3, 'month').format('YYYY-MM-DD')
      const { generateRecurrenceDates } = await import('../utils/recurrence')
      const dates = generateRecurrenceDates(task.date, task.recurrence, task.date, rangeEnd)

      for (const d of dates) {
        if (d === task.date) continue
        const repeatedTask: Task = {
          ...task,
          id: uuidv4(),
          date: d,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        await dbAddTask(repeatedTask)
        tasks.value.push(repeatedTask)
      }
    }

    return task
  }

  // 更新任务
  async function editTask(id: string, formData: Partial<TaskFormData>): Promise<Task | null> {
    const index = tasks.value.findIndex(t => t.id === id)
    if (index === -1) return null

    const task = { ...tasks.value[index] }
    if (formData.title !== undefined) task.title = formData.title
    if (formData.description !== undefined) task.description = formData.description
    if (formData.category !== undefined) {
      task.category = formData.category
      task.color = getCategoryColor(formData.category)
    }
    if (formData.priority !== undefined) task.priority = formData.priority
    if (formData.date !== undefined) task.date = formData.date
    if (formData.startTime !== undefined) task.startTime = formData.startTime
    if (formData.endTime !== undefined) task.endTime = formData.endTime
    if (formData.recurrence !== undefined) task.recurrence = formData.recurrence
    if (formData.remindAt !== undefined) task.remindAt = formData.remindAt
    task.updatedAt = Date.now()

    await dbUpdateTask(task)
    tasks.value[index] = task
    return task
  }

  // 切换完成状态
  async function toggleComplete(id: string): Promise<void> {
    const index = tasks.value.findIndex(t => t.id === id)
    if (index === -1) return

    const task = { ...tasks.value[index] }
    task.isCompleted = !task.isCompleted
    task.updatedAt = Date.now()

    await dbUpdateTask(task)
    tasks.value[index] = task
  }

  // 删除任务
  async function removeTask(id: string): Promise<void> {
    await dbDeleteTask(id)
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  // 拖拽更新时间
  async function dragUpdateTaskTime(id: string, newStartTime: string, newEndTime: string, newDate?: string): Promise<void> {
    const index = tasks.value.findIndex(t => t.id === id)
    if (index === -1) return

    const task = { ...tasks.value[index] }
    task.startTime = newStartTime
    task.endTime = newEndTime
    if (newDate) task.date = newDate
    task.updatedAt = Date.now()

    await dbUpdateTask(task)
    tasks.value[index] = task
  }

  // 搜索任务
  function searchTasks(query: string): Task[] {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return tasks.value
      .filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  // 按条件筛选任务
  function filterTasks(options: { category?: string; priority?: string; completed?: boolean }): Task[] {
    return tasks.value.filter(t => {
      if (options.category && t.category !== options.category) return false
      if (options.priority && t.priority !== options.priority) return false
      if (options.completed !== undefined && t.isCompleted !== options.completed) return false
      return true
    })
  }

  // 统计数据
  const todayStats = computed(() => {
    const today = dayjs().format('YYYY-MM-DD')
    const todayTasks = tasks.value.filter(t => t.date === today)
    const completed = todayTasks.filter(t => t.isCompleted).length
    return { total: todayTasks.length, completed, rate: todayTasks.length > 0 ? completed / todayTasks.length : 0 }
  })

  const weekStats = computed(() => {
    const startOfWeek = dayjs().startOf('week').format('YYYY-MM-DD')
    const endOfWeek = dayjs().endOf('week').format('YYYY-MM-DD')
    const weekTasks = tasks.value.filter(t => t.date >= startOfWeek && t.date <= endOfWeek)
    const completed = weekTasks.filter(t => t.isCompleted).length
    return { total: weekTasks.length, completed, rate: weekTasks.length > 0 ? completed / weekTasks.length : 0 }
  })

  const monthStats = computed(() => {
    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD')
    const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD')
    const monthTasks = tasks.value.filter(t => t.date >= startOfMonth && t.date <= endOfMonth)
    const completed = monthTasks.filter(t => t.isCompleted).length
    return { total: monthTasks.length, completed, rate: monthTasks.length > 0 ? completed / monthTasks.length : 0 }
  })

  const categoryStats = computed(() => {
    const stats: Record<string, { total: number; completed: number }> = {}
    for (const task of tasks.value) {
      if (!stats[task.category]) stats[task.category] = { total: 0, completed: 0 }
      stats[task.category].total++
      if (task.isCompleted) stats[task.category].completed++
    }
    return stats
  })

  return {
    tasks,
    loading,
    loadTasks,
    getTasksByDate,
    getTasksInRange,
    getIncompleteCount,
    createTask,
    editTask,
    toggleComplete,
    removeTask,
    dragUpdateTaskTime,
    searchTasks,
    filterTasks,
    todayStats,
    weekStats,
    monthStats,
    categoryStats,
  }
})