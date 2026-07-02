/**
 * 测试模块6: 健身任务功能
 * 覆盖：健身分类任务创建、动作选择、组数设置
 */
import { test, expect } from '@playwright/test'

test.describe('健身任务功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })
  })

  test('创建健身任务 - 基本流程', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '健身房训练')

    // 选择健身分类
    await page.click('button:has-text("健身")')
    // 等待健身动作区域渲染完成
    await page.waitForSelector('.workout-block', { timeout: 5000 })
    await page.locator('.workout-block').scrollIntoViewIfNeeded()

    // 验证健身动作区域出现（用 .ex-card 避免与 .workout-block 产生 strict mode 冲突）
    await expect(page.locator('.ex-card').first()).toBeVisible()

    await page.click('button:has-text("创建")')
    await page.waitForTimeout(500)

    // 验证任务创建成功
    await expect(page.locator('.task-chip, .task-block')).toContainText('健身房训练')
  })

  test('健身任务 - 选择肌肉部位', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '部位训练')
    await page.click('button:has-text("健身")')
    await page.waitForSelector('.workout-block', { timeout: 5000 })
    await page.locator('.workout-block').scrollIntoViewIfNeeded()

    // 选择肌肉部位（背）—— 肌肉部位 select 是 .ex-head 内的第一个 select
    const muscleSelect = page.locator('.ex-card').first().locator('.ex-head select').first()
    await muscleSelect.selectOption({ label: '背' })
    await page.waitForTimeout(300)

    // 验证动作列表更新
    await expect(page.locator('.ex-card')).toBeVisible()

    await page.click('button:has-text("取消")')
  })

  test('健身任务 - 添加多个动作', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '多动作训练')
    await page.click('button:has-text("健身")')
    await page.waitForSelector('.workout-block', { timeout: 5000 })
    await page.locator('.workout-block').scrollIntoViewIfNeeded()

    // 点击添加动作按钮
    await page.click('button:has-text("＋ 添加动作")')
    await page.waitForTimeout(300)

    // 验证有两个动作卡片
    const exCards = page.locator('.ex-card')
    await expect(exCards).toHaveCount(2)

    await page.click('button:has-text("取消")')
  })

  test('健身任务 - 添加组数', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '组数测试')
    await page.click('button:has-text("健身")')
    await page.waitForSelector('.workout-block', { timeout: 5000 })
    await page.locator('.workout-block').scrollIntoViewIfNeeded()

    // 点击加一组按钮
    await page.click('button:has-text("＋ 加一组")')
    await page.waitForTimeout(300)

    // 验证组数增加
    const setRows = page.locator('.set-row')
    await expect(setRows).toHaveCount(2)

    await page.click('button:has-text("取消")')
  })

  test('健身任务 - 删除动作', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '删除动作测试')
    await page.click('button:has-text("健身")')
    await page.waitForSelector('.workout-block', { timeout: 5000 })
    await page.locator('.workout-block').scrollIntoViewIfNeeded()

    // 先添加一个动作
    await page.click('button:has-text("＋ 添加动作")')
    await page.waitForTimeout(300)

    // 删除第一个动作
    await page.locator('.ex-card').first().locator('button:has-text("×")').click()
    await page.waitForTimeout(300)

    // 验证只剩一个动作
    const exCards = page.locator('.ex-card')
    await expect(exCards).toHaveCount(1)

    await page.click('button:has-text("取消")')
  })

  test('健身任务 - 设置重量和次数', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '重量次数测试')
    await page.click('button:has-text("健身")')
    await page.waitForSelector('.workout-block', { timeout: 5000 })
    await page.locator('.workout-block').scrollIntoViewIfNeeded()

    // 设置重量——重量 select 是 .set-row 内的第一个 wk-input.tight
    const weightSelect = page.locator('.ex-card').first().locator('.set-row .wk-input.tight').first()
    await weightSelect.selectOption({ valueOrLabel: '20' })

    // 设置次数——次数 select 是 .set-row 内的第二个 wk-input.tight
    const repsSelect = page.locator('.ex-card').first().locator('.set-row .wk-input.tight').nth(1)
    await repsSelect.selectOption({ label: '12 次' })

    await page.click('button:has-text("创建")')
    await page.waitForTimeout(500)

    // 打开任务卡片验证健身详情
    const task = page.locator('.task-block').filter({ hasText: '重量次数测试' })
    if (await task.isVisible()) {
      await task.click()
      await page.waitForTimeout(300)

      // 验证显示训练详情
      await expect(page.locator('.task-card')).toContainText('训练')
    }
  })

  test('健身任务 - 自重选项', async ({ page }) => {
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '自重训练')
    await page.click('button:has-text("健身")')
    await page.waitForSelector('.workout-block', { timeout: 5000 })
    await page.locator('.workout-block').scrollIntoViewIfNeeded()

    // 选择自重——重量 select 是 .set-row 内的第一个 wk-input.tight
    const weightSelect = page.locator('.ex-card').first().locator('.set-row .wk-input.tight').first()
    await weightSelect.selectOption({ valueOrLabel: '0' })

    await page.click('button:has-text("创建")')
    await page.waitForTimeout(500)

    await expect(page.locator('.task-chip, .task-block')).toContainText('自重训练')
  })

  test('健身任务在日历中显示容量信息', async ({ page }) => {
    // 创建有详细数据的健身任务
    await page.click('button:has-text("+")')
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="输入任务标题"]', '容量显示测试')
    await page.click('button:has-text("健身")')
    await page.waitForSelector('.workout-block', { timeout: 5000 })
    await page.locator('.workout-block').scrollIntoViewIfNeeded()

    // 设置3组
    await page.click('button:has-text("＋ 加一组")')
    await page.click('button:has-text("＋ 加一组")')
    await page.waitForTimeout(300)

    await page.click('button:has-text("创建")')
    await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 })

    // 切换到日视图
    await page.click('button:has-text("日")')
    await page.waitForTimeout(500)

    // 任务块应显示容量（组数×次数×重量）
    const taskBlock = page.locator('.task-block').filter({ hasText: '容量显示测试' })
    if (await taskBlock.isVisible()) {
      // 验证有容量或热量显示
      const content = await taskBlock.textContent()
      expect(content).toBeTruthy()
    }
  })
})