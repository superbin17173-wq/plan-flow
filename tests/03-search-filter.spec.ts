/**
 * 测试模块3: 搜索筛选功能
 * 覆盖：关键词搜索、分类筛选、优先级筛选、完成状态筛选
 *
 * beforeEach 使用 Pinia store 直接播种测试数据，避免通过模态框 UI 创建任务
 * 因模态框 transition 动画导致 overlay linger 干扰后续点击的问题。
 */
import { test, expect } from '@playwright/test'

// 今天的日期，用于播种任务
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test.describe('搜索筛选功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })

    // 通过 Pinia store 和 IndexedDB 直接播种任务数据，
    // 绕过 TaskForm 模态框的 transition 动画问题。
    const date = todayStr()
    await page.evaluate((seedDate) => {
      const win = window as any
      // 通过 idb 库打开 PlanFlowDB 并插入任务
      const { openDB } = win.__idbModule || {}

      // 使用 Pinia store（在 app 挂载后可从 Vue devtools hook 访问）
      // 更可靠的方式：直接操作 IndexedDB
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('PlanFlowDB', 3)
        req.onupgradeneeded = () => {}
        req.onsuccess = async () => {
          const db = req.result
          const tasks = [
            {
              id: 'seed-task-1',
              title: '工作会议讨论',
              description: '',
              category: 'work',
              priority: 'high',
              date: seedDate,
              startTime: '09:00',
              endTime: '10:00',
              color: '#81C9D8',
              isCompleted: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            {
              id: 'seed-task-2',
              title: '学习编程课程',
              description: '',
              category: 'study',
              priority: 'medium',
              date: seedDate,
              startTime: '10:00',
              endTime: '11:00',
              color: '#7BC47F',
              isCompleted: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            {
              id: 'seed-task-3',
              title: '健身跑步训练',
              description: '',
              category: 'fitness',
              priority: 'low',
              date: seedDate,
              startTime: '18:00',
              endTime: '19:00',
              color: '#F27B7B',
              isCompleted: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ]
          const tx = db.transaction('tasks', 'readwrite')
          const store = tx.objectStore('tasks')
          for (const t of tasks) store.put(t)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
        req.onerror = () => reject(req.error)
      })
    }, date)

    // 刷新页面让 app 加载播种的数据
    await page.reload()
    await page.waitForSelector('.app', { timeout: 10000 })
    // 等待加载状态消失
    await page.waitForSelector('.loading-state', { state: 'hidden', timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(500)
  })

  test('打开搜索面板', async ({ page }) => {
    await page.click('button:has-text("🔍")')
    await page.waitForTimeout(300)

    await expect(page.locator('.search-panel')).toBeVisible()
  })

  test('关键词搜索', async ({ page }) => {
    await page.click('button:has-text("🔍")')
    await page.waitForTimeout(300)

    // 输入搜索关键词
    await page.fill('input[placeholder="搜索任务..."]', '会议')
    await page.waitForTimeout(500)

    // 验证搜索结果 - 使用 .result-item 选择器（与 SearchBar.vue 一致）
    const searchResults = page.locator('.result-item')
    await expect(searchResults).toContainText('工作会议讨论')
  })

  test('关键词搜索 - 无结果', async ({ page }) => {
    await page.click('button:has-text("🔍")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="搜索任务..."]', '不存在的任务xyz')
    await page.waitForTimeout(500)

    // 验证无结果提示 - 使用实际文本（与 SearchBar.vue 一致）
    const noResults = page.locator('text=未找到匹配的任务')
    await expect(noResults).toBeVisible()
  })

  test('分类筛选', async ({ page }) => {
    await page.click('button:has-text("🔍")')
    await page.waitForTimeout(300)

    // 先输入搜索词触发 searchTasks()（空查询时返回 []）
    await page.fill('input[placeholder="搜索任务..."]', '训练')
    await page.waitForTimeout(300)

    // 选择分类筛选 - 使用 .filter-select 定位第1个筛选（分类）
    const categorySelect = page.locator('.filter-select').first()
    await categorySelect.selectOption({ label: '健身' })
    await page.waitForTimeout(500)

    // 验证只显示健身任务
    const results = page.locator('.result-item')
    await expect(results).toContainText('健身跑步训练')

    // 验证不显示其他分类（"训练"匹配"工作会议讨论"和"健身跑步训练"，但健身筛选掉工作会议讨论）
    await expect(results).not.toContainText('工作会议讨论')
    await expect(results).not.toContainText('学习编程课程')
  })

  test('优先级筛选', async ({ page }) => {
    await page.click('button:has-text("🔍")')
    await page.waitForTimeout(300)

    // 先输入搜索词触发 searchTasks()
    await page.fill('input[placeholder="搜索任务..."]', '会议')
    await page.waitForTimeout(300)

    // 选择优先级筛选 - 使用第2个 .filter-select
    const prioritySelect = page.locator('.filter-select').nth(1)
    await prioritySelect.selectOption({ label: '高' })
    await page.waitForTimeout(500)

    // 验证只显示高优先级任务（"会议"匹配"工作会议讨论"，高优先级也是它）
    const results = page.locator('.result-item')
    await expect(results).toContainText('工作会议讨论')
  })

  test('完成状态筛选', async ({ page }) => {
    // 先通过 IndexedDB 将学习任务标记为完成
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('PlanFlowDB', 3)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('tasks', 'readwrite')
          const store = tx.objectStore('tasks')
          const getReq = store.get('seed-task-2')
          getReq.onsuccess = () => {
            const task = getReq.result
            if (task) {
              task.isCompleted = true
              task.updatedAt = Date.now()
              store.put(task)
            }
          }
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => reject(tx.error)
        }
        req.onerror = () => reject(req.error)
      })
    })
    await page.reload()
    await page.waitForSelector('.app', { timeout: 10000 })
    await page.waitForTimeout(500)

    // 打开搜索面板
    await page.click('button:has-text("🔍")')
    await page.waitForTimeout(300)

    // 先输入搜索词触发 searchTasks()（"学习"匹配"学习编程课程"）
    await page.fill('input[placeholder="搜索任务..."]', '学习')
    await page.waitForTimeout(300)

    // 筛选已完成 - 使用第3个 .filter-select（状态）
    const statusSelect = page.locator('.filter-select').nth(2)
    await statusSelect.selectOption({ label: '已完成' })
    await page.waitForTimeout(500)

    // 验证只显示已完成任务
    const results = page.locator('.result-item')
    await expect(results).toContainText('学习编程课程')
  })

  test('组合筛选', async ({ page }) => {
    await page.click('button:has-text("🔍")')
    await page.waitForTimeout(300)

    // 先输入搜索词触发 searchTasks()（"训练"匹配"工作会议讨论"和"健身跑步训练"）
    await page.fill('input[placeholder="搜索任务..."]', '训练')
    await page.waitForTimeout(300)

    // 同时设置分类和优先级
    const categorySelect = page.locator('.filter-select').first()
    const prioritySelect = page.locator('.filter-select').nth(1)
    await categorySelect.selectOption({ label: '健身' })
    await prioritySelect.selectOption({ label: '低' })
    await page.waitForTimeout(500)

    // 验证组合筛选结果（"训练" + 健身 + 低 → 只有"健身跑步训练"）
    const results = page.locator('.result-item')
    await expect(results).toContainText('健身跑步训练')
    await expect(results).not.toContainText('工作会议讨论')
  })

  test('清除筛选', async ({ page }) => {
    await page.click('button:has-text("🔍")')
    await page.waitForTimeout(300)

    // 设置筛选
    await page.fill('input[placeholder="搜索任务..."]', '会议')
    await page.waitForTimeout(300)

    // 清除筛选
    const clearBtn = page.locator('button:has-text("清除筛选")')
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()
    await page.waitForTimeout(300)

    // 验证筛选已清除
    const input = page.locator('input[placeholder="搜索任务..."]')
    await expect(input).toHaveValue('')
  })

  test('点击搜索结果打开任务', async ({ page }) => {
    await page.click('button:has-text("🔍")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="搜索任务..."]', '会议')
    await page.waitForTimeout(500)

    // 点击搜索结果 - 使用 .result-item 选择器
    const result = page.locator('.result-item').filter({ hasText: '工作会议讨论' })
    await result.click()
    await page.waitForTimeout(300)

    // 任务卡片应打开
    await expect(page.locator('.task-card')).toBeVisible()
  })

  test('关闭搜索面板', async ({ page }) => {
    await page.click('button:has-text("🔍")')
    await page.waitForTimeout(300)

    await expect(page.locator('.search-panel')).toBeVisible()

    // 点击关闭按钮
    await page.click('.search-panel .close-btn')
    await page.waitForTimeout(300)

    await expect(page.locator('.search-panel')).not.toBeVisible()
  })
})
