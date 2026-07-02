<script setup lang="ts">
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { downloadTemplate, pickAndParseExcel, type ParseResult } from '../../utils/excelImport'
import { expandBulkPlan, previewBulkPlan, type BulkPlanParams } from '../../utils/bulkPlan'
import { DEFAULT_CATEGORIES } from '../../types/category'
import { useTaskStore } from '../../stores/taskStore'

const props = withDefaults(defineProps<{ modelValue?: boolean }>(), { modelValue: false })
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const taskStore = useTaskStore()
const tab = ref<'excel' | 'bulk'>('excel')
const importing = ref(false)
const excelResult = ref<ParseResult | null>(null)
const excelMessage = ref('')

// 批量表单
const bulk = ref<BulkPlanParams>({
  title: '',
  description: '',
  category: 'work',
  priority: 'medium',
  startDate: dayjs().format('YYYY-MM-DD'),
  endDate: dayjs().add(1, 'month').format('YYYY-MM-DD'),
  daysOfWeek: [1],
  startTime: '20:00',
  endTime: '21:00',
})

const weekdays = [
  { v: 1, l: '一' }, { v: 2, l: '二' }, { v: 3, l: '三' },
  { v: 4, l: '四' }, { v: 5, l: '五' }, { v: 6, l: '六' }, { v: 0, l: '日' },
]

const bulkPreview = computed(() => previewBulkPlan(bulk.value))

function toggleWeekday(v: number) {
  const idx = bulk.value.daysOfWeek.indexOf(v)
  if (idx >= 0) bulk.value.daysOfWeek.splice(idx, 1)
  else bulk.value.daysOfWeek.push(v)
}

function close() {
  emit('update:modelValue', false)
  excelResult.value = null
  excelMessage.value = ''
}

async function handlePickExcel() {
  excelMessage.value = ''
  excelResult.value = null
  const r = await pickAndParseExcel()
  if (r) excelResult.value = r
}

async function confirmExcelImport() {
  if (!excelResult.value || excelResult.value.valid.length === 0) return
  importing.value = true
  try {
    const n = await taskStore.createTasksBulk(excelResult.value.valid)
    excelMessage.value = `成功导入 ${n} 条任务`
    excelResult.value = null
    setTimeout(close, 1200)
  } catch (err) {
    excelMessage.value = `导入失败: ${err}`
  } finally {
    importing.value = false
  }
}

async function confirmBulkCreate() {
  if (!bulk.value.title.trim()) {
    excelMessage.value = '请填写标题'
    return
  }
  if (bulk.value.daysOfWeek.length === 0) {
    excelMessage.value = '请至少选择一个星期'
    return
  }
  if (bulk.value.endTime <= bulk.value.startTime) {
    excelMessage.value = '结束时间必须晚于开始时间'
    return
  }
  const items = expandBulkPlan(bulk.value)
  if (items.length === 0) {
    excelMessage.value = '生成结果为空,请检查日期范围'
    return
  }
  importing.value = true
  try {
    const n = await taskStore.createTasksBulk(items)
    excelMessage.value = `成功创建 ${n} 条任务`
    setTimeout(close, 1200)
  } catch (err) {
    excelMessage.value = `创建失败: ${err}`
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div v-if="modelValue" class="modal-mask" @click.self="close">
    <div class="modal-panel">
      <div class="modal-header">
        <h3>批量任务</h3>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: tab === 'excel' }"
          @click="tab = 'excel'; excelMessage = ''"
        >Excel 导入</button>
        <button
          class="tab-btn"
          :class="{ active: tab === 'bulk' }"
          @click="tab = 'bulk'; excelMessage = ''"
        >按区间批量创建</button>
      </div>

      <!-- Excel 导入 -->
      <div v-if="tab === 'excel'" class="tab-content">
        <div class="section">
          <p class="help">
            规范:表头固定为 <b>日期 / 开始时间 / 结束时间 / 标题 / 分类 / 优先级 / 描述</b>。
            日期支持 <code>2026-07-01</code>、<code>2026/7/1</code> 或 Excel 日期格式;
            时间为 24 小时制 <code>HH:mm</code>;分类支持工作/学习/生活/健康/社交/其他;
            优先级支持 高/中/低。
          </p>
          <div class="btn-row">
            <button class="btn secondary" @click="downloadTemplate">📄 下载模板</button>
            <button class="btn primary" @click="handlePickExcel">📤 选择 Excel 文件</button>
          </div>
        </div>

        <div v-if="excelResult" class="result-box">
          <div class="result-summary">
            <span class="badge ok">有效: {{ excelResult.valid.length }}</span>
            <span v-if="excelResult.errors.length" class="badge err">错误: {{ excelResult.errors.length }}</span>
          </div>

          <div v-if="excelResult.errors.length" class="error-list">
            <div v-for="(e, i) in excelResult.errors.slice(0, 8)" :key="i" class="error-item">
              第 {{ e.row }} 行: {{ e.message }}
            </div>
            <div v-if="excelResult.errors.length > 8" class="error-item more">
              ...另有 {{ excelResult.errors.length - 8 }} 条错误已省略
            </div>
          </div>

          <div v-if="excelResult.valid.length" class="preview-list">
            <div class="preview-title">前 5 条预览:</div>
            <div v-for="(t, i) in excelResult.valid.slice(0, 5)" :key="i" class="preview-item">
              <span class="p-date">{{ t.date }}</span>
              <span class="p-time">{{ t.startTime }}-{{ t.endTime }}</span>
              <span class="p-title">{{ t.title }}</span>
            </div>
          </div>

          <div class="btn-row right">
            <button
              class="btn primary"
              :disabled="excelResult.valid.length === 0 || importing"
              @click="confirmExcelImport"
            >
              {{ importing ? '导入中...' : `确认导入 ${excelResult.valid.length} 条` }}
            </button>
          </div>
        </div>
      </div>

      <!-- 批量创建 -->
      <div v-if="tab === 'bulk'" class="tab-content">
        <div class="form-grid">
          <label class="field">
            <span>标题</span>
            <input v-model="bulk.title" placeholder="如: 晚跑" />
          </label>
          <label class="field">
            <span>分类</span>
            <select v-model="bulk.category">
              <option v-for="c in DEFAULT_CATEGORIES" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="field">
            <span>优先级</span>
            <select v-model="bulk.priority">
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <label class="field">
            <span>开始日期</span>
            <input type="date" v-model="bulk.startDate" />
          </label>
          <label class="field">
            <span>结束日期</span>
            <input type="date" v-model="bulk.endDate" />
          </label>
          <label class="field">
            <span>开始时间</span>
            <input type="time" v-model="bulk.startTime" />
          </label>
          <label class="field">
            <span>结束时间</span>
            <input type="time" v-model="bulk.endTime" />
          </label>
        </div>

        <div class="field full">
          <span>星期几(可多选)</span>
          <div class="weekday-picker">
            <button
              v-for="w in weekdays"
              :key="w.v"
              class="wd-btn"
              :class="{ active: bulk.daysOfWeek.includes(w.v) }"
              @click="toggleWeekday(w.v)"
            >{{ w.l }}</button>
          </div>
        </div>

        <label class="field full">
          <span>描述(可选)</span>
          <textarea v-model="bulk.description" rows="2"></textarea>
        </label>

        <div class="preview-box">
          将生成 <b>{{ bulkPreview.count }}</b> 条任务
          <span v-if="bulkPreview.sampleDates.length">
            (前几条: {{ bulkPreview.sampleDates.join(', ') }}...)
          </span>
        </div>

        <div class="btn-row right">
          <button
            class="btn primary"
            :disabled="bulkPreview.count === 0 || importing"
            @click="confirmBulkCreate"
          >
            {{ importing ? '创建中...' : `确认创建 ${bulkPreview.count} 条` }}
          </button>
        </div>
      </div>

      <div v-if="excelMessage" class="footer-msg">{{ excelMessage }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-panel {
  background: var(--bg-secondary);
  border-radius: 16px;
  width: 100%;
  max-width: 640px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 20px;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  h3 { font-size: 18px; color: var(--text-primary); margin: 0; }
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 20px;
}

.tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-primary);
  padding: 4px;
  border-radius: 10px;
  margin-bottom: 16px;
}

.tab-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  &.active { background: var(--color-work); color: white; }
}

.tab-content { display: flex; flex-direction: column; gap: 14px; }

.section { display: flex; flex-direction: column; gap: 10px; }

.help {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  background: var(--bg-primary);
  padding: 10px 12px;
  border-radius: 8px;
  b { color: var(--text-primary); }
  code {
    background: var(--bg-hover);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
  }
}

.btn-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  &.right { justify-content: flex-end; }
}

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  &.primary { background: var(--color-work); color: white; }
  &.secondary { background: var(--bg-primary); color: var(--text-primary); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.result-box {
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-summary { display: flex; gap: 8px; }
.badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  &.ok { background: rgba(123, 196, 127, 0.2); color: #4a8f4d; }
  &.err { background: rgba(231, 76, 60, 0.15); color: #c0392b; }
}

.error-list, .preview-list {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 8px 12px;
  max-height: 160px;
  overflow-y: auto;
  font-size: 13px;
}

.error-item {
  color: #c0392b;
  padding: 3px 0;
  &.more { color: var(--text-tertiary); }
}

.preview-title {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.preview-item {
  display: flex;
  gap: 8px;
  padding: 3px 0;
  .p-date { color: var(--text-secondary); min-width: 90px; }
  .p-time { color: var(--text-tertiary); min-width: 100px; font-family: monospace; }
  .p-title { color: var(--text-primary); flex: 1; }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);

  &.full { grid-column: 1 / -1; }

  input, select, textarea {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    font-family: inherit;
  }
}

.weekday-picker { display: flex; gap: 6px; flex-wrap: wrap; }
.wd-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  &.active { background: var(--color-work); color: white; }
}

.preview-box {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  b { color: var(--color-work); font-size: 15px; }
}

.footer-msg {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--calendar-today-bg);
  color: var(--text-primary);
  font-size: 13px;
  text-align: center;
}

@media (max-width: 640px) {
  .form-grid { grid-template-columns: 1fr; }
  .modal-panel { padding: 14px; }
}
</style>
