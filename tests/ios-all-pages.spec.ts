import { test } from '@playwright/test'

test('验证所有页面iOS风格', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  // 1. 首页
  await page.goto('http://localhost:3019/')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/ios-home.png' })
  console.log('✅ 首页截图')

  // 2. PlanFlow 月视图
  await page.goto('http://localhost:3019/#/planflow')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/ios-planflow-month.png' })
  console.log('✅ PlanFlow 月视图')

  // 3. 切换到周视图
  await page.click('.view-btn:has-text("周")')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'test-results/ios-planflow-week.png' })
  console.log('✅ 周视图')

  // 4. 切换到日视图
  await page.click('.view-btn:has-text("日")')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'test-results/ios-planflow-day.png' })
  console.log('✅ 日视图')

  // 5. 打开新建任务表单
  await page.click('button:has-text("+")')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'test-results/ios-task-form.png' })
  console.log('✅ 任务表单')
})

test('验证组件iOS风格', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3019/#/planflow')
  await page.waitForTimeout(1500)

  // 打开设置面板
  await page.click('.overflow-btn')
  await page.waitForTimeout(300)
  await page.click('text=设置')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'test-results/ios-settings-panel.png' })
  console.log('✅ 设置面板')
})