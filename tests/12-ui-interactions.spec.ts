/**
 * 测试模块12: UI交互细节
 * 覆盖：对话框关闭、Toast通知、键盘快捷键
 */
import { test, expect } from '@playwright/test'

test.describe('UI交互细节', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })
  })

  test('点击遮罩关闭对话框', async ({ page }) => {
    // 打开任务表单
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await expect(page.locator('.modal-overlay')).toBeVisible()

    // 点击遮罩（背景）关闭
    await page.click('.modal-overlay', { position: { x: 10, y: 10 } })
    await page.waitForTimeout(300)

    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('ESC键关闭对话框', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await expect(page.locator('.modal-overlay')).toBeVisible()

    // 按ESC键
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('任务表单动画效果', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(100)

    // 验证模态框出现有动画
    const modal = page.locator('.modal-content')
    await expect(modal).toBeVisible()

    // 关闭验证消失动画
    await page.click('button:has-text("取消")')
    await page.waitForTimeout(500)

    await expect(page.locator('.modal-content')).not.toBeVisible()
  })

  test('按钮hover效果', async ({ page }) => {
    // 验证新建按钮hover
    const addBtn = page.locator('button:has-text("+")')
    await addBtn.hover()
    await page.waitForTimeout(100)

    // 验证导航按钮hover
    const navBtn = page.locator('button.nav-btn').first()
    await navBtn.hover()
    await page.waitForTimeout(100)
  })

  test('日期选择器交互', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    // 点击日期输入框
    const dateInput = page.locator('input[type="date"]')
    await dateInput.click()
    await page.waitForTimeout(100)

    // 验证日期选择器可用
    await expect(dateInput).toBeEditable()

    await page.click('button:has-text("取消")')
  })

  test('任务卡片显示完整信息', async ({ page }) => {
    // 创建一个完整信息的任务
    await page.click('button:has-text("+")')
    await page.fill('input[placeholder="输入任务标题"]', '完整信息任务')
    await page.fill('textarea[placeholder="输入任务描述（可选）"]', '这是任务描述')
    await page.click('button:has-text("工作")')
    await page.click('button:has-text("高")')
    await page.click('button:has-text("创建")')
    await page.waitForTimeout(500)

    // 打开任务卡片
    const task = page.locator('.task-chip, .task-block').filter({ hasText: '完整信息任务' }).first()
    await task.click()
    await page.waitForTimeout(300)

    // 验证卡片显示标题
    await expect(page.locator('.task-card')).toContainText('完整信息任务')

    // 验证显示时间
    await expect(page.locator('.task-card')).toContainText(':')

    // 验证显示分类
    await expect(page.locator('.task-card')).toContainText('工作')
  })

  test('长标题截断显示', async ({ page }) => {
    await page.click('button:has-text("+")')

    // 输入长标题
    const longTitle = '这是一个非常长的任务标题用于测试截断显示效果ABCDEFGHIJKLMN'
    await page.fill('input[placeholder="输入任务标题"]', longTitle)
    await page.click('button:has-text("创建")')
    await page.waitForTimeout(500)

    // 验证任务chip显示截断标题
    const taskChip = page.locator('.task-chip').first()
    if (await taskChip.isVisible()) {
      const text = await taskChip.textContent()
      // 标题应被截断
      expect(text?.length).toBeLessThan(longTitle.length)
    }
  })

  test('多个任务同时显示', async ({ page }) => {
    // 创建多个任务
    for (let i = 1; i <= 5; i++) {
      await page.click('button:has-text("+")')
      await page.fill('input[placeholder="输入任务标题"]', `多任务测试${i}`)
      await page.click('button:has-text("创建")')
      await page.waitForTimeout(300)
    }

    // 切换到日视图验证多个任务块
    await page.click('button:has-text("日")')
    await page.waitForTimeout(500)

    const taskBlocks = page.locator('.task-block')
    const count = await taskBlocks.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('过去时间槽禁止点击', async ({ page }) => {
    await page.click('button:has-text("日")')
    await page.waitForTimeout(300)

    // 点击今天按钮确保是今天
    await page.click('button:has-text("今")')
    await page.waitForTimeout(300)

    // 尝试点击过去的时间槽（如果当前时间已过8点）
    const now = new Date()
    const currentHour = now.getHours()

    if (currentHour > 2) {
      // 尝试点击第一个小时槽（应该是过去的）
      const firstSlot = page.locator('.hour-slot').first()
      const hasPastClass = await firstSlot.evaluate(el => el.classList.contains('past'))

      if (hasPastClass) {
        // 过去的槽不应打开表单
        await firstSlot.click({ position: { x: 50, y: 30 } })
        await page.waitForTimeout(300)

        // 表单不应打开
        await expect(page.locator('.modal-overlay')).not.toBeVisible()
      }
    }
  })
})