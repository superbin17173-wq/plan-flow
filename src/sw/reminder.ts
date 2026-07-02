// @ts-nocheck
// Service Worker - 后台提醒检测

import type { Task } from '../types'

// 时间转换工具
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function getToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// 打开 IndexedDB
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PlanFlowDB', 3)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

// 从 IndexedDB 获取今日任务
async function getTasksByDate(date: string): Promise<Task[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly')
    const store = tx.objectStore('tasks')
    const index = store.index('by-date')
    const request = index.getAll(date)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

// 从 IndexedDB 读取设置（键值对形式）
async function getSettingsMap(): Promise<Record<string, string>> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly')
    const store = tx.objectStore('settings')
    const request = store.getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const map: Record<string, string> = {}
      for (const row of request.result as Array<{ key: string; value: string }>) {
        map[row.key] = row.value
      }
      resolve(map)
    }
  })
}

// HTML 转义
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 调用 PushPlus 发送微信推送
async function sendPushPlus(token: string, topic: string, title: string, content: string): Promise<void> {
  const body: Record<string, string> = {
    token,
    title,
    content,
    template: 'html',
  }
  if (topic) body.topic = topic
  try {
    await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('SW PushPlus 推送失败:', err)
  }
}

// SW 内的推送去重集合（每次唤醒时新建，只在本次执行期间生效）
const swPushedKeys = new Set<string>()

// 标记任务完成
async function markTaskComplete(taskId: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readwrite')
    const store = tx.objectStore('tasks')
    const request = store.get(taskId)

    request.onsuccess = () => {
      const task = request.result
      if (task) {
        task.isCompleted = true
        task.updatedAt = Date.now()
        store.put(task)
      }
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// 检查提醒并发送通知
async function checkAndSendReminders(): Promise<void> {
  const today = getToday()
  const [tasks, settingsMap] = await Promise.all([getTasksByDate(today), getSettingsMap()])
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const pushplusEnabled = settingsMap.pushplusEnabled === 'true'
  const pushplusToken = settingsMap.pushplusToken || ''
  const pushplusTopic = settingsMap.pushplusTopic || ''

  for (const task of tasks) {
    if (task.isCompleted) continue
    if (!task.remindAt) continue

    const taskStartMinutes = timeToMinutes(task.startTime)
    const remindMinutes = taskStartMinutes - task.remindAt

    // 如果当前时间在提醒时间点（±2分钟容差）
    if (Math.abs(currentMinutes - remindMinutes) <= 2) {
      // 发送通知
      self.registration.showNotification(`任务提醒: ${task.title}`, {
        body: `即将开始 (${task.startTime}) - ${task.description || '点击查看详情'}`,
        icon: '/icons/icon-192.png',
        tag: `planflow-${task.id}`,
        requireInteraction: false,
      })

      // 微信推送（去重）
      const pushKey = `${today}-${task.id}`
      if (pushplusEnabled && pushplusToken && !swPushedKeys.has(pushKey)) {
        swPushedKeys.add(pushKey)
        const content = [
          `<h3>${escapeHtml(task.title)}</h3>`,
          `<p><b>开始时间：</b>${escapeHtml(task.startTime)}</p>`,
          task.category ? `<p><b>分类：</b>${escapeHtml(task.category)}</p>` : '',
          task.description ? `<p><b>备注：</b>${escapeHtml(task.description)}</p>` : '',
          `<p style="color:#888;font-size:12px;">— 来自 PlanFlow</p>`,
        ].join('')
        await sendPushPlus(pushplusToken, pushplusTopic, `任务提醒: ${task.title}`, content)
      }
    }
  }
}

// 处理 Periodic Background Sync 事件
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'reminder-check') {
    event.waitUntil(checkAndSendReminders())
  }
})

// 处理通知点击事件
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close()

  if (event.action === 'view') {
    // 打开应用
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients: any[]) => {
        // 如果已有窗口，聚焦它
        for (const client of clients) {
          if (client.url && 'focus' in client) {
            return (client as any).focus()
          }
        }
        // 否则打开新窗口
        if (self.clients.openWindow) {
          return self.clients.openWindow('/')
        }
      })
    )
  } else if (event.action === 'complete') {
    // 标记任务完成
    const taskId = event.notification.tag.replace('planflow-', '')
    event.waitUntil(markTaskComplete(taskId))
  }
})

// 处理 Push 事件（未来可扩展为服务器推送）
self.addEventListener('push', (event: any) => {
  if (event.data) {
    const data = event.data.json()
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icons/icon-192.png',
        tag: 'planflow-push',
      })
    )
  }
})