<script setup lang="ts">
import { computed } from 'vue'
import ChatPanel from './ChatPanel.vue'
import { useSettingStore } from '../../stores/settingStore'
import { useUiStore } from '../../stores/uiStore'

const settingStore = useSettingStore()
const uiStore = useUiStore()

const isOpen = computed(() => uiStore.showAiChat)

function toggle() {
  if (uiStore.showAiChat) {
    uiStore.closeAiChat()
  } else {
    uiStore.openAiChat()
  }
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
// iOS FAB
.chat-fab {
  position: fixed;
  bottom: calc(80px + var(--safe-bottom));
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--ios-blue);
  color: #fff;
  font-size: 26px;
  border: none;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 122, 255, 0.32), 0 2px 6px rgba(0, 122, 255, 0.18);
  z-index: 2400;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--spring), background var(--transition-normal), box-shadow var(--transition-normal);

  &:hover { transform: scale(1.05); }
  &:active { transform: scale(0.94); }

  &.open {
    background: var(--bg-elevated);
    color: var(--text-primary);
    box-shadow: var(--shadow-md);
    border: 0.5px solid var(--separator);
  }
}

@media (max-width: 768px) {
  .chat-fab {
    bottom: calc(24px + var(--safe-bottom));
    right: 16px;
    width: 52px;
    height: 52px;
    font-size: 24px;
  }
}
</style>