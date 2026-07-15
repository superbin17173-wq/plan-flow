<script setup lang="ts">
import { ref } from 'vue'
import { DECK_COLOR_PRESETS, DECK_ICON_PRESETS } from '../../types'

const emit = defineEmits<{
  confirm: [data: { name: string; description: string; icon: string; color: string }]
  close: []
}>()

const name = ref('')
const description = ref('')
const icon = ref('📚')
const color = ref(DECK_COLOR_PRESETS[5]) // 默认蓝色

function confirm() {
  if (!name.value.trim()) return
  emit('confirm', {
    name: name.value.trim(),
    description: description.value.trim(),
    icon: icon.value,
    color: color.value,
  })
}
</script>

<template>
  <Teleport to="body">
    <div class="sheet-mask" @click.self="$emit('close')">
      <div class="sheet">
        <div class="sheet-handle" />
        <h3 class="sheet-title">新建牌组</h3>

        <div class="sheet-body">
          <label class="field-label">名称 *</label>
          <input v-model="name" class="ios-input" placeholder="如: Java基础、Spring" maxlength="30" />

          <label class="field-label">描述</label>
          <input v-model="description" class="ios-input" placeholder="可选" maxlength="100" />

          <label class="field-label">图标</label>
          <div class="icon-grid">
            <button
              v-for="e in DECK_ICON_PRESETS" :key="e"
              class="icon-option"
              :class="{ active: icon === e }"
              @click="icon = e"
            >{{ e }}</button>
          </div>

          <label class="field-label">颜色</label>
          <div class="color-grid">
            <button
              v-for="c in DECK_COLOR_PRESETS" :key="c"
              class="color-option"
              :class="{ active: color === c }"
              :style="{ background: c }"
              @click="color = c"
            />
          </div>
        </div>

        <div class="sheet-actions">
          <button class="ios-btn ios-btn-secondary" @click="$emit('close')">取消</button>
          <button class="ios-btn" :disabled="!name.trim()" @click="confirm">创建</button>
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
.sheet-body { display: flex; flex-direction: column; gap: 12px; }
.field-label {
  font-size: 13px; font-weight: 600;
  color: var(--text-secondary, #8e8e93);
  margin-bottom: 4px; display: block;
}
.icon-grid {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.icon-option {
  width: 40px; height: 40px; border-radius: 10px;
  border: 2px solid transparent;
  background: var(--bg-secondary, #f5f5f5);
  font-size: 20px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.15s;
  &.active { border-color: var(--accent-color, #007AFF); }
}
.color-grid {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.color-option {
  width: 32px; height: 32px; border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer; transition: border-color 0.15s, transform 0.15s;
  &.active { border-color: var(--text-primary, #1c1c1e); transform: scale(1.15); }
}
.sheet-actions {
  display: flex; gap: 12px; margin-top: 20px;
  .ios-btn { flex: 1; }
}
</style>
