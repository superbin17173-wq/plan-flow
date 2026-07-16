// OTA 远程更新模块
// 原理: 用 @capgo/capacitor-updater 插件做原生 WebView 切换,取代之前手写的 file:// 导航(会被跨源拦)

import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater'
import { Capacitor } from '@capacitor/core'
import { APP_VERSION } from './version'

// 更新服务器地址(Cloudflare Pages)
const UPDATE_SERVER = 'https://planflow-aot.pages.dev'
const VERSION_PATH = '/version.json'
const DIST_ZIP_PATH = '/dist.zip'

export interface UpdateInfo {
  version: string
  buildTime: string
  changelog?: string
  hasUpdate: boolean
  localVersion: string
}

// 检查是否有更新
export async function checkForUpdate(): Promise<UpdateInfo> {
  try {
    const res = await fetch(`${UPDATE_SERVER}${VERSION_PATH}`, { cache: 'no-store' })
    if (!res.ok) {
      return { version: '', buildTime: '', hasUpdate: false, localVersion: APP_VERSION }
    }

    const remote = await res.json()
    const remoteVersion = remote.version || '0.0.0'

    // 用当前运行的 bundle 版本(而非 APK 内置版本)比较,防止降级循环
    const currentVersion = await getCurrentBundleVersion()

    // 只有 native 平台才走 OTA(浏览器/dev 环境不弹更新框)
    const hasUpdate = Capacitor.isNativePlatform() && remoteVersion !== currentVersion

    return {
      version: remoteVersion,
      buildTime: remote.buildTime || '',
      changelog: remote.changelog || undefined,
      hasUpdate,
      localVersion: currentVersion,
    }
  } catch {
    return { version: '', buildTime: '', hasUpdate: false, localVersion: APP_VERSION }
  }
}

// 下载新版本 bundle,返回 BundleInfo(含 id,后续 apply 用)
// onProgress: 0-100
export async function downloadUpdate(
  version: string,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; bundle?: BundleInfo; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: '非移动端不支持 OTA' }
  }

  const listener = await CapacitorUpdater.addListener('download', (evt) => {
    onProgress?.(evt.percent)
  })

  try {
    const bundle = await CapacitorUpdater.download({
      url: `${UPDATE_SERVER}${DIST_ZIP_PATH}`,
      version,
    })
    onProgress?.(100)
    return { success: true, bundle }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg || '下载失败' }
  } finally {
    listener.remove()
  }
}

// 立即应用新 bundle: 切换 WebView 并重启 JS 上下文
// 注意: 调用后当前 JS 会被销毁,不要在后面写其他逻辑
// 返回: 诊断信息(仅在 set 未触发 reload 时才会返回,正常情况下 JS 上下文被销毁不会返回)
export async function applyBundle(bundle: BundleInfo): Promise<{ diagnosticsAfterSet: string }> {
  // set 之前先列所有 bundle,确认目标 bundle 在 native 侧存在且状态正常
  const before = await CapacitorUpdater.list().catch((e) => ({ bundles: [], _error: String(e) }))
  const target = (before.bundles || []).find((b: any) => b.id === bundle.id) as any

  if (!target) {
    throw new Error(`Bundle ${bundle.id} 在 native 侧不存在。当前 list=${JSON.stringify(before)}`)
  }
  // capgo 的 status 可能包含 'error' / 'deleted' / 其他异常值
  if (target.status === 'error' || target.status === 'deleted') {
    throw new Error(`Bundle ${bundle.id} 状态异常: ${target.status}。完整信息=${JSON.stringify(target)}`)
  }

  await CapacitorUpdater.set({ id: bundle.id })

  // 正常情况下 set() 后 WebView 立刻 reload,以下代码不会执行
  // 如果执行到了,说明 set 静默失败,采集诊断信息
  await new Promise((r) => setTimeout(r, 1500))
  const after = await CapacitorUpdater.list().catch((e) => ({ bundles: [], _error: String(e) }))
  const current = await CapacitorUpdater.current().catch((e) => ({ _error: String(e) }))
  return {
    diagnosticsAfterSet: JSON.stringify({ targetBundle: target, listAfter: after, current }, null, 2),
  }
}

// 列出 native 侧所有已下载的 bundle(诊断用)
export async function getBundleList(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return '[non-native]'
  try {
    const list = await CapacitorUpdater.list()
    const current = await CapacitorUpdater.current()
    return JSON.stringify({ list, current }, null, 2)
  } catch (err) {
    return `list-error: ${err instanceof Error ? err.message : String(err)}`
  }
}

// 通知插件 APP 启动成功(必须在启动时调,不然插件会自动回滚到上一个 bundle)
export async function notifyAppReady(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await CapacitorUpdater.notifyAppReady()
  } catch {
    // 首次启动或没 bundle 时可能抛错,忽略
  }
}

// 获取当前运行的 bundle 版本
export async function getCurrentBundleVersion(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return APP_VERSION
  try {
    const { bundle } = await CapacitorUpdater.current()
    return bundle.version || APP_VERSION
  } catch {
    return APP_VERSION
  }
}
