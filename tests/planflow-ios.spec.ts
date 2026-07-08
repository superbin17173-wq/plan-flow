import { test } from '@playwright/test'

test('原有planflow页面 - iOS风格', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3019/#/planflow')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/planflow-ios-style.png', fullPage: true })
  console.log('✅ planflow iOS 风格截图完成')
})