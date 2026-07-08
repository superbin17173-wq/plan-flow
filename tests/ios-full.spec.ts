import { test } from '@playwright/test'

test('iOS风格日历 - 完整效果', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3019/#/ios')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/ios-full-calendar.png', fullPage: true })
  console.log('✅ iOS 日历全页截图')

  // 点击添加任务按钮，截图表单
  await page.click('button:has-text("+")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/ios-task-form.png', fullPage: false })
  console.log('✅ iOS 任务表单截图')

  // 关闭表单
  await page.click('.close-btn')
  await page.waitForTimeout(300)

  // 截图 OTA 更新对话框样式（通过设置）
  await page.click('button:has-text("设置")')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/ios-settings.png', fullPage: true })
  console.log('✅ iOS 设置面板截图')
})