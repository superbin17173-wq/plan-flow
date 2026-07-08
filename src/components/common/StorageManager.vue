<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getDB } from '../../utils/db'
import type { Task, AIMessage } from '../../types'
import type { AIMemory } from '../../types/memory'

const loading = ref(true)
const totalQuota = ref(0)
const totalUsage = ref(0)

const categoryUsage = ref<{ name: string; bytes: number; count: number }[]>([])
const cleaning = ref(false)

onMounted(async () => {
  await estimateStorage()
})

async function estimateStorage() {
  loading.value = true
  try {
    // 使用 navigator.storage.estimate() 获取配额
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate()
      totalQuota.value = estimate.quota || 0
      totalUsage.value = estimate.usage || 0
    }

    // 手动估算各分类
    const db = await getDB()

    // Tasks
    const tasks = await db.getAll('tasks') as Task[]
    let tasksBytes = 0
    for (const t of tasks) {
      tasksBytes += new Blob([JSON.stringify(t)]).size
    }
    categoryUsage.value.push({ name: '任务数据', bytes: tasksBytes, count: tasks.length })

    // AI Messages
    const aiMsgs = await db.getAll('ai_messages') as AIMessage[]
    let aiMsgsBytes = 0
    for (const m of aiMsgs) {
      aiMsgsBytes += new Blob([JSON.stringify(m)]).size
    }
    categoryUsage.value.push({ name: 'AI 消息', bytes: aiMsgsBytes, count: aiMsgs.length })

    // AI Memories
    const aiMems = await db.getAll('ai_memories') as AIMemory[]
    let aiMemsBytes = 0
    for (const m of aiMems) {
      aiMemsBytes += new Blob([JSON.stringify(m)]).size
    }
    categoryUsage.value.push({ name: 'AI 记忆', bytes: aiMemsBytes, count: aiMems.length })

    // Settings
    const settings = await db.getAll('settings')
    let settingsBytes = 0
    for (const s of settings) {
      settingsBytes += new Blob([JSON.stringify(s)]).size
    }
    categoryUsage.value.push({ name: '设置', bytes: settingsBytes, count: settings.length })

  } finally {
    loading.value = false
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatPercent(bytes: number): string {
  if (totalUsage.value === 0) return '0%'
  return `${((bytes / totalUsage.value) * 100).toFixed(1)}%`
}

async function clearCategory(name: string) {
  cleaning.value = true
  const db = await getDB()
  try {
    switch (name) {
      case '任务数据':
        // 只清理已完成的任务
        const tasks = await db.getAll('tasks') as Task[]
        for (const t of tasks) {
          if (t.isCompleted && !t.study?.ebbinghaus) {
            await db.delete('tasks', t.id)
          }
        }
        break
      case 'AI 消息':
        await db.clear('ai_messages')
        break
      case 'AI 记忆':
        await db.clear('ai_memories')
        break
      case '设置':
        // 不清理设置
        break
    }
    categoryUsage.value = []
    await estimateStorage()
  } finally {
    cleaning.value = false
  }
}

async function clearAllCompleted() {
  cleaning.value = true
  const db = await getDB()
  try {
    const tasks = await db.getAll('tasks') as Task[]
    for (const t of tasks) {
      if (t.isCompleted && !t.recurrence && !t.study?.ebbinghaus) {
        await db.delete('tasks', t.id)
      }
    }
    categoryUsage.value = []
    await estimateStorage()
  } finally {
    cleaning.value = false
  }
}
</script>

<template>
  <div class="storage-manager">
    <div v-if="loading" class="loading">正在计算...</div>

    <div v-else class="storage-content">
      <div class="total-bar">
        <div class="total-info">
          <span class="total-label">总占用</span>
          <span class="total-value">{{ formatBytes(totalUsage) }}</span>
          <span v-if="totalQuota" class="total-quota">/ {{ formatBytes(totalQuota) }} 可用</span>
        </div>
        <div v-if="totalQuota" class="progress-bar">
          <div class="progress-fill" :style="{ width: `${(totalUsage / totalQuota) * 100}%` }"></div>
        </div>
      </div>

      <div class="category-list">
        <div v-for="cat in categoryUsage" :key="cat.name" class="category-item">
          <div class="cat-info">
            <span class="cat-name">{{ cat.name }}</span>
            <span class="cat-stats">{{ cat.count }} 条 · {{ formatBytes(cat.bytes) }} ({{ formatPercent(cat.bytes) }})</span>
          </div>
          <button
            class="clear-btn"
            :disabled="cleaning || cat.bytes === 0"
            @click="clearCategory(cat.name)"
          >
            清理
          </button>
        </div>
      </div>

      <div class="actions">
        <button class="btn danger" :disabled="cleaning" @click="clearAllCompleted">
          清空所有已完成任务（不含学习）
        </button>
      </div>

      <div class="hint">
        <p>💡 学习任务和复习任务不会被自动清理</p>
        <p>⚠️ 清理 AI 消息/记忆会删除所有 AI 聊天历史</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.storage-manager {
  padding: 16px;
}

.loading {
  text-align: center;
  color: var(--text-tertiary);
  padding: 20px;
}

.total-bar {
  margin-bottom: 20px;
}

.total-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.total-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.total-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.total-quota {
  font-size: 12px;
  color: var(--text-tertiary);
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

.category-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
}

.cat-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cat-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.cat-stats {
  font-size: 12px;
  color: var(--text-tertiary);
}

.clear-btn {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) { background: var(--bg-hover); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;

  &.danger {
    background: rgba(240, 100, 100, 0.15);
    color: rgb(200, 70, 70);

    &:hover:not(:disabled) { background: rgba(240, 100, 100, 0.25); }
  }

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.hint {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-tertiary);

  p { margin-bottom: 4px; }
  p:last-child { margin-bottom: 0; }
}
</style>