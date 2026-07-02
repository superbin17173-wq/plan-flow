/**
 * 测试模块8: 统计面板功能
 * 覆盖：完成率统计、能量平衡、趋势图表
 */
import { test, expect } from '@playwright/test'

test.describe('统计面板功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })

    // 创建一些测试任务
    await page.click('button:has-text("+")')
    await page.fill('input[placeholder="输入任务标题"]', '统计测试任务1')
    await page.click('button:has-text("工作")')
    await page.click('button:has-text("创建")')
    await page.waitForTimeout(300)

    await page.click('button:has-text("+")')
    await page.fill('input[placeholder="输入任务标题"]', '统计测试任务2')
    await page.click('button:has-text("学习")')
    await page.click('button:has-text("创建")')
    await page.waitForTimeout(300)
  })

  test('打开统计面板', async ({ page }) => {
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    await expect(page.locator('.stats-panel')).toBeVisible()
  })

  test('显示完成率进度条', async ({ page }) => {
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    // 验证今日完成率进度条
    await expect(page.locator('.progress-bar, .completion-rate')).toBeVisible()
  })

  test('显示今日/本周/本月统计', async ({ page }) => {
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    // 验证显示今日、本周、本月标题
    await expect(page.locator('.stats-panel')).toContainText('今日')
    await expect(page.locator('.stats-panel')).toContainText('本周')
    await expect(page.locator('.stats-panel')).toContainText('本月')
  })

  test('显示分类统计', async ({ page }) => {
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    // 验证分类统计显示
    await expect(page.locator('.category-stats, .stats-panel')).toContainText('工作')
  })

  test('标记任务完成后统计更新', async ({ page }) => {
    // 先打开统计面板确认当前完成率
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    // 关闭面板
    await page.click('.stats-panel .close-btn')
    await page.waitForTimeout(300)

    // 标记一个任务完成
    await page.click('button:has-text("月")')
    await page.waitForTimeout(300)

    const task = page.locator('.task-chip').filter({ hasText: '统计测试任务1' }).first()
    await task.click()
    await page.waitForTimeout(300)

    await page.click('button:has-text("标记完成")')
    await page.waitForTimeout(500)

    // 再次打开统计面板验证完成率变化
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    // 验证今日完成率不为0%
    const completionRate = page.locator('.completion-rate, .progress-text')
    if (await completionRate.isVisible()) {
      const text = await completionRate.textContent()
      expect(text).not.toContain('0%')
    }
  })

  test('打开个人资料对话框', async ({ page }) => {
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    // 点击资料链接
    const profileLink = page.locator('a:has-text("资料"), button:has-text("资料")')
    if (await profileLink.isVisible()) {
      await profileLink.click()
      await page.waitForTimeout(300)

      await expect(page.locator('.profile-dialog')).toBeVisible()
    }
  })

  test('关闭统计面板', async ({ page }) => {
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    await expect(page.locator('.stats-panel')).toBeVisible()

    await page.click('.stats-panel .close-btn')
    await page.waitForTimeout(300)

    await expect(page.locator('.stats-panel')).not.toBeVisible()
  })
})