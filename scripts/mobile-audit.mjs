// 批量截图手机端多个场景:通过 route/click 序列驱动
import { chromium, devices } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Users/ljadmin/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const executablePath = candidates.find((p) => existsSync(p))
if (!executablePath) {
  console.error('未找到浏览器')
  process.exit(1)
}

const OUT_DIR = 'shots/audit'
mkdirSync(OUT_DIR, { recursive: true })

const iphone = devices['iPhone 13']
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ ...iphone })
const page = await context.newPage()

// 收集控制台错误
const errors = []
page.on('pageerror', (err) => errors.push(`PageError: ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`Console: ${msg.text()}`)
})

async function shot(name, notes = '') {
  const path = `${OUT_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  console.log(`✓ ${name}${notes ? ' — ' + notes : ''}`)
}

async function go(hash) {
  await page.goto(`http://localhost:3012${hash}`, { waitUntil: 'networkidle', timeout: 20000 })
  await page.waitForTimeout(600)
}

async function safeClick(selector, timeout = 2000) {
  try {
    await page.click(selector, { timeout })
    await page.waitForTimeout(400)
    return true
  } catch {
    console.log(`  ⚠ click failed: ${selector}`)
    return false
  }
}

async function pressEsc() {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

// ===== 场景 1:首页 =====
await go('/#/')
await shot('01-home', '首页项目列表')

// ===== 场景 2:PlanFlow 各视图 =====
await go('/#/planflow')
await shot('02-planflow-month', '月视图(默认)')

// 切到周
await safeClick('.view-btn:has-text("周")')
await shot('03-planflow-week', '周视图')

// 切到日
await safeClick('.view-btn:has-text("日")')
await shot('04-planflow-day', '日视图')

// 切到年
await safeClick('.view-btn:has-text("年")')
await shot('05-planflow-year', '年视图')

// 回月视图
await safeClick('.view-btn:has-text("月")')

// ===== 场景 3:新建任务弹窗 =====
await safeClick('button[title="新建任务"]')
await shot('06-task-form', '任务表单')
await pressEsc()

// ===== 场景 4:搜索面板 =====
await safeClick('button[title="搜索"]')
await shot('07-search', '搜索面板')
await pressEsc()

// ===== 场景 5:溢出菜单(⋯) =====
await safeClick('button[title="更多"]')
await shot('08-overflow-menu', '⋯ 溢出菜单展开')

// 点击 "批量/导入"
await safeClick('.el-dropdown-menu__item:has-text("批量")')
await shot('09-bulk-dialog', '批量/导入弹窗')
await pressEsc()

// ===== 场景 6:统计 =====
await safeClick('button[title="更多"]')
await safeClick('.el-dropdown-menu__item:has-text("统计")')
await shot('10-stats', '统计面板')
await pressEsc()

// ===== 场景 7:设置 =====
await safeClick('button[title="更多"]')
await safeClick('.el-dropdown-menu__item:has-text("设置")')
await shot('11-settings', '设置面板')
await pressEsc()

// ===== 场景 8:AI 助手 =====
await safeClick('.chat-bubble, [class*="chat-bubble"]')
await shot('12-ai-chat', 'AI 助手浮动窗')

console.log('\n共截图完毕。目录:', OUT_DIR)
if (errors.length) {
  console.log('\n⚠️ 页面错误:')
  errors.forEach((e) => console.log('  ', e))
} else {
  console.log('✅ 无 JS 错误')
}

await browser.close()
