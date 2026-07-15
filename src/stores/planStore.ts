// 计划 / 模板 状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { Plan, PlanTemplate, PlanFormData, TemplateFormData } from '../types'
import {
  initDB,
  getAllPlans,
  getAllTemplates,
  putPlan,
  deletePlanRow,
  putTemplate,
  deleteTemplateRow,
  addTask as dbAddTask,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
} from '../utils/db'
import { expandTemplateToTasks } from '../utils/planExpander'
import { useTaskStore } from './taskStore'

export const usePlanStore = defineStore('plan', () => {
  const plans = ref<Plan[]>([])
  const templates = ref<PlanTemplate[]>([])
  const loading = ref(false)

  async function loadAll() {
    loading.value = true
    try {
      await initDB()
      const [ps, ts] = await Promise.all([getAllPlans(), getAllTemplates()])
      plans.value = ps.sort((a, b) => b.createdAt - a.createdAt)
      templates.value = ts
    } finally {
      loading.value = false
    }
  }

  const activePlans = computed(() =>
    plans.value.filter(p => p.status === 'active'),
  )
  const archivedPlans = computed(() =>
    plans.value.filter(p => p.status === 'archived'),
  )

  function getPlanById(id: string): Plan | undefined {
    return plans.value.find(p => p.id === id)
  }

  function getTemplatesByPlan(planId: string): PlanTemplate[] {
    return templates.value
      .filter(t => t.planId === planId)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  function getTemplateById(id: string): PlanTemplate | undefined {
    return templates.value.find(t => t.id === id)
  }

  // ---------- Plan CRUD ----------

  async function createPlan(data: PlanFormData): Promise<Plan> {
    const now = Date.now()
    const plan: Plan = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      templateIds: [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    await putPlan(plan)
    plans.value.unshift(plan)
    return plan
  }

  async function editPlan(id: string, patch: Partial<PlanFormData & { status: 'active' | 'archived' }>): Promise<Plan | null> {
    const idx = plans.value.findIndex(p => p.id === id)
    if (idx < 0) return null
    const updated: Plan = {
      ...plans.value[idx],
      ...patch,
      updatedAt: Date.now(),
    }
    await putPlan(updated)
    plans.value[idx] = updated
    return updated
  }

  async function archivePlan(id: string): Promise<void> {
    await editPlan(id, { status: 'archived' })
  }

  // 级联删:清理该 planId 下未完成的日任务,已完成的孤儿化(planId 置 undefined)
  // 同时删除所有关联模板
  async function deletePlan(id: string): Promise<void> {
    const taskStore = useTaskStore()

    // 1) 处理相关日任务
    const related = taskStore.tasks.filter(t => t.planId === id)
    for (const t of related) {
      if (t.isCompleted) {
        const orphan = { ...t }
        delete orphan.planId
        delete orphan.templateItemId
        orphan.updatedAt = Date.now()
        await dbUpdateTask(orphan)
        const idx2 = taskStore.tasks.findIndex(x => x.id === t.id)
        if (idx2 >= 0) taskStore.tasks[idx2] = orphan
      } else {
        await dbDeleteTask(t.id)
      }
    }
    // 从内存移除未完成的
    taskStore.tasks = taskStore.tasks.filter(t => !(t.planId === id && !t.isCompleted))

    // 2) 删除该 plan 的所有模板
    const relatedTemplates = templates.value.filter(t => t.planId === id)
    for (const tpl of relatedTemplates) {
      await deleteTemplateRow(tpl.id)
    }
    templates.value = templates.value.filter(t => t.planId !== id)

    // 3) 删除计划本身
    await deletePlanRow(id)
    plans.value = plans.value.filter(p => p.id !== id)
  }

  // ---------- Template CRUD ----------

  async function addTemplate(planId: string, data: TemplateFormData): Promise<PlanTemplate> {
    const now = Date.now()
    const tpl: PlanTemplate = {
      id: uuidv4(),
      planId,
      name: data.name,
      daysOfWeek: [...data.daysOfWeek],
      items: JSON.parse(JSON.stringify(data.items)),
      createdAt: now,
      updatedAt: now,
    }
    await putTemplate(tpl)
    templates.value.push(tpl)
    // 同步 plan.templateIds
    const planIdx = plans.value.findIndex(p => p.id === planId)
    if (planIdx >= 0) {
      const p = { ...plans.value[planIdx] }
      p.templateIds = [...p.templateIds, tpl.id]
      p.updatedAt = now
      await putPlan(p)
      plans.value[planIdx] = p
    }
    return tpl
  }

  // 编辑模板:先清理"该模板下未完成"的日任务,以便重展开时重新生成
  // 已完成的任务保留(带旧 templateItemId 也无妨,幂等键会保护它们)
  async function editTemplate(id: string, data: TemplateFormData): Promise<PlanTemplate | null> {
    const idx = templates.value.findIndex(t => t.id === id)
    if (idx < 0) return null
    const before = templates.value[idx]
    const now = Date.now()
    const updated: PlanTemplate = {
      ...before,
      name: data.name,
      daysOfWeek: [...data.daysOfWeek],
      items: JSON.parse(JSON.stringify(data.items)),
      updatedAt: now,
    }

    // 清理未完成的关联日任务(用 templateItemId 反查)
    const taskStore = useTaskStore()
    const itemIdSet = new Set(before.items.map(i => i.id))
    const toRemove = taskStore.tasks.filter(t =>
      t.planId === before.planId &&
      t.templateItemId &&
      itemIdSet.has(t.templateItemId) &&
      !t.isCompleted,
    )
    for (const t of toRemove) await dbDeleteTask(t.id)
    taskStore.tasks = taskStore.tasks.filter(t => !toRemove.some(r => r.id === t.id))

    await putTemplate(updated)
    templates.value[idx] = updated
    return updated
  }

  async function deleteTemplate(id: string): Promise<void> {
    const idx = templates.value.findIndex(t => t.id === id)
    if (idx < 0) return
    const tpl = templates.value[idx]

    // 级联:未完成 → 删,已完成 → 孤儿化
    const taskStore = useTaskStore()
    const itemIdSet = new Set(tpl.items.map(i => i.id))
    const related = taskStore.tasks.filter(t =>
      t.planId === tpl.planId &&
      t.templateItemId &&
      itemIdSet.has(t.templateItemId),
    )
    for (const t of related) {
      if (t.isCompleted) {
        const orphan = { ...t }
        delete orphan.templateItemId // 保留 planId,便于 AI 汇总仍能覆盖
        orphan.updatedAt = Date.now()
        await dbUpdateTask(orphan)
        const i2 = taskStore.tasks.findIndex(x => x.id === t.id)
        if (i2 >= 0) taskStore.tasks[i2] = orphan
      } else {
        await dbDeleteTask(t.id)
      }
    }
    taskStore.tasks = taskStore.tasks.filter(t =>
      !related.some(r => r.id === t.id && !r.isCompleted),
    )

    await deleteTemplateRow(id)
    templates.value.splice(idx, 1)

    // 同步 plan.templateIds
    const planIdx = plans.value.findIndex(p => p.id === tpl.planId)
    if (planIdx >= 0) {
      const p = { ...plans.value[planIdx] }
      p.templateIds = p.templateIds.filter(x => x !== id)
      p.updatedAt = Date.now()
      await putPlan(p)
      plans.value[planIdx] = p
    }
  }

  // ---------- 展开 ----------

  // 展开单个模板,返回新创建的任务数
  async function expandTemplate(templateId: string): Promise<number> {
    const tpl = getTemplateById(templateId)
    if (!tpl) return 0
    const plan = getPlanById(tpl.planId)
    if (!plan) return 0

    const taskStore = useTaskStore()
    const newTasks = expandTemplateToTasks(plan, tpl, taskStore.tasks)

    for (const t of newTasks) {
      await dbAddTask(t)
    }
    // 一次性 push,减少响应式抖动
    taskStore.tasks.push(...newTasks)

    // 处理艾宾浩斯:模板里学习任务开启了艾宾浩斯的,单独走复习链生成
    // (planExpander 已经在 task.study.__enableEbbinghaus 打了标)
    // 这里直接遍历新任务,命中即调 taskStore 的私有实现太耦合;
    // 折中方案:走公共 API editTask 触发不合适,改成直接构造首学任务并调用 taskStore 内部逻辑。
    // 为避免入侵 taskStore,此处若开启艾宾浩斯,复习任务留待后续手动操作
    // (符合"first cut ship"精神,后续再优化)。

    return newTasks.length
  }

  // 展开整个计划
  async function expandPlan(planId: string): Promise<number> {
    const tpls = getTemplatesByPlan(planId)
    let total = 0
    for (const tpl of tpls) {
      total += await expandTemplate(tpl.id)
    }
    return total
  }

  return {
    plans,
    templates,
    loading,
    activePlans,
    archivedPlans,
    loadAll,
    getPlanById,
    getTemplatesByPlan,
    getTemplateById,
    createPlan,
    editPlan,
    archivePlan,
    deletePlan,
    addTemplate,
    editTemplate,
    deleteTemplate,
    expandTemplate,
    expandPlan,
  }
})
