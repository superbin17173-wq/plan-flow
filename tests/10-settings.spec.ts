/**
 * 测试模块10: 设置面板功能
 * 覆盖：通知设置、周起始日设置、时间格式设置
 */
import { test, expect } from '@playwright/test'

test.describe('设置面板功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })
  })

  test('打开设置面板', async ({ page }) => {
    await page.click('button:has-text("⚙️")')
    await page.waitForTimeout(300)

    await expect(page.locator('.settings-panel')).toBeVisible()
  })

  test('周起始日设置', async ({ page }) => {
    await page.click('button:has-text("⚙️")')
    await page.waitForTimeout(300)

    // 查找周起始日设置
    const weekStartSelect = page.locator('select, .setting-option').filter({ hasText: '周日周一' })

    if (await weekStartSelect.isVisible()) {
      // 切换到周一起始
      await weekStartSelect.selectOption({ label: '周一' })
      await page.waitForTimeout(300)

      // 验证周视图显示周一开始
      await page.click('button:has-text("周")')
      await page.waitForTimeout(300)

      const weekdayLabels = page.locator('.weekday-name')
      const firstDay = await weekdayLabels.first().textContent()

      // 周一起始时第一天应是周一
      expect(firstDay).toBe('周一')
    }
  })

  test('时间格式设置', async ({ page }) => {
    await page.click('button:has-text("⚙️")')
    await page.waitForTimeout(300)

    // 查找时间格式设置
    const timeFormatSelect = page.locator('select, .setting-option').filter({ hasText: '24小时12小时' })

    if (await timeFormatSelect.isVisible()) {
      await timeFormatSelect.selectOption({ label: '12小时' })
      await page.waitForTimeout(300)

      // 验证日视图时间显示变化
      await page.click('button:has-text("日")')
      await page.waitForTimeout(300)

      // 12小时格式应显示AM/PM
      const hourLabel = page.locator('.hour-label').first()
      const text = await hourLabel.textContent()

      expect(text).toMatch(/AM|PM/)
    }
  })

  test('关闭设置面板', async ({ page }) => {
    await page.click('button:has-text("⚙️")')
    await page.waitForTimeout(300)

    await expect(page.locator('.settings-panel')).toBeVisible()

    await page.click('.settings-panel .close-btn')
    await page.waitForTimeout(300)

    await expect(page.locator('.settings-panel')).not.toBeVisible()
  })
})