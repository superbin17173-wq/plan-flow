// OTA 远程更新模块
// 原理：APP启动时检查服务器 version.json，有新版本则下载 dist.zip 到本地并热更新

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import JSZip from 'jszip'
import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'
import { APP_VERSION } from './version'

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

// 检查是否有更新（使用打包时的版本号 APP_VERSION）
export async function checkForUpdate(): Promise<UpdateInfo> {
  try {
    const res = await fetch(`${UPDATE_SERVER}${VERSION_PATH}`, {
      cache: 'no-store',
    })
    if (!res.ok) return { version: '', buildTime: '', hasUpdate: false, localVersion: APP_VERSION }

    const remote = await res.json()
    const remoteVersion = remote.version || '0.0.0'

    // 比较远程版本和打包时的版本号
    const hasUpdate = remoteVersion !== APP_VERSION

    return {
      version: remoteVersion,
      buildTime: remote.buildTime || '',
      hasUpdate,
      localVersion: APP_VERSION,
    }
  } catch {
    return { version: '', buildTime: '', hasUpdate: false, localVersion: APP_VERSION }
  }
}

// 下载并安装更新
export async function downloadAndUpdate(
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; error?: string }> {
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
      return { success: false, error: `下载失败: HTTP ${res.status}` }
    }

    const total = Number(res.headers.get('content-length')) || 0
    if (total === 0) {
      console.log('OTA: content-length 未知，直接下载完整文件')
    }

    // Android WebView 可能不支持 ReadableStream，直接用 arrayBuffer
    console.log('OTA: 开始读取响应体...')
    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await res.arrayBuffer()
    } catch (streamErr) {
      console.error('OTA: arrayBuffer 读取失败，尝试 blob 方式', streamErr)
      // fallback: blob -> arrayBuffer
      try {
        const blob = await res.blob()
        arrayBuffer = await blob.arrayBuffer()
      } catch (blobErr) {
        console.error('OTA: blob 方式也失败', blobErr)
        return { success: false, error: '下载失败: 无法读取响应数据' }
      }
    }

    const zipBuffer = new Uint8Array(arrayBuffer)
    console.log('OTA: 下载完成，大小', zipBuffer.length, '字节')
    onProgress?.(30)

    // 解压
    console.log('OTA: 开始解压...')
    let zip: JSZip
    try {
      zip = await JSZip.loadAsync(zipBuffer)
    } catch (zipErr) {
      console.error('OTA: ZIP 解压失败', zipErr)
      return { success: false, error: '更新包解压失败，请重试' }
    }
    const files = Object.keys(zip.files)
    console.log('OTA: ZIP 包含', files.length, '个文件')

    // 先清理旧目录
    try {
      await Filesystem.rmdir({ path: LOCAL_DIR, directory: Directory.Data, recursive: true })
    } catch {
      // 目录不存在，忽略
    }

    onProgress?.(50)

    // 解压每个文件
    let fileIndex = 0
    for (const filePath of files) {
      const file = zip.files[filePath]
      if (file.dir) continue
      fileIndex++

      // 将 Windows 反斜杠转为正斜杠
      const normalizedPath = filePath.replace(/\\/g, '/')

      // 判断是否是文本文件（JS、CSS、HTML、JSON、SVG 等）
      const isTextFile = /\.(js|css|html|json|svg|txt|md|map)$/i.test(normalizedPath)

      // 使用合适的方式读取文件内容
      const content = isTextFile
        ? await file.async('string')
        : await file.async('base64')

      // 确保父目录存在
      const parts = normalizedPath.split('/')
      if (parts.length > 1) {
        let currentPath = LOCAL_DIR
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath = `${currentPath}/${parts[i]}`
          try {
            await Filesystem.mkdir({ path: currentPath, directory: Directory.Data, recursive: true })
          } catch {
            // 已存在
          }
        }
      }

      try {
        await Filesystem.writeFile({
          path: `${LOCAL_DIR}/${normalizedPath}`,
          data: content,
          directory: Directory.Data,
          recursive: true,
          encoding: isTextFile ? Encoding.UTF8 : undefined,
        })
      } catch (writeErr) {
        console.error('OTA: 写入文件失败', normalizedPath, writeErr)
        return { success: false, error: `写入文件失败: ${normalizedPath}` }
      }

      // 更新进度 (50-90%)
      onProgress?.(50 + Math.round((fileIndex / files.length) * 40))
    }

    console.log('OTA: 文件写入完成')

    onProgress?.(100)
    return { success: true }
  } catch (err) {
    console.error('OTA更新失败:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg || '未知错误' }
  }
}

// 获取更新后的 index.html URI（用于加载）
export async function getUpdateIndexPath(): Promise<string | null> {
  try {
    const result = await Filesystem.getUri({
      path: `${LOCAL_DIR}/index.html`,
      directory: Directory.Data,
    })
    return result.uri
  } catch {
    return null
  }
}

// 检查是否有已下载的更新
export async function hasDownloadedUpdate(): Promise<boolean> {
  try {
    await Filesystem.stat({
      path: `${LOCAL_DIR}/index.html`,
      directory: Directory.Data,
    })
    return true
  } catch {
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
