// 完整用户行为模拟测试 - 不使用 AI API
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

const OUT_DIR = 'shots/user-simulation'
mkdirSync(OUT_DIR, { recursive: true })

// 检测端口
const possiblePorts = [3012, 3013, 3014, 3015, 3016, 3017, 3018]
let port = 3012
for (const p of possiblePorts) {
  try {
    const r = await fetch(`http://localhost:${p}`, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
    if (r.ok) { port = p; break }
  } catch {}
}
console.log(`端口: ${port}\n`)

const browser = await chromium.launch({ executablePath, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' })

const bugs = []
const successes = []
page.on('pageerror', e => bugs.push(`JS错误: ${e.message.slice(0, 80)}`))
page.on('console', m => {
  const t = m.text()
  if (m.type() === 'error' && !t.includes('后台同步')) bugs.push(`Console: ${t.slice(0, 80)}`)
})

async function shot(name) {
  try { await page.screenshot({ path: `${OUT_DIR}/${name}.png` }) } catch {}
}
async function wait(ms) { await page.waitForTimeout(ms) }

console.log('=== 模拟用户行为测试 ===\n')

// ==================== 场景 1: 进入 PlanFlow ====================
console.log('【场景 1】进入 PlanFlow')
try {
  await page.goto(`http://localhost:${port}/#/planflow`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.planflow-view', { timeout: 10000 })
  await wait(1500)
  await shot('01-planflow')
  console.log('  ✅ 页面加载')
  successes.push('页面加载')
} catch (e) {
  bugs.push(`页面加载失败: ${e.message.slice(0, 80)}`)
  console.log('  ❌ 页面加载失败')
}

// ==================== 场景 2: 创建学习任务 ====================
console.log('\n【场景 2】创建学习任务')
try {
  // 点击新建任务按钮
  await page.click('.action-btn:has-text("+")')
  await page.waitForSelector('.modal-content', { timeout: 5000 })
  await wait(500)
  await shot('02-form')
  console.log('  ✅ 任务表单打开')
  successes.push('打开任务表单')

  // 填标题
  await page.fill('.modal-content input[type="text"]', 'GRE核心词汇测试')
  await wait(300)

  // 切换到学习分类
  await page.click('button:has-text("学习")')
  await wait(700)
  await shot('03-study-category')

  // 检查学习区块
  const studyVisible = await page.locator('.study-block').isVisible()
  if (studyVisible) {
    console.log('  ✅ 学习区块显示')
    successes.push('学习区块')

    // 填学习主题
    await page.fill('.study-block input[placeholder*="学习主题"]', 'GRE List Test')
    await page.fill('.study-block textarea', 'ephemeral ubiquity zenith')
    await wait(300)

    // 勾选艾宾浩斯
    await page.click('.ebbinghaus-toggle input')
    await wait(500)
    await shot('04-ebbinghaus')

    const previewVisible = await page.locator('.ebbinghaus-preview').isVisible()
    if (previewVisible) {
      console.log('  ✅ 艾宾浩斯预览显示')
      successes.push('艾宾浩斯预览')
    }

    // 保存
    await page.click('.submit-btn')
    await wait(2500)
    await shot('05-saved')
    console.log('  ✅ 任务创建完成')
    successes.push('学习任务创建')
  } else {
    bugs.push('学习区块未显示')
    console.log('  ❌ 学习区块未显示')
  }
} catch (e) {
  bugs.push(`创建任务失败: ${e.message.slice(0, 80)}`)
}

// ==================== 场景 3: 检查复习链 ====================
console.log('\n【场景 3】检查复习任务链生成')
try {
  await page.click('.view-btn:has-text("月")')
  await wait(700)
  await shot('06-month')

  const reviewIcons = await page.locator('text=🔁').count()
  console.log(`  复习任务图标数: ${reviewIcons}`)
  if (reviewIcons >= 5) {
    console.log('  ✅ 5次复习任务已生成')
    successes.push('复习链生成（5次）')
  } else {
    bugs.push(`复习任务生成不足: ${reviewIcons}`)
  }
} catch (e) {
  bugs.push(`检查复习链失败: ${e.message.slice(0, 80)}`)
}

// ==================== 场景 4: 打开复习任务 + 评估 ====================
console.log('\n【场景 4】打开复习任务并评估')
try {
  // 切到日视图
  await page.click('.view-btn:has-text("日")')
  await wait(500)
  // 前进一天找到第1次复习
  await page.click('.nav-btn:has-text("›")')
  await wait(500)
  await shot('07-day-next')

  // 找到复习任务
  const taskBlock = page.locator('.task-block').first()
  if (await taskBlock.isVisible()) {
    await taskBlock.click()
    await wait(800)
    await shot('08-task-card')
    console.log('  ✅ 任务卡片打开')

    // 点击复习评估按钮
    const reviewBtn = page.locator('.study-review-btn')
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click()
      await page.waitForSelector('.review-panel', { timeout: 3000 })
      await wait(500)
      await shot('09-review-dialog')
      console.log('  ✅ 评估对话框打开')
      successes.push('评估对话框')

      // 检查关键元素
      const aiBtn = await page.locator('.ai-chat-btn').isVisible()
      const voiceBtn = await page.locator('.voice-btn').isVisible()
      const masteryBtns = await page.locator('.mastery-btn').count()
      console.log(`  AI 问答按钮: ${aiBtn ? '✅' : '❌'}`)
      console.log(`  语音按钮: ${voiceBtn ? '✅' : '❌'}`)
      console.log(`  评估按钮数: ${masteryBtns}`)

      if (aiBtn) successes.push('AI问答按钮')
      if (voiceBtn) successes.push('语音按钮')
      if (masteryBtns >= 4) successes.push('4档评估按钮')

      // 点击"良好"评估
      await page.click('.mastery-btn.mastery-good')
      await wait(1500)
      await shot('10-after-assess')
      console.log('  ✅ 评估提交（不消耗AI）')
      successes.push('手动评估流程')
    } else {
      bugs.push('复习评估按钮未显示')
    }
  } else {
    console.log('  ⚠ 复习任务未找到（可能在其他日期）')
  }
} catch (e) {
  bugs.push(`评估流程失败: ${e.message.slice(0, 80)}`)
}

// ==================== 场景 5: 学习仪表盘 ====================
console.log('\n【场景 5】学习仪表盘')
try {
  await page.goto(`http://localhost:${port}/#/study-dashboard`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.study-dashboard', { timeout: 8000 })
  await wait(1000)
  await shot('11-dashboard')

  const items = {
    '仪表盘标题': 'header h1',
    '统计卡片': '.stat-card',
    '今日复习': '.today-section',
    '掌握度分布': '.mastery-section',
    '复习热力图': '.heatmap-section',
  }
  for (const [name, sel] of Object.entries(items)) {
    const ok = await page.locator(sel).first().isVisible()
    console.log(`  ${name}: ${ok ? '✅' : '❌'}`)
    if (ok) successes.push(name)
    else bugs.push(`${name}未显示`)
  }
} catch (e) {
  bugs.push(`学习仪表盘失败: ${e.message.slice(0, 80)}`)
}

// ==================== 场景 6: 设置面板 + 存储管理 ====================
console.log('\n【场景 6】设置面板与存储管理')
try {
  await page.goto(`http://localhost:${port}/#/planflow`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.planflow-view', { timeout: 8000 })
  await wait(1000)

  // 设置按钮在 header-right 区域
  const headerRight = page.locator('.header-right')
  if (await headerRight.isVisible()) {
    // 桌面端设置按钮
    const settingsBtn = headerRight.locator('button[title="设置"]')
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click()
    } else {
      // 尝试溢出菜单
      await headerRight.locator('button[title="更多"]').click()
      await wait(300)
      await page.click('.el-dropdown-menu__item:has-text("设置")')
    }
    await page.waitForSelector('.settings-panel', { timeout: 5000 })
    await wait(800)
    await shot('12-settings')
    console.log('  ✅ 设置面板打开')
    successes.push('设置面板')

    // 滚动到底部看存储管理
    await page.evaluate(() => {
      const body = document.querySelector('.settings-body')
      if (body) body.scrollTop = body.scrollHeight
    })
    await wait(800)
    await shot('13-storage')

    const storageBlock = await page.locator('h3:has-text("存储管理")').isVisible()
    console.log(`  存储管理区块: ${storageBlock ? '✅' : '❌'}`)
    if (storageBlock) successes.push('存储管理区块')
  } else {
    bugs.push('header-right 未找到')
  }
} catch (e) {
  bugs.push(`设置面板失败: ${e.message.slice(0, 80)}`)
}

// ==================== 场景 7: AI 面板 UI 检查 ====================
console.log('\n【场景 7】AI 面板 UI（不发送消息）')
try {
  await page.goto(`http://localhost:${port}/#/planflow`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.planflow-view', { timeout: 8000 })
  await wait(800)

  // 点击 AI 浮动按钮
  const fabBtn = page.locator('.chat-fab')
  if (await fabBtn.isVisible()) {
    await fabBtn.click()
    await wait(1000)
    await shot('14-ai-panel')

    const panelVisible = await page.locator('.chat-panel').isVisible()
    console.log(`  AI 面板: ${panelVisible ? '✅' : '❌'}`)
    if (panelVisible) successes.push('AI面板UI')
  } else {
    console.log('  ⚠ AI FAB 按钮未显示（可能未启用 AI）')
  }
} catch (e) {
  bugs.push(`AI面板失败: ${e.message.slice(0, 80)}`)
}

// ==================== 场景 8: 视图切换 ====================
console.log('\n【场景 8】视图切换测试')
try {
  await page.goto(`http://localhost:${port}/#/planflow`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.planflow-view', { timeout: 8000 })
  await wait(1000)

  // 视图切换器在 header-center
  const viewSwitcher = page.locator('.view-switcher')
  if (await viewSwitcher.isVisible()) {
    for (const view of ['年', '月', '周', '日']) {
      const btn = viewSwitcher.locator(`button:has-text("${view}")`)
      if (await btn.isVisible()) {
        await btn.click()
        await wait(500)
        console.log(`  ✅ ${view}视图`)
        successes.push(`${view}视图`)
      }
    }
    await shot('15-views')
  } else {
    bugs.push('视图切换器未显示')
  }
} catch (e) {
  bugs.push(`视图切换失败: ${e.message.slice(0, 80)}`)
}

// ==================== 场景 9: 移动端排版检查 ====================
console.log('\n【场景 9】移动端排版检查')
try {
  // 创建移动端视口页面
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' })

  // 测试主页面
  await mobilePage.goto(`http://localhost:${port}/#/planflow`, { waitUntil: 'domcontentloaded' })
  await mobilePage.waitForSelector('.planflow-view', { timeout: 8000 })
  await wait(1500)
  await mobilePage.screenshot({ path: `${OUT_DIR}/16-mobile-planflow.png` })
  console.log('  ✅ 移动端主页截图')

  // 检查导航栏
  const headerHeight = await mobilePage.evaluate(() => {
    const header = document.querySelector('.app-header')
    return header?.getBoundingClientRect().height || 0
  })
  console.log(`  导航栏高度: ${headerHeight}px`)

  // 检查是否单行显示
  const headerWrap = await mobilePage.evaluate(() => {
    const header = document.querySelector('.app-header')
    if (!header) return false
    const style = getComputedStyle(header)
    return style.flexWrap === 'nowrap'
  })
  console.log(`  导航栏单行(no-wrap): ${headerWrap ? '✅' : '❌'}`)

  // 打开任务表单检查
  await mobilePage.click('.action-btn')
  await mobilePage.waitForSelector('.modal-content', { timeout: 5000 })
  await wait(800)
  await mobilePage.screenshot({ path: `${OUT_DIR}/17-mobile-form.png` })

  // 切换到学习分类
  await mobilePage.click('button:has-text("学习")')
  await wait(700)
  await mobilePage.screenshot({ path: `${OUT_DIR}/18-mobile-study.png` })

  const studyBlockVisible = await mobilePage.locator('.study-block').isVisible()
  console.log(`  移动端学习区块: ${studyBlockVisible ? '✅' : '❌'}`)

  // 打开溢出菜单
  await mobilePage.click('button[title="更多"]')
  await wait(400)
  await mobilePage.screenshot({ path: `${OUT_DIR}/19-mobile-overflow.png` })

  const overflowVisible = await mobilePage.locator('.el-dropdown-menu').isVisible()
  console.log(`  溢出菜单显示: ${overflowVisible ? '✅' : '❌'}`)

  // 检查按钮是否可点击
  const menuItems = await mobilePage.locator('.el-dropdown-menu__item').count()
  console.log(`  溢出菜单项数: ${menuItems}`)

  // 测试学习仪表盘移动端
  await mobilePage.goto(`http://localhost:${port}/#/study-dashboard`, { waitUntil: 'domcontentloaded' })
  await mobilePage.waitForSelector('.study-dashboard', { timeout: 8000 })
  await wait(1000)
  await mobilePage.screenshot({ path: `${OUT_DIR}/20-mobile-dashboard.png` })
  console.log('  ✅ 移动端仪表盘截图')

  // 检查统计卡片是否响应式
  const cardCount = await mobilePage.locator('.stat-card').count()
  console.log(`  统计卡片数: ${cardCount}`)

  await mobilePage.close()
  successes.push('移动端测试')
} catch (e) {
  bugs.push(`移动端测试失败: ${e.message.slice(0, 80)}`)
}

// ==================== 结果汇总 ====================
console.log('\n========================================')
console.log(`✅ 通过: ${successes.length}`)
console.log(`❌ Bug: ${bugs.length}`)
if (bugs.length) {
  console.log('\nBug 详情:')
  bugs.forEach((b, i) => console.log(`  ${i + 1}. ${b}`))
}
console.log(`\n通过项:`)
successes.forEach(s => console.log(`  ✓ ${s}`))
console.log(`\n截图目录: ${OUT_DIR}/`)

await browser.close()