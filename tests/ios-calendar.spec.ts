import { test } from '@playwright/test'

test('截图iOS风格日历', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }) // iPhone 14 尺寸
  await page.goto('http://localhost:3019/#/ios')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'test-results/ios-calendar-main.png', fullPage: false })
  console.log('✅ iOS风格日历截图完成')
})