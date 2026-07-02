// 测试脚本:创建任务后是否立即显示
import { chromium } from 'playwright'

const APP_URL = 'http://localhost:3014'

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/ljadmin/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
  })
  const context = await browser.newContext({
    // 使用独立数据目录,避免 IndexedDB 污染
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  page.on('console', msg => {
    const type = msg.type()
    if (type === 'error' || type === 'warning') {
      console.log(`[browser ${type}]`, msg.text())
    }
  })

  console.log('→ 打开应用...')
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // 切换到日视图
  console.log('→ 切换到"日"视图')
  await page.click('.view-btn:has-text("日")', { force: true })
  await page.waitForTimeout(1000)

  // 记录当前日期
  const currentDate = await page.evaluate(() => {
    return new Date().toISOString().slice(0, 10)
  })
  console.log('  当前日期:', currentDate)

  // 记录初始任务数
  const before = await page.locator('.task-block').count()
  console.log('  日视图任务数(创建前):', before)

  // 点击顶部 + 按钮打开新建任务表单
  console.log('→ 点击 + 新建任务')
  await page.click('.action-btn[title="新建任务"]')
  await page.waitForSelector('.modal-overlay', { timeout: 3000 })

  // 填标题
  const testTitle = `测试任务-${Date.now()}`
  console.log('→ 填写标题:', testTitle)
  await page.fill('input[placeholder*="任务标题"]', testTitle)

  // 打印 modal 里的按钮文本调试
  const btns = await page.locator('.modal-content button').allTextContents()
  console.log('  modal 按钮:', btns)
  const inputs = await page.locator('.modal-content input, .modal-content select').count()
  console.log('  input+select 数量:', inputs)

  // 提交
  console.log('→ 点击创建按钮(未禁用即可)')
  const createBtn = page.locator('.submit-btn')
  const createBtnText = await createBtn.textContent()
  const isDisabled = await createBtn.isDisabled()
  console.log('  创建按钮:', createBtnText, ' 禁用?', isDisabled)
  await createBtn.click({ force: true })
  await page.waitForTimeout(1500)

  // 检查任务是否显示
  const after = await page.locator('.task-block').count()
  console.log('  日视图任务数(创建后立即):', after)

  const taskTexts = await page.locator('.task-block').allTextContents()
  console.log('  任务列表:', taskTexts)

  const showsImmediately = taskTexts.some(t => t.includes(testTitle))
  console.log('  ★ 立即显示?', showsImmediately ? '是' : '否')

  if (!showsImmediately) {
    console.log('→ 检查 IndexedDB 里是否有:')
    const dbTasks = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('PlanFlowDB', 2)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('tasks', 'readonly')
          const store = tx.objectStore('tasks')
          const all = store.getAll()
          all.onsuccess = () => resolve(all.result)
        }
      })
    })
    console.log('  DB 中任务数:', dbTasks.length)
    console.log('  DB 中含测试任务?', dbTasks.some((t) => t.title === testTitle))

    // 刷新页面看是否显示
    console.log('→ 刷新页面')
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    // 切回日视图
    await page.click('button:has-text("日")')
    await page.waitForTimeout(800)
    const afterReload = await page.locator('.task-block').allTextContents()
    console.log('  刷新后任务:', afterReload)
    console.log('  ★ 刷新后显示?', afterReload.some(t => t.includes(testTitle)) ? '是' : '否')
  }

  await browser.close()
}

main().catch(err => {
  console.error('测试失败:', err)
  process.exit(1)
})
