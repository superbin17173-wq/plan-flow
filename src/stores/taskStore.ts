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
        // timed 优先按 startTime 排序,非 timed 排后按 createdAt
        const aTimed = !!(a.startTime && a.endTime)
        const bTimed = !!(b.startTime && b.endTime)
        if (aTimed && !bTimed) return -1
        if (!aTimed && bTimed) return 1
        if (aTimed && bTimed) {
          if (a.startTime !== b.startTime) return a.startTime!.localeCompare(b.startTime!)
          return a.endTime!.localeCompare(b.endTime!)
        }
        return a.createdAt - b.createdAt
      })
  }

  // 按日期范围获取任务
  function getTasksInRange(startDate: string, endDate: string): Task[] {
    return tasks.value
      .filter(t => t.date >= startDate && t.date <= endDate)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        const aTimed = !!(a.startTime && a.endTime)
        const bTimed = !!(b.startTime && b.endTime)
        if (aTimed && !bTimed) return -1
        if (!aTimed && bTimed) return 1
        if (aTimed && bTimed) return a.startTime!.localeCompare(b.startTime!)
        return a.createdAt - b.createdAt
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
      durationMinutes: formData.durationMinutes,
      color: getCategoryColor(formData.category),
      isCompleted: false,
      recurrence: formData.recurrence,
      remindAt: formData.remindAt,
      workout: formData.workout,
      study: formData.study,
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

    // 处理学习任务的艾宾浩斯复习计划
    if (task.study && (task.study as any).__enableEbbinghaus) {
      await generateEbbinghausReviews(task)
    }

    return task
  }

  // 根据首学任务生成后续复习任务链
  async function generateEbbinghausReviews(originTask: Task): Promise<void> {
    if (!originTask.study) return
    const { initialReviewSchedule, addDays: _ } = await import('../utils/sm2')
    const { defaultSM2State } = await import('../types/study')

    const studyGroupId = uuidv4()
    const aiSessionId = uuidv4() // 所有复习任务共享同一个 AI 会话
    const reviewDates = initialReviewSchedule(originTask.date, 5)

    // 更新原任务的 study.ebbinghaus 字段
    const originIndex = tasks.value.findIndex(t => t.id === originTask.id)
    if (originIndex >= 0) {
      const study = { ...originTask.study }
      delete (study as any).__enableEbbinghaus
      study.ebbinghaus = {
        enabled: true,
        studyGroupId,
        originTaskId: originTask.id,
        reviewIndex: 0,
        sm2: defaultSM2State(),
        masteryHistory: [],
        aiSessionId,
      }
      const updated: Task = { ...tasks.value[originIndex], study, updatedAt: Date.now() }
      await dbUpdateTask(updated)
      tasks.value[originIndex] = updated
    }

    // 生成后续复习任务
    for (let i = 0; i < reviewDates.length; i++) {
      const reviewTask: Task = {
        id: uuidv4(),
        title: `🔁 复习:${originTask.study.subject}`,
        description: `第 ${i + 1} 次复习(首学于 ${originTask.date})`,
        category: 'study',
        priority: 'medium',
        date: reviewDates[i],
        startTime: originTask.startTime,
        endTime: originTask.endTime,
        durationMinutes: originTask.durationMinutes,
        color: getCategoryColor('study'),
        isCompleted: false,
        study: {
          subject: originTask.study.subject,
          materialText: originTask.study.materialText,
          materialFileName: originTask.study.materialFileName,
          ebbinghaus: {
            enabled: true,
            studyGroupId,
            originTaskId: originTask.id,
            reviewIndex: i + 1,
            sm2: defaultSM2State(),
            masteryHistory: [],
            aiSessionId,
          },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await dbAddTask(reviewTask)
      tasks.value.push(reviewTask)
    }
  }

  // 提交一次复习评估:更新 SM-2 状态,调整下一次复习日期
  async function submitReviewAssessment(
    taskId: string,
    mastery: import('../types/study').MasteryLevel,
    aiReason?: string
  ): Promise<void> {
    const { sm2, addDays } = await import('../utils/sm2')
    const { MASTERY_TO_QUALITY } = await import('../types/study')

    const idx = tasks.value.findIndex(t => t.id === taskId)
    if (idx < 0) return
    const task = tasks.value[idx]
    if (!task.study?.ebbinghaus) return

    const quality = MASTERY_TO_QUALITY[mastery]
    const newSm2 = sm2(task.study.ebbinghaus.sm2, quality)
    const record: import('../types/study').MasteryRecord = {
      date: task.date,
      level: mastery,
      quality,
      source: aiReason ? 'ai' : 'manual',
      aiReason,
    }

    // 更新当前复习任务
    const updated: Task = {
      ...task,
      isCompleted: true,
      study: {
        ...task.study,
        ebbinghaus: {
          ...task.study.ebbinghaus,
          sm2: newSm2,
          masteryHistory: [...task.study.ebbinghaus.masteryHistory, record],
        },
      },
      updatedAt: Date.now(),
    }
    await dbUpdateTask(updated)
    tasks.value[idx] = updated

    // 调整下一次未完成的复习任务日期
    const groupId = task.study.ebbinghaus.studyGroupId
    const nextReview = tasks.value
      .filter(t =>
        t.study?.ebbinghaus?.studyGroupId === groupId &&
        !t.isCompleted &&
        t.id !== task.id
      )
      .sort((a, b) => a.date.localeCompare(b.date))[0]

    if (nextReview) {
      const newDate = addDays(task.date, newSm2.interval || 1)
      const nextIdx = tasks.value.findIndex(t => t.id === nextReview.id)
      const nextUpdated: Task = {
        ...nextReview,
        date: newDate,
        study: {
          ...nextReview.study!,
          ebbinghaus: {
            ...nextReview.study!.ebbinghaus!,
            sm2: newSm2,
          },
        },
        updatedAt: Date.now(),
      }
      await dbUpdateTask(nextUpdated)
      tasks.value[nextIdx] = nextUpdated
    }
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
    // 时间字段允许显式清空(切换到"全天"模式时需要清 startTime/endTime,切换到"定时"时需清 durationMinutes)
    // 用属性存在与否作为"是否想修改该字段"的信号
    if ('startTime' in formData) task.startTime = formData.startTime
    if ('endTime' in formData) task.endTime = formData.endTime
    if ('durationMinutes' in formData) task.durationMinutes = formData.durationMinutes
    if (formData.recurrence !== undefined) task.recurrence = formData.recurrence
    if (formData.remindAt !== undefined) task.remindAt = formData.remindAt
    if (formData.workout !== undefined) task.workout = formData.workout
    if (formData.study !== undefined) task.study = formData.study
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

  // 批量创建任务(用于 Excel 导入 / 批量生成)
  async function createTasksBulk(items: TaskFormData[]): Promise<number> {
    const created: Task[] = []
    for (const formData of items) {
      const task: Task = {
        id: uuidv4(),
        title: formData.title,
        description: formData.description,
        category: formData.category,
        priority: formData.priority,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        durationMinutes: formData.durationMinutes,
        color: getCategoryColor(formData.category),
        isCompleted: false,
        recurrence: formData.recurrence,
        remindAt: formData.remindAt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await dbAddTask(task)
      created.push(task)
    }
    tasks.value.push(...created)
    return created.length
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
    createTasksBulk,
    editTask,
    toggleComplete,
    removeTask,
    dragUpdateTaskTime,
    searchTasks,
    filterTasks,
    submitReviewAssessment,
    todayStats,
    weekStats,
    monthStats,
    categoryStats,
  }
})