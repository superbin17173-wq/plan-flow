<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { checkForUpdate, downloadUpdate, applyBundle, getBundleList, notifyAppReady, type UpdateInfo } from '../../utils/otaUpdate'
import { Capacitor } from '@capacitor/core'
import type { BundleInfo } from '@capgo/capacitor-updater'

const showUpdateDialog = ref(false)
const updateInfo = ref<UpdateInfo | null>(null)
const downloading = ref(false)
const progress = ref(0)
const updateDone = ref(false)
const updateError = ref('')
const showSuccessToast = ref(false)
const successVersion = ref('')
const applying = ref(false)

// 下载好的 bundle,点"立即启用"时用
const downloadedBundle = ref<BundleInfo | null>(null)

// 诊断日志(手机上直接可见,不用连 logcat)
const diagLog = ref<string[]>([])
const showDiag = ref(false)
function log(msg: string) {
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  diagLog.value.push(`[${ts}] ${msg}`)
  if (diagLog.value.length > 40) diagLog.value.shift()
}

async function checkUpdate() {
  if (!Capacitor.isNativePlatform()) return

  const info = await checkForUpdate()
  if (info.hasUpdate) {
    updateInfo.value = info
    showUpdateDialog.value = true
  }
}

async function doUpdate() {
  if (!updateInfo.value) return
  downloading.value = true
  updateError.value = ''
  progress.value = 0
  log(`doUpdate: 目标版本=${updateInfo.value.version},当前=${updateInfo.value.localVersion}`)

  const result = await downloadUpdate(updateInfo.value.version, (p) => {
    progress.value = p
  })

  if (result.success && result.bundle) {
    downloadedBundle.value = result.bundle
    updateDone.value = true
    log(`✓ 下载完成 bundle=${JSON.stringify(result.bundle)}`)
    log(`native list: ${await getBundleList()}`)
  } else {
    updateError.value = result.error || '更新失败,请重试'
    downloading.value = false
    log(`❌ 下载失败: ${result.error}`)
    showDiag.value = true
  }
}

// 立即启用: 切换 WebView 到新 bundle
async function reloadNow() {
  if (applying.value || !downloadedBundle.value) return
  applying.value = true
  try {
    log(`reloadNow: 开始,bundle=${JSON.stringify(downloadedBundle.value)}`)
    log(`native list(before): ${await getBundleList()}`)
    // 应用后 JS 上下文会立刻被销毁,后续代码不会执行
    const result = await applyBundle(downloadedBundle.value)
    // 走到这里说明 set() 没触发 reload,是 bug
    log(`⚠️ set 已返回但 WebView 未 reload`)
    log(`诊断: ${result.diagnosticsAfterSet}`)
    showDiag.value = true
    updateError.value = 'set() 已调用但 WebView 未重启,请展开诊断日志'
  } catch (err) {
    const msg = err instanceof Error ? (err.stack || err.message) : String(err)
    log(`❌ applyBundle 抛错: ${msg}`)
    showDiag.value = true
    updateError.value = err instanceof Error ? err.message : '应用失败'
  } finally {
    applying.value = false
  }
}

function skipUpdate() {
  showUpdateDialog.value = false
  downloading.value = false
  updateDone.value = false
  progress.value = 0
  updateError.value = ''
  downloadedBundle.value = null
}

function dismissSuccessToast() {
  showSuccessToast.value = false
}

onMounted(() => {
  checkUpdate()
})

// 供外部触发: 显示"更新成功"toast(App.vue 里 notifyAppReady 后可选调用)
defineExpose({
  showUpdateSuccessToast(version: string) {
    successVersion.value = version
    showSuccessToast.value = true
    setTimeout(() => { showSuccessToast.value = false }, 3500)
  },
})
</script>

<template>
  <Teleport to="body">
    <!-- 更新成功提示 Toast -->
    <Transition name="toast">
      <div v-if="showSuccessToast" class="ota-success-toast" @click="dismissSuccessToast">
        <div class="toast-icon">🎉</div>
        <div class="toast-content">
          <div class="toast-title">更新成功</div>
          <div class="toast-subtitle">已升级到 v{{ successVersion }}</div>
        </div>
      </div>
    </Transition>

    <!-- 更新对话框 -->
    <Transition name="fade">
      <div v-if="showUpdateDialog" class="ota-overlay" @click.self="skipUpdate">
        <div class="ota-dialog">
          <div class="ota-icon">{{ updateDone ? '✅' : '🚀' }}</div>
          <h3>{{ updateDone ? '下载完成' : '发现新版本' }}</h3>

          <div v-if="updateInfo && !downloading && !updateDone" class="ota-info">
            <p>当前版本: {{ updateInfo.localVersion }}</p>
            <p>最新版本: <b>{{ updateInfo.version }}</b></p>
            <p v-if="updateInfo.buildTime" class="build-time">
              构建时间: {{ new Date(updateInfo.buildTime).toLocaleString('zh-CN') }}
            </p>
            <div v-if="updateInfo.changelog" class="changelog-section">
              <h4>更新内容:</h4>
              <pre class="changelog-text">{{ updateInfo.changelog }}</pre>
            </div>
          </div>

          <div v-if="downloading" class="ota-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <p>正在下载更新... {{ progress }}%</p>
          </div>

          <div v-if="updateDone" class="ota-success">
            <p class="success-line">新版本 v{{ updateInfo?.version }} 已下载</p>
            <p class="hint-line">点击下方按钮加载新版本</p>
          </div>

          <div v-if="updateError" class="ota-error">
            <p>⚠️ {{ updateError }}</p>
          </div>

          <!-- 诊断日志(默认折叠,点击展开;手机上直接能看,不用连 logcat) -->
          <div v-if="diagLog.length > 0" class="ota-diag">
            <button class="diag-toggle" @click="showDiag = !showDiag">
              {{ showDiag ? '▼' : '▶' }} 诊断日志 ({{ diagLog.length }})
            </button>
            <pre v-if="showDiag" class="diag-content">{{ diagLog.join('\n') }}</pre>
          </div>

          <!-- 未开始更新时 -->
          <div v-if="!downloading && !updateDone && !updateError" class="ota-actions">
            <button class="btn-skip" @click="skipUpdate">稍后再说</button>
            <button class="btn-update" @click="doUpdate">立即更新</button>
          </div>

          <!-- 更新完成后 -->
          <div v-if="updateDone" class="ota-actions">
            <button class="btn-update" @click="reloadNow">立即启用</button>
          </div>

          <!-- 出错时 -->
          <div v-if="updateError" class="ota-actions">
            <button class="btn-skip" @click="skipUpdate">关闭</button>
            <button class="btn-update" @click="doUpdate">重试</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
