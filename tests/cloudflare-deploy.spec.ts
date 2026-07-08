import { test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

test('Cloudflare Pages 部署', async ({ page }) => {
  // 打开 Cloudflare Dashboard
  await page.goto('https://dash.cloudflare.com/')
  await page.screenshot({ path: 'test-results/cloudflare-1-login.png' })

  console.log('=== 请在浏览器窗口中登录 Cloudflare ===')
  console.log('=== 登录后我会继续操作 ===')

  // 等待用户登录（检测是否进入了主页面）
  // 用户登录后会看到顶部导航栏
  await page.waitForSelector('[data-testid="pages-link"], a[href="/pages"], text=Pages', { timeout: 300000 })

  console.log('=== 检测到登录成功，继续操作 ===')

  // 进入 Pages
  await page.click('text=Pages')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/cloudflare-2-pages.png' })

  // 点击 planflow 项目
  await page.click('text=planflow')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/cloudflare-3-project.png' })

  // 点击 Create deployment
  try {
    await page.click('text=Create deployment')
    await page.waitForTimeout(1000)
  } catch {
    // 可能按钮文字不同
    await page.click('button:has-text("Create")')
    await page.waitForTimeout(1000)
  }
  await page.screenshot({ path: 'test-results/cloudflare-4-deploy.png' })

  // 选择 Direct Upload
  try {
    await page.click('text=Direct Upload')
    await page.waitForTimeout(1000)
  } catch {
    // 可能已经是 Direct Upload 页面
  }
  await page.screenshot({ path: 'test-results/cloudflare-5-upload.png' })

  console.log('=== 请手动拖拽 dist 文件夹到上传区域 ===')
  console.log('=== 或者等待我尝试文件上传 ===')

  // 尝试上传文件 - 通过文件输入框
  const distPath = path.resolve('./dist')

  // 获取 dist 目录下所有文件
  const files: string[] = []
  function getAllFiles(dir: string, baseDir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        getAllFiles(fullPath, baseDir)
      } else {
        files.push(fullPath)
      }
    }
  }
  getAllFiles(distPath, distPath)

  console.log(`找到 ${files.length} 个文件`)

  // 尝试找到文件上传输入框
  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count() > 0) {
    // 只上传关键文件（version.json 和 index.html 等）
    const keyFiles = files.filter(f =>
      f.includes('version.json') ||
      f.includes('index.html') ||
      f.includes('_routes.json')
    )
    await fileInput.setInputFiles(keyFiles)
    await page.waitForTimeout(2000)
  }

  await page.screenshot({ path: 'test-results/cloudflare-6-files.png' })

  // 等待用户完成上传和部署
  console.log('=== 请点击 Deploy 按钮完成部署 ===')
  await page.waitForTimeout(60000) // 等待用户操作

  // 验证远程版本
  console.log('=== 验证远程版本 ===')
  await page.goto('https://planflow-aot.pages.dev/version.json')
  const content = await page.textContent('body')
  console.log('远程 version.json:', content)
  await page.screenshot({ path: 'test-results/cloudflare-7-version.png' })
})