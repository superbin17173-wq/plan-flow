<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { usePlanStore } from '../stores/planStore'
import { useTaskStore } from '../stores/taskStore'
import type { Plan, PlanTemplate } from '../types'
import { WEEKDAY_LABELS } from '../types/plan'
import { getCategoryById } from '../types/category'
import PlanFormDialog from '../components/plan/PlanFormDialog.vue'
import TemplateFormDialog from '../components/plan/TemplateFormDialog.vue'
import PlanSummaryDialog from '../components/plan/PlanSummaryDialog.vue'

const router = useRouter()
const planStore = usePlanStore()
const taskStore = useTaskStore()

// 弹窗状态
const planDialog = ref<{ open: boolean; editing: Plan | null }>({ open: false, editing: null })
const templateDialog = ref<{ open: boolean; planId: string; editing: PlanTemplate | null }>({
  open: false, planId: '', editing: null,
})
const summaryDialog = ref<{ open: boolean; planId: string }>({ open: false, planId: '' })

const expandedPlanIds = ref<Set<string>>(new Set())

onMounted(async () => {
  // 保证任务已加载(计划展开需要读取现有任务做幂等去重)
  if (taskStore.tasks.length === 0) await taskStore.loadTasks()
  await planStore.loadAll()
})

const activePlans = computed(() => planStore.activePlans)
const archivedPlans = computed(() => planStore.archivedPlans)

function toggleExpand(id: string) {
  if (expandedPlanIds.value.has(id)) expandedPlanIds.value.delete(id)
  else expandedPlanIds.value.add(id)
}

function openNewPlan() {
  planDialog.value = { open: true, editing: null }
}

function openEditPlan(p: Plan) {
  planDialog.value = { open: true, editing: p }
}

async function onConfirmDeletePlan(p: Plan) {
  const ok = window.confirm(
    `删除计划「${p.name}」?\n\n所有关联模板会一起删除。\n未完成的日任务会一并清理,已完成的任务会保留(不再归属该计划)。\n\n此操作不可撤销。`,
  )
  if (!ok) return
  await planStore.deletePlan(p.id)
}

async function onArchivePlan(p: Plan) {
  if (p.status === 'archived') {
    await planStore.editPlan(p.id, { status: 'active' })
  } else {
    await planStore.archivePlan(p.id)
  }
}

function openNewTemplate(planId: string) {
  templateDialog.value = { open: true, planId, editing: null }
  expandedPlanIds.value.add(planId)
}

function openEditTemplate(tpl: PlanTemplate) {
  templateDialog.value = { open: true, planId: tpl.planId, editing: tpl }
}

async function onDeleteTemplate(tpl: PlanTemplate) {
  const ok = window.confirm(
    `删除模板「${tpl.name}」?\n\n未完成的关联日任务会一并清理,已完成的任务保留。`,
  )
  if (!ok) return
  await planStore.deleteTemplate(tpl.id)
}

async function onExpandTemplate(tpl: PlanTemplate) {
  const n = await planStore.expandTemplate(tpl.id)
  window.alert(n > 0 ? `已生成 ${n} 条日任务(已存在的自动跳过)` : '本次没有新增任务(可能已经全部生成过了)')
}

async function onExpandPlan(p: Plan) {
  const tpls = planStore.getTemplatesByPlan(p.id)
  if (!tpls.length) {
    window.alert('该计划下还没有模板,请先添加模板')
    return
  }
  const n = await planStore.expandPlan(p.id)
  window.alert(n > 0 ? `已一键生成 ${n} 条日任务` : '所有模板此前已展开过,无新增任务')
}

function openSummary(planId: string) {
  summaryDialog.value = { open: true, planId }
}

function planDateLabel(p: Plan): string {
  const s = dayjs(p.startDate)
  const e = dayjs(p.endDate)
  const days = e.diff(s, 'day') + 1
  return `${p.startDate} ~ ${p.endDate}(共 ${days} 天)`
}

function templateWeekdaysLabel(days: number[]): string {
  if (!days.length) return '未设置'
  return days.map(d => `周${WEEKDAY_LABELS[d]}`).join(' · ')
}

function categoryChipStyle(catId: string) {
  const c = getCategoryById(catId)
  return c ? { backgroundColor: c.color } : {}
}

function categoryName(catId: string): string {
  return getCategoryById(catId)?.name || catId
}

