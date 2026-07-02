/**
 * 测试模块7: 提醒功能
 * 覆盖：提醒设置、提醒时间选项
 */
import { test, expect } from '@playwright/test'

test.describe('提醒功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })
  })

  test('创建带提醒的任务', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '提醒任务测试')

    // 开启提醒开关
    const toggleBtn = page.locator('.form-group:has(label:text-is("提醒")) .toggle-btn')
    await toggleBtn.click()
    await page.waitForTimeout(500)

    // 验证提醒选项显示
    await expect(page.locator('.reminder-options')).toBeVisible()

    // 选择提前15分钟
    await page.locator('.reminder-options select').selectOption({ label: '提前15分钟' })

    await page.click('button:has-text("创建")')
    await page.waitForTimeout(500)

    // 验证任务创建成功
    await expect(page.locator('.task-chip, .task-block').filter({ hasText: '提醒任务测试' })).toBeVisible()
  })

  test('所有提醒时间选项', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '提醒选项测试')

    // 开启提醒开关
    const toggleBtn = page.locator('.form-group:has(label:text-is("提醒")) .toggle-btn')
    await toggleBtn.click()
    await page.waitForTimeout(300)

    // 验证所有选项存在
    const options = ['任务开始时', '提前5分钟', '提前15分钟', '提前30分钟', '提前1小时']
    const select = page.locator('.reminder-options select')
    for (const opt of options) {
      await expect(select).toContainText(opt)
    }

    await page.click('button:has-text("取消")')
  })

  test('关闭提醒开关', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '关闭提醒测试')

    // 开启提醒
    const toggleBtn = page.locator('.form-group:has(label:text-is("提醒")) .toggle-btn')
    await toggleBtn.click()
    await page.waitForTimeout(300)

    await expect(page.locator('.reminder-options')).toBeVisible()

    // 关闭提醒
    await toggleBtn.click()
    await page.waitForTimeout(300)

    await expect(page.locator('.reminder-options')).not.toBeVisible()

    await page.click('button:has-text("取消")')
  })

  test('编辑任务时显示已有提醒设置', async ({ page }) => {
    // 创建带提醒的任务
    await page.click('button:has-text("+")')
    await page.fill('input[placeholder="输入任务标题"]', '编辑提醒测试')
    // 开启提醒开关
    await page.locator('.form-group:has(label:text-is("提醒")) .toggle-btn').click()
    await page.waitForTimeout(300)
    await page.locator('.reminder-options select').selectOption({ label: '提前30分钟' })
    await page.click('button:has-text("创建")')
    await page.waitForTimeout(500)

    // 打开任务卡片
    const task = page.locator('.task-chip, .task-block').filter({ hasText: '编辑提醒测试' }).first()
    await task.click()
    await page.waitForTimeout(300)

    // 点击编辑
    await page.click('button:has-text("编辑")')
    await page.waitForTimeout(300)

    // 验证提醒开关已开启
    await expect(page.locator('.reminder-options')).toBeVisible()

    // 验证提醒时间正确
    const select = page.locator('.reminder-options select')
    await expect(select).toHaveValue('30')

    await page.click('button:has-text("取消")')
  })

  test('任务卡片显示提醒信息', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '提醒信息显示')
    // 开启提醒开关
    await page.locator('.form-group:has(label:text-is("提醒")) .toggle-btn').click()
    await page.waitForTimeout(300)
    await page.locator('.reminder-options select').selectOption({ label: '提前1小时' })
    await page.click('button:has-text("创建")')
    await page.waitForTimeout(500)

    // 打开任务卡片
    const task = page.locator('.task-chip, .task-block').filter({ hasText: '提醒信息显示' }).first()
    await task.click()
    await page.waitForTimeout(300)

    // 验证卡片显示提醒信息
    await expect(page.locator('.task-card')).toContainText('提醒')
  })
})