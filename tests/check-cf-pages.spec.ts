import { test, expect } from '@playwright/test'

test('Check Cloudflare Pages deployment', async ({ page }) => {
  // 直接访问部署地址
  const response = await page.goto('https://planflow.pages.dev/version.json', {
    waitUntil: 'networkidle'
  })

  console.log('Status:', response?.status())

  const content = await page.content()
  console.log('Content:', content)

  // 如果 404，尝试检查其他可能的地址
  if (response?.status() === 404) {
    console.log('404 - checking alternative URLs...')

    // 可能项目名不同
    const altUrls = [
      'https://plan-flow.pages.dev/version.json',
      'https://planflow-ota.pages.dev/version.json',
    ]

    for (const url of altUrls) {
      const r = await page.goto(url)
      console.log(`${url}: ${r?.status()}`)
      if (r?.status() === 200) {
        console.log('Found!', await page.content())
        break
      }
    }
  }
})