/**
 * 测试模块2: 日历视图与导航
 * 覆盖：月视图、周视图、日视图、年周视图、导航功能、日期选择
 */
import { test, expect } from '@playwright/test'

test.describe('日历视图与导航', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })
  })

  test('视图切换 - 月/周/日/年', async ({ page }) => {
    // 切换到周视图
    await page.click('button:has-text("周")')
    await page.waitForTimeout(300)
    await expect(page.locator('.week-calendar')).toBeVisible()

    // 切换到日视图
    await page.click('button:has-text("日")')
    await page.waitForTimeout(300)
    await expect(page.locator('.day-calendar')).toBeVisible()

    // 切换到年视图
    await page.click('button:has-text("年")')
    await page.waitForTimeout(300)
    await expect(page.locator('.year-week-view')).toBeVisible()

    // 切换回月视图
    await page.click('button:has-text("月")')
    await page.waitForTimeout(300)
    await expect(page.locator('.month-calendar')).toBeVisible()
  })

  test('月视图 - 点击日期切换到日视图', async ({ page }) => {
    // 确保在月视图
    await page.click('button:has-text("月")')
    await page.waitForTimeout(300)

    // 点击一个日期单元格
    const dateCell = page.locator('.day-cell').filter({ hasText: '15' }).first()
    await dateCell.click()

    // 应切换到日视图
    await expect(page.locator('.day-calendar')).toBeVisible()
  })

  test('月视图 - 双击日期创建任务', async ({ page }) => {
    await page.click('button:has-text("月")')
    await page.waitForTimeout(300)

    // 双击日期单元格
    const dateCell = page.locator('.day-cell').filter({ hasText: '20' }).first()
    await dateCell.dblclick()

    // 任务表单应打开
    await expect(page.locator('.modal-content')).toBeVisible()
    await expect(page.locator('h2:has-text("新建任务")')).toBeVisible()

    await page.click('button:has-text("取消")')
  })

  test('月视图 - 今日高亮', async ({ page }) => {
    await page.click('button:has-text("月")')
    await page.waitForTimeout(300)

    // 今日单元格应有特殊样式
    const todayCell = page.locator('.day-cell.today')
    await expect(todayCell).toBeVisible()
  })

  test('周视图 - 显示7天列', async ({ page }) => {
    await page.click('button:has-text("周")')
    await page.waitForTimeout(300)

    // 应有7个日期列
    const dayColumns = page.locator('.day-column')
    await expect(dayColumns).toHaveCount(7)

    // 应有7个日期头
    const dayHeaders = page.locator('.day-header-cell')
    await expect(dayHeaders).toHaveCount(7)
  })

  test('周视图 - 点击日期列头切换日视图', async ({ page }) => {
    await page.click('button:has-text("周")')
    await page.waitForTimeout(300)

    // 点击一个日期头
    const dayHeader = page.locator('.day-header-cell').nth(3)
    await dayHeader.click()

    // 应切换到日视图
    await expect(page.locator('.day-calendar')).toBeVisible()
  })

  test('日视图 - 导航按钮', async ({ page }) => {
    await page.click('button:has-text("日")')
    await page.waitForTimeout(300)

    // 测试返回按钮
    await page.click('button:has-text("←")')
    await page.waitForTimeout(300)
    // 返回后应在月视图或上一视图

    // 再次进入日视图
    await page.click('button:has-text("日")')
    await page.waitForTimeout(300)

    // 测试前一天按钮
    await page.click('button:has-text("‹")')
    await page.waitForTimeout(300)

    // 测试后一天按钮
    await page.click('button:has-text("›")')
    await page.waitForTimeout(300)

    // 测试今天按钮
    await page.click('button:has-text("今")')
    await page.waitForTimeout(300)
  })

  test('日视图 - 时间轴显示24小时', async ({ page }) => {
    await page.click('button:has-text("日")')
    await page.waitForTimeout(300)

    // 应有24个小时标签
    const hourLabels = page.locator('.hour-label')
    await expect(hourLabels).toHaveCount(24)
  })

  test('年周视图 - 显示全年周', async ({ page }) => {
    await page.click('button:has-text("年")')
    await page.waitForTimeout(300)

    // 应有12个月分组
    const monthGroups = page.locator('.month-group')
    await expect(monthGroups).toHaveCount(12)

    // 每月应有若干周单元格
    const weekCells = page.locator('.week-cell')
    const count = await weekCells.count()
    expect(count).toBeGreaterThan(50) // 全年应有52+周
  })

  test('年周视图 - 导航按钮', async ({ page }) => {
    await page.click('button:has-text("年")')
    await page.waitForTimeout(300)

    // 上一年
    await page.click('button:has-text("‹")')
    await page.waitForTimeout(300)

    // 下一年
    await page.click('button:has-text("›")')
    await page.waitForTimeout(300)

    // 今年
    await page.click('button:has-text("今")')
    await page.waitForTimeout(300)
  })

  test('年周视图 - 点击周切换周视图', async ({ page }) => {
    await page.click('button:has-text("年")')
    await page.waitForTimeout(300)

    // 点击一个周单元格
    const weekCell = page.locator('.week-cell').nth(20)
    await weekCell.click()

    // 应切换到周视图
    await expect(page.locator('.week-calendar')).toBeVisible()
  })

  test('全局导航 - 前一周期', async ({ page }) => {
    // 月视图下前一周期是上月
    await page.click('button:has-text("月")')
    await page.waitForTimeout(300)

    await page.click('button.nav-btn:has-text("‹")')
    await page.waitForTimeout(300)

    // 周视图下前一周期是上周
    await page.click('button:has-text("周")')
    await page.waitForTimeout(300)

    await page.click('button.nav-btn:has-text("‹")')
    await page.waitForTimeout(300)
  })

  test('全局导航 - 后一周期', async ({ page }) => {
    await page.click('button:has-text("月")')
    await page.waitForTimeout(300)

    await page.click('button.nav-btn:has-text("›")')
    await page.waitForTimeout(300)
  })

  test('全局导航 - 今天按钮', async ({ page }) => {
    // 导航到其他日期
    await page.click('button:has-text("月")')
    await page.waitForTimeout(300)

    // 前进几个月
    await page.click('button.nav-btn:has-text("›")')
    await page.click('button.nav-btn:has-text("›")')
    await page.waitForTimeout(300)

    // 点击今天回到当前月
    await page.click('button.nav-btn:has-text("今")')
    await page.waitForTimeout(300)

    // 验证回到今天
    const todayCell = page.locator('.day-cell.today')
    await expect(todayCell).toBeVisible()
  })

  test('月视图显示任务chip', async ({ page }) => {
    // 先创建几个任务
    await page.click('button:has-text("+")')
    await page.fill('input[placeholder="输入任务标题"]', '月视图任务1')
    await page.click('button:has-text("创建")')

    await page.waitForTimeout(300)

    await page.click('button:has-text("+")')
    await page.fill('input[placeholder="输入任务标题"]', '月视图任务2')
    await page.click('button:has-text("创建")')

    await page.waitForTimeout(300)

    // 确保在月视图
    await page.click('button:has-text("月")')
    await page.waitForTimeout(500)

    // 验证任务chip显示
    const taskChips = page.locator('.task-chip')
    await expect(taskChips.first()).toBeVisible()
  })
})