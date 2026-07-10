<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettingStore } from '../../stores/settingStore'
import { useTaskStore } from '../../stores/taskStore'
import { sendPushPlus } from '../../utils/pushplus'
import { useAIChat } from '../../composables/useAIChat'
import { checkForUpdate, downloadUpdate, applyBundle, type UpdateInfo } from '../../utils/otaUpdate'
import { mergeStudyTasks, getMergeableStudyTasks } from '../../utils/mergeStudy'
import type { Task } from '../../types'
import { Capacitor } from '@capacitor/core'
import type { BundleInfo } from '@capgo/capacitor-updater'
import StorageManager from './StorageManager.vue'
import { APP_VERSION } from '../../utils/version'

const settingStore = useSettingStore()
const taskStore = useTaskStore()
const aiChat = useAIChat()

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const testing = ref(false)
const testResult = ref<{ ok: boolean; msg: string } | null>(null)

// 学习管理 - 合并
const mergeableTasks = ref<Task[]>([])
const mergeTarget = ref<string | null>(null)
const mergeSource = ref<string | null>(null)
const merging = ref(false)
const mergeResult = ref<string | null>(null)

onMounted(async () => {
  mergeableTasks.value = await getMergeableStudyTasks()
})

async function doMerge() {
  if (!mergeTarget.value || !mergeSource.value) return
  if (mergeTarget.value === mergeSource.value) {
    mergeResult.value = '请选择两个不同的学习任务'
    return
  }
  merging.value = true
  mergeResult.value = null
  try {
    const merged = await mergeStudyTasks(mergeTarget.value, mergeSource.value)
    if (merged) {
      mergeResult.value = `✅ 合并完成: ${merged.study?.subject}`
      // 刷新列表
      mergeableTasks.value = await getMergeableStudyTasks()
      await taskStore.loadTasks()
      mergeTarget.value = null
      mergeSource.value = null
    }
  } catch (e) {
    mergeResult.value = `❌ 合并失败: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    merging.value = false
  }
}

// OTA 更新相关
const otaChecking = ref(false)
const otaInfo = ref<UpdateInfo | null>(null)
const otaDownloading = ref(false)
const otaProgress = ref(0)
const otaError = ref('')
const otaDone = ref(false)
const otaBundle = ref<BundleInfo | null>(null)

async function checkOtaUpdate() {
  if (!Capacitor.isNativePlatform()) {
    otaError.value = '仅在手机 APP 中可用'
    return
  }
  otaChecking.value = true
  otaError.value = ''
  otaInfo.value = null
  otaDone.value = false
  otaBundle.value = null

  const info = await checkForUpdate()
  otaChecking.value = false
  otaInfo.value = info

  if (!info.hasUpdate) {
    otaError.value = '已是最新版本'
  }
}

async function doOtaUpdate() {
  if (!otaInfo.value) return
  otaDownloading.value = true
  otaError.value = ''
  otaProgress.value = 0

  const result = await downloadUpdate(otaInfo.value.version, (p) => {
    otaProgress.value = p
  })

  otaDownloading.value = false

  if (result.success && result.bundle) {
    otaBundle.value = result.bundle
    otaDone.value = true
    otaError.value = ''
  } else {
    otaError.value = result.error || '更新失败'
  }
}

async function reloadNow() {
  if (!otaBundle.value) return
  try {
    await applyBundle(otaBundle.value)
  } catch (err) {
    otaError.value = err instanceof Error ? err.message : '应用失败'
  }
}

async function testPush() {
  const token = settingStore.settings.pushplusToken.trim()
  if (!token) {
    testResult.value = { ok: false, msg: '请先填写 Token' }
    return
  }
  testing.value = true
  testResult.value = null
  const result = await sendPushPlus({
    token,
    topic: settingStore.settings.pushplusTopic.trim() || undefined,
    title: 'PlanFlow 测试推送',
    content: '<h3>🎉 微信推送已生效</h3><p>如果你在微信里看到这条消息，说明配置成功了。</p>',
  })
  testing.value = false
  testResult.value = { ok: result.ok, msg: result.msg }
}

function close() {
  isOpen.value = false
}

async function onTokenBlur() {
  await settingStore.updateSetting('pushplusToken', settingStore.settings.pushplusToken.trim())
}
async function onTopicBlur() {
  await settingStore.updateSetting('pushplusTopic', settingStore.settings.pushplusTopic.trim())
}
async function onToggleEnabled(e: Event) {
  const val = (e.target as HTMLInputElement).checked
  await settingStore.updateSetting('pushplusEnabled', val)
}
async function onToggleNotify(e: Event) {
  const val = (e.target as HTMLInputElement).checked
  await settingStore.updateSetting('notificationsEnabled', val)
}

// AI 助手相关
async function onToggleAI(e: Event) {
  const val = (e.target as HTMLInputElement).checked
  await settingStore.updateSetting('aiEnabled', val)
}
async function onAIKeyBlur() {
  await settingStore.updateSetting('aiApiKey', settingStore.settings.aiApiKey.trim())
}
async function onAIModelChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  await settingStore.updateSetting('aiModel', val)
}
async function onAILimitBlur() {
  let v = Number(settingStore.settings.aiHistoryLimitMB)
  if (!Number.isFinite(v) || v < 1) v = 1
  if (v > 100) v = 100
  settingStore.settings.aiHistoryLimitMB = v
  await settingStore.updateSetting('aiHistoryLimitMB', v)
}
async function onClearAIHistory() {
  if (!confirm('确认清空全部 AI 对话历史？不可恢复。')) return
  await aiChat.clearAll()
}

// 豆包（视觉识图）
async function onToggleDoubao(e: Event) {
  const val = (e.target as HTMLInputElement).checked
  await settingStore.updateSetting('doubaoEnabled', val)
}
async function onDoubaoKeyBlur() {
  await settingStore.updateSetting('doubaoApiKey', settingStore.settings.doubaoApiKey.trim())
}
async function onDoubaoModelBlur() {
  await settingStore.updateSetting('doubaoModel', settingStore.settings.doubaoModel.trim())
}

// 睡眠时间配置
async function onSleepStartBlur() {
  const val = settingStore.settings.sleepStartTime.trim()
  if (!/^([01]?\d|2[0-3]):([0-5]\d)$/.test(val)) {
    settingStore.settings.sleepStartTime = '23:00'
    await settingStore.updateSetting('sleepStartTime', '23:00')
  } else {
    await settingStore.updateSetting('sleepStartTime', val)
  }
}
async function onSleepEndBlur() {
  const val = settingStore.settings.sleepEndTime.trim()
  if (!/^([01]?\d|2[0-3]):([0-5]\d)$/.test(val)) {
    settingStore.settings.sleepEndTime = '07:00'
    await settingStore.updateSetting('sleepEndTime', '07:00')
  } else {
    await settingStore.updateSetting('sleepEndTime', val)
  }
}
</script>

<template>
  <Transition name="settings-fade">
    <div v-if="isOpen" class="settings-mask" @click.self="close">
      <div class="settings-panel">
        <header class="settings-header">
          <h2>设置</h2>
          <button class="close-btn" @click="close">×</button>
        </header>

        <div class="settings-body">
          <!-- 通知 -->
          <section class="settings-section">
            <h3>浏览器通知</h3>
            <label class="row">
              <span>启用系统通知</span>
              <input type="checkbox" :checked="settingStore.settings.notificationsEnabled" @change="onToggleNotify" />
            </label>
            <p class="hint">当任务到达提醒时间时，弹出系统通知（浏览器需授权）</p>
          </section>

          <!-- PushPlus 微信推送 -->
          <section class="settings-section">
            <h3>微信推送（PushPlus）</h3>
            <label class="row">
              <span>启用微信推送</span>
              <input type="checkbox" :checked="settingStore.settings.pushplusEnabled" @change="onToggleEnabled" />
            </label>

            <label class="field">
              <span>Token</span>
              <input
                type="text"
                v-model="settingStore.settings.pushplusToken"
                @blur="onTokenBlur"
                placeholder="从 pushplus.plus 首页复制你的 token"
                autocomplete="off"
                spellcheck="false"
              />
            </label>

            <label class="field">
              <span>群组编码（可选）</span>
              <input
                type="text"
                v-model="settingStore.settings.pushplusTopic"
                @blur="onTopicBlur"
                placeholder="留空则推送到个人微信"
                autocomplete="off"
                spellcheck="false"
              />
            </label>

            <div class="actions">
              <button class="btn" :disabled="testing" @click="testPush">
                {{ testing ? '发送中...' : '发送测试消息' }}
              </button>
              <span v-if="testResult" class="test-result" :class="{ ok: testResult.ok, err: !testResult.ok }">
                {{ testResult.ok ? '✓ ' : '✗ ' }}{{ testResult.msg }}
              </span>
            </div>

            <div class="notice">
              <p><b>如何获取 Token：</b></p>
              <ol>
                <li>手机微信扫码关注公众号「pushplus推送加」</li>
                <li>访问 <a href="https://www.pushplus.plus" target="_blank" rel="noopener">pushplus.plus</a> 微信登录</li>
                <li>首页复制「一对一推送」的 token 到上方输入框</li>
              </ol>
              <p class="warn">⚠️ 目前仅在浏览器/PWA 打开时能推送微信。完全关闭 APP 时也想收到提醒，需要额外部署云函数。</p>
            </div>
          </section>

          <!-- AI 助手 -->
          <section class="settings-section">
            <h3>AI 日程助手（DeepSeek）</h3>
            <label class="row">
              <span>启用 AI 助手</span>
              <input type="checkbox" :checked="settingStore.settings.aiEnabled" @change="onToggleAI" />
            </label>

            <label class="field">
              <span>DeepSeek API Key</span>
              <input
                type="password"
                v-model="settingStore.settings.aiApiKey"
                @blur="onAIKeyBlur"
                placeholder="sk-xxxxxxxxxxxxxxxx"
                autocomplete="off"
                spellcheck="false"
              />
            </label>

            <label class="field">
              <span>模型</span>
              <select :value="settingStore.settings.aiModel" @change="onAIModelChange">
                <option value="deepseek-chat">deepseek-chat（推荐，快且便宜）</option>
                <option value="deepseek-reasoner">deepseek-reasoner（推理更强，更慢）</option>
              </select>
            </label>

            <label class="field">
              <span>对话历史本地存储上限 (MB)</span>
              <input
                type="number"
                min="1"
                max="100"
                v-model.number="settingStore.settings.aiHistoryLimitMB"
                @blur="onAILimitBlur"
              />
            </label>

            <div class="actions">
              <span class="ai-usage">当前占用: {{ aiChat.storageMB.value }} MB</span>
              <button class="btn danger-btn" @click="onClearAIHistory">清空对话历史</button>
            </div>

            <div class="notice">
              <p><b>如何获取 API Key：</b></p>
              <ol>
                <li>访问 <a href="https://platform.deepseek.com" target="_blank" rel="noopener">platform.deepseek.com</a> 注册登录</li>
                <li>左侧「API keys」→ 创建新 key，复制粘贴到上方</li>
                <li>建议在 DeepSeek 后台设置每日用量上限，避免意外扣费</li>
              </ol>
              <p class="warn">⚠️ Key 存在浏览器本地，请勿在公共设备使用。删除任务需要你确认才会执行。</p>
            </div>
          </section>

          <!-- 豆包视觉 -->
          <section class="settings-section">
            <h3>食物识图（豆包 Vision）</h3>
            <label class="row">
              <span>启用食物识图</span>
              <input type="checkbox" :checked="settingStore.settings.doubaoEnabled" @change="onToggleDoubao" />
            </label>

            <label class="field">
              <span>火山方舟 API Key</span>
              <input
                type="password"
                v-model="settingStore.settings.doubaoApiKey"
                @blur="onDoubaoKeyBlur"
                placeholder="ARK API Key"
                autocomplete="off"
                spellcheck="false"
              />
            </label>

            <label class="field">
              <span>接入点 ID / 模型名</span>
              <input
                type="text"
                v-model="settingStore.settings.doubaoModel"
                @blur="onDoubaoModelBlur"
                placeholder="ep-xxxx 或 doubao-1-5-vision-pro-32k-250115"
                autocomplete="off"
                spellcheck="false"
              />
            </label>

            <div class="notice">
              <p><b>如何配置：</b></p>
              <ol>
                <li>访问 <a href="https://www.volcengine.com/product/ark" target="_blank" rel="noopener">火山方舟</a> 注册开通</li>
                <li>控制台「API Key 管理」创建 Key</li>
                <li>「在线推理」→ 选择带视觉能力的模型（如 doubao-1-5-vision-pro）→ 创建接入点，复制接入点 ID (ep-xxx)</li>
                <li>启用后，在聊天窗点 📎 上传餐食图片，会自动识别并记录到今日饮食</li>
              </ol>
            </div>
          </section>

          <!-- 睡眠时间配置 -->
          <section class="settings-section">
            <h3>⏰ 时间统计</h3>
            <p class="hint">设置睡眠时间，用于日视图圆饼图计算休息时间</p>

            <div class="sleep-time-grid">
              <label class="field-inline">
                <span>入睡时间</span>
                <input
                  type="time"
                  v-model="settingStore.settings.sleepStartTime"
                  @blur="onSleepStartBlur"
                />
              </label>
              <label class="field-inline">
                <span>起床时间</span>
                <input
                  type="time"
                  v-model="settingStore.settings.sleepEndTime"
                  @blur="onSleepEndBlur"
                />
              </label>
            </div>

            <div class="notice">
              <p class="hint">💡 默认睡眠时间 23:00 - 07:00（8小时）。日视图会自动计算任务时间、睡眠时间和剩余休息时间。</p>
            </div>
          </section>

          <!-- OTA 远程更新 -->
          <section class="settings-section">
            <h3>APP 远程更新 <span class="version-badge">v{{ APP_VERSION }}</span></h3>
            <p class="hint">检查是否有新版本，无需重新安装 APK 即可更新</p>

            <div class="ota-status">
              <p v-if="otaInfo && !otaDone">
                当前版本: {{ otaInfo.localVersion }}<br>
                最新版本: <b>{{ otaInfo.version }}</b>
              </p>
              <p v-if="otaDone" class="ota-success">✅ 新版本已下载，点击下方按钮启用</p>
              <p v-if="otaError && !otaDone" :class="{ 'ota-success': otaError.includes('最新') }">{{ otaError }}</p>
            </div>

            <div v-if="otaDownloading" class="ota-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: otaProgress + '%' }"></div>
              </div>
              <span>{{ otaProgress }}%</span>
            </div>

            <div class="actions">
              <button class="btn" :disabled="otaChecking || otaDownloading" @click="checkOtaUpdate">
                {{ otaChecking ? '检查中...' : '检查更新' }}
              </button>
              <button
                v-if="otaInfo?.hasUpdate && !otaDownloading && !otaDone"
                class="btn"
                @click="doOtaUpdate"
              >
                立即下载
              </button>
              <button
                v-if="otaDone"
                class="btn primary-btn"
                @click="reloadNow"
              >
                立即启用
              </button>
            </div>

            <div class="notice">
              <p class="warn">⚠️ 如提示网络错误，请切换 WiFi/4G 重试。Cloudflare 在部分运营商网络下可能不稳定。</p>
            </div>
          </section>

          <!-- 学习管理 -->
          <section class="settings-section" v-if="mergeableTasks.length >= 2">
            <h3>📚 学习管理</h3>
            <p class="hint">合并两个学习任务的知识库（材料、复习历史、AI会话）</p>

            <div class="merge-row">
              <label>目标任务（保留）:</label>
              <select v-model="mergeTarget" class="merge-select">
                <option value="">请选择</option>
                <option v-for="t in mergeableTasks" :key="t.id" :value="t.id">{{ t.study?.subject }}</option>
              </select>
            </div>

            <div class="merge-row">
              <label>合并来源（归档）:</label>
              <select v-model="mergeSource" class="merge-select">
                <option value="">请选择</option>
                <option v-for="t in mergeableTasks" :key="t.id" :value="t.id">{{ t.study?.subject }}</option>
              </select>
            </div>

            <p v-if="mergeResult" class="merge-result">{{ mergeResult }}</p>

            <div class="actions">
              <button class="btn" :disabled="merging || !mergeTarget || !mergeSource" @click="doMerge">
                {{ merging ? '合并中...' : '确认合并' }}
              </button>
            </div>

            <div class="notice">
              <p class="hint">💡 合并后来源任务将归档，30天后自动清理。复习历史按时间合并，SM-2状态取保守值确保不会错过复习。</p>
            </div>
          </section>

          <!-- 存储管理 -->
          <section class="settings-section">
            <h3>📦 存储管理</h3>
            <StorageManager />
          </section>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
// iOS 设置面板
.settings-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 3000;
}

.settings-panel {
  background: var(--bg-primary);
  border-radius: var(--radius-xxl) var(--radius-xxl) 0 0;
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-bottom: var(--safe-bottom);
  box-shadow: var(--shadow-xl);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px;
  background: var(--bg-card);
  border-bottom: 0.5px solid var(--separator);
  position: relative;

  h2 {
    font-size: var(--font-size-headline);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
    margin: 0;
  }
}

.close-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--bg-fill-quaternary);
  color: var(--text-secondary);
  font-size: 18px;
  line-height: 1;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast);

  &:hover { background: var(--bg-pressed); }
}

.settings-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  background: var(--bg-primary);
}

.settings-section {
  margin-bottom: 22px;

  h3 {
    font-size: var(--font-size-footnote);
    font-weight: 600;
    color: var(--text-tertiary);
    margin: 0 0 8px 0;
    padding: 0 16px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  h3 + * {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-xs);
  }
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  min-height: 44px;
  cursor: pointer;
  background: var(--bg-card);
  transition: background var(--transition-fast);

  & + .row, & + .field, & + .sleep-time-grid { border-top: 0.5px solid var(--separator); }

  &:hover { background: var(--bg-hover); }

  span {
    color: var(--text-primary);
    font-size: var(--font-size-body);
  }

  input[type='checkbox'] {
    width: 22px;
    height: 22px;
    accent-color: var(--ios-blue);
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 12px 16px;
  background: var(--bg-card);

  & + .field, & + .row { border-top: 0.5px solid var(--separator); }

  span {
    font-size: var(--font-size-footnote);
    color: var(--text-tertiary);
    font-weight: 500;
  }

  input, select {
    padding: 11px 14px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--bg-fill-quaternary);
    color: var(--text-primary);
    font-size: var(--font-size-body);
    font-family: inherit;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);

    &:focus {
      outline: none;
      background: var(--bg-primary);
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.18);
    }
  }
}

.hint {
  font-size: var(--font-size-footnote);
  color: var(--text-tertiary);
  margin: 8px 0;
  padding: 0 16px;
  line-height: 1.5;
}

.version-badge {
  font-size: var(--font-size-caption);
  background: var(--bg-fill-quaternary);
  padding: 3px 8px;
  border-radius: var(--radius-full);
  color: var(--text-tertiary);
  margin-left: 8px;
  font-weight: 500;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 18px;
  min-height: 40px;
  border-radius: var(--radius-md);
  background: var(--ios-blue);
  color: #fff;
  font-size: var(--font-size-sub);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform var(--spring), opacity var(--transition-fast);

  &:active:not(:disabled) { transform: scale(0.97); opacity: 0.9; }

  &:disabled {
    background: var(--bg-fill-quaternary);
    color: var(--text-tertiary);
    cursor: not-allowed;
  }

  &.danger-btn { background: var(--ios-red); }
}

.ai-usage {
  font-size: var(--font-size-footnote);
  color: var(--text-tertiary);
}

.test-result {
  font-size: var(--font-size-footnote);
  font-weight: 500;

  &.ok { color: var(--ios-green); }
  &.err { color: var(--ios-red); }
}

.notice {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-fill-quaternary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  line-height: 1.6;

  ol { margin: 4px 0 8px 20px; padding: 0; }
  a { color: var(--ios-blue); text-decoration: underline; }
  .warn {
    margin-top: 8px;
    color: var(--text-tertiary);
    font-size: var(--font-size-caption2);
  }
}

.settings-fade-enter-active, .settings-fade-leave-active { transition: opacity 0.2s; }
.settings-fade-enter-from, .settings-fade-leave-to { opacity: 0; }

.ota-status {
  margin: 8px 0;
  font-size: var(--font-size-footnote);
  color: var(--text-secondary);
}

.sleep-time-grid {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-card);
}

.field-inline {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;

  span {
    font-size: var(--font-size-footnote);
    color: var(--text-tertiary);
  }

  input[type="time"] {
    padding: 10px 12px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--bg-fill-quaternary);
    color: var(--text-primary);
    font-size: var(--font-size-sub);
    font-family: inherit;

    &:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.18);
    }
  }
}

.ota-success { color: var(--ios-green); font-weight: 600; }
.primary-btn { background: var(--ios-green) !important; }

.ota-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;

  .progress-bar {
    height: 6px;
    width: 120px;
    background: var(--bg-fill-quaternary);
    border-radius: 3px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background: var(--ios-blue);
      transition: width 0.2s;
    }
  }

  span {
    font-size: var(--font-size-caption);
    color: var(--text-tertiary);
  }
}

.merge-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;

  label {
    font-size: var(--font-size-footnote);
    color: var(--text-secondary);
    min-width: 120px;
  }
}

.merge-select {
  flex: 1;
  padding: 8px 12px;
  border: 0.5px solid var(--separator);
  border-radius: var(--radius-sm);
  background: var(--bg-fill-quaternary);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
}

.merge-result {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-footnote);
  margin-bottom: 10px;
}

@media (max-width: 768px) {
  .settings-panel {
    max-height: 92vh;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }
  .close-btn { width: 32px; height: 32px; }
}

@media (min-width: 769px) {
  .settings-mask { align-items: center; padding: 16px; }
  .settings-panel { border-radius: var(--radius-xl); }
}
</style>
