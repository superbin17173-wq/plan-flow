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
                  <span class="task-time">{{ task.startTime || (task.durationMinutes ? task.durationMinutes + 'm' : '全天') }}</span>
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
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 1000;
}

.search-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  max-width: 640px;
  margin: 0 auto;
  background: var(--bg-elevated);
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  color: var(--text-primary);
}

.search-header {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  background: var(--material-regular);
  backdrop-filter: var(--backdrop-blur);
  border-bottom: 0.5px solid var(--separator);
  gap: 10px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 0.5px solid transparent;
  background: var(--bg-fill-quaternary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-body);
  color: var(--text-primary);

  &::placeholder { color: var(--text-tertiary); }
  &:focus {
    outline: none;
    background: var(--bg-card);
    border-color: var(--ios-blue);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.14);
  }
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-fill-quaternary);
  color: var(--text-secondary);
  font-size: 18px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover { background: var(--bg-pressed); }
}

.search-filters {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 0.5px solid var(--separator);
  align-items: center;
  background: var(--bg-card);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;

  label {
    font-size: var(--font-size-caption);
    color: var(--text-tertiary);
    font-weight: 500;
  }
}

.filter-select {
  padding: 6px 12px;
  border: 0.5px solid var(--separator);
  border-radius: var(--radius-sm);
  background: var(--bg-fill-quaternary);
  color: var(--text-primary);
  font-size: var(--font-size-footnote);
}

.clear-btn {
  padding: 6px 12px;
  border-radius: var(--radius-full);
  background: var(--bg-fill-quaternary);
  color: var(--ios-blue);
  font-size: var(--font-size-caption);
  font-weight: 500;
  border: none;
  cursor: pointer;
}

.search-results {
  max-height: 440px;
  overflow-y: auto;
  padding: 12px 12px 16px;
  background: var(--bg-card);
}

.no-results {
  text-align: center;
  color: var(--text-tertiary);
  padding: 40px 16px;
  font-size: var(--font-size-sub);
}

.result-group { margin-bottom: 16px; }

.group-date {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  margin-bottom: 6px;
  padding-left: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  min-height: 44px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover { background: var(--bg-hover); }
}

.task-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-title {
  flex: 1;
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.completed {
    text-decoration: line-through;
    opacity: 0.55;
  }
}

.task-time {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.24s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-down-enter-active, .slide-down-leave-active {
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-down-enter-from, .slide-down-leave-to { transform: translateY(-100%); }

@media (min-width: 769px) {
  .search-overlay { background: rgba(0,0,0,0.25); }
  .search-panel {
    position: fixed;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    width: 540px;
    border-radius: var(--radius-xl);
  }
}

@media (max-width: 768px) {
  .search-filters {
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
  }
  .filter-group {
    flex: 1 1 auto;
    min-width: 0;
    label { display: none; }
  }
  .filter-select {
    width: 100%;
    padding: 8px 10px;
    font-size: var(--font-size-sub);
  }
  .clear-btn {
    flex-shrink: 0;
    padding: 8px 12px;
    font-size: var(--font-size-footnote);
  }
  .search-input { font-size: 16px; }
  .close-btn { width: 34px; height: 34px; }
  .search-results { max-height: calc(100vh - 200px); }
}
</style>