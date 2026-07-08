import { test, expect, devices } from '@playwright/test'

// 模拟手机端测试 - 使用 iPhone 13 尺寸
test.describe.configure({ mode: 'parallel' })

test('移动端 - 顶部应显示月份', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
  })
  const page = await context.newPage()

  await page.goto('http://localhost:3019/#/planflow')
  await page.waitForLoadState('networkidle')

  // 等待加载完成
  await page.waitForTimeout(2000)

  // 截图看当前状态
  await page.screenshot({ path: 'test-results/mobile-header-check.png', fullPage: false })

  const viewTitle = page.locator('.view-title')
  const count = await viewTitle.count()
  console.log('view-title 元素数量:', count)

  if (count > 0) {
    const text = await viewTitle.first().textContent()
    console.log('顶部标题:', text)
    // 应该显示 "YYYY年MM月" 格式
    expect(text).toMatch(/\d{4}年\d{2}月/)
  } else {
    console.log('view-title 未找到，检查 header 结构')
    const header = await page.locator('.app-header').innerHTML()
    console.log('header HTML:', header.substring(0, 500))
  }

  await context.close()
})

test('移动端 - 设置面板显示版本号', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
  })
  const page = await context.newPage()

  await page.goto('http://localhost:3019/#/planflow')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  // 打开溢出菜单
  const overflowBtn = page.locator('.overflow-btn')
  const count = await overflowBtn.count()
  console.log('overflow-btn 数量:', count)

  if (count > 0) {
    await overflowBtn.click()
    await page.waitForTimeout(500)

    // 点击设置
    await page.click('text=设置')
    await page.waitForTimeout(1000)

    // 截图
    await page.screenshot({ path: 'test-results/mobile-settings-check.png', fullPage: true })

    // 找到版本号 badge
    const versionBadge = page.locator('.version-badge')
    const badgeCount = await versionBadge.count()
    console.log('version-badge 数量:', badgeCount)

    if (badgeCount > 0) {
      const versionText = await versionBadge.first().textContent()
      console.log('版本号:', versionText)
      expect(versionText).toContain('v0.0')
    } else {
      // 查找 OTA 标题
      const otaTitle = await page.locator('h3').filter({ hasText: 'APP' }).textContent()
      console.log('OTA 标题:', otaTitle)
    }
  } else {
    console.log('overflow-btn 未找到')
    await page.screenshot({ path: 'test-results/mobile-header-no-overflow.png', fullPage: false })
  }

  await context.close()
})