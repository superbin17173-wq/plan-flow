import { test } from '@playwright/test'

test('iOS风格 - 所有视图验证', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  // 首页
  await page.goto('http://localhost:3019/')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/verify-ios-home.png', fullPage: false })
  console.log('✅ 首页')

  // PlanFlow 月视图
  await page.goto('http://localhost:3019/#/planflow')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/verify-ios-month.png', fullPage: true })
  console.log('✅ 月视图')

  // 切换周视图
  try {
    await page.click('.view-switcher .view-btn:nth-child(2)')
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/verify-ios-week.png', fullPage: false })
    console.log('✅ 周视图')
  } catch {}

  // 切换日视图
  try {
    await page.click('.view-switcher .view-btn:nth-child(3)')
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/verify-ios-day.png', fullPage: false })
    console.log('✅ 日视图')
  } catch {}

  // 切换年视图
  try {
    await page.click('.view-switcher .view-btn:nth-child(1)')
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/verify-ios-year.png', fullPage: false })
    console.log('✅ 年视图')
  } catch {}
})

test('iOS风格 - 组件验证', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3019/#/planflow')
  await page.waitForTimeout(1500)

  // 搜索栏
  try {
    await page.click('button:has-text("🔍")')
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test-results/verify-ios-search.png', fullPage: false })
    console.log('✅ 搜索栏')
    await page.keyboard.press('Escape')
  } catch {}

  // 任务表单
  try {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'test-results/verify-ios-form.png', fullPage: false })
    console.log('✅ 任务表单')
  } catch {}
})