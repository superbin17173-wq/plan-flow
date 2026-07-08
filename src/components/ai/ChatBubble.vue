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
// iOS 风格 AI 聊天浮动按钮
.chat-fab {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom, 20px));
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background: #007AFF;
  color: white;
  font-size: 26px;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
  z-index: 2400;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.95);
  }

  &.open {
    background: #E5E5EA;
    color: #1A1A1A;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}
</style>