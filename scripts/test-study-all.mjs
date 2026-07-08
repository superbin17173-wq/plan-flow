// 学习功能综合测试 - 验证所有 6 个阶段
// 用法: node scripts/test-study-all.mjs

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

const OUT_DIR = 'shots/study-all'
mkdirSync(OUT_DIR, { recursive: true })

// 检测端口 - 尝试多个可能的端口
const possiblePorts = [3012, 3013, 3014, 3015]
let port = 3012
for (const p of possiblePorts) {
  try {
    const resp = await fetch(`http://localhost:${p}`, { method: 'HEAD' })
    if (resp.ok) {
      port = p
      console.log(`检测到 dev server 运行在端口 ${port}`)
      break
    }
  } catch {}
}

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
    await page.waitForTimeout(opts.waitAfter ?? 400)
    return true
  } catch {
    return false
  }
}

console.log('\n=== 学习功能综合测试（6 阶段）===\n')

// 阶段 1: 学习任务创建
console.log('【阶段 1】学习任务创建')
await page.goto(`http://localhost:${port}/#/planflow`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await shot('01-planflow', '打开应用')

await safeClick('button:has-text("+")')
await page.waitForTimeout(600)
await shot('02-task-form', '任务表单')

// 等待表单完全加载
await page.waitForTimeout(1000)

// 用 evaluate 直接操作 DOM
await page.evaluate(() => {
  // 填标题
  const titleInput = document.querySelector('input[placeholder="输入任务标题"]')
  if (titleInput) {
    titleInput.value = 'GRE 词汇 List 4'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await page.waitForTimeout(300)
await shot('03-title-filled', '标题已填')

// 选学习分类
await page.evaluate(() => {
  // 找分类按钮或选择器
  const studyBtn = document.querySelector('button[data-category="study"]') ||
                   Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('学习'))
  if (studyBtn) studyBtn.click()

  // 或通过 select
  const selects = document.querySelectorAll('select')
  for (const s of selects) {
    const options = Array.from(s.options)
    if (options.some(o => o.value === 'study')) {
      s.value = 'study'
      s.dispatchEvent(new Event('change', { bubbles: true }))
      break
    }
  }
})
await page.waitForTimeout(400)
await shot('04-study-selected', '学习分类')

// 检查学习区块是否出现
const studyBlock = await page.isVisible('.study-block')
console.log(`  学习区块: ${studyBlock ? '✅' : '❌'}`)

if (studyBlock) {
  // 填学习字段
  await page.evaluate(() => {
    const subjectInput = document.querySelector('.study-block input')
    if (subjectInput) {
      subjectInput.value = 'GRE 词汇 List 4'
      subjectInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const textarea = document.querySelector('.study-block textarea')
    if (textarea) {
      textarea.value = 'ephemeral (adj.) 短暂的; ubiquitous (adj.) 无处不在的'
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }
    // 勾选艾宾浩斯
    const checkbox = document.querySelector('.ebbinghaus-toggle input[type="checkbox"]')
    if (checkbox) {
      checkbox.checked = true
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await page.waitForTimeout(300)
  await shot('05-ebbinghaus-enabled', '艾宾浩斯启用')
}

// 保存
await page.evaluate(() => {
  const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('保存'))
  if (saveBtn) saveBtn.click()
})
await page.waitForTimeout(1500)
await shot('06-saved', '保存完成')

// 验证复习任务生成
await safeClick('.view-btn:has-text("月")')
await page.waitForTimeout(500)
await shot('07-month-view', '月视图 - 应看到复习任务链')

// 阶段 2: AI 多会话
console.log('\n【阶段 2】AI 多会话')
await safeClick('.nav-btn:has-text("›")')
await page.waitForTimeout(400)
await safeClick('.task-block')
await page.waitForTimeout(800)
await shot('07-task-card', '复习任务卡片')

// 点击复习评估按钮
const reviewBtnFound = await safeClick('.study-review-btn, button:has-text("开始复习")', { waitAfter: 800 })
await shot('08-review-dialog', '评估对话框')

// 等待对话框渲染
await page.waitForTimeout(500)
const aiBtn = await page.isVisible('.ai-chat-btn')
const voiceBtn = await page.isVisible('.voice-btn')
console.log(`  AI 问答按钮: ${aiBtn ? '✅' : '❌'}`)
console.log(`  语音按钮: ${voiceBtn ? '✅' : '❌'}`)

// 阶段 5: 学习仪表盘
console.log('\n【阶段 5】学习仪表盘')
await page.goto(`http://localhost:${port}/#/study-dashboard`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await shot('09-dashboard', '学习仪表盘页面')

const dashboardTitle = await page.isVisible('h1:has-text("学习仪表盘")')
console.log(`  仪表盘标题: ${dashboardTitle ? '✅' : '❌'}`)

// 阶段 4: 存储管理
console.log('\n【阶段 4】存储管理')
await page.goto(`http://localhost:${port}/#/planflow`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await safeClick('button[title="更多"]')
await page.waitForTimeout(300)
await safeClick('.el-dropdown-menu__item:has-text("设置")')
await page.waitForTimeout(800)
await shot('10-settings', '设置面板')

const storageManager = await page.isVisible('h3:has-text("存储管理")')
console.log(`  存储管理区块: ${storageManager ? '✅' : '❌'}`)

// 阶段 2.5: 合并功能（需要有 2+ 学习任务）
console.log('\n【阶段 2.5】合并功能')
const mergeSection = await page.isVisible('h3:has-text("学习管理")')
console.log(`  学习管理区块: ${mergeSection ? '✅' : '❌（需 ≥2 学习任务）'}`)

// 阶段 6: 语音/PDF（UI 检查）
console.log('\n【阶段 6】语音/PDF')
// PDF: 检查文件上传 accept 属性包含 .pdf
const fileInput = await page.$('.study-file-btn input[type="file"]')
if (fileInput) {
  const accept = await fileInput.getAttribute('accept')
  console.log(`  PDF 支持: ${accept?.includes('.pdf') ? '✅' : '❌'}`)
}

// 语音按钮已在阶段 2 检测过
console.log(`  语音按钮: ${voiceBtn ? '✅' : '❌'}`)
await shot('11-final', '最终状态')

// 汇总
console.log('\n=== 测试结果 ===')
console.log(`JS 错误数: ${errors.length}`)
if (errors.length) {
  console.log('错误:')
  errors.forEach(e => console.log('  ', e))
}
console.log(`\n截图目录: ${OUT_DIR}/`)

await browser.close()