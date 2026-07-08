import { test, expect, devices } from '@playwright/test'

test('截取4种UI风格预览', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 400, height: 900 },
  })
  const page = await context.newPage()

  await page.goto('http://localhost:3019/#/ui-preview')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // 点击新拟态风格
  await page.click('button:has-text("新拟态")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/ui-style-neumorphism.png', fullPage: false })
  console.log('✅ 新拟态风格截图完成')

  // 点击玻璃拟态风格
  await page.click('button:has-text("玻璃拟态")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/ui-style-glassmorphism.png', fullPage: false })
  console.log('✅ 玻璃拟态风格截图完成')

  // 点击极简风格
  await page.click('button:has-text("极简风")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/ui-style-minimal.png', fullPage: false })
  console.log('✅ 极简风格截图完成')

  // 点击iOS风格
  await page.click('button:has-text("iOS风格")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/ui-style-ios.png', fullPage: false })
  console.log('✅ iOS风格截图完成')

  await context.close()
})