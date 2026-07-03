// OTA 远程更新模块
// 原理：APP启动时检查服务器 version.json，有新版本则下载 dist.zip 到本地并热更新

import { Filesystem, Directory } from '@capacitor/filesystem'
import JSZip from 'jszip'
import { Preferences } from '@capacitor/preferences'

// 更新服务器地址（Cloudflare Pages）
const UPDATE_SERVER = 'https://planflow-aot.pages.dev'
const VERSION_PATH = '/version.json'
const DIST_ZIP_PATH = '/dist.zip'
const LOCAL_DIR = 'planflow-updates'

export interface UpdateInfo {
  version: string
  buildTime: string
  hasUpdate: boolean
  localVersion: string
}

// 读取本地缓存的版本号
async function getLocalVersion(): Promise<string> {
  const { value } = await Preferences.get({ key: 'ota_version' })
  return value || '0.0.0'
}

// 保存本地版本号
async function setLocalVersion(version: string) {
  await Preferences.set({ key: 'ota_version', value: version })
}

// 检查是否有更新
export async function checkForUpdate(): Promise<UpdateInfo> {
  try {
    const res = await fetch(`${UPDATE_SERVER}${VERSION_PATH}`, {
      cache: 'no-store',
    })
    if (!res.ok) return { version: '', buildTime: '', hasUpdate: false, localVersion: await getLocalVersion() }

    const remote = await res.json()
    const localVersion = await getLocalVersion()
    const remoteVersion = remote.version || '0.0.0'

    return {
      version: remoteVersion,
      buildTime: remote.buildTime || '',
      hasUpdate: remoteVersion !== localVersion,
      localVersion,
    }
  } catch {
    return { version: '', buildTime: '', hasUpdate: false, localVersion: await getLocalVersion() }
  }
}

// 下载并安装更新
export async function downloadAndUpdate(
  onProgress?: (percent: number) => void
): Promise<boolean> {
  try {
    // 下载 zip（添加超时和错误处理）
    console.log('OTA: 开始下载', `${UPDATE_SERVER}${DIST_ZIP_PATH}`)

    const res = await fetch(`${UPDATE_SERVER}${DIST_ZIP_PATH}`, {
      mode: 'cors',
      cache: 'no-store',
    })

    console.log('OTA: 响应状态', res.status)

    if (!res.ok) {
      console.error('OTA: 下载失败，HTTP', res.status)
      return false
    }

    const total = Number(res.headers.get('content-length')) || 0
    const reader = res.body?.getReader()
    if (!reader) return false

    // 分块读取并显示进度
    const chunks: Uint8Array[] = []
    let received = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      if (onProgress && total > 0) {
        onProgress(Math.round((received / total) * 100))
      }
    }

    // 合并为完整 ArrayBuffer
    const zipBuffer = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      zipBuffer.set(chunk, offset)
      offset += chunk.length
    }

    // 解压
    const zip = await JSZip.loadAsync(zipBuffer)
    const files = Object.keys(zip.files)

    // 先清理旧目录
    try {
      await Filesystem.rmdir({ path: LOCAL_DIR, directory: Directory.Data, recursive: true })
    } catch {
      // 目录不存在，忽略
    }

    // 解压每个文件
    for (const filePath of files) {
      const file = zip.files[filePath]
      if (file.dir) continue

      const content = await file.async('string')

      // 确保父目录存在
      const parts = filePath.split('/')
      if (parts.length > 1) {
        let currentPath = ''
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]
          try {
            await Filesystem.mkdir({ path: currentPath, directory: Directory.Data, recursive: true })
          } catch {
            // 已存在
          }
        }
      }

      await Filesystem.writeFile({
        path: filePath,
        data: content,
        directory: Directory.Data,
        recursive: true,
      })
    }

    // 保存版本号
    const versionRes = await fetch(`${UPDATE_SERVER}${VERSION_PATH}`)
    if (versionRes.ok) {
      const versionData = await versionRes.json()
      await setLocalVersion(versionData.version || '0.0.0')
    }

    return true
  } catch (err) {
    console.error('OTA更新失败:', err)
    return false
  }
}

// 获取本地更新目录的URI（用于Capacitor加载）
export async function getUpdateDirUri(): Promise<string | null> {
  try {
    const result = await Filesystem.getUri({
      path: LOCAL_DIR,
      directory: Directory.Data,
    })
    return result.uri
  } catch {
    return null
  }
}

// 清除本地更新缓存
export async function clearUpdateCache() {
  try {
    await Filesystem.rmdir({ path: LOCAL_DIR, directory: Directory.Data, recursive: true })
    await Preferences.remove({ key: 'ota_version' })
  } catch {
    // 忽略
  }
}
