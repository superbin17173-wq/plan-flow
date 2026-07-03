import { test, expect } from '@playwright/test'

test('Update Cloudflare Pages production branch to master', async ({ page }) => {
  // 打开 Cloudflare Pages 项目设置页面
  console.log('Opening Cloudflare Dashboard...')

  await page.goto('https://dash.cloudflare.com/d3faa697c42199d984556a4afd886cac/pages/view/planflow')

  // 等待页面加载
  await page.waitForLoadState('networkidle')

  // 截图查看当前状态
  await page.screenshot({ path: 'test-results/cf-pages-settings.png', fullPage: true })
  console.log('Screenshot saved to test-results/cf-pages-settings.png')

  // 检查是否需要登录
  const loginForm = await page.$('input[type="email"]')
  if (loginForm) {
    console.log('Need to login - please login in the browser window')
    // 等待用户登录
    await page.waitForSelector('[data-testid="pages-project-settings"]', { timeout: 120000 })
  }

  // 点击 Settings 标签
  console.log('Looking for Settings tab...')
  const settingsTab = await page.$('text=Settings')
  if (settingsTab) {
    await settingsTab.click()
    await page.waitForLoadState('networkidle')
  }

  // 找到 Production branch 设置
  console.log('Looking for Production branch setting...')
  await page.screenshot({ path: 'test-results/cf-pages-settings-tab.png', fullPage: true })

  // 尝试找到并修改 production branch
  const branchInput = await page.$('input[value="main"]')
  if (branchInput) {
    console.log('Found production branch input, changing to master...')
    await branchInput.fill('master')

    // 保存
    const saveButton = await page.$('button:has-text("Save")')
    if (saveButton) {
      await saveButton.click()
      console.log('Saved!')
    }
  } else {
    console.log('Production branch input not found - checking page structure')
    const pageContent = await page.content()
    console.log('Page contains "production":', pageContent.includes('production'))
    console.log('Page contains "branch":', pageContent.includes('branch'))
  }

  // 最终截图
  await page.screenshot({ path: 'test-results/cf-pages-final.png', fullPage: true })
})