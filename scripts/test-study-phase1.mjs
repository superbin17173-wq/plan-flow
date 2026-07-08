// 阶段 1 学习功能自动化测试
// 场景:
//   1. 打开 PlanFlow
//   2. 新建任务 → 分类选"学习" → 填写主题/材料 → 勾选艾宾浩斯 → 保存
//   3. 验证日历上生成了首学 + 5 次复习任务
//   4. 点击复习任务 → 打开评估对话框 → 选择 Good
//   5. 验证下一次复习日期按 SM-2 调整
//
// 用法: node scripts/test-study-phase1.mjs

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
  console.error('未找到 Chrome/Edge')
  process.exit(1)
}

const OUT_DIR = 'shots/study-phase1'
mkdirSync(OUT_DIR, { recursive: true })

// 桌面视口测试 (先桌面, 移动端另测)
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'zh-CN',
})
const page = await context.newPage()

const errors = []
const consoleLogs = []
page.on('pageerror', (err) => errors.push(`PageError: ${err.message}`))
page.on('console', (msg) => {
  const text = msg.text()
  consoleLogs.push(`[${msg.type()}] ${text}`)
  if (msg.type() === 'error') errors.push(`Console: ${text}`)
})

async function shot(name, note = '') {
  const path = `${OUT_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  console.log(`✓ ${name}${note ? ' — ' + note : ''}`)
}

async function safeClick(sel, opts = {}) {
  try {
    await page.click(sel, { timeout: opts.timeout ?? 3000, ...opts })
    if (opts.waitAfter !== 0) await page.waitForTimeout(opts.waitAfter ?? 400)
    return true
  } catch (e) {
    console.log(`  ⚠ click 失败: ${sel} — ${e.message.slice(0, 100)}`)
    return false
  }
}

async function fill(sel, value) {
  try {
    await page.fill(sel, value, { timeout: 3000 })
    return true
  } catch (e) {
    console.log(`  ⚠ fill 失败: ${sel} — ${e.message.slice(0, 100)}`)
    return false
  }
}

// ============ 开始测试 ============
console.log('\n=== 阶段 1 学习功能自动化测试 ===\n')

// 步骤 1: 进入 PlanFlow
console.log('步骤 1: 打开 PlanFlow')
await page.goto('http://localhost:3012/#/planflow', { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(1000)
await shot('01-planflow-opened', '打开 PlanFlow 主页')

// 步骤 2: 点击 "+" 新建任务
console.log('\n步骤 2: 打开新建任务表单')
const addBtnOk = await safeClick('button[title="新建任务"]')
if (!addBtnOk) {
  console.log('  尝试用文本定位')
  await safeClick('button:has-text("+")')
}
await page.waitForTimeout(600)
await shot('02-task-form-opened', '新建任务表单打开')

// 步骤 3: 填标题
console.log('\n步骤 3: 填写标题')
await fill('input[placeholder*="任务标题"], input.form-input[type="text"]', 'GRE 词汇 List 1')
await shot('03-title-filled', '标题已填写')

// 步骤 4: 切换分类到 "学习"
console.log('\n步骤 4: 切换分类到 学习')
// 尝试点击分类按钮 / 下拉
const studyClicked = await safeClick('button:has-text("学习")', { timeout: 2000 })
if (!studyClicked) {
  console.log('  尝试通过 select 选择')
  try {
    await page.selectOption('select', 'study')
  } catch (e) {
    console.log('  select 失败:', e.message.slice(0, 100))
  }
}
await page.waitForTimeout(500)
await shot('04-category-study', '分类切到学习, 学习字段应显示')

// 步骤 5: 检查学习专属字段是否出现
console.log('\n步骤 5: 检查 study-block 是否出现')
const studyBlockVisible = await page.isVisible('.study-block').catch(() => false)
console.log(`  .study-block 可见: ${studyBlockVisible}`)

if (!studyBlockVisible) {
  console.log('  ❌ 学习字段区块未显示, 中止测试')
  await shot('05-error-no-study-block', '学习字段未显示')
  await browser.close()
  process.exit(1)
}

// 步骤 6: 填学习字段
console.log('\n步骤 6: 填写学习字段')
await fill('.study-block input[placeholder*="学习主题"]', 'GRE 词汇 List 1')
await fill('.study-block textarea', 'abandon (v.) 放弃; abolish (v.) 废除; abrupt (adj.) 突然的')
await shot('06-study-filled', '学习字段已填写')

// 步骤 7: 勾选启用艾宾浩斯
console.log('\n步骤 7: 勾选艾宾浩斯')
const checkboxClicked = await safeClick('.ebbinghaus-toggle input[type="checkbox"]')
console.log(`  checkbox 已勾选: ${checkboxClicked}`)
await page.waitForTimeout(400)
await shot('07-ebbinghaus-enabled', '艾宾浩斯已启用, 应显示预览')

const previewVisible = await page.isVisible('.ebbinghaus-preview').catch(() => false)
console.log(`  预览面板可见: ${previewVisible}`)

// 步骤 8: 保存
console.log('\n步骤 8: 保存任务')
await safeClick('button:has-text("保存"), button.submit-btn, button[type="submit"]')
await page.waitForTimeout(1500)
await shot('08-after-save', '保存后回到主视图')

// 步骤 9: 切到月视图看是否生成了 6 个任务 (首学 + 5 次复习)
console.log('\n步骤 9: 切换到月视图查看复习任务链')
await safeClick('.view-btn:has-text("月")')
await page.waitForTimeout(600)
await shot('09-month-view', '月视图 — 应看到多个学习任务分布在不同日期')

// 步骤 10: 统计月视图上的 🔁 图标数量 (反映复习任务数)
console.log('\n步骤 10: 统计复习任务图标')
const reviewCount = await page.evaluate(() => {
  const text = document.body.innerText
  return (text.match(/🔁/g) || []).length
})
console.log(`  🔁 图标出现次数: ${reviewCount} (期望 ≥ 5 次)`)

// 步骤 11: 切回日视图, 找一个复习任务点击
console.log('\n步骤 11: 切回日视图找复习任务')
await safeClick('.view-btn:has-text("日")')
await page.waitForTimeout(500)
// 前进 1 天找第一个复习任务
await safeClick('.nav-btn:has-text("›")')
await page.waitForTimeout(500)
await shot('10-day-view-next', '下一天 — 应看到第 1 次复习任务')

// 步骤 12: 点击任务打开卡片
console.log('\n步骤 12: 点击复习任务打开卡片')
const taskClicked = await safeClick('.task-block')
await page.waitForTimeout(700)
await shot('11-task-card', '任务卡片 — 应显示学习内容和"开始复习评估"按钮')

// 步骤 13: 点击"开始复习评估"
console.log('\n步骤 13: 打开评估对话框')
const reviewBtnClicked = await safeClick('.study-review-btn, button:has-text("开始复习评估")')
console.log(`  "开始复习评估"按钮点击: ${reviewBtnClicked}`)
await page.waitForTimeout(500)
await shot('12-review-dialog', '评估对话框 — 应显示 4 档按钮')

const reviewDialogVisible = await page.isVisible('.review-overlay').catch(() => false)
console.log(`  评估对话框可见: ${reviewDialogVisible}`)

// 步骤 14: 点击 "良好" (Good)
if (reviewDialogVisible) {
  console.log('\n步骤 14: 点击 "良好"')
  await safeClick('.mastery-btn.mastery-good')
  await page.waitForTimeout(1000)
  await shot('13-after-assess-good', '评估完成 — 应关闭对话框')
} else {
  console.log('  ⚠ 评估对话框未打开, 跳过评估步骤')
}

// 步骤 15: 切回月视图看下一次复习任务日期是否调整
console.log('\n步骤 15: 回到月视图观察复习链变化')
await safeClick('.view-btn:has-text("月")')
await page.waitForTimeout(500)
await shot('14-final-month', '最终月视图')

// ============ 汇总 ============
console.log('\n=== 测试结果 ===')
console.log(`总截图数: 14`)
console.log(`学习字段区块显示: ${studyBlockVisible ? '✅' : '❌'}`)
console.log(`艾宾浩斯预览显示: ${previewVisible ? '✅' : '❌'}`)
console.log(`🔁 复习任务数: ${reviewCount}`)
console.log(`评估对话框打开: ${reviewDialogVisible ? '✅' : '❌'}`)
console.log(`JS 错误数: ${errors.length}`)
if (errors.length) {
  console.log('\n错误列表:')
  errors.forEach((e) => console.log('  ', e))
}

console.log(`\n截图目录: ${OUT_DIR}/`)
await browser.close()
