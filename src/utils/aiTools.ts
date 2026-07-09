// AI 工具集 - 供 DeepSeek Function Calling 使用
// 工具定义采用 OpenAI 兼容格式

import type { TaskFormData, Task, MealItem, MealType } from '../types'
import { useTaskStore } from '../stores/taskStore'
import { useHealthStore } from '../stores/healthStore'
import { DEFAULT_CATEGORIES } from '../types/category'
import dayjs from 'dayjs'

// 工具描述（发送给 DeepSeek 的 tools 字段）
export const AI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'addTask',
      description: '新增一个任务/计划。时间安排有三种模式:1)定时(提供 startTime,可选 endTime,默认持续 1h); 2)只有时长(提供 durationMinutes,如"读 30 分钟单词"); 3)全天待办(都不提供,当天要做但没具体时间)。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题，简明扼要' },
          description: { type: 'string', description: '任务备注/详情，可选' },
          date: { type: 'string', description: '日期，格式 YYYY-MM-DD，如 2026-07-15' },
          startTime: { type: 'string', description: '开始时间 HH:mm。仅当用户明确说"几点开始"时用' },
          endTime: { type: 'string', description: '结束时间 HH:mm。有 startTime 时才有意义;若未指定,默认 start+1h' },
          durationMinutes: { type: 'number', description: '花费时长(分钟)。用户只说"读 30 分钟"、"写 2 小时"等时长而不说具体几点时使用。与 startTime 二选一' },
          category: { type: 'string', description: '分类 id，可选值: work(工作)|study(学习)|fitness(健身)|life(生活)|health(健康)|social(社交)|other(其他)。默认 work' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'], description: '优先级，默认 medium' },
          remindAt: { type: 'number', description: '提前多少分钟提醒。仅对"定时"模式有效。默认不提醒' },
        },
        required: ['title', 'date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'updateTask',
      description: '修改已有任务。必须提供 taskId。可通过 queryTasks 先获取 id。',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: '任务 ID' },
          title: { type: 'string' },
          description: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          startTime: { type: 'string', description: 'HH:mm，空字符串表示清除' },
          endTime: { type: 'string', description: 'HH:mm，空字符串表示清除' },
          durationMinutes: { type: 'number', description: '花费时长(分钟);切换到时长模式时使用。0 表示清除' },
          category: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          remindAt: { type: 'number' },
          isCompleted: { type: 'boolean', description: '设置完成状态' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'deleteTask',
      description: '删除任务。此操作需要用户二次确认。',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: '要删除的任务 ID' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'queryTasks',
      description: '查询任务。可按日期范围或关键词过滤。返回符合条件的任务列表。',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: '起始日期 YYYY-MM-DD，可选' },
          endDate: { type: 'string', description: '结束日期 YYYY-MM-DD，可选' },
          keyword: { type: 'string', description: '标题或描述关键词，可选' },
          category: { type: 'string', description: '分类 id，可选' },
          onlyIncomplete: { type: 'boolean', description: '只查未完成' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'bulkAddTasks',
      description: '批量新增任务，用于生成重复日程（如"每周三下午 2 点开周会连续 4 周"）。每条任务同 addTask 的时间三态。',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                date: { type: 'string' },
                startTime: { type: 'string' },
                endTime: { type: 'string' },
                durationMinutes: { type: 'number' },
                category: { type: 'string' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                remindAt: { type: 'number' },
                description: { type: 'string' },
              },
              required: ['title', 'date'],
            },
          },
        },
        required: ['tasks'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'addMeal',
      description: '记录一餐饮食（早餐/午餐/晚餐/加餐）。适用于用户口头告知吃了什么。',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: '日期 YYYY-MM-DD' },
          mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          time: { type: 'string', description: 'HH:mm，可选' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                amount: { type: 'string' },
                calories: { type: 'number' },
                protein: { type: 'number' },
                carbs: { type: 'number' },
                fat: { type: 'number' },
              },
              required: ['name'],
            },
          },
          totalCalories: { type: 'number', description: '总热量 kcal，可选' },
          notes: { type: 'string' },
        },
        required: ['date', 'mealType', 'items'],
      },
    },
  },
]

// 工具执行结果（发回给 AI 作为 tool message）
export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  needsConfirmation?: boolean // 待确认（如 deleteTask）
}

// 删除确认回调
export type DeleteConfirmFn = (task: Task | undefined, taskId: string) => Promise<boolean>

// 归一化时间字段
function normalizeTime(t: string | undefined): string | undefined {
  if (!t) return undefined
  const m = t.match(/^(\d{1,2}):(\d{1,2})$/)
  if (!m) return t
  return `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}`
}

