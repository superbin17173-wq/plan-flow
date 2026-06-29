<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'

const taskStore = useTaskStore()
const uiStore = useUiStore()

const stats = computed(() => ({
  today: taskStore.todayStats,
  week: taskStore.weekStats,
  month: taskStore.monthStats,
  category: taskStore.categoryStats,
}))

function closePanel() {
  uiStore.toggleStatsPanel()
}
</script>

<template>
  <div class="stats-panel">
    <div class="panel-header">
      <h3>任务统计</h3>
      <button class="close-btn" @click="closePanel">×</button>
    </div>

    <div class="panel-body">
      <!-- 今日进度 -->
      <div class="stat-section">
        <div class="stat-title">今日完成率</div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${stats.today.rate * 100}%`, backgroundColor: stats.today.rate >= 0.8 ? '#7BC47F' : '#F5A962' }"
          ></div>
        </div>
        <div class="stat-numbers">
          {{ stats.today.completed }} / {{ stats.today.total }}
        </div>
      </div>

      <!-- 本周进度 -->
      <div class="stat-section">
        <div class="stat-title">本周完成率</div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${stats.week.rate * 100}%` }"
          ></div>
        </div>
        <div class="stat-numbers">
          {{ stats.week.completed }} / {{ stats.week.total }}
        </div>
      </div>

      <!-- 本月进度 -->
      <div class="stat-section">
        <div class="stat-title">本月完成率</div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${stats.month.rate * 100}%` }"
          ></div>
        </div>
        <div class="stat-numbers">
          {{ stats.month.completed }} / {{ stats.month.total }}
        </div>
      </div>

      <!-- 分类分布 -->
      <div class="stat-section">
        <div class="stat-title">分类分布</div>
        <div class="category-stats">
          <div
            v-for="(data, catId) in stats.category"
            :key="catId"
            class="category-item"
          >
            <span class="cat-dot" :style="{ backgroundColor: `var(--color-${catId})` }"></span>
            <span class="cat-name">{{ catId }}</span>
            <span class="cat-count">{{ data.total }}</span>
            <span class="cat-rate">{{ Math.round((data.completed / data.total) * 100) || 0 }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stats-panel {
  position: absolute;
  top: 100%;
  right: 20px;
  width: 280px;
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  z-index: 50;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--calendar-header-bg);

  h3 {
    font-size: 16px;
    font-weight: 600;
  }
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--bg-hover);
  }
}

.panel-body {
  padding: 16px;
}

.stat-section {
  margin-bottom: 16px;
}

.stat-title {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.progress-bar {
  height: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-work);
  transition: width 0.3s;
}

.stat-numbers {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  text-align: right;
}

.category-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.cat-name {
  flex: 1;
  color: var(--text-primary);
}

.cat-count {
  color: var(--text-secondary);
}

.cat-rate {
  color: var(--color-work);
  font-weight: 500;
}

@media (max-width: 768px) {
  .stats-panel {
    position: fixed;
    inset: 0;
    top: 60px;
    width: 100%;
    border-radius: 0;
  }
}
</style>