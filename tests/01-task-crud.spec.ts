/**
 * 测试模块1: 任务基础CRUD操作
 * 覆盖：创建、编辑、删除、完成状态切换、时间预填充bug验证
 *
 * 选择器说明（基于实际 DOM 结构）：
 *   新建任务按钮  → .action-btn[title="新建任务"]
 *   视图切换      → .view-btn
 *   分类按钮      → .category-btn （TaskForm 内，type="button"）
 *   优先级按钮    → .priority-btn （TaskForm 内，type="button"）
 *   表单内 select → 通过 label 文本定位
 *   提交/取消     → .submit-btn / .cancel-btn
 */
import { test, expect, type Page, type Locator } from '@playwright/test'

// ── 辅助函数 ──────────────────────────────────────────────────────────────────

/** 通过 label 文本定位表单内 select（精确匹配 label 文字） */
function selectByLabel(page: Page, labelText: string): Locator {
  return page.locator('.modal-content .form-group').filter({ hasText: labelText }).locator('select')
}

/** 打开新建任务表单并等待渲染完成 */
async function openNewTaskForm(page: Page) {
  await page.locator('.action-btn[title="新建任务"]').click()
  await expect(page.locator('.modal-content')).toBeVisible({ timeout: 3000 })
}

/** 关闭表单 */
async function closeForm(page: Page) {
  await page.locator('.modal-content .cancel-btn').click()
  await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 })
}

/** 创建任务：填写标题后直接提交 */
async function createTaskWithTitle(page: Page, title: string) {
  await openNewTaskForm(page)
  await page.locator('.modal-content input[placeholder="输入任务标题"]').fill(title)
  await page.locator('.modal-content .submit-btn').click()
  await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 })
}

/** 通过按钮文本在 modal 内点击分类按钮 */
async function clickCategory(page: Page, name: string) {
  await page.locator('.modal-content .category-options > button', { hasText: name }).click()
}

/** 通过按钮文本在 modal 内点击优先级按钮 */
async function clickPriority(page: Page, label: string) {
  await page.locator('.modal-content .priority-options > button', { hasText: label }).click()
}

// ── 测试套件 ──────────────────────────────────────────────────────────────────

