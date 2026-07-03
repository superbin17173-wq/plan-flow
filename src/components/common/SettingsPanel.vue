<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingStore } from '../../stores/settingStore'
import { sendPushPlus } from '../../utils/pushplus'
import { useAIChat } from '../../composables/useAIChat'
import { checkForUpdate, downloadAndUpdate, type UpdateInfo } from '../../utils/otaUpdate'
import { Capacitor } from '@capacitor/core'

const settingStore = useSettingStore()
const aiChat = useAIChat()

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const testing = ref(false)
const testResult = ref<{ ok: boolean; msg: string } | null>(null)

// OTA 更新相关
const otaChecking = ref(false)
const otaInfo = ref<UpdateInfo | null>(null)
const otaDownloading = ref(false)
const otaProgress = ref(0)
const otaError = ref('')

async function checkOtaUpdate() {
  if (!Capacitor.isNativePlatform()) {
    otaError.value = '仅在手机 APP 中可用'
    return
  }
  otaChecking.value = true
  otaError.value = ''
  otaInfo.value = null

  const info = await checkForUpdate()
  otaChecking.value = false
  otaInfo.value = info

  if (!info.hasUpdate) {
    otaError.value = '已是最新版本'
  }
}

async function doOtaUpdate() {
  otaDownloading.value = true
  otaError.value = ''
  otaProgress.value = 0

  const success = await downloadAndUpdate((p) => {
    otaProgress.value = p
  })

  otaDownloading.value = false

  if (success) {
    otaError.value = '更新完成，重启后生效'
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  } else {
    otaError.value = '更新失败，请检查网络连接'
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

          <!-- OTA 远程更新 -->
          <section class="settings-section">
            <h3>APP 远程更新</h3>
            <p class="hint">检查是否有新版本，无需重新安装 APK 即可更新</p>

            <div class="ota-status">
              <p v-if="otaInfo">
                当前版本: {{ otaInfo.localVersion }}<br>
                最新版本: {{ otaInfo.version }}
              </p>
              <p v-if="otaError" :class="{ 'ota-success': otaError.includes('完成') }">{{ otaError }}</p>
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
                v-if="otaInfo?.hasUpdate && !otaDownloading"
                class="btn"
                @click="doOtaUpdate"
              >
                立即更新
              </button>
            </div>

            <div class="notice">
              <p class="warn">⚠️ 如提示网络错误，请切换 WiFi/4G 重试。Cloudflare 在部分运营商网络下可能不稳定。</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.settings-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 20px;
}

.settings-panel {
  background: var(--bg-secondary);
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);

  h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-tertiary);
  font-size: 20px;
  line-height: 1;

  &:hover {
    background: var(--bg-hover);
  }
}

.settings-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.settings-section {
  margin-bottom: 24px;

  h3 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 12px 0;
  }
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  cursor: pointer;

  span {
    color: var(--text-primary);
    font-size: 14px;
  }

  input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;

  span {
    font-size: 13px;
    color: var(--text-secondary);
  }

  input, select {
    padding: 8px 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    font-family: monospace;

    &:focus {
      outline: none;
      border-color: var(--color-work);
    }
  }
}

.hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 4px 0 0 0;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  background: var(--color-work);
  color: white;
  font-size: 13px;
  transition: filter 0.2s;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &.danger-btn {
    background: #ef4444;
  }
}

.ai-usage {
  font-size: 12px;
  color: var(--text-tertiary);
}

.test-result {
  font-size: 12px;

  &.ok {
    color: #22c55e;
  }
  &.err {
    color: #ef4444;
  }
}

.notice {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;

  ol {
    margin: 4px 0 8px 20px;
    padding: 0;
  }

  a {
    color: var(--color-work);
    text-decoration: underline;
  }

  .warn {
    margin-top: 8px;
    color: var(--text-tertiary);
    font-size: 11px;
  }
}

.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 0.2s;
}
.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

.ota-status {
  margin: 8px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.ota-success {
  color: #22c55e;
}

.ota-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;

  .progress-bar {
    height: 6px;
    width: 100px;
    background: var(--bg-primary);
    border-radius: 3px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background: var(--color-work);
      transition: width 0.2s;
    }
  }

  span {
    font-size: 12px;
    color: var(--text-tertiary);
  }
}
</style>
