<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { checkForUpdate, downloadAndUpdate, hasDownloadedUpdate, getUpdateIndexPath, type UpdateInfo } from '../../utils/otaUpdate'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { APP_VERSION } from '../../utils/version'

const showUpdateDialog = ref(false)
const updateInfo = ref<UpdateInfo | null>(null)
const downloading = ref(false)
const progress = ref(0)
const updateDone = ref(false)
const updateError = ref('')
const showSuccessToast = ref(false)
const successVersion = ref('')

// 检查上次更新是否成功（启动时对比版本号）
async function checkUpdateSuccess() {
  if (!Capacitor.isNativePlatform()) return

  const { value: pendingVersion } = await Preferences.get({ key: 'ota_pending_version' })
  if (pendingVersion && pendingVersion === APP_VERSION) {
    // 已经在新版本上运行
    successVersion.value = pendingVersion
    showSuccessToast.value = true
    // 清除标记
    await Preferences.remove({ key: 'ota_pending_version' })
    // 3秒后自动隐藏
    setTimeout(() => {
      showSuccessToast.value = false
    }, 3500)
  }
}

// 检查并加载已下载的更新
async function loadDownloadedUpdate() {
  if (!Capacitor.isNativePlatform()) return

  const hasUpdate = await hasDownloadedUpdate()
  if (!hasUpdate) return

  const indexPath = await getUpdateIndexPath()
  if (!indexPath) return

  if (Capacitor.getPlatform() === 'android') {
    console.log('OTA: 加载已下载的更新', indexPath)
    window.location.href = indexPath
  }
}

async function checkUpdate() {
  if (!Capacitor.isNativePlatform()) return

  // 先检查上次更新是否成功
  await checkUpdateSuccess()

  // 检查是否有已下载的更新
  await loadDownloadedUpdate()

  const info = await checkForUpdate()
  if (info.hasUpdate) {
    updateInfo.value = info
    showUpdateDialog.value = true
  }
}

async function doUpdate() {
  downloading.value = true
  updateError.value = ''
  progress.value = 0

  const result = await downloadAndUpdate((p: number) => {
    progress.value = p
  })

  if (result.success) {
    updateDone.value = true
    // 保存目标版本号，下次启动时比对
    if (updateInfo.value?.version) {
      await Preferences.set({ key: 'ota_pending_version', value: updateInfo.value.version })
    }
  } else {
    updateError.value = result.error || '更新失败，请重试'
    downloading.value = false
  }
}

// 手动重启加载新版本
async function reloadNow() {
  const indexPath = await getUpdateIndexPath()
  if (indexPath) {
    window.location.href = indexPath
  } else {
    window.location.reload()
  }
}

function skipUpdate() {
  showUpdateDialog.value = false
  // 重置状态
  downloading.value = false
  updateDone.value = false
  progress.value = 0
  updateError.value = ''
}

function dismissSuccessToast() {
  showSuccessToast.value = false
}

onMounted(() => {
  checkUpdate()
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
// iOS 风格 OTA 更新对话框
.ota-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.ota-dialog {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 28px 24px 24px;
  max-width: 320px;
  width: 100%;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.ota-icon {
  font-size: 52px;
  margin-bottom: 12px;
}

h3 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
  color: #1A1A1A;
}

.ota-info {
  p {
    font-size: 15px;
    color: #8E8E93;
    margin: 8px 0;

    b { color: #007AFF; }
  }

  .build-time {
    font-size: 12px;
    color: #C7C7CC;
    margin-top: 12px;
  }
}

.ota-progress {
  .progress-bar {
    height: 6px;
    background: #E5E5EA;
    border-radius: 3px;
    overflow: hidden;
    margin: 16px 0;

    .progress-fill {
      height: 100%;
      background: #007AFF;
      border-radius: 3px;
      transition: width 0.3s;
    }
  }

  p {
    font-size: 14px;
    color: #8E8E93;
  }
}

.ota-success {
  padding: 8px 0;

  .success-line {
    font-size: 16px;
    color: #34C759;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .hint-line {
    font-size: 13px;
    color: #8E8E93;
  }
}

.ota-error {
  p {
    font-size: 15px;
    color: #FF3B30;
    line-height: 1.5;
  }
}

.ota-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;

  button {
    flex: 1;
    padding: 14px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-skip {
    background: #E5E5EA;
    color: #1A1A1A;

    &:active { opacity: 0.7; }
  }

  .btn-update {
    background: #007AFF;
    color: white;

    &:active { opacity: 0.85; }
  }
}

// 成功提示 Toast
.ota-success-toast {
  position: fixed;
  top: calc(env(safe-area-inset-top, 20px) + 12px);
  left: 16px;
  right: 16px;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  max-width: 400px;
  margin: 0 auto;
  cursor: pointer;

  .toast-icon {
    font-size: 28px;
  }

  .toast-content {
    flex: 1;
    text-align: left;
  }

  .toast-title {
    font-size: 16px;
    font-weight: 600;
    color: #1A1A1A;
  }

  .toast-subtitle {
    font-size: 13px;
    color: #8E8E93;
    margin-top: 2px;
  }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.toast-enter-active, .toast-leave-active {
  transition: all 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
