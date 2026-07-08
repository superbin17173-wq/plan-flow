import { test } from '@playwright/test'

test('打开 Cloudflare Dashboard - 用户登录后我来操作', async ({ page }) => {
  // 打开 Cloudflare Dashboard
  await page.goto('https://dash.cloudflare.com/')

  console.log('浏览器已打开，请登录 Cloudflare...')

  // 暂停让用户登录 - 用户可以手动操作
  await page.pause()

  // 用户登录后继续
  console.log('用户已登录，开始操作...')

  // 导航到 Pages
  await page.click('text=Pages', { timeout: 30000 })
  await page.waitForTimeout(2000)

  // 点击 planflow
  await page.click('text=planflow')
  await page.waitForTimeout(2000)

  // 查看当前状态
  await page.screenshot({ path: 'test-results/cloudflare-state.png', fullPage: true })

  // 检查远程版本
  await page.goto('https://planflow-aot.pages.dev/version.json')
  const content = await page.textContent('body')
  console.log('当前远程版本:', content)
})