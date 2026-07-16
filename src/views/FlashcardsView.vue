<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFlashcardStore } from '../stores/flashcardStore'
import DeckCard from '../components/flashcard/DeckCard.vue'
import WeeklyTrendChart from '../components/flashcard/WeeklyTrendChart.vue'
import CreateDeckDialog from '../components/flashcard/CreateDeckDialog.vue'

const router = useRouter()
const store = useFlashcardStore()

const showCreate = ref(false)

onMounted(async () => {
  await store.loadAll()
})

async function onCreate(data: { name: string; description: string; icon: string; color: string }) {
  const deck = await store.createDeck(data)
  showCreate.value = false
  router.push(`/flashcards/${deck.id}`)
}
</script>

<template>
  <div class="flashcards-view">
    <!-- Header -->
    <div class="view-header">
      <button class="back-btn" @click="router.back()">‹ 返回</button>
      <h1 class="view-title">🎴 记忆卡牌</h1>
      <button class="action-btn" @click="showCreate = true">+ 新建</button>
    </div>

    <div class="view-content">
      <!-- 总览统计 -->
      <div class="stat-pills" v-if="store.totalStats.total > 0">
        <div class="stat-pill">
          <span class="stat-num">{{ store.totalStats.total }}</span>
          <span class="stat-label">总卡牌</span>
        </div>
        <div class="stat-pill stat-pill-accent">
          <span class="stat-num">{{ store.totalStats.dueToday }}</span>
          <span class="stat-label">待复习</span>
        </div>
        <div class="stat-pill stat-pill-fire">
          <span class="stat-num">🔥 {{ store.totalStats.streak }}</span>
          <span class="stat-label">连续天数</span>
        </div>
      </div>

      <!-- 牌组列表 -->
      <div class="deck-list" v-if="store.decks.length > 0">
        <DeckCard
          v-for="deck in store.decks"
          :key="deck.id"
          :deck="deck"
          :stats="store.getDeckStats(deck.id)"
          @click="router.push(`/flashcards/${deck.id}`)"
        />
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <div class="empty-icon">🎴</div>
        <div class="empty-text">还没有牌组</div>
        <div class="empty-hint">创建你的第一个牌组,开始记忆训练!</div>
        <button class="ios-btn" @click="showCreate = true">+ 创建牌组</button>
      </div>

      <!-- 本周趋势 -->
      <WeeklyTrendChart
        v-if="store.sessions.length > 0"
        :data="store.weeklyData"
        class="trend-section"
      />
    </div>

    <!-- 创建弹窗 -->
    <CreateDeckDialog
      v-if="showCreate"
      @confirm="onCreate"
      @close="showCreate = false"
    />
  </div>
</template>

<style scoped lang="scss">
.flashcards-view {
  min-height: 100vh;
  background: var(--bg-primary, #f2f2f7);
}
.view-header {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  background: var(--material-regular, rgba(249,249,249,0.94));
  backdrop-filter: var(--backdrop-blur, blur(20px));
  border-bottom: 0.5px solid var(--separator-color, #e5e5e5);
}
.back-btn {
  background: none; border: none; cursor: pointer;
  font-size: 16px; color: var(--accent-color, #007AFF);
  padding: 4px 0;
}
.view-title {
  font-size: 17px; font-weight: 700;
  color: var(--text-primary, #1c1c1e);
}
.action-btn {
  background: none; border: none; cursor: pointer;
  font-size: 15px; font-weight: 600;
  color: var(--accent-color, #007AFF);
}
.view-content {
  max-width: 780px; margin: 0 auto; padding: 16px;
}

/* 统计条 */
.stat-pills {
  display: flex; gap: 10px; margin-bottom: 16px;
}
.stat-pill {
  flex: 1; background: var(--card-bg, #fff);
  border-radius: 12px; padding: 12px;
  text-align: center;
}
.stat-num {
  display: block; font-size: 22px; font-weight: 700;
  color: var(--text-primary, #1c1c1e);
}
.stat-label {
  font-size: 12px; color: var(--text-secondary, #8e8e93);
  margin-top: 2px;
}
.stat-pill-accent .stat-num { color: var(--accent-color, #007AFF); }
.stat-pill-fire .stat-num { }

/* 牌组列表 */
.deck-list {
  display: flex; flex-direction: column; gap: 10px;
}

/* 空状态 */
.empty-state {
  text-align: center; padding: 60px 20px;
}
.empty-icon { font-size: 56px; margin-bottom: 16px; }
.empty-text {
  font-size: 18px; font-weight: 600;
  color: var(--text-primary, #1c1c1e);
}
.empty-hint {
  font-size: 14px; color: var(--text-secondary, #8e8e93);
  margin: 8px 0 24px;
}

/* 趋势图 */
.trend-section { margin-top: 20px; }
</style>