test.describe('任务基础CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.app')).toBeVisible({ timeout: 10000 })
  })

  // ── 1. 创建任务 ──────────────────────────────────────────────────────────────
  test('创建任务 - 基本流程', async ({ page }) => {
    await openNewTaskForm(page)

    // 填写标题与描述
    await page.locator('.modal-content input[placeholder="输入任务标题"]').fill('测试任务ABC')
    await page.locator('.modal-content textarea[placeholder="输入任务描述（可选）"]').fill('这是一个测试描述')

    // 选择分类（工作）和优先级（高）
    await clickCategory(page, '工作')
    await clickPriority(page, '高')

    // 选择时间：开始 10:00，结束 11:00
    await selectByLabel(page, '开始时间').selectOption({ label: '10:00' })
    await selectByLabel(page, '结束时间').selectOption({ label: '11:00' })

    // 提交创建
    await page.locator('.modal-content .submit-btn').click()
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 })

    // 验证任务创建成功
    await expect(page.locator('.task-chip, .task-block').first()).toContainText('测试任务ABC', { timeout: 5000 })
  })

  // ── 2. 时间预填充（日视图） ──────────────────────────────────────────────────
  test('验证时间预填充功能 - 点击时间槽创建任务', async ({ page }) => {
    // 切换到日视图
    await page.locator('.view-btn', { hasText: '日' }).click()
    await page.waitForTimeout(300)

    // 确保选择今天（DayView 独有的 .today-btn）
    const todayBtn = page.locator('.nav-btn.today-btn')
    if (await todayBtn.isVisible()) {
      await todayBtn.click()
      await page.waitForTimeout(200)
    }

    // 使用未来的小时（当前时间 + 2 小时，避免点击已过时段）
    const now = new Date()
    const futureHour = (now.getHours() + 2) % 24
    const hourSlot = page.locator('.day-calendar .hour-slot').nth(futureHour)
    await hourSlot.click({ position: { x: 50, y: 30 } })

    // 等待表单出现
    await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 })

    // 验证开始时间已预填充为对应小时
    const startTimeSelect = selectByLabel(page, '开始时间')
    const selectedValue = await startTimeSelect.inputValue()
    const expectedHour = String(futureHour).padStart(2, '0')
    expect(selectedValue).toMatch(new RegExp(`^${expectedHour}:`))

    await closeForm(page)
  })

  // ── 3. 周视图时间预填充 ──────────────────────────────────────────────────────
  test('周视图时间预填充', async ({ page }) => {
    // 切换到周视图
    await page.locator('.view-btn', { hasText: '周' }).click()
    await page.waitForTimeout(300)

    // 找到今天所在的列索引
    const todayIndex = await page.locator('.day-header-cell.today').evaluate((el) => {
      const parent = el.parentElement!
      return Array.from(parent.children).indexOf(el)
    })

    // 使用未来的小时
    const now = new Date()
    const futureHour = (now.getHours() + 3) % 24
    const hourSlot = page
      .locator('.week-calendar .day-column')
      .nth(todayIndex)
      .locator('.hour-slot')
      .nth(futureHour)
    await hourSlot.click({ position: { x: 50, y: 30 } })

    // 等待表单出现
    await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 })

    // 验证时间预填充
    const startTimeSelect = selectByLabel(page, '开始时间')
    const selectedValue = await startTimeSelect.inputValue()
    const expectedHour = String(futureHour).padStart(2, '0')
    expect(selectedValue).toMatch(new RegExp(`^${expectedHour}:`))

    await closeForm(page)
  })

  // ── 4. 编辑任务 ──────────────────────────────────────────────────────────────
  test('编辑任务', async ({ page }) => {
    // 先创建一个任务
    await createTaskWithTitle(page, '待编辑任务')
    await page.waitForTimeout(500)

    // 点击任务打开详情卡片
    const taskChip = page.locator('.task-chip, .task-block').filter({ hasText: '待编辑任务' }).first()
    await taskChip.click()
    await expect(page.locator('.task-card')).toBeVisible()

    // 点击编辑按钮
    await page.locator('.task-card .edit-btn').click()
    await expect(page.locator('.modal-content')).toBeVisible()

    // 修改标题
    await page.locator('.modal-content input[placeholder="输入任务标题"]').fill('已编辑任务')

    // 保存
    await page.locator('.modal-content .submit-btn').click()
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 })

    // 验证修改成功
    await expect(
      page.locator('.task-chip, .task-block').filter({ hasText: '已编辑任务' }).first()
    ).toBeVisible({ timeout: 5000 })
  })

  // ── 5. 删除任务 ──────────────────────────────────────────────────────────────
  test('删除任务', async ({ page }) => {
    // 创建任务
    await createTaskWithTitle(page, '待删除任务')
    await page.waitForTimeout(500)

    // 打开任务卡片
    const taskChip = page.locator('.task-chip, .task-block').filter({ hasText: '待删除任务' }).first()
    await taskChip.click()
    await expect(page.locator('.task-card')).toBeVisible()

    // 处理浏览器原生 confirm 对话框
    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })

    // 点击删除按钮
    await page.locator('.task-card .delete-btn').click()
    await page.waitForTimeout(500)

    // 验证任务已删除
    await expect(
      page.locator('.task-chip, .task-block').filter({ hasText: '待删除任务' })
    ).toHaveCount(0)
  })

  // ── 6. 切换任务完成状态 ──────────────────────────────────────────────────────
  test('切换任务完成状态', async ({ page }) => {
    // 创建任务
    await createTaskWithTitle(page, '完成测试任务')
    await page.waitForTimeout(500)

    // 打开任务卡片
    const taskChip = page.locator('.task-chip, .task-block').filter({ hasText: '完成测试任务' }).first()
    await taskChip.click()
    await expect(page.locator('.task-card')).toBeVisible()

    // 点击"标记完成"按钮
    await page.locator('.task-card .complete-btn').click()
    await expect(page.locator('.task-card .complete-btn.completed')).toBeVisible({ timeout: 3000 })

    // 关闭卡片
    await page.locator('.task-card .close-btn').click()
    await page.waitForTimeout(200)

    // 再次打开，点击"取消完成"
    const completedChip = page.locator('.task-chip.completed, .task-block.completed')
      .filter({ hasText: '完成测试任务' }).first()
    await completedChip.click()
    await expect(page.locator('.task-card')).toBeVisible()
    await page.locator('.task-card .complete-btn').click()

    // 验证恢复未完成状态
    await expect(
      page.locator('.task-chip.completed, .task-block.completed').filter({ hasText: '完成测试任务' })
    ).toHaveCount(0, { timeout: 3000 })
  })

  // ── 7. 表单验证：空标题不能提交 ──────────────────────────────────────────────
  test('表单验证 - 空标题不能提交', async ({ page }) => {
    await openNewTaskForm(page)
    const submitBtn = page.locator('.modal-content .submit-btn')
    await expect(submitBtn).toBeDisabled()
  })

  // ── 8. 表单验证：结束时间必须晚于开始时间 ────────────────────────────────────
  test('表单验证 - 结束时间必须晚于开始时间', async ({ page }) => {
    await openNewTaskForm(page)
    await page.locator('.modal-content input[placeholder="输入任务标题"]').fill('时间验证测试')

    // 设置开始时间为 12:00，结束时间为 10:00（无效）
    await selectByLabel(page, '开始时间').selectOption({ label: '12:00' })
    await selectByLabel(page, '结束时间').selectOption({ label: '10:00' })

    const submitBtn = page.locator('.modal-content .submit-btn')
    await expect(submitBtn).toBeDisabled()
  })

  // ── 9. 所有分类选择 ──────────────────────────────────────────────────────────
  test('所有分类选择', async ({ page }) => {
    await openNewTaskForm(page)
    await page.locator('.modal-content input[placeholder="输入任务标题"]').fill('分类测试')

    const categories = ['工作', '学习', '健身', '生活', '健康', '社交', '其他']

    for (const cat of categories) {
      await clickCategory(page, cat)
      const btn = page.locator('.modal-content .category-options > button', { hasText: cat })
      await expect(btn).toHaveClass(/active/)
    }

    await closeForm(page)
  })

  // ── 10. 所有优先级选择 ────────────────────────────────────────────────────────
  test('所有优先级选择', async ({ page }) => {
    await openNewTaskForm(page)
    await page.locator('.modal-content input[placeholder="输入任务标题"]').fill('优先级测试')

    const priorities = ['高', '中', '低']

    for (const pri of priorities) {
      await clickPriority(page, pri)
      const btn = page.locator('.modal-content .priority-options > button', { hasText: pri })
      await expect(btn).toHaveClass(/active/)
    }

    await closeForm(page)
  })
})