function goBack() {
  router.push('/planflow')
}
</script>

<template>
  <div class="plans-view">
    <header class="plans-header">
      <button class="back-btn" @click="goBack">‹ 返回</button>
      <h1>计划与模板</h1>
      <button class="primary-btn" @click="openNewPlan">+ 新建计划</button>
    </header>

    <main class="plans-main">
      <p class="hint">
        用「计划(时间范围)+ 模板(星期几)」批量铺任务。修改模板会重新展开未完成的日任务,已完成的会保留。
      </p>

      <!-- 活动中的计划 -->
      <section v-if="activePlans.length" class="plan-section">
        <h2>进行中</h2>
        <div class="plan-list">
          <article
            v-for="p in activePlans"
            :key="p.id"
            class="plan-card"
          >
            <header class="card-head">
              <div class="card-title-wrap">
                <h3 class="card-title">{{ p.name }}</h3>
                <p class="card-sub">{{ planDateLabel(p) }}</p>
                <p v-if="p.description" class="card-desc">{{ p.description }}</p>
              </div>
              <div class="card-actions">
                <button class="ghost-btn" @click="openEditPlan(p)" title="编辑">✎</button>
                <button class="ghost-btn" @click="onArchivePlan(p)" title="归档">📦</button>
                <button class="ghost-btn danger" @click="onConfirmDeletePlan(p)" title="删除">🗑</button>
              </div>
            </header>

            <div class="card-actions-row">
              <button class="action-btn" @click="openNewTemplate(p.id)">+ 新建模板</button>
              <button class="action-btn" @click="onExpandPlan(p)" :disabled="planStore.getTemplatesByPlan(p.id).length === 0">
                🚀 一键展开
              </button>
              <button class="action-btn ai" @click="openSummary(p.id)">🤖 AI 汇总</button>
              <button class="action-btn" @click="toggleExpand(p.id)">
                {{ expandedPlanIds.has(p.id) ? '收起' : `展开 (${planStore.getTemplatesByPlan(p.id).length})` }}
              </button>
            </div>

            <div v-if="expandedPlanIds.has(p.id)" class="template-list">
              <div v-if="!planStore.getTemplatesByPlan(p.id).length" class="empty-tip">
                暂无模板。点上方「+ 新建模板」开始。
              </div>
              <article
                v-for="tpl in planStore.getTemplatesByPlan(p.id)"
                :key="tpl.id"
                class="template-card"
              >
                <div class="tpl-head">
                  <h4>{{ tpl.name }}</h4>
                  <span class="tpl-weekdays">{{ templateWeekdaysLabel(tpl.daysOfWeek) }}</span>
                </div>
                <ul class="tpl-items">
                  <li v-for="item in tpl.items" :key="item.id">
                    <span class="cat-chip" :style="categoryChipStyle(item.category)">{{ categoryName(item.category) }}</span>
                    <span class="item-title">{{ item.title }}</span>
                    <span v-if="item.startTime && item.endTime" class="item-time">{{ item.startTime }}~{{ item.endTime }}</span>
                    <span v-else-if="item.durationMinutes" class="item-time">{{ item.durationMinutes }}分钟</span>
                    <span v-else class="item-time">全天</span>
                  </li>
                </ul>
                <div class="tpl-actions">
                  <button class="mini-btn" @click="openEditTemplate(tpl)">编辑</button>
                  <button class="mini-btn" @click="onExpandTemplate(tpl)">展开</button>
                  <button class="mini-btn danger" @click="onDeleteTemplate(tpl)">删除</button>
                </div>
              </article>
            </div>
          </article>
        </div>
      </section>

      <!-- 归档 -->
      <section v-if="archivedPlans.length" class="plan-section archived">
        <h2>已归档</h2>
        <div class="plan-list">
          <article v-for="p in archivedPlans" :key="p.id" class="plan-card muted">
            <header class="card-head">
              <div class="card-title-wrap">
                <h3 class="card-title">{{ p.name }}</h3>
                <p class="card-sub">{{ planDateLabel(p) }}</p>
              </div>
              <div class="card-actions">
                <button class="ghost-btn" @click="onArchivePlan(p)" title="恢复">↩</button>
                <button class="ghost-btn" @click="openSummary(p.id)" title="AI 汇总">🤖</button>
                <button class="ghost-btn danger" @click="onConfirmDeletePlan(p)" title="删除">🗑</button>
              </div>
            </header>
          </article>
        </div>
      </section>

      <div v-if="!activePlans.length && !archivedPlans.length" class="empty-hero">
        <p>还没有任何计划。</p>
        <button class="primary-btn" @click="openNewPlan">+ 新建你的第一个计划</button>
      </div>
    </main>

    <PlanFormDialog
      v-if="planDialog.open"
      :editing="planDialog.editing"
      @close="planDialog.open = false"
    />
    <TemplateFormDialog
      v-if="templateDialog.open"
      :plan-id="templateDialog.planId"
      :editing="templateDialog.editing"
      @close="templateDialog.open = false"
    />
    <PlanSummaryDialog
      v-if="summaryDialog.open"
      :plan-id="summaryDialog.planId"
      @close="summaryDialog.open = false"
    />
  </div>
