<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { DEFAULT_CATEGORIES } from '../../types/category'

const uiStore = useUiStore()
const taskStore = useTaskStore()

const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const selectedPriority = ref<string | null>(null)
const selectedCompleted = ref<boolean | null>(null)

// 同步到 uiStore
watch(searchQuery, (v) => uiStore.searchQuery = v)
watch(selectedCategory, (v) => uiStore.filterCategory = v)
watch(selectedPriority, (v) => uiStore.filterPriority = v)
watch(selectedCompleted, (v) => uiStore.filterCompleted = v)

// 搜索结果
const searchResults = computed(() => {
  let results = taskStore.searchTasks(searchQuery.value)

  if (selectedCategory.value) {
    results = results.filter(t => t.category === selectedCategory.value)
  }
  if (selectedPriority.value) {
    results = results.filter(t => t.priority === selectedPriority.value)
  }
  if (selectedCompleted.value !== null) {
    results = results.filter(t => t.isCompleted === selectedCompleted.value)
  }

  return results.slice(0, 50)
})

// 按日期分组
const groupedResults = computed(() => {
  const groups: Record<string, typeof searchResults.value> = {}
  for (const task of searchResults.value) {
    if (!groups[task.date]) groups[task.date] = []
    groups[task.date].push(task)
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
})

function closePanel() {
  uiStore.toggleSearchPanel()
  searchQuery.value = ''
  selectedCategory.value = null
  selectedPriority.value = null
  selectedCompleted.value = null
}

function selectTask(taskId: string, date: string) {
  uiStore.selectDate(date)
  uiStore.openTaskCard(taskId)
}

function clearFilters() {
  searchQuery.value = ''
  selectedCategory.value = null
  selectedPriority.value = null
  selectedCompleted.value = null
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="uiStore.showSearchPanel" class="search-overlay" @click.self="closePanel">
        <Transition name="slide-down">
          <div class="search-panel">
            <div class="search-header">
              <input
                v-model="searchQuery"
                type="text"
                class="search-input"
                placeholder="搜索任务..."
                autofocus
              />
              <button class="close-btn" @click="closePanel">×</button>
            </div>

            <div class="search-filters">
              <!-- 分类筛选 -->
              <div class="filter-group">
                <label>分类</label>
                <select v-model="selectedCategory" class="filter-select">
                  <option :value="null">全部</option>
                  <option v-for="cat in DEFAULT_CATEGORIES" :key="cat.id" :value="cat.id">
                    {{ cat.name }}
                  </option>
                </select>
              </div>

              <!-- 优先级筛选 -->
              <div class="filter-group">
                <label>优先级</label>
                <select v-model="selectedPriority" class="filter-select">
                  <option :value="null">全部</option>
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>

              <!-- 完成状态筛选 -->
              <div class="filter-group">
                <label>状态</label>
                <select v-model="selectedCompleted" class="filter-select">
                  <option :value="null">全部</option>
                  <option :value="false">未完成</option>
                  <option :value="true">已完成</option>
                </select>
              </div>

              <button class="clear-btn" @click="clearFilters">清除筛选</button>
            </div>

            <div class="search-results">
              <div v-if="searchResults.length === 0" class="no-results">
                未找到匹配的任务
              </div>

              <div
                v-for="[date, tasks] in groupedResults"
                :key="date"
                class="result-group"
              >
                <div class="group-date">{{ date }}</div>
                <div
                  v-for="task in tasks"
                  :key="task.id"
                  class="result-item"
                  @click="selectTask(task.id, task.date)"
                >
                  <span class="task-dot" :style="{ backgroundColor: task.color }"></span>
                  <span class="task-title" :class="{ completed: task.isCompleted }">
                    {{ task.title }}
                  </span>
                  <span class="task-time">{{ task.startTime }}</span>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.search-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.search-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  max-width: 600px;
  margin: 0 auto;
  background: var(--bg-secondary);
  border-radius: 0 0 16px 16px;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.search-header {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--calendar-header-bg);
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: var(--bg-primary);
  border-radius: 8px;
  font-size: 16px;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-work);
  }
}

.close-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 20px;
  margin-left: 12px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--bg-hover);
  }
}

.search-filters {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;

  label {
    font-size: 12px;
    color: var(--text-tertiary);
  }
}

.filter-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
}

.clear-btn {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-tertiary);
  font-size: 12px;

  &:hover {
    background: var(--bg-hover);
  }
}

.search-results {
  max-height: 400px;
  overflow-y: auto;
  padding: 16px;
}

.no-results {
  text-align: center;
  color: var(--text-tertiary);
  padding: 32px;
}

.result-group {
  margin-bottom: 16px;
}

.group-date {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-hover);
  }
}

.task-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.task-title {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);

  &.completed {
    text-decoration: line-through;
    opacity: 0.6;
  }
}

.task-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

// 动画
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-down-enter-active, .slide-down-leave-active {
  transition: transform 0.3s;
}
.slide-down-enter-from, .slide-down-leave-to {
  transform: translateY(-100%);
}

@media (min-width: 769px) {
  .search-overlay {
    background: transparent;
    pointer-events: none;
  }

  .search-panel {
    position: fixed;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    width: 500px;
    border-radius: 16px;
    pointer-events: auto;
  }
}
</style>