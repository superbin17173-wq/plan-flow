import { test, expect } from '@playwright/test'

test('首页到planflow导航测试', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  // 打开首页
  await page.goto('http://localhost:3019/')
  await page.waitForTimeout(1500)

  // 截图首页
  await page.screenshot({ path: 'test-results/test-home.png' })
  console.log('✅ 首页加载成功')

  // 点击 PlanFlow 项目卡片
  await page.click('.project-card:not(.disabled):not(.placeholder)')
  await page.waitForTimeout(2000)

  // 应该跳转到 planflow
  await expect(page).toHaveURL(/#\/planflow/)
  await page.screenshot({ path: 'test-results/test-planflow.png' })
  console.log('✅ PlanFlow 页面加载成功')
})

test('planflow视图切换测试', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3019/#/planflow')
  await page.waitForTimeout(1500)

  // 月视图
  await page.screenshot({ path: 'test-results/test-month-view.png' })
  console.log('✅ 月视图')

  // 切换周视图
  const weekBtn = page.locator('.view-switcher .view-btn').nth(1)
  if (await weekBtn.count() > 0) {
    await weekBtn.click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/test-week-view.png' })
    console.log('✅ 周视图')
  }

  // 切换日视图
  const dayBtn = page.locator('.view-switcher .view-btn').nth(2)
  if (await dayBtn.count() > 0) {
    await dayBtn.click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/test-day-view.png' })
    console.log('✅ 日视图')
  }

  // 切换年视图
  const yearBtn = page.locator('.view-switcher .view-btn').nth(0)
  if (await yearBtn.count() > 0) {
    await yearBtn.click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/test-year-view.png' })
    console.log('✅ 年视图')
  }
})

test('任务表单测试', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3019/#/planflow')
  await page.waitForTimeout(1500)

  // 点击新建任务按钮
  const addBtn = page.locator('.action-btn:has-text("+"), button:has-text("+")')
  await addBtn.first().click()
  await page.waitForTimeout(800)

  // 截图表单
  await page.screenshot({ path: 'test-results/test-task-form.png' })
  console.log('✅ 任务表单')

  // 关闭表单
  await page.click('.close-btn')
  await page.waitForTimeout(300)
})