</template>

<style scoped lang="scss">
.plans-view {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: calc(24px + var(--safe-bottom, 0px));
}

.plans-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px calc(10px + var(--safe-top, 0px));
  padding-top: calc(10px + var(--safe-top, 0px));
  background: var(--material-regular);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  border-bottom: 0.5px solid var(--separator);

  h1 {
    flex: 1;
    text-align: center;
    font-size: var(--font-size-headline);
    font-weight: 700;
    color: var(--text-primary);
  }
}

.back-btn {
  background: transparent;
  border: none;
  color: var(--ios-blue);
  font-size: 17px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  &:hover { background: var(--bg-hover); }
}

.primary-btn {
  background: var(--ios-blue);
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 122, 255, 0.28);
  &:hover { filter: brightness(1.05); }
  &:active { transform: scale(0.97); }
}

.plans-main {
  max-width: 780px;
  margin: 0 auto;
  padding: 16px;
}

.hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.5;
}

.plan-section {
  margin-bottom: 28px;
  h2 {
    font-size: var(--font-size-headline);
    color: var(--text-primary);
    margin-bottom: 12px;
    font-weight: 700;
  }
  &.archived h2 { color: var(--text-secondary); }
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.plan-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg, 14px);
  padding: 16px;
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06));
  border: 0.5px solid var(--separator);

  &.muted { opacity: 0.7; }
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.card-title-wrap { flex: 1; min-width: 0; }
.card-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.card-sub {
  font-size: 13px;
  color: var(--text-secondary);
}
.card-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.4;
}
.card-actions {
  display: flex;
  gap: 4px;
}

.ghost-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  &:hover { background: var(--bg-hover); }
  &.danger:hover { background: rgba(255,59,48,0.12); }
}

.card-actions-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.action-btn {
  background: var(--bg-fill-quaternary, rgba(120,120,128,0.12));
  border: none;
  padding: 7px 12px;
  border-radius: 9px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  &:hover:not(:disabled) { background: var(--bg-hover); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
  &.ai {
    background: linear-gradient(135deg, #7c5ce6, #4b8bf5);
    color: #fff;
  }
}

.template-list {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 0.5px dashed var(--separator);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-tip {
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
  padding: 12px;
}

.template-card {
  background: var(--bg-primary);
  border: 0.5px solid var(--separator);
  border-radius: 10px;
  padding: 12px;
}

.tpl-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  h4 { font-size: 15px; font-weight: 600; color: var(--text-primary); }
}
.tpl-weekdays {
  font-size: 12px;
  color: var(--ios-blue);
  font-weight: 500;
}

.tpl-items {
  list-style: none;
  padding: 0;
  margin: 0 0 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-primary);
  }
}
.cat-chip {
  color: #fff;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.item-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-time { color: var(--text-secondary); font-size: 12px; }

.tpl-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
.mini-btn {
  background: transparent;
  border: 0.5px solid var(--separator);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  &:hover { background: var(--bg-hover); }
  &.danger { color: #ff3b30; border-color: rgba(255,59,48,0.3); }
}

.empty-hero {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
  p { margin-bottom: 16px; font-size: 15px; }
}

@media (max-width: 640px) {
  .plans-header h1 { font-size: 15px; }
  .primary-btn { padding: 7px 10px; font-size: 13px; }
  .plan-card { padding: 12px; }
  .card-title { font-size: 15px; }
}
</style>
