import { test } from '@playwright/test'

test('截图新拟态', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 })
  await page.goto('http://localhost:3019/#/ui-preview')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("新拟态")')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/ui-neumorphism.png' })
})

test('截图玻璃拟态', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 })
  await page.goto('http://localhost:3019/#/ui-preview')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("玻璃拟态")')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/ui-glassmorphism.png' })
})

test('截图极简风', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 })
  await page.goto('http://localhost:3019/#/ui-preview')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("极简风")')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/ui-minimal.png' })
})

test('截图iOS风格', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 })
  await page.goto('http://localhost:3019/#/ui-preview')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("iOS风格")')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/ui-ios.png' })
})