function computeEndTime(start: string, end: string | undefined): string {
  const st = normalizeTime(start) || '09:00'
  if (end) return normalizeTime(end) || st
  // 默认加 1 小时
  const [h, m] = st.split(':').map(Number)
  const total = h * 60 + m + 60
  const nh = Math.min(23, Math.floor(total / 60))
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function validCategory(id: string | undefined): string {
  if (!id) return 'work'
  return DEFAULT_CATEGORIES.some(c => c.id === id) ? id : 'work'
}

// 执行工具调用
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  opts: { onDeleteConfirm: DeleteConfirmFn }
): Promise<ToolResult> {
  const taskStore = useTaskStore()

  try {
    switch (name) {
      case 'addTask': {
        const title = String(args.title || '').trim()
        const date = String(args.date || '').trim()
        const rawStart = args.startTime ? String(args.startTime).trim() : ''
        const startTime = rawStart ? normalizeTime(rawStart) : undefined
        const duration = typeof args.durationMinutes === 'number' && args.durationMinutes > 0
          ? args.durationMinutes
          : undefined
        if (!title || !date) {
          return { success: false, error: '缺少必填字段: title/date' }
        }
        const form: TaskFormData = {
          title,
          description: args.description ? String(args.description) : undefined,
          category: validCategory(args.category as string),
          priority: (args.priority as TaskFormData['priority']) || 'medium',
          date,
          startTime,
          endTime: startTime ? computeEndTime(startTime, args.endTime as string) : undefined,
          durationMinutes: !startTime ? duration : undefined,
          remindAt: startTime && typeof args.remindAt === 'number' ? args.remindAt : undefined,
        }
        const task = await taskStore.createTask(form)
        return { success: true, data: { id: task.id, title: task.title, date: task.date, startTime: task.startTime, durationMinutes: task.durationMinutes } }
      }

      case 'updateTask': {
        const taskId = String(args.taskId || '')
        if (!taskId) return { success: false, error: '缺少 taskId' }
        const existing = taskStore.tasks.find(t => t.id === taskId)
        if (!existing) return { success: false, error: `找不到任务: ${taskId}` }

        const patch: Partial<TaskFormData> = {}
        if (args.title !== undefined) patch.title = String(args.title)
        if (args.description !== undefined) patch.description = String(args.description)
        if (args.category !== undefined) patch.category = validCategory(String(args.category))
        if (args.priority !== undefined) patch.priority = args.priority as TaskFormData['priority']
        if (args.date !== undefined) patch.date = String(args.date)
        if (args.startTime !== undefined) {
          const s = String(args.startTime)
          patch.startTime = s ? normalizeTime(s) : undefined
        }
        if (args.endTime !== undefined) {
          const s = String(args.endTime)
          patch.endTime = s ? normalizeTime(s) : undefined
        }
        if (args.durationMinutes !== undefined) {
          const n = Number(args.durationMinutes)
          patch.durationMinutes = n > 0 ? n : undefined
        }
        if (args.remindAt !== undefined) patch.remindAt = Number(args.remindAt)

        const updated = await taskStore.editTask(taskId, patch)
        if (args.isCompleted !== undefined && updated) {
          if (updated.isCompleted !== Boolean(args.isCompleted)) {
            await taskStore.toggleComplete(taskId)
          }
        }
        return { success: true, data: { id: taskId, updated: Object.keys(patch) } }
      }

      case 'deleteTask': {
        const taskId = String(args.taskId || '')
        if (!taskId) return { success: false, error: '缺少 taskId' }
        const task = taskStore.tasks.find(t => t.id === taskId)
        // 让 UI 弹确认框
        const confirmed = await opts.onDeleteConfirm(task, taskId)
        if (!confirmed) {
          return { success: false, error: '用户取消了删除操作', needsConfirmation: true }
        }
        await taskStore.removeTask(taskId)
        return { success: true, data: { id: taskId, deleted: true } }
      }

      case 'queryTasks': {
        const startDate = args.startDate ? String(args.startDate) : undefined
        const endDate = args.endDate ? String(args.endDate) : undefined
        const keyword = args.keyword ? String(args.keyword).toLowerCase() : undefined
        const category = args.category ? String(args.category) : undefined
        const onlyIncomplete = Boolean(args.onlyIncomplete)

        let list = [...taskStore.tasks]
        if (startDate) list = list.filter(t => t.date >= startDate)
        if (endDate) list = list.filter(t => t.date <= endDate)
        if (keyword) {
          list = list.filter(t =>
            t.title.toLowerCase().includes(keyword) ||
            (t.description && t.description.toLowerCase().includes(keyword))
          )
        }
        if (category) list = list.filter(t => t.category === category)
        if (onlyIncomplete) list = list.filter(t => !t.isCompleted)

        // 限制返回条数避免上下文过大
        const limited = list.slice(0, 30)
        const summary = limited.map(t => ({
          id: t.id,
          title: t.title,
          date: t.date,
          startTime: t.startTime,
          endTime: t.endTime,
          durationMinutes: t.durationMinutes,
          category: t.category,
          priority: t.priority,
          isCompleted: t.isCompleted,
          remindAt: t.remindAt,
        }))
        return { success: true, data: { total: list.length, returned: summary.length, tasks: summary } }
      }

      case 'bulkAddTasks': {
        const rawTasks = Array.isArray(args.tasks) ? args.tasks : []
        if (rawTasks.length === 0) return { success: false, error: '任务列表为空' }
        if (rawTasks.length > 100) return { success: false, error: '单次最多批量新增 100 条' }

        const forms: TaskFormData[] = []
        for (const raw of rawTasks as Array<Record<string, unknown>>) {
          const title = String(raw.title || '').trim()
          const date = String(raw.date || '').trim()
          if (!title || !date) continue
          const rawStart = raw.startTime ? String(raw.startTime).trim() : ''
          const startTime = rawStart ? normalizeTime(rawStart) : undefined
          const duration = typeof raw.durationMinutes === 'number' && raw.durationMinutes > 0
            ? raw.durationMinutes
            : undefined
          forms.push({
            title,
            description: raw.description ? String(raw.description) : undefined,
            category: validCategory(raw.category as string),
            priority: (raw.priority as TaskFormData['priority']) || 'medium',
            date,
            startTime,
            endTime: startTime ? computeEndTime(startTime, raw.endTime as string) : undefined,
            durationMinutes: !startTime ? duration : undefined,
            remindAt: startTime && typeof raw.remindAt === 'number' ? raw.remindAt : undefined,
          })
        }
        const count = await taskStore.createTasksBulk(forms)
        return { success: true, data: { added: count, skipped: rawTasks.length - count } }
      }

      case 'addMeal': {
        const healthStore = useHealthStore()
        const date = String(args.date || '').trim()
        const mealType = String(args.mealType || '') as MealType
        const items = Array.isArray(args.items) ? (args.items as MealItem[]) : []
        if (!date || !mealType || items.length === 0) {
          return { success: false, error: '缺少必填: date/mealType/items' }
        }
        const totalCalories =
          typeof args.totalCalories === 'number'
            ? args.totalCalories
            : items.reduce((s, it) => s + (it.calories || 0), 0)

        const entry = await healthStore.saveMeal({
          date,
          mealType,
          time: args.time ? String(args.time) : undefined,
          items,
          totalCalories,
          notes: args.notes ? String(args.notes) : undefined,
        })
        return {
          success: true,
          data: { id: entry.id, date, mealType, totalCalories, itemCount: items.length },
        }
      }

      default:
        return { success: false, error: `未知工具: ${name}` }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

// 生成 system prompt（支持注入额外内容）
export function buildSystemPrompt(extra?: string): string {
  const today = dayjs().format('YYYY-MM-DD (dddd)')
  const cats = DEFAULT_CATEGORIES.map(c => `${c.id}(${c.name})`).join(', ')
  const base = `你是 PlanFlow 的智能日程助手。用户会用自然语言告诉你想安排什么，你需要理解意图并调用相应的工具来完成。

今天是 ${today}。
可用分类: ${cats}

工作规则:
1. 用户说"明天"、"下周三"等相对日期时，转换为绝对日期(YYYY-MM-DD)后再调用工具。
2. 时间安排有三种模式,按用户话语判断:
   a. 用户说明具体时间点(如"下午 3 点"、"14:00 开始"):使用 startTime,若未说结束时间则默认 start+1h(endTime 可留空由系统补)
   b. 用户只说时长而没说具体几点(如"读 30 分钟单词"、"写 2 小时代码"):使用 durationMinutes,不填 startTime
   c. 用户只说"当天做"没提时间(如"记得取快递"):都不填,归为全天待办
3. 除非用户明确说要提醒,否则 remindAt 留空。用户说"提前 X 分钟提醒"时才设置。提醒只对定时模式有效。
4. 修改或删除任务前，如果不知道 taskId，先用 queryTasks 找到对应任务。
5. 删除操作会弹出用户确认框，你不用担心，直接调用即可。
6. 批量重复日程（每周会议等）使用 bulkAddTasks 一次性提交。
7. 记录饮食用 addMeal。用户没说 mealType 时，根据时间推断（早/中/晚/加餐）。
8. 简洁友好，操作完成后用一两句话告知用户结果。不要输出 JSON 或工具调用细节。
9. 如果用户请求含糊（比如没说日期），先问清再操作，不要瞎猜。`

  if (extra) {
    return base + `\n\n--- 学习会话额外信息 ---\n${extra}`
  }
  return base
}
