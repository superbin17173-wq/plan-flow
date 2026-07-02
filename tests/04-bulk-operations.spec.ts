/**
 * 测试模块4: 批量操作功能
 * 覆盖：Excel导入、批量创建、下载模板
 */
import { test, expect } from '@playwright/test'

test.describe('批量操作功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })
  })

  test('打开批量对话框', async ({ page }) => {
    await page.click('button:has-text("📥")')
    await page.waitForTimeout(300)

    await expect(page.locator('.modal-mask')).toBeVisible()
  })

  test('下载Excel模板', async ({ page }) => {
    await page.click('button:has-text("📥")')
    await page.waitForTimeout(300)

    // 默认已在Excel导入Tab，无需切换

    // 点击下载模板按钮
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("下载模板")')
    const download = await downloadPromise

    // 验证下载文件名
    expect(download.suggestedFilename()).toContain('PlanFlow')
  })

  test('批量创建Tab切换', async ({ page }) => {
    await page.click('button:has-text("📥")')
    await page.waitForTimeout(300)

    // 默认应在Excel导入Tab
    await expect(page.locator('button:has-text("Excel 导入")')).toHaveClass(/active/)

    // 切换到批量创建
    await page.click('button:has-text("按区间批量创建")')
    await page.waitForTimeout(300)

    await expect(page.locator('button:has-text("按区间批量创建")')).toHaveClass(/active/)
  })

  test('批量创建 - 基本信息填写', async ({ page }) => {
    await page.click('button:has-text("📥")')
    await page.waitForTimeout(300)

    await page.click('button:has-text("按区间批量创建")')
    await page.waitForTimeout(300)

    // 填写批量创建表单
    await page.fill('input[placeholder="如: 晚跑"]', '批量测试任务')
    await page.locator('select').first().selectOption({ label: '工作' })
    await page.locator('select').nth(1).selectOption({ label: '中' })

    // 设置日期范围
    const today = new Date()
    const weekLater = new Date(today)
    weekLater.setDate(weekLater.getDate() + 7)

    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    await page.locator('input[type="date"]').first().fill(formatDate(today))
    await page.locator('input[type="date"]').nth(1).fill(formatDate(weekLater))

    // 选择星期几（周一到周五）
    const weekdays = ['一', '二', '三', '四', '五']
    for (const day of weekdays) {
      await page.click(`button:has-text("${day}")`)
    }

    // 验证预览显示
    await expect(page.locator('.preview-box')).toBeVisible()
  })

  test('批量创建 - 验证至少选择一天', async ({ page }) => {
    await page.click('button:has-text("📥")')
    await page.waitForTimeout(300)

    await page.click('button:has-text("按区间批量创建")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="如: 晚跑"]', '测试')

    // 取消默认选中的周一（组件默认 daysOfWeek: [1]）
    await page.click('button:has-text("一")')
    await page.waitForTimeout(300)

    // 不选择任何星期几
    const confirmBtn = page.locator('button:has-text("确认创建")')
    await expect(confirmBtn).toBeDisabled()
  })

  test('批量创建 - 验证时间顺序', async ({ page }) => {
    await page.click('button:has-text("📥")')
    await page.waitForTimeout(300)

    await page.click('button:has-text("按区间批量创建")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="如: 晚跑"]', '测试')

    // 设置结束时间早于开始时间
    await page.locator('input[type="time"]').first().fill('14:00')
    await page.locator('input[type="time"]').nth(1).fill('10:00')

    const confirmBtn = page.locator('button:has-text("确认创建")')
    // 点击确认创建，应提示错误
    await confirmBtn.click()
    await page.waitForTimeout(500)
    await expect(page.locator('text=结束时间必须晚于开始时间')).toBeVisible()
  })

  test('关闭批量对话框', async ({ page }) => {
    await page.click('button:has-text("📥")')
    await page.waitForTimeout(300)

    await expect(page.locator('.modal-mask')).toBeVisible()

    await page.click('.close-btn')
    await page.waitForTimeout(300)

    await expect(page.locator('.modal-mask')).not.toBeVisible()
  })
})
