<script setup lang="ts">
import { ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { Plan, PlanFormData } from '../../types'
import { usePlanStore } from '../../stores/planStore'

const props = defineProps<{ editing: Plan | null }>()
const emit = defineEmits<{ close: [] }>()

const planStore = usePlanStore()

const form = ref<PlanFormData>({
  name: '',
  description: '',
  startDate: dayjs().format('YYYY-MM-DD'),
  endDate: dayjs().add(3, 'month').format('YYYY-MM-DD'),
})

const error = ref('')
const saving = ref(false)

watch(
  () => props.editing,
  (e) => {
    if (e) {
      form.value = {
        name: e.name,
        description: e.description || '',
        startDate: e.startDate,
        endDate: e.endDate,
      }
    }
  },
  { immediate: true },
)

async function onSave() {
  error.value = ''
  if (!form.value.name.trim()) {
    error.value = '请填写计划名称'
    return
  }
  if (!form.value.startDate || !form.value.endDate) {
    error.value = '请选择开始和结束日期'
    return
  }
  if (dayjs(form.value.endDate).isBefore(dayjs(form.value.startDate))) {
    error.value = '结束日期不能早于开始日期'
    return
  }
  saving.value = true
  try {
    if (props.editing) {
      await planStore.editPlan(props.editing.id, form.value)
    } else {
      await planStore.createPlan(form.value)
    }
    emit('close')
  } catch (e: any) {
    error.value = e?.message || '保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ editing ? '编辑计划' : '新建计划' }}</h2>
          <button class="close-btn" @click="emit('close')">×</button>
        </div>
        <form class="modal-body" @submit.prevent="onSave">
          <div class="form-group">
            <label class="form-label required">计划名称</label>
            <input
              v-model="form.name"
              type="text"
              class="form-input"
              maxlength="30"
              placeholder="例如:2026 Q3 冲刺计划"
              autofocus
            />
          </div>

          <div class="form-group">
            <label class="form-label">描述</label>
            <textarea
              v-model="form.description"
              class="form-input textarea"
              rows="2"
              maxlength="200"
              placeholder="选填,说明这个计划的目标"
            />
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label class="form-label required">开始日期</label>
              <input v-model="form.startDate" type="date" class="form-input" />
            </div>
            <div class="form-group half">
              <label class="form-label required">结束日期</label>
              <input v-model="form.endDate" type="date" class="form-input" />
            </div>
          </div>

          <p v-if="error" class="error-hint">{{ error }}</p>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="emit('close')">取消</button>
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@import './planDialog.shared.scss';
</style>
