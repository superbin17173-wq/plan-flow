<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  confirm: [cards: Array<{ front: string; back: string }>]
  close: []
}>()

interface Draft {
  front: string
  back: string
}

const drafts = ref<Draft[]>([{ front: '', back: '' }])

function addEmpty() {
  drafts.value.push({ front: '', back: '' })
}

function removeAt(i: number) {
  if (drafts.value.length <= 1) return
  drafts.value.splice(i, 1)
}

function validCount(): number {
  return drafts.value.filter(d => d.front.trim() && d.back.trim()).length
}

function confirm() {
  const valid = drafts.value.filter(d => d.front.trim() && d.back.trim())
  if (valid.length === 0) return
  emit('confirm', valid)
}
</script>

<template>
  <Teleport to="body">
    <div class="sheet-mask" @click.self="$emit('close')">
      <div class="sheet sheet-large">
        <div class="sheet-handle" />
        <h3 class="sheet-title">添加卡牌</h3>

        <div class="sheet-body">
          <div v-for="(d, i) in drafts" :key="i" class="card-form">
            <div class="card-form-header">
              <span class="card-num">卡牌 {{ i + 1 }}</span>
              <button v-if="drafts.length > 1" class="remove-btn" @click="removeAt(i)">✕</button>
            </div>
            <textarea
              v-model="d.front"
              class="card-textarea"
              placeholder="问题 (正面)"
              rows="2"
            />
            <textarea
              v-model="d.back"
              class="card-textarea"
              placeholder="答案 (背面)"
              rows="3"
            />
          </div>

          <button class="add-more-btn" @click="addEmpty">
            + 添加另一张
          </button>
        </div>

        <div class="sheet-actions">
          <button class="ios-btn ios-btn-secondary" @click="$emit('close')">取消</button>
          <button class="ios-btn" :disabled="validCount() === 0" @click="confirm">
            添加 {{ validCount() }} 张
          </button>
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
.sheet-large { max-height: 85vh; overflow-y: auto; }
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
.sheet-body { display: flex; flex-direction: column; gap: 12px; }
.card-form {
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 10px;
  padding: 12px;
}
.card-form-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px;
}
.card-num {
  font-size: 13px; font-weight: 600;
  color: var(--text-secondary, #8e8e93);
}
.remove-btn {
  background: none; border: none; cursor: pointer;
  color: var(--text-secondary, #8e8e93);
  font-size: 16px; padding: 2px 6px;
}
.card-textarea {
  width: 100%; border: none; border-radius: 8px;
  background: var(--card-bg, #fff);
  padding: 10px 12px; font-size: 14px;
  resize: vertical; margin-top: 6px;
  color: var(--text-primary, #1c1c1e);
  font-family: inherit;
  &::placeholder { color: var(--text-tertiary, #c7c7c7); }
}
.add-more-btn {
  width: 100%; padding: 12px;
  border: 2px dashed var(--separator-color, #e5e5e5);
  border-radius: 10px; background: transparent;
  color: var(--accent-color, #007AFF);
  font-size: 14px; font-weight: 600;
  cursor: pointer;
  &:active { background: var(--bg-secondary, #f5f5f5); }
}
.sheet-actions {
  display: flex; gap: 12px; margin-top: 20px;
  .ios-btn { flex: 1; }
}
</style>
