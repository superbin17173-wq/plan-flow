<script setup lang="ts">
import { ref } from 'vue'
import ChatPanel from './ChatPanel.vue'
import { useSettingStore } from '../../stores/settingStore'

const isOpen = ref(false)
const settingStore = useSettingStore()

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div v-if="settingStore.settings.aiEnabled">
    <button class="chat-fab" @click="toggle" :class="{ open: isOpen }" title="AI 助手">
      <span v-if="!isOpen">🤖</span>
      <span v-else>×</span>
    </button>
    <ChatPanel v-model="isOpen" />
  </div>
</template>

<style scoped lang="scss">
.chat-fab {
  position: fixed;
  bottom: 24px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-work);
  color: white;
  font-size: 26px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: 2400;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;

  &:hover {
    transform: scale(1.05);
    filter: brightness(1.05);
  }

  &.open {
    background: var(--text-tertiary);
    transform: rotate(90deg);
    font-size: 30px;
  }
}

@media (max-width: 640px) {
  .chat-fab {
    bottom: 20px;
    right: 16px;
    width: 52px;
    height: 52px;
  }
}
</style>
