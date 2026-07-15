<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import type { KnowledgeFile, KnowledgePoint } from '../../types'

const props = defineProps<{
  modelValue: string | undefined      // knowledgeRef
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | undefined): void
}>()

const router = useRouter()
const store = useKnowledgeStore()

const loaded = ref(false)

onMounted(async () => {
  if (!store.files.length) {
    await store.loadAll()
  }
  loaded.value = true
})

const files = computed(() => store.files)

const selectedPoint = computed<KnowledgePoint | null>(() => {
  if (!props.modelValue) return null
  return store.getPointById(props.modelValue) || null
})

function onSelectChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit('update:modelValue', v || undefined)
}

function clearSelection() {
  emit('update:modelValue', undefined)
}

function goUpload() {
  router.push('/knowledge')
}

function goFile(fileId: string) {
  router.push(`/knowledge/${fileId}`)
}

function getPointsOf(file: KnowledgeFile): KnowledgePoint[] {
  return store.getPointsByFile(file.id)
}
</script>

<template>
  <div class="knowledge-picker">
    <!-- 已关联知识点:展示简要信息 -->
    <div v-if="selectedPoint" class="kp-selected">
      <div class="kp-info">
        <span class="kp-label">📎 已关联知识点</span>
        <p class="kp-question">{{ selectedPoint.question }}</p>
      </div>
      <button type="button" class="kp-clear" @click="clearSelection" title="解除关联">×</button>
    </div>

    <!-- 未关联:下拉 + 上传入口 -->
    <div v-else class="kp-empty">
      <select class="form-input kp-select" :value="modelValue || ''" @change="onSelectChange">
        <option value="">选择已录入的知识点…</option>
        <optgroup v-for="f in files" :key="f.id" :label="f.title">
          <option
            v-for="p in getPointsOf(f)"
            :key="p.id"
            :value="p.id"
          >{{ p.question }}</option>
        </optgroup>
      </select>
      <button type="button" class="kp-upload-btn" @click="goUpload">
        📚 去知识库上传 / 抽取
      </button>
      <p v-if="loaded && !files.length" class="kp-empty-hint">
        还没有知识文件。点上方「去知识库上传」先录入内容,再回来关联。
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.knowledge-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kp-selected {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: rgba(0, 122, 255, 0.06);
  border: 0.5px solid rgba(0, 122, 255, 0.25);
  border-radius: 10px;
  padding: 10px 12px;
}
.kp-info { flex: 1; min-width: 0; }
.kp-label {
  font-size: 12px;
  color: var(--ios-blue);
  font-weight: 600;
  margin-bottom: 4px;
  display: block;
}
.kp-question {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  line-height: 1.4;
  margin: 0;
}
.kp-clear {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  flex-shrink: 0;
  &:hover { background: rgba(255, 59, 48, 0.1); color: #ff3b30; }
}

.kp-empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.kp-select {
  font-size: 14px;
}
.kp-upload-btn {
  align-self: flex-start;
  background: transparent;
  border: 0.5px dashed var(--ios-blue);
  color: var(--ios-blue);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  &:hover { background: rgba(0, 122, 255, 0.06); }
}
.kp-empty-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}
</style>
