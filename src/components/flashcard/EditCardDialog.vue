<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FlashcardCard, FlashcardPool } from '../../types'
import { POOL_LABELS, POOL_COLORS } from '../../types'
import dayjs from 'dayjs'

const props = defineProps<{
  card: FlashcardCard | null
  pool: FlashcardPool
}>()

const emit = defineEmits<{
  confirm: [data: { front: string; back: string }]
  delete: []
  close: []
}>()

const front = ref('')
const back = ref('')

watch(() => props.card, (c) => {
  if (c) {
    front.value = c.front
    back.value = c.back
  }
}, { immediate: true })

function confirm() {
  if (!front.value.trim() || !back.value.trim()) return
  emit('confirm', { front: front.value.trim(), back: back.value.trim() })
}

function lastReviewLabel(): string {
  if (!props.card?.lastReviewDate) return '未复习'
  return dayjs(props.card.lastReviewDate).format('MM/DD')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="card" class="sheet-mask" @click.self="$emit('close')">
      <div class="sheet">
        <div class="sheet-handle" />
        <h3 class="sheet-title">编辑卡牌</h3>

        <div class="sheet-body">
          <div class="card-meta">
            <span
              class="pool-badge"
              :style="{ background: POOL_COLORS[pool] + '20', color: POOL_COLORS[pool] }"
            >{{ POOL_LABELS[pool] }}</span>
            <span class="meta-text">复习 {{ card.reviewCount }} 次</span>
            <span class="meta-text">{{ lastReviewLabel() }}</span>
          </div>

          <label class="field-label">问题 (正面)</label>
          <textarea v-model="front" class="card-textarea" rows="3" placeholder="问题" />

          <label class="field-label">答案 (背面)</label>
          <textarea v-model="back" class="card-textarea" rows="4" placeholder="答案" />
        </div>

        <div class="sheet-actions">
          <button class="ios-btn ios-btn-danger-tinted" @click="emit('delete')">删除</button>
          <button class="ios-btn ios-btn-secondary" @click="$emit('close')">取消</button>
          <button class="ios-btn" :disabled="!front.trim() || !back.trim()" @click="confirm">保存</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.sheet-mask {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end; justify-content: center;
}
.sheet {
  background: var(--card-bg, #fff);
  border-radius: 16px 16px 0 0;
  width: 100%; max-width: 500px;
  padding: 12px 20px 28px;
  animation: slideUp 0.3s ease;
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.sheet-handle {
  width: 36px; height: 5px; border-radius: 3px;
  background: var(--separator-color, #e5e5e5);
  margin: 0 auto 12px;
}
.sheet-title {
  font-size: 18px; font-weight: 700;
  text-align: center; margin-bottom: 16px;
  color: var(--text-primary, #1c1c1e);
}
.sheet-body { display: flex; flex-direction: column; gap: 10px; }
.card-meta {
  display: flex; align-items: center; gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--separator-color, #e5e5e5);
}
.pool-badge {
  font-size: 12px; font-weight: 600;
  padding: 2px 8px; border-radius: 6px;
}
.meta-text {
  font-size: 12px; color: var(--text-secondary, #8e8e93);
}
.field-label {
  font-size: 13px; font-weight: 600;
  color: var(--text-secondary, #8e8e93);
  margin-top: 4px;
}
.card-textarea {
  width: 100%; border: none; border-radius: 8px;
  background: var(--bg-secondary, #f5f5f5);
  padding: 10px 12px; font-size: 14px;
  resize: vertical;
  color: var(--text-primary, #1c1c1e);
  font-family: inherit;
  &::placeholder { color: var(--text-tertiary, #c7c7c7); }
}
.sheet-actions {
  display: flex; gap: 10px; margin-top: 20px;
  .ios-btn { flex: 1; }
}
</style>
