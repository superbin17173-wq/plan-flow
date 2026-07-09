// 三态时间验收自测:
// 1) 打开 app,新建 3 个任务分别对应 timed / duration / anytime
// 2) 检查 IndexedDB 中三条数据字段正确
// 3) 检查 DayView 出现"未排时段"chip 条
import { chromium, devices } from 'playwright-core'
import { existsSync } from 'node:fs'

const url = 'http://localhost:3012/#/planflow'
const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Users/ljadmin/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const executablePath = candidates.find(p => existsSync(p))
if (!executablePath) { console.error('未找到 Chrome/Edge'); process.exit(1) }

const iphone = devices['iPhone 13']
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ ...iphone })
const page = await context.newPage()
page.on('pageerror', e => console.error('PAGE ERROR:', e.message))
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()) })

await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(600)

// 通过页面 JS 直接调用 taskStore 创建三种模式的任务
const today = new Date().toISOString().slice(0, 10)
const result = await page.evaluate(async (dateStr) => {
  const { useTaskStore } = await import('/src/stores/taskStore.ts')
  const store = useTaskStore()
  await store.loadTasks()

  // 清理之前的验证任务
  const marker = '__timemode_test__'
  for (const t of [...store.tasks]) {
    if (t.description === marker) await store.removeTask(t.id)
  }

  // timed
  await store.createTask({
    title: 'TEST-TIMED', description: marker, category: 'work', priority: 'medium',
    date: dateStr, startTime: '10:00', endTime: '11:00',
  })
  // duration
  await store.createTask({
    title: 'TEST-DURATION', description: marker, category: 'study', priority: 'medium',
    date: dateStr, durationMinutes: 30,
  })
  // anytime
  await store.createTask({
    title: 'TEST-ANYTIME', description: marker, category: 'life', priority: 'low',
    date: dateStr,
  })

  const list = store.tasks
    .filter(t => t.description === marker)
    .map(t => ({
      title: t.title, startTime: t.startTime, endTime: t.endTime,
      durationMinutes: t.durationMinutes,
    }))
  return list
}, today)

console.log('创建结果:', JSON.stringify(result, null, 2))

// 期望
const pass = result.length === 3
  && result.find(t => t.title === 'TEST-TIMED')?.startTime === '10:00'
  && result.find(t => t.title === 'TEST-TIMED')?.endTime === '11:00'
  && result.find(t => t.title === 'TEST-DURATION')?.durationMinutes === 30
  && !result.find(t => t.title === 'TEST-DURATION')?.startTime
  && !result.find(t => t.title === 'TEST-ANYTIME')?.startTime
  && result.find(t => t.title === 'TEST-ANYTIME')?.durationMinutes == null

console.log(pass ? '✅ 数据字段验证通过' : '❌ 数据字段验证失败')

// 切到日视图
await page.evaluate((dateStr) => {
  return import('/src/stores/uiStore.ts').then(m => {
    const ui = m.useUiStore()
    ui.selectDate(dateStr, true)
    ui.setView('day')
  })
}, today)
await page.waitForTimeout(1200)

// 找页面上 "未排时段" 标签及包含 TEST-DURATION 的 chip
const strip = await page.evaluate(() => {
  const t = document.body.innerText
  return {
    hasLabel: t.includes('未排时段'),
    hasDuration: t.includes('TEST-DURATION'),
    hasAnytime: t.includes('TEST-ANYTIME'),
    hasTimed: t.includes('TEST-TIMED'),
  }
})
console.log('页面文本检查:', strip)

// 截图留档
await page.screenshot({ path: 'test-time-modes.png', fullPage: true })
console.log('已截图 test-time-modes.png')

// 清理验证任务
await page.evaluate(async () => {
  const { useTaskStore } = await import('/src/stores/taskStore.ts')
  const store = useTaskStore()
  for (const t of [...store.tasks]) {
    if (t.description === '__timemode_test__') await store.removeTask(t.id)
  }
})

await browser.close()
process.exit((pass && strip.hasLabel && strip.hasDuration && strip.hasAnytime && strip.hasTimed) ? 0 : 1)