// iOS OTA
.ota-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.ota-dialog {
  background: var(--bg-elevated);
  border-radius: var(--radius-xl);
  padding: 28px 24px 24px;
  max-width: 320px;
  width: 100%;
  text-align: center;
  box-shadow: var(--shadow-xl);
  color: var(--text-primary);
}

.ota-icon {
  font-size: 52px;
  margin-bottom: 12px;
}

h3 {
  font-size: var(--font-size-title3);
  font-weight: 700;
  margin: 0 0 14px;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.ota-info {
  p {
    font-size: var(--font-size-sub);
    color: var(--text-secondary);
    margin: 6px 0;

    b { color: var(--ios-blue); font-weight: 700; }
  }

  .build-time {
    font-size: var(--font-size-caption);
    color: var(--text-tertiary);
    margin-top: 10px;
  }

  .changelog-section {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 0.5px solid var(--separator-opaque);
    text-align: left;

    h4 {
      font-size: var(--font-size-sub);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 8px;
    }

    .changelog-text {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-secondary);
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      padding: 0;
      font-family: inherit;
    }
  }
}

.ota-progress {
  .progress-bar {
    height: 6px;
    background: var(--separator-opaque);
    border-radius: 3px;
    overflow: hidden;
    margin: 16px 0;

    .progress-fill {
      height: 100%;
      background: var(--ios-blue);
      border-radius: 3px;
      transition: width 0.3s;
    }
  }

  p {
    font-size: var(--font-size-sub);
    color: var(--text-secondary);
  }
}

.ota-success {
  padding: 8px 0;

  .success-line {
    font-size: var(--font-size-callout);
    color: var(--ios-green);
    font-weight: 700;
    margin-bottom: 6px;
  }

  .hint-line {
    font-size: var(--font-size-footnote);
    color: var(--text-tertiary);
  }
}

.ota-error {
  p {
    font-size: var(--font-size-sub);
    color: var(--ios-red);
    line-height: 1.5;
  }
}

.ota-diag {
  margin-top: 12px;
  text-align: left;

  .diag-toggle {
    background: transparent;
    border: none;
    color: var(--ios-blue);
    font-size: var(--font-size-footnote);
    padding: 4px 0;
    cursor: pointer;
    font-weight: 600;
  }

  .diag-content {
    margin-top: 6px;
    max-height: 240px;
    overflow: auto;
    background: var(--bg-fill-quaternary);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1.4;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.ota-actions {
  display: flex;
  gap: 10px;
  margin-top: 22px;

  button {
    flex: 1;
    padding: 13px;
    min-height: 48px;
    border-radius: var(--radius-md);
    font-size: var(--font-size-callout);
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: transform var(--spring), opacity var(--transition-fast);

    &:active { transform: scale(0.97); opacity: 0.9; }
  }

  .btn-skip {
    background: var(--bg-fill-quaternary);
    color: var(--text-primary);
  }

  .btn-update {
    background: var(--ios-blue);
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 122, 255, 0.28);
  }
}

// 成功 Toast
.ota-success-toast {
  position: fixed;
  top: calc(var(--safe-top) + 12px);
  left: 16px;
  right: 16px;
  background: var(--material-thick);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  border: 0.5px solid var(--separator);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: var(--shadow-lg);
  z-index: 10000;
  max-width: 420px;
  margin: 0 auto;
  cursor: pointer;
  color: var(--text-primary);

  .toast-icon { font-size: 26px; }

  .toast-content {
    flex: 1;
    text-align: left;
  }

  .toast-title {
    font-size: var(--font-size-callout);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .toast-subtitle {
    font-size: var(--font-size-footnote);
    color: var(--text-tertiary);
    margin-top: 2px;
  }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.toast-enter-active, .toast-leave-active {
  transition: transform 0.34s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.24s;
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateY(-24px);
}
</style>
