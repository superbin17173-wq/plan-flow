// 导出导入处理
import type { Task, Category, Settings } from '../types'
import { exportData, importData } from './db'

interface ExportedData {
  version: string
  exportDate: string
  tasks: Task[]
  categories: Category[]
  settings: Settings
}

// 导出为JSON文件
export async function exportToFile(): Promise<void> {
  const data = await exportData()
  const exportObj: ExportedData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    ...data,
  }

  const json = JSON.stringify(exportObj, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `planflow-export-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 从JSON文件导入
export async function importFromFile(mode: 'merge' | 'overwrite' = 'merge'): Promise<{ success: boolean; message: string; count: number }> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {
        resolve({ success: false, message: '未选择文件', count: 0 })
        return
      }

      try {
        const text = await file.text()
        const data = JSON.parse(text) as ExportedData

        // 验证数据结构
        if (!data.version || !data.tasks) {
          resolve({ success: false, message: '文件格式不正确', count: 0 })
          return
        }

        await importData({
          tasks: data.tasks,
          categories: data.categories,
          settings: data.settings,
        }, mode)

        resolve({
          success: true,
          message: `成功导入 ${data.tasks.length} 个任务`,
          count: data.tasks.length,
        })
      } catch (err) {
        resolve({ success: false, message: `导入失败: ${err}`, count: 0 })
      }
    }

    input.click()
  })
}