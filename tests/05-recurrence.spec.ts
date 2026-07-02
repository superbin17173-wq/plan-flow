/**
 * 测试模块5: 重复任务功能
 * 覆盖：日重复、周重复、月重复、年重复、结束日期设置
 */
import { test, expect } from '@playwright/test'

test.describe('重复任务功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })
  })

  // ── 辅助函数 ──────────────────────────────────────────────

  async function openTaskForm(page) {
    await page.click('button:has-text("+")')
    await page.waitForSelector('.modal-content', { timeout: 5000 })
    await page.waitForSelector('input[placeholder="输入任务标题"]', { timeout: 5000 })
  }

  /**
   * 点击重复开关。
   * 用 Playwright 原生 click()（能正确触发 Vue 的 @click 监听器），
   * 通过 .filter({ hasText }) 精确定位包含"重复"标签的那一行。
   */
  async function toggleRecurrence(page) {
    await page.locator('.toggle-row').filter({ hasText: '重复' }).locator('.toggle-btn').click()
    await page.waitForTimeout(500)
  }

  /**
   * 通过 JS 设置 <select> 的值并触发 change。
   * 不能用 Playwright selectOption —— Vue 响应式会在值变化时重新渲染 DOM，
   * 导致 select 元素在 Playwright 完成操作前就被卸载。
   */
  async function selectRecurrenceType(page, value) {
    await page.evaluate((val) => {
      const select = document.querySelector('.recurrence-options select') as HTMLSelectElement
      if (select) {
        select.value = val
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, value)
    // 验证 select 值是否正确设置
    const actual = await page.evaluate(() => {
      const s = document.querySelector('.recurrence-options select') as HTMLSelectElement
      return s ? s.value : null
    })
    if (actual !== value) {
      throw new Error(`Select value mismatch: expected "${value}", got "${actual}"`)
    }
    await page.waitForTimeout(800)
  }

  async function fillInterval(page, value) {
    await page.waitForSelector('.recurrence-options input[placeholder="间隔"]', { timeout: 5000 })
    await page.evaluate((val) => {
      const input = document.querySelector('.recurrence-options input[placeholder="间隔"]') as HTMLInputElement
      if (input) {
        input.value = val
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, value)
    await page.waitForTimeout(300)
  }

  async function fillEndDate(page, date) {
    await page.waitForSelector('.recurrence-options input[type="date"]', { timeout: 5000 })
    await page.evaluate((val) => {
      const input = document.querySelector('.recurrence-options input[type="date"]') as HTMLInputElement
      if (input) {
        input.value = val
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, date)
    await page.waitForTimeout(300)
  }

  /**
   * 提交表单：等待按钮稳定后通过 JS dispatch MouseEvent 点击，
   * 避免 Playwright 点击时元素被 Vue 重渲染卸载。
   */
  async function submitForm(page) {
    await page.waitForFunction(() => {
      const btn = document.querySelector('.submit-btn') as HTMLButtonElement
      return btn !== null && btn.isConnected && !btn.disabled
    }, { timeout: 5000 })
    await page.evaluate(() => {
      const btn = document.querySelector('.submit-btn') as HTMLButtonElement
      if (btn) {
        btn.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        }))
      }
    })
    await page.waitForTimeout(1000)
  }

  async function clickCancel(page) {
    await page.locator('.cancel-btn').click()
    await page.waitForTimeout(300)
  }

  /**
   * 一次性点击多个周几按钮（在同一个 evaluate 调用中完成，
   * 避免 Vue 在两次点击之间重新渲染导致 .weekday-select 消失）。
   */
  async function clickWeekdays(page, dayTexts) {
    await page.waitForSelector('.weekday-select', { state: 'visible', timeout: 5000 })
    await page.evaluate((days) => {
      const buttons = document.querySelectorAll('.weekday-select button')
      for (const day of days) {
        const btn = Array.from(buttons).find(b => b.textContent!.trim() === day)
        if (btn) {
          (btn as HTMLElement).dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          }))
        }
      }
    }, dayTexts)
    await page.waitForTimeout(500)
  }

  // ── 测试用例 ──────────────────────────────────────────────

  test('创建每日重复任务', async ({ page }) => {
    await openTaskForm(page)
    await page.fill('input[placeholder="输入任务标题"]', '每日重复任务')

    await toggleRecurrence(page)
    await page.waitForSelector('.recurrence-options', { state: 'visible', timeout: 5000 })

    await selectRecurrenceType(page, 'daily')
    await fillInterval(page, '1')

    await submitForm(page)

    await page.click('button:has-text("周")')
    await page.waitForTimeout(500)

    const taskBlocks = page.locator('.task-block').filter({ hasText: '每日重复任务' })
    const count = await taskBlocks.count()
    expect(count).toBeGreaterThan(1)
  })

  test('创建每周重复任务', async ({ page }) => {
    await openTaskForm(page)
    await page.fill('input[placeholder="输入任务标题"]', '每周重复任务')

    await toggleRecurrence(page)
    await page.waitForSelector('.recurrence-options', { state: 'visible', timeout: 5000 })

    await selectRecurrenceType(page, 'weekly')

    // 选择周一和周三
    await clickWeekdays(page, ['周一', '周三'])

    await submitForm(page)

    // 验证任务已创建
    await page.click('button:has-text("月")')
    await page.waitForTimeout(500)

    await expect(page.locator('.task-chip, .task-block').filter({ hasText: '每周重复任务' }).first()).toBeVisible()
  })

  test('创建每月重复任务', async ({ page }) => {
    await openTaskForm(page)
    await page.fill('input[placeholder="输入任务标题"]', '每月重复任务')

    await toggleRecurrence(page)
    await page.waitForSelector('.recurrence-options', { state: 'visible', timeout: 5000 })

    await selectRecurrenceType(page, 'monthly')
    await submitForm(page)

    await page.click('button:has-text("月")')
    await page.waitForTimeout(500)

    await expect(page.locator('.task-chip').filter({ hasText: '每月重复任务' }).first()).toBeVisible()
  })

  test('创建带结束日期的重复任务', async ({ page }) => {
    await openTaskForm(page)
    await page.fill('input[placeholder="输入任务标题"]', '有限期重复任务')

    await toggleRecurrence(page)
    await page.waitForSelector('.recurrence-options', { state: 'visible', timeout: 5000 })

    await selectRecurrenceType(page, 'daily')

    const weekLater = new Date()
    weekLater.setDate(weekLater.getDate() + 7)
    const endDate = weekLater.toISOString().split('T')[0]
    await fillEndDate(page, endDate)

    await submitForm(page)

    await expect(page.locator('.task-chip, .task-block').filter({ hasText: '有限期重复任务' }).first()).toBeVisible()
  })

  test('编辑重复任务', async ({ page }) => {
    await openTaskForm(page)
    await page.fill('input[placeholder="输入任务标题"]', '可编辑重复任务')
    await toggleRecurrence(page)
    await page.waitForSelector('.recurrence-options', { state: 'visible', timeout: 5000 })
    await selectRecurrenceType(page, 'daily')
    await submitForm(page)

    const task = page.locator('.task-chip, .task-block').filter({ hasText: '可编辑重复任务' }).first()
    await task.click()
    await page.waitForTimeout(500)

    await page.click('button:has-text("编辑")')
    await page.waitForTimeout(500)

    await page.fill('input[placeholder="输入任务标题"]', '已编辑重复任务')
    await submitForm(page)

    await expect(page.locator('.task-chip, .task-block').filter({ hasText: '已编辑重复任务' }).first()).toBeVisible()
  })

  test('关闭重复开关', async ({ page }) => {
    await openTaskForm(page)
    await page.fill('input[placeholder="输入任务标题"]', '测试任务')

    await toggleRecurrence(page)
    await page.waitForSelector('.recurrence-options', { state: 'visible', timeout: 5000 })
    await expect(page.locator('.recurrence-options')).toBeVisible()

    await toggleRecurrence(page)
    await page.waitForTimeout(500)
    await expect(page.locator('.recurrence-options')).not.toBeVisible()

    await clickCancel(page)
  })

  test('重复间隔设置', async ({ page }) => {
    await openTaskForm(page)
    await page.fill('input[placeholder="输入任务标题"]', '隔日重复任务')

    await toggleRecurrence(page)
    await page.waitForSelector('.recurrence-options', { state: 'visible', timeout: 5000 })

    await selectRecurrenceType(page, 'daily')
    await fillInterval(page, '2')

    await submitForm(page)

    await expect(page.locator('.task-chip, .task-block').filter({ hasText: '隔日重复任务' }).first()).toBeVisible()
  })
})
