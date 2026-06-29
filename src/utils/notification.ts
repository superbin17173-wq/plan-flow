// 提醒通知封装 - 支持 Service Worker 后台提醒
import { getTasksByDate } from './db'
import type { Task } from '../types'
import { timeToMinutes, getToday } from './timeUtils'

let notificationPermission: NotificationPermission = 'default'
let reminderCheckInterval: number | null = null
let backgroundSyncRegistered = false

// 检查并请求通知权限
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('浏览器不支持通知功能')
    return false
  }

  if (Notification.permission === 'granted') {
    notificationPermission = 'granted'
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    notificationPermission = permission
    return permission === 'granted'
  }

  return false
}

// 注册 Service Worker 后台同步
export async function registerBackgroundSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    console.warn('浏览器不支持 Service Worker')
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready

    // 检查是否支持 periodicSync
    if (!('periodicSync' in registration)) {
      console.warn('浏览器不支持 Periodic Background Sync，使用普通定时检查')
      return false
    }

    // 使用 any 类型绕过 TypeScript 类型检查
    const periodicSync = (registration as any).periodicSync

    // 检查是否已注册
    const tags = await periodicSync.getTags()
    if (tags.includes('reminder-check')) {
      backgroundSyncRegistered = true
      return true
    }

    // 注册后台同步（每分钟检查一次）
    await periodicSync.register('reminder-check', {
      minInterval: 60 * 1000,
    })

    backgroundSyncRegistered = true
    console.log('后台同步已注册')
    return true
  } catch (err) {
    console.error('注册后台同步失败:', err)
    return false
  }
}

// 发送系统通知（优先使用 Service Worker）
export async function sendNotification(title: string, body: string, icon?: string): Promise<void> {
  if (notificationPermission !== 'granted') return

  // 尝试通过 Service Worker 发送
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, {
        body,
        icon: icon || '/icons/icon-192.png',
        tag: 'planflow-reminder',
        requireInteraction: false,
      } as NotificationOptions)
      return
    } catch (err) {
      console.warn('Service Worker 发送通知失败，使用普通通知')
    }
  }

  // 普通 Notification
  const notification = new Notification(title, {
    body,
    icon: icon || '/icons/icon-192.png',
    tag: 'planflow-reminder',
    requireInteraction: false,
  })

  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}

// 发送应用内 Toast 提醒（由 UI 组件处理）
export interface ReminderToast {
  taskId: string
  title: string
  time: string
  category: string
}

// 检查当前时间是否有需要提醒的任务
export async function checkReminders(): Promise<ReminderToast[]> {
  const today = getToday()
  const tasks = await getTasksByDate(today)
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const reminders: ReminderToast[] = []

  for (const task of tasks) {
    if (task.isCompleted) continue
    if (!task.remindAt) continue

    const taskStartMinutes = timeToMinutes(task.startTime)
    const remindMinutes = taskStartMinutes - task.remindAt

    // 如果当前时间在提醒时间点（±2分钟容差）
    if (Math.abs(currentMinutes - remindMinutes) <= 2) {
      reminders.push({
        taskId: task.id,
        title: task.title,
        time: task.startTime,
        category: task.category,
      })

      // 同时发送系统通知
      await sendNotification(
        `任务提醒: ${task.title}`,
        `即将开始 (${task.startTime}) - ${task.description || ''}`
      )
    }
  }

  return reminders
}

// 启动提醒检测循环（前台模式）
export function startReminderCheck(onReminder: (reminders: ReminderToast[]) => void, intervalMs: number = 60000): void {
  if (reminderCheckInterval) return

  // 先请求权限
  requestNotificationPermission()

  // 尝试注册后台同步
  registerBackgroundSync()

  // 立即检查一次
  checkReminders().then(reminders => {
    if (reminders.length > 0) {
      onReminder(reminders)
    }
  })

  // 设置定时检查
  reminderCheckInterval = window.setInterval(async () => {
    const reminders = await checkReminders()
    if (reminders.length > 0) {
      onReminder(reminders)
    }
  }, intervalMs)
}

// 停止提醒检测
export function stopReminderCheck(): void {
  if (reminderCheckInterval) {
    window.clearInterval(reminderCheckInterval)
    reminderCheckInterval = null
  }
}

// 发送任务提醒
export async function sendTaskReminder(task: Task): Promise<void> {
  const title = `任务提醒: ${task.title}`
  const body = `即将开始 (${task.startTime}) - ${task.description || ''}`
  await sendNotification(title, body)
}

// 监听 Service Worker 消息（后台检测到的提醒）
export function listenToServiceWorkerMessages(onReminder: (reminders: ReminderToast[]) => void): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'REMINDER_CHECK') {
        const reminders = event.data.reminders as ReminderToast[]
        if (reminders && reminders.length > 0) {
          onReminder(reminders)
        }
      }
    })
  }
}

// 初始化提醒系统（应用启动时调用）
export async function initReminderSystem(onReminder: (reminders: ReminderToast[]) => void): Promise<void> {
  // 请求通知权限
  await requestNotificationPermission()

  // 注册后台同步
  await registerBackgroundSync()

  // 监听 Service Worker 消息
  listenToServiceWorkerMessages(onReminder)

  // 启动前台定时检查
  startReminderCheck(onReminder)
}