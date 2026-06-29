// Service Worker 类型声明补充
declare global {
  interface ServiceWorkerRegistration {
    periodicSync: {
      register(tag: string, options?: { minInterval?: number }): Promise<void>
      getTags(): Promise<string[]>
    }
  }

  interface NotificationOptions {
    vibrate?: number[]
    actions?: NotificationAction[]
  }

  interface NotificationAction {
    action: string
    title: string
  }

  interface PeriodicSyncEvent extends ExtendableEvent {
    tag: string
    waitUntil(promise: Promise<any>): void
  }

  interface ServiceWorkerGlobalScope {
    registration: ServiceWorkerRegistration
    clients: Clients
    addEventListener(type: 'periodicsync', listener: (event: PeriodicSyncEvent) => void): void
    addEventListener(type: 'notificationclick', listener: (event: NotificationEvent) => void): void
    addEventListener(type: 'push', listener: (event: PushEvent) => void): void
  }

  interface NotificationEvent extends Event {
    notification: Notification
    action: string
    waitUntil(promise: Promise<any>): void
  }

  interface PushEvent extends Event {
    data: PushMessageData | null
  }

  interface PushMessageData {
    json(): any
    text(): string
  }

  interface Clients {
    matchAll(options?: { type?: string }): Promise<WindowClient[]>
    openWindow(url: string): Promise<WindowClient | null>
  }

  interface WindowClient {
    url: string
    focus(): Promise<WindowClient>
  }
}

// 声明 self 为 ServiceWorkerGlobalScope
declare const self: ServiceWorkerGlobalScope

export {}