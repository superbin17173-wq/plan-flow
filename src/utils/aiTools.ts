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
    type: 'function',
    function: {
      name: 'addTask',
      description: '新增一个任务/计划。需要提供标题、日期、开始时间。其他字段可选。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题，简明扼要' },
          description: { type: 'string', description: '任务备注/详情，可选' },
          date: { type: 'string', description: '日期，格式 YYYY-MM-DD，如 2026-07-15' },
          startTime: { type: 'string', description: '开始时间，格式 HH:mm，如 14:30' },
          endTime: { type: 'string', description: '结束时间，格式 HH:mm；如果没说，比开始时间晚 1 小时' },
          category: { type: 'string', description: '分类 id，可选值: work(工作)|study(学习)|fitness(健身)|life(生活)|health(健康)|social(社交)|other(其他)。默认 work' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'], description: '优先级，默认 medium' },
          remindAt: { type: 'number', description: '提前多少分钟提醒，默认 0 表示不提醒。常用值 5, 15, 30, 60' },
        },
        required: ['title', 'date', 'startTime'],
      },
    },
  },
  {
    type: 'function',
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
          startTime: { type: 'string', description: 'HH:mm' },
          endTime: { type: 'string', description: 'HH:mm' },
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
    type: 'function',
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
    type: 'function',
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
    type: 'function',
    function: {
      name: 'bulkAddTasks',
      description: '批量新增任务，用于生成重复日程（如"每周三下午 2 点开周会连续 4 周"）。',
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
                category: { type: 'string' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                remindAt: { type: 'number' },
                description: { type: 'string' },
              },
              required: ['title', 'date', 'startTime'],
            },
          },
        },
        required: ['tasks'],
      },
    },
  },
  {
    type: 'function',
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
        const startTime = normalizeTime(String(args.startTime || ''))
        if (!title || !date || !startTime) {
          return { success: false, error: '缺少必填字段: title/date/startTime' }
        }
        const form: TaskFormData = {
          title,
          description: args.description ? String(args.description) : undefined,
          category: validCategory(args.category as string),
          priority: (args.priority as TaskFormData['priority']) || 'medium',
          date,
          startTime,
          endTime: computeEndTime(startTime, args.endTime as string),
          remindAt: typeof args.remindAt === 'number' ? args.remindAt : undefined,
        }
        const task = await taskStore.createTask(form)
        return { success: true, data: { id: task.id, title: task.title, date: task.date, startTime: task.startTime } }
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
        if (args.startTime !== undefined) patch.startTime = normalizeTime(String(args.startTime))
        if (args.endTime !== undefined) patch.endTime = normalizeTime(String(args.endTime))
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
          const startTime = normalizeTime(String(raw.startTime || ''))
          if (!title || !date || !startTime) continue
          forms.push({
            title,
            description: raw.description ? String(raw.description) : undefined,
            category: validCategory(raw.category as string),
            priority: (raw.priority as TaskFormData['priority']) || 'medium',
            date,
            startTime,
            endTime: computeEndTime(startTime, raw.endTime as string),
            remindAt: typeof raw.remindAt === 'number' ? raw.remindAt : undefined,
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

// 生成 system prompt
export function buildSystemPrompt(): string {
  const today = dayjs().format('YYYY-MM-DD (dddd)')
  const cats = DEFAULT_CATEGORIES.map(c => `${c.id}(${c.name})`).join(', ')
  return `你是 PlanFlow 的智能日程助手。用户会用自然语言告诉你想安排什么，你需要理解意图并调用相应的工具来完成。

今天是 ${today}。
可用分类: ${cats}

工作规则:
1. 用户说"明天"、"下周三"等相对日期时，转换为绝对日期(YYYY-MM-DD)后再调用工具。
2. 时间没说结束时间时，默认持续 1 小时。
3. 除非用户明确说要提醒，否则 remindAt 留空（即不提醒）。用户说"提前 X 分钟提醒"时才设置。
4. 修改或删除任务前，如果不知道 taskId，先用 queryTasks 找到对应任务。
5. 删除操作会弹出用户确认框，你不用担心，直接调用即可。
6. 批量重复日程（每周会议等）使用 bulkAddTasks 一次性提交。
7. 记录饮食用 addMeal。用户没说 mealType 时，根据时间推断（早/中/晚/加餐）。
8. 简洁友好，操作完成后用一两句话告知用户结果。不要输出 JSON 或工具调用细节。
9. 如果用户请求含糊（比如没说日期、时间），先问清再操作，不要瞎猜。`
}
