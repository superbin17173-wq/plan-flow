// 手机视口截图工具:用于迭代式调整移动端 UI
// 用法: node scripts/mobile-shot.mjs [route] [outfile]
import { chromium, devices } from 'playwright-core'
import { existsSync } from 'node:fs'

const route = process.argv[2] || '/#/planflow'
const outfile = process.argv[3] || 'mobile-shot.png'
const url = `http://localhost:3012${route}`

// 找本机 chrome 路径(playwright-core 不自带浏览器)
const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Users/ljadmin/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const executablePath = candidates.find((p) => existsSync(p))
if (!executablePath) {
  console.error('未找到 Chrome/Edge,请手动改 mobile-shot.mjs 里的 candidates')
  process.exit(1)
}

const iphone = devices['iPhone 13']
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ ...iphone })
const page = await context.newPage()

console.log(`视口 ${iphone.viewport.width}x${iphone.viewport.height}, 打开 ${url}`)
await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(600)

await page.screenshot({ path: outfile, fullPage: false })
console.log('已保存:', outfile)
await browser.close()
