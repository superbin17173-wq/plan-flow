<script setup lang="ts">
import type { FlashcardDeck, FlashcardStats } from '../../types'

defineProps<{
  deck: FlashcardDeck
  stats: FlashcardStats
}>()

defineEmits<{
  click: []
  edit: []
  delete: []
}>()

function masteryRate(stats: FlashcardStats): number {
  if (stats.total === 0) return 0
  return Math.round((stats.mastered / stats.total) * 100)
}
</script>

<template>
  <div class="deck-card" @click="$emit('click')">
    <div class="deck-main">
      <div class="deck-icon" :style="{ background: deck.color + '20', color: deck.color }">
        {{ deck.icon }}
      </div>
      <div class="deck-info">
        <div class="deck-name">{{ deck.name }}</div>
        <div class="deck-meta">
          {{ stats.total }} 张 · {{ stats.dueToday }} 待复习
        </div>
        <div class="deck-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: masteryRate(stats) + '%', background: deck.color }"
            />
          </div>
          <span class="progress-text">{{ masteryRate(stats) }}%</span>
        </div>
      </div>
      <button class="deck-more" @click.stop="$emit('edit')">⋯</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.deck-card {
  background: var(--card-bg, #fff);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:active {
    transform: scale(0.98);
  }
}
.deck-main {
  display: flex;
  align-items: center;
  gap: 12px;
}
.deck-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}
.deck-info {
  flex: 1;
  min-width: 0;
}
.deck-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1c1c1e);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.deck-meta {
  font-size: 13px;
  color: var(--text-secondary, #8e8e93);
  margin-top: 2px;
}
.deck-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--separator-color, #e5e5e5);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}
.progress-text {
  font-size: 12px;
  color: var(--text-secondary, #8e8e93);
  min-width: 32px;
  text-align: right;
}
.deck-more {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-secondary, #8e8e93);
  cursor: pointer;
  padding: 4px 8px;
  flex-shrink: 0;
}
</style>
