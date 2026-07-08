// 学习功能综合测试 - 使用 Playwright 原生 API
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Users/ljadmin/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const executablePath = candidates.find((p) => existsSync(p))
if (!executablePath) { console.error('未找到浏览器'); process.exit(1) }

const OUT_DIR = 'shots/study-final'
mkdirSync(OUT_DIR, { recursive: true })

// 检测端口
const possiblePorts = [3012, 3013, 3014, 3015]
let port = 3012
for (const p of possiblePorts) {
  try {
    const resp = await fetch(`http://localhost:${p}`, { method: 'HEAD' })
    if (resp.ok) { port = p; break }
  } catch {}
}
console.log(`Dev server 端口: ${port}`)

const browser = await chromium.launch({ executablePath, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' })

const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

async function shot(name) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png` })
  console.log(`✓ ${name}`)
}

console.log('\n=== 学习功能验证 ===\n')

// 1. 打开应用
await page.goto(`http://localhost:${port}/#/planflow`, { waitUntil: 'networkidle' })
await shot('01-home')

// 2. 点击新建任务按钮
await page.click('button:has-text("+")')
await page.waitForTimeout(800)
await shot('02-form')

// 3. 填标题 - 等待输入框出现后填写
await page.waitForSelector('input[type="text"]', { timeout: 5000 })
await page.fill('input[type="text"]', 'GRE单词测试')
await shot('03-title')

// 4. 点击分类按钮切换到学习
await page.click('button:has-text("学习")')
await page.waitForTimeout(600)
await shot('04-category')

// 5. 检查学习区块出现
const studyBlock = await page.locator('.study-block').isVisible()
console.log(`学习区块: ${studyBlock ? '✅' : '❌'}`)

if (studyBlock) {
  // 填学习主题
  await page.fill('.study-block input', 'GRE单词List5')
  // 填学习材料
  await page.fill('.study-block textarea', 'ephemeral短暂的 ubiquitous无处不在的')
  // 勾选艾宾浩斯
  await page.check('.ebbinghaus-toggle input[type="checkbox"]')
  await shot('05-ebbinghaus')
}

// 6. 点击保存按钮
await page.click('.submit-btn')
await page.waitForTimeout(1500)
await shot('06-saved')

// 7. 切到月视图看复习任务
await page.click('.view-btn:has-text("月")')
await page.waitForTimeout(500)
await shot('07-month')

// 8. 统计复习任务图标数量
const reviewIcons = await page.locator('text=🔁').count()
console.log(`复习任务图标(🔁)数量: ${reviewIcons}`)

// 9. 下一天查看复习任务
await page.click('.nav-btn:has-text("›")')
await page.waitForTimeout(400)
await shot('08-next-day')

// 10. 点击复习任务
const taskBlock = await page.locator('.task-block').first()
if (await taskBlock.isVisible()) {
  await taskBlock.click()
  await page.waitForTimeout(700)
  await shot('09-card')

  // 11. 点击复习按钮
  const reviewBtn = await page.locator('.study-review-btn')
  if (await reviewBtn.isVisible()) {
    await reviewBtn.click()
    await page.waitForTimeout(600)
    await shot('10-review-dialog')

    // 检查 AI 按钮
    const aiBtn = await page.locator('.ai-chat-btn').isVisible()
    const voiceBtn = await page.locator('.voice-btn').isVisible()
    console.log(`AI问答按钮: ${aiBtn ? '✅' : '❌'}`)
    console.log(`语音按钮: ${voiceBtn ? '✅' : '❌'}`)
  } else {
    console.log('复习按钮未显示')
  }
} else {
  console.log('复习任务未找到')
}

// 12. 学习仪表盘
await page.goto(`http://localhost:${port}/#/study-dashboard`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await shot('11-dashboard')

const dashTitle = await page.locator('header h1').isVisible()
console.log(`仪表盘标题: ${dashTitle ? '✅' : '❌'}`)

// 13. 返回设置面板检查存储管理
await page.goto(`http://localhost:${port}/#/planflow`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
// 桌面端直接点击设置按钮，移动端用更多菜单
const settingsBtn = await page.locator('button[title="设置"]').first()
if (await settingsBtn.isVisible()) {
  await settingsBtn.click()
} else {
  // 移动端溢出菜单
  await page.click('button[title="更多"]')
  await page.waitForTimeout(300)
  await page.click('.el-dropdown-menu__item:has-text("设置")')
}
await page.waitForTimeout(800)
await shot('12-settings')

const storageBlock = await page.locator('h3:has-text("存储管理")').isVisible()
console.log(`存储管理区块: ${storageBlock ? '✅' : '❌'}`)

// 汇总
console.log('\n=== 结果 ===')
console.log(`JS错误: ${errors.length}`)
if (errors.length) errors.forEach(e => console.log(`  - ${e.slice(0, 100)}`))
console.log(`截图: ${OUT_DIR}/`)

await browser.close()