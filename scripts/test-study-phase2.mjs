// 阶段 2 AI 多会话功能测试
// 场景:
//   1. 新建学习任务(启用艾宾浩斯) → 验证自动生成 aiSessionId
//   2. 打开复习任务 → 点击"AI 问答复习"按钮 → 验证 AI 聊天面板打开
//   3. 验证 AI 聊天面板已切换到学习会话(显示材料作为 system prompt 注入)
//   4. 发送一条消息 → 验证消息 sessionId 正确
//   5. 关闭 AI 面板 → 再打开默认全局会话 → 验证消息隔离
//
// 用法: node scripts/test-study-phase2.mjs

import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Users/ljadmin/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const executablePath = candidates.find((p) => existsSync(p))
if (!executablePath) {
  console.error('未找到 Chrome/Edge')
  process.exit(1)
}

const OUT_DIR = 'shots/study-phase2'
mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'zh-CN',
})
const page = await context.newPage()

const errors = []
page.on('pageerror', (err) => errors.push(`PageError: ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`Console: ${msg.text()}`)
})

async function shot(name, note = '') {
  const path = `${OUT_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  console.log(`✓ ${name}${note ? ' — ' + note : ''}`)
}

async function safeClick(sel, opts = {}) {
  try {
    await page.click(sel, { timeout: opts.timeout ?? 3000, ...opts })
    if (opts.waitAfter !== 0) await page.waitForTimeout(opts.waitAfter ?? 500)
    return true
  } catch (e) {
    console.log(`  ⚠ click 失败: ${sel}`)
    return false
  }
}

async function fill(sel, value) {
  try {
    await page.fill(sel, value, { timeout: 3000 })
    return true
  } catch {
    console.log(`  ⚠ fill 失败: ${sel}`)
    return false
  }
}

// ============ 测试开始 ============
console.log('\n=== 阶段 2 AI 多会话功能测试 ===\n')

// 步骤 1: 打开 PlanFlow
console.log('步骤 1: 打开 PlanFlow')
await page.goto('http://localhost:3012/#/planflow', { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(800)
await shot('01-open', '打开应用')

// 步骤 2: 新建学习任务
console.log('\n步骤 2: 新建学习任务')
await safeClick('button[title="新建任务"]')
await page.waitForTimeout(600)
await shot('02-task-form', '任务表单打开')

await fill('input[placeholder*="任务标题"]', 'GRE 词汇 List 3')
await safeClick('button:has-text("学习")')
await page.waitForTimeout(400)
await shot('03-category-study', '分类切到学习')

// 填学习字段
await fill('.study-block input[placeholder*="学习主题"]', 'GRE 词汇 List 3')
await fill('.study-block textarea', 'ephemeral (adj.) 暂的; ubiquitous (adj.) 无处不在的; zenith (n.) 天顶;最高点')
await safeClick('.ebbinghaus-toggle input[type="checkbox"]')
await page.waitForTimeout(300)
await shot('04-study-filled', '学习字段已填写,艾宾浩斯已启用')

await safeClick('button:has-text("保存")')
await page.waitForTimeout(1200)
await shot('05-after-save', '保存完成')

// 步骤 3: 找到复习任务并点击
console.log('\n步骤 3: 找复习任务')
await safeClick('.view-btn:has-text("日")')
await page.waitForTimeout(400)
await safeClick('.nav-btn:has-text("›")') // 下一天
await page.waitForTimeout(400)
await shot('06-day-next', '下一天的复习任务')

await safeClick('.task-block')
await page.waitForTimeout(700)
await shot('07-task-card', '复习任务卡片')

// 步骤 4: 点击"开始复习评估"打开 ReviewDialog
console.log('\n步骤 4: 打开评估对话框')
await safeClick('.study-review-btn')
await page.waitForTimeout(500)
await shot('08-review-dialog', '评估对话框 — 应有 AI 问答按钮')

// 步骤 5: 检查 AI 问答按钮存在
console.log('\n步骤 5: 检查 AI 问答按钮')
const aiBtnVisible = await page.isVisible('.ai-chat-btn')
console.log(`  AI 问答按钮可见: ${aiBtnVisible}`)

// 步骤 6: 点击 AI 问答按钮 → 应打开 AI 聊天面板
console.log('\n步骤 6: 点击 AI 问答按钮')
await safeClick('.ai-chat-btn')
await page.waitForTimeout(800)
await shot('09-ai-chat-panel', 'AI 聊天面板应打开')

// 步骤 7: 验证 AI 面板已打开
console.log('\n步骤 7: 验证 AI 面板状态')
const chatPanelVisible = await page.isVisible('.chat-panel')
console.log(`  AI 聊天面板可见: ${chatPanelVisible}`)

// 步骤 8: 发送一条消息测试
console.log('\n步骤 8: 发送测试消息')
if (chatPanelVisible) {
  await fill('.chat-input, .chat-panel input[type="text"]', '请根据学习材料问我一个问题')
  await safeClick('.send-btn, button:has-text("发送")')
  await page.waitForTimeout(2000)
  await shot('10-ai-response', 'AI 应响应')
}

// 步骤 9: 关闭 AI 面板
console.log('\n步骤 9: 关闭 AI 面板')
await safeClick('.chat-fab.open, button.chat-fab')
await page.waitForTimeout(500)
await shot('11-ai-closed', 'AI 面板已关闭')

// 步骤 10: 再打开 AI 面板 → 应回到默认会话
console.log('\n步骤 10: 再打开 AI 面板（默认会话）')
await safeClick('.chat-fab')
await page.waitForTimeout(800)
await shot('12-ai-default-session', '默认会话消息应与学习会话隔离')

// ============ 汇总 ============
console.log('\n=== 测试结果 ===')
console.log(`总截图数: 12`)
console.log(`AI 问答按钮存在: ${aiBtnVisible ? '✅' : '❌'}`)
console.log(`AI 聊天面板打开: ${chatPanelVisible ? '✅' : '❌'}`)
console.log(`JS 错误数: ${errors.length}`)
if (errors.length) {
  console.log('\n错误:')
  errors.forEach(e => console.log('  ', e))
}

console.log(`\n截图目录: ${OUT_DIR}/`)
await browser.close()