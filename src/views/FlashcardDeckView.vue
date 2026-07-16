<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFlashcardStore } from '../stores/flashcardStore'
import type { FlashcardCard, FlashcardPool } from '../types'
import { POOL_LABELS, POOL_COLORS } from '../types'
import AddCardsDialog from '../components/flashcard/AddCardsDialog.vue'
import EditCardDialog from '../components/flashcard/EditCardDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useFlashcardStore()

const deckId = route.params.deckId as string
const showAdd = ref(false)
const editingCard = ref<FlashcardCard | null>(null)
const editingPool = ref<FlashcardPool>('unmastered')
const showMenu = ref(false)

const deck = computed(() => store.getDeckById(deckId))
const stats = computed(() => store.getDeckStats(deckId))
const deckCards = computed(() => store.getCardsByDeck(deckId))

onMounted(async () => {
  await store.loadAll()
})

async function onAddCards(drafts: Array<{ front: string; back: string }>) {
  await store.addCards(deckId, drafts)
  showAdd.value = false
}

function openEdit(card: FlashcardCard) {
  editingCard.value = card
  editingPool.value = store.derivePool(card)
}

async function onEditCard(data: { front: string; back: string }) {
  if (!editingCard.value) return
  await store.editCard(editingCard.value.id, data)
  editingCard.value = null
}

async function onDeleteCard() {
  if (!editingCard.value) return
  if (!confirm('确定删除这张卡牌?')) return
  await store.deleteCard(editingCard.value.id)
  editingCard.value = null
}

async function onDeleteDeck() {
  if (!confirm('确定删除这个牌组? 所有卡牌也会被删除。')) return
  await store.deleteDeck(deckId)
  router.push('/flashcards')
}

function startPractice() {
  router.push(`/flashcards/practice/${deckId}`)
}

function startWeakest() {
  router.push(`/flashcards/practice/${deckId}?mode=weakest`)
}
</script>

<template>
  <div class="deck-view">
    <!-- Header -->
    <div class="view-header">
      <button class="back-btn" @click="router.back()">‹ 返回</button>
      <h1 class="view-title">{{ deck?.icon }} {{ deck?.name }}</h1>
      <button class="action-btn" @click="showMenu = !showMenu">⋯</button>
    </div>

    <!-- 菜单 -->
    <div v-if="showMenu" class="dropdown-menu" @click="showMenu = false">
      <button @click="showMenu = false">编辑牌组</button>
      <button class="menu-danger" @click="onDeleteDeck">删除牌组</button>
    </div>

    <div class="view-content">
      <!-- 三池统计 -->
      <div class="pool-grid">
        <div class="pool-card">
          <div class="pool-num" :style="{ color: POOL_COLORS.unmastered }">{{ stats.unmastered }}</div>
          <div class="pool-label">未掌握</div>
        </div>
        <div class="pool-card">
          <div class="pool-num" :style="{ color: POOL_COLORS.learning }">{{ stats.learning }}</div>
          <div class="pool-label">在学</div>
        </div>
        <div class="pool-card">
          <div class="pool-num" :style="{ color: POOL_COLORS.mastered }">{{ stats.mastered }}</div>
          <div class="pool-label">掌握</div>
        </div>
        <div class="pool-card">
          <div class="pool-num" style="color: #5AC8FA">{{ stats.dueToday }}</div>
          <div class="pool-label">待复习</div>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="actions">
        <button class="ios-btn ios-btn-block" :disabled="stats.dueToday === 0" @click="startPractice">
          🎯 开始练习 ({{ stats.dueToday }} 张待复习)
        </button>
        <button class="ios-btn ios-btn-tinted ios-btn-block" :disabled="stats.total === 0" @click="startWeakest">
          🔥 专项突破 (最弱的 {{ Math.min(10, stats.total) }} 张)
        </button>
      </div>

      <!-- 卡牌列表 -->
      <div class="card-list" v-if="deckCards.length > 0">
        <div class="section-title">卡牌 ({{ deckCards.length }})</div>
        <div
          v-for="card in deckCards"
          :key="card.id"
          class="card-item"
          @click="openEdit(card)"
        >
          <div class="card-front">{{ card.front }}</div>
          <div class="card-badges">
            <span
              class="pool-badge"
              :style="{
                background: POOL_COLORS[store.derivePool(card)] + '20',
                color: POOL_COLORS[store.derivePool(card)],
              }"
            >{{ POOL_LABELS[store.derivePool(card)] }}</span>
            <span class="review-count">{{ card.reviewCount }}次</span>
          </div>
        </div>
      </div>

      <!-- 添加按钮 -->
      <button class="ios-btn ios-btn-secondary ios-btn-block add-btn" @click="showAdd = true">
        + 添加新卡牌
      </button>
    </div>

    <!-- 弹窗 -->
    <AddCardsDialog v-if="showAdd" @confirm="onAddCards" @close="showAdd = false" />
    <EditCardDialog
      v-if="editingCard"
      :card="editingCard"
      :pool="editingPool"
      @confirm="onEditCard"
      @delete="onDeleteCard"
      @close="editingCard = null"
    />
  </div>
</template>

<style scoped lang="scss">
.deck-view {
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
}
.view-title {
  font-size: 17px; font-weight: 700;
  color: var(--text-primary, #1c1c1e);
}
.action-btn {
  background: none; border: none; cursor: pointer;
  font-size: 20px; color: var(--text-secondary, #8e8e93);
  padding: 4px 8px;
}
.dropdown-menu {
  position: absolute; right: 16px; top: 52px; z-index: 60;
  background: var(--card-bg, #fff);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
  button {
    display: block; width: 100%;
    padding: 12px 20px; border: none;
    background: transparent; cursor: pointer;
    font-size: 14px; text-align: left;
    color: var(--text-primary, #1c1c1e);
    &:active { background: var(--bg-secondary, #f5f5f5); }
  }
  .menu-danger { color: #FF3B30; }
}
.view-content {
  max-width: 780px; margin: 0 auto; padding: 16px;
}

/* 三池统计 */
.pool-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  margin-bottom: 16px;
}
.pool-card {
  background: var(--card-bg, #fff);
  border-radius: 12px; padding: 14px 8px;
  text-align: center;
}
.pool-num { font-size: 24px; font-weight: 700; }
.pool-label { font-size: 12px; color: var(--text-secondary, #8e8e93); margin-top: 2px; }

/* 快捷操作 */
.actions { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }

/* 卡牌列表 */
.section-title {
  font-size: 14px; font-weight: 600;
  color: var(--text-secondary, #8e8e93);
  margin-bottom: 10px;
}
.card-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.card-item {
  background: var(--card-bg, #fff);
  border-radius: 10px; padding: 12px 14px;
  display: flex; align-items: center; justify-content: space-between;
  cursor: pointer;
  &:active { opacity: 0.7; }
}
.card-front {
  font-size: 14px; color: var(--text-primary, #1c1c1e);
  flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-right: 10px;
}
.card-badges { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.pool-badge {
  font-size: 11px; font-weight: 600;
  padding: 2px 6px; border-radius: 5px;
}
.review-count {
  font-size: 12px; color: var(--text-secondary, #8e8e93);
}
.add-btn { margin-top: 8px; }
</style>
