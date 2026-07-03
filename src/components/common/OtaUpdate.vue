<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { checkForUpdate, downloadAndUpdate, type UpdateInfo } from '../../utils/otaUpdate'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

const showUpdateDialog = ref(false)
const updateInfo = ref<UpdateInfo | null>(null)
const downloading = ref(false)
const progress = ref(0)
const updateDone = ref(false)
const updateError = ref('')

async function checkUpdate() {
  // 只在原生环境中检查OTA更新
  if (!Capacitor.isNativePlatform()) return

  const info = await checkForUpdate()
  if (info.hasUpdate) {
    updateInfo.value = info
    showUpdateDialog.value = true
  }
}

async function doUpdate() {
  downloading.value = true
  updateError.value = ''

  const success = await downloadAndUpdate((p: number) => {
    progress.value = p
  })

  if (success) {
    updateDone.value = true
    // 2秒后重新加载
    setTimeout(() => {
      window.location.reload()
    }, 2000)
  } else {
    updateError.value = '更新失败，请检查网络连接'
    downloading.value = false
  }
}

function skipUpdate() {
  showUpdateDialog.value = false
}

onMounted(() => {
  checkUpdate()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showUpdateDialog" class="ota-overlay" @click.self="skipUpdate">
        <div class="ota-dialog">
          <div class="ota-icon"></div>
          <h3>发现新版本</h3>

          <div v-if="updateInfo && !downloading && !updateDone" class="ota-info">
            <p>当前版本: {{ updateInfo.localVersion }}</p>
            <p>最新版本: {{ updateInfo.version }}</p>
            <p v-if="updateInfo.buildTime">构建时间: {{ new Date(updateInfo.buildTime).toLocaleString('zh-CN') }}</p>
          </div>

          <div v-if="downloading" class="ota-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <p>正在下载更新... {{ progress }}%</p>
          </div>

          <div v-if="updateDone" class="ota-success">
            <p>✅ 更新完成 (v{{ updateInfo?.version }})，正在重启...</p>
          </div>

          <div v-if="updateError" class="ota-error">
            <p>⚠️ {{ updateError }}</p>
          </div>

          <div v-if="!downloading && !updateDone" class="ota-actions">
            <button class="btn-skip" @click="skipUpdate">稍后再说</button>
            <button class="btn-update" @click="doUpdate">立即更新</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.ota-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.ota-dialog {
  background: var(--bg-secondary, #fff);
  border-radius: 16px;
  padding: 32px 24px;
  max-width: 340px;
  width: 100%;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.ota-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--text-primary, #333);
}

.ota-info {
  p {
    font-size: 14px;
    color: var(--text-secondary, #666);
    margin: 6px 0;
  }
}

.ota-progress {
  .progress-bar {
    height: 8px;
    background: var(--bg-primary, #eee);
    border-radius: 4px;
    overflow: hidden;
    margin: 16px 0;

    .progress-fill {
      height: 100%;
      background: var(--color-work, #81C9D8);
      border-radius: 4px;
      transition: width 0.3s;
    }
  }

  p {
    font-size: 14px;
    color: var(--text-secondary, #666);
  }
}

.ota-success {
  p {
    font-size: 15px;
    color: #27ae60;
    font-weight: 500;
  }
}

.ota-error {
  p {
    font-size: 14px;
    color: #e74c3c;
  }
}

.ota-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;

  button {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-skip {
    background: var(--bg-primary, #eee);
    color: var(--text-secondary, #666);

    &:hover {
      background: #ddd;
    }
  }

  .btn-update {
    background: var(--color-work, #81C9D8);
    color: white;

    &:hover {
      filter: brightness(1.1);
    }
  }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
