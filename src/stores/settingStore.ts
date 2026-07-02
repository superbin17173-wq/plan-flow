// 设置状态管理
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { getSettings, updateSetting as dbUpdateSetting, initDB } from '../utils/db'

export const useSettingStore = defineStore('setting', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
  const loaded = ref(false)

  // 从 IndexedDB 加载设置
  async function loadSettings() {
    await initDB()
    const stored = await getSettings()
    settings.value = { ...DEFAULT_SETTINGS, ...stored }
    loaded.value = true
    applyTheme()
  }

  // 更新单个设置
  async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    settings.value[key] = value
    await dbUpdateSetting(key, value as any)
    if (key === 'theme') applyTheme()
  }

  // 批量更新
  async function updateSettings(partial: Partial<Settings>) {
    for (const [k, v] of Object.entries(partial)) {
      (settings.value as any)[k] = v
      await dbUpdateSetting(k as keyof Settings, v as any)
    }
    if ('theme' in partial) applyTheme()
  }

  // 应用主题
  function applyTheme() {
    const theme = settings.value.theme
    const root = document.documentElement

    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
  }

  // 切换主题
  async function toggleTheme() {
    const themes: Settings['theme'][] = ['light', 'dark', 'auto']
    const currentIndex = themes.indexOf(settings.value.theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    await updateSetting('theme', nextTheme)
  }

  // 获取当前是否为深色模式
  function isDark(): boolean {
    if (settings.value.theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return settings.value.theme === 'dark'
  }

  return {
    settings,
    loaded,
    loadSettings,
    updateSetting,
    updateSettings,
    applyTheme,
    toggleTheme,
    isDark,
  }
})