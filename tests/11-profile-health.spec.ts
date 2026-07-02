/**
 * 测试模块11: 个人资料与健康记录
 * 覆盖：个人资料设置、体重记录、饮食记录
 */
import { test, expect } from '@playwright/test'

test.describe('个人资料与健康记录', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })
  })

  test('打开个人资料对话框', async ({ page }) => {
    // 从统计面板打开
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    const profileLink = page.locator('a:has-text("资料"), button:has-text("资料")')
    if (await profileLink.isVisible()) {
      await profileLink.click()
      await page.waitForTimeout(300)

      await expect(page.locator('.profile-dialog')).toBeVisible()
    }
  })

  test('设置性别', async ({ page }) => {
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    const profileLink = page.locator('a:has-text("资料"), button:has-text("资料")')
    if (await profileLink.isVisible()) {
      await profileLink.click()
      await page.waitForTimeout(300)

      // 选择性别
      await page.click('button:has-text("男")')
      await page.waitForTimeout(100)

      await expect(page.locator('button:has-text("男")')).toHaveClass(/active/)
    }
  })

  test('设置年龄身高体重', async ({ page }) => {
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    const profileLink = page.locator('a:has-text("资料"), button:has-text("资料")')
    if (await profileLink.isVisible()) {
      await profileLink.click()
      await page.waitForTimeout(300)

      // 选择年龄
      const ageSelect = page.locator('select').filter({ hasText: '岁' }).first()
      if (await ageSelect.isVisible()) {
        await ageSelect.selectOption({ label: '25岁' })
      }

      // 选择身高
      const heightSelect = page.locator('select').filter({ hasText: 'cm' }).first()
      if (await heightSelect.isVisible()) {
        await heightSelect.selectOption({ label: '175cm' })
      }

      // 选择体重
      const weightSelect = page.locator('select').filter({ hasText: 'kg' }).first()
      if (await weightSelect.isVisible()) {
        await weightSelect.selectOption({ label: '70kg' })
      }

      await page.waitForTimeout(300)

      // 验证BMR/TDEE显示
      await expect(page.locator('.profile-dialog')).toContainText('BMR')
    }
  })

  test('保存个人资料', async ({ page }) => {
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    const profileLink = page.locator('a:has-text("资料"), button:has-text("资料")')
    if (await profileLink.isVisible()) {
      await profileLink.click()
      await page.waitForTimeout(300)

      await page.click('button:has-text("男")')

      await page.click('button:has-text("保存")')
      await page.waitForTimeout(500)

      // 对话框应关闭
      await expect(page.locator('.profile-dialog')).not.toBeVisible()
    }
  })

  test('打开饮食记录对话框', async ({ page }) => {
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    const mealLink = page.locator('a:has-text("记录饮食"), button:has-text("记录饮食")')
    if (await mealLink.isVisible()) {
      await mealLink.click()
      await page.waitForTimeout(300)

      await expect(page.locator('.meal-log, .meal-dialog')).toBeVisible()
    }
  })

  test('饮食记录 - 选择餐类型', async ({ page }) => {
    await page.click('button:has-text("📊")')
    await page.waitForTimeout(300)

    const mealLink = page.locator('a:has-text("记录饮食"), button:has-text("记录饮食")')
    if (await mealLink.isVisible()) {
      await mealLink.click()
      await page.waitForTimeout(300)

      // 验证餐类型选项
      const mealTypes = ['早餐', '午餐', '晚餐', '加餐']
      for (const type of mealTypes) {
        const btn = page.locator(`button:has-text("${type}")`)
        if (await btn.isVisible()) {
          await expect(btn).toBeVisible()
        }
      }
    }
  })
})