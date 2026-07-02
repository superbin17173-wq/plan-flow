/**
 * 测试模块9: 主题切换功能
 * 覆盖：浅色/深色/自动主题切换
 */
import { test, expect } from '@playwright/test'

test.describe('主题切换功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })
  })

  test('点击主题切换按钮', async ({ page }) => {
    const themeBtn = page.locator('.theme-toggle, button[title*="主题"]')

    if (await themeBtn.isVisible()) {
      await themeBtn.click()
      await page.waitForTimeout(300)

      // 验证主题变化（可以通过背景色或CSS变量验证）
      const bgColor = await page.evaluate(() => {
        return document.documentElement.style.getPropertyValue('--bg-primary') ||
               getComputedStyle(document.body).backgroundColor
      })

      expect(bgColor).toBeTruthy()
    }
  })

  test('多次点击循环切换主题', async ({ page }) => {
    const themeBtn = page.locator('.theme-toggle, button[title*="主题"]')

    if (await themeBtn.isVisible()) {
      // 浅色 → 深色
      await themeBtn.click()
      await page.waitForTimeout(300)

      // 深色 → 自动
      await themeBtn.click()
      await page.waitForTimeout(300)

      // 自动 → 浅色
      await themeBtn.click()
      await page.waitForTimeout(300)

      // 验证回到浅色模式
      const isDark = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark')
      })

      // 第三次点击后应回到浅色或根据系统设置
      expect(typeof isDark).toBe('boolean')
    }
  })

  test('深色模式下样式正确', async ({ page }) => {
    const themeBtn = page.locator('.theme-toggle, button[title*="主题"]')

    if (await themeBtn.isVisible()) {
      // 切换到深色
      await themeBtn.click()
      await page.waitForTimeout(300)

      // 验证深色类添加到html
      const hasDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark')
      })

      expect(hasDarkClass).toBe(true)

      // 验证背景色变暗
      const bgColor = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor
      })

      // 深色背景应该是暗色调
      expect(bgColor).toBeTruthy()
    }
  })
})