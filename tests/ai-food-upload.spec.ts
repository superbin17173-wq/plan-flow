/**
 * 测试: AI食物图片上传功能
 * 复现: 上传食物图片+描述"油较多"时报错的问题
 */
import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('AI食物图片上传', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app', { timeout: 10000 })

    // 启用AI功能
    await page.click('button:has-text("⚙️")')
    await page.waitForTimeout(500)

    // 启用AI助手开关
    const aiToggles = page.locator('.settings-panel .toggle-btn')
    // 找到"AI 日程助手"区域的开关
    const aiSection = page.locator('.settings-panel').filter({ hasText: 'AI 日程助手' })
    const aiToggle = aiSection.locator('.toggle-btn').first()
    if (await aiToggle.isVisible()) {
      const isActive = await aiToggle.evaluate(el => el.classList.contains('active'))
      if (!isActive) {
        await aiToggle.click()
        await page.waitForTimeout(300)
      }
    }

    // 启用豆包视觉
    const doubaoSection = page.locator('.settings-panel').filter({ hasText: '食物识图' })
    const doubaoToggle = doubaoSection.locator('.toggle-btn').first()
    if (await doubaoToggle.isVisible()) {
      const isActive = await doubaoToggle.evaluate(el => el.classList.contains('active'))
      if (!isActive) {
        await doubaoToggle.click()
        await page.waitForTimeout(300)
      }
    }

    // 关闭设置
    await page.click('.settings-panel .close-btn')
    await page.waitForTimeout(500)
  })

  test('上传食物图片+描述-复现报错', async ({ page }) => {
    // 1. 打开AI聊天面板
    const chatBubble = page.locator('.chat-fab')
    await expect(chatBubble).toBeVisible()
    await chatBubble.click()
    await page.waitForTimeout(500)

    // 验证聊天面板打开
    const chatPanel = page.locator('.chat-panel')
    await expect(chatPanel).toBeVisible()

    // 2. 截图当前状态
    await page.screenshot({ path: 'test-results/ai-chat-opened.png' })

    // 3. 点击图片上传按钮
    const imageBtn = page.locator('.icon-input-btn')
    await imageBtn.click()
    await page.waitForTimeout(300)

    // 4. 选择一个测试图片
    // 先创建一个测试图片文件
    const testImagePath = path.join(__dirname, 'test-food.png')

    // 通过页面创建一个小测试图片
    const testImage = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext('2d')!
      // 画一个模拟食物的图
      ctx.fillStyle = '#f5f5dc'
      ctx.fillRect(0, 0, 200, 200)
      ctx.fillStyle = '#8B4513'
      ctx.beginPath()
      ctx.arc(100, 100, 60, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#FF6347'
      ctx.beginPath()
      ctx.arc(80, 90, 20, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#FFD700'
      ctx.beginPath()
      ctx.arc(120, 110, 15, 0, Math.PI * 2)
      ctx.fill()
      return canvas.toDataURL('image/png')
    })

    // 将 data URL 转为 blob 并设置到 file input
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test-food.png',
      mimeType: 'image/png',
      buffer: Buffer.from(testImage.replace(/^data:image\/png;base64,/, ''), 'base64'),
    })
    await page.waitForTimeout(500)

    // 5. 验证待发送图片预览区出现
    const pendingImage = page.locator('.pending-image')
    await expect(pendingImage).toBeVisible()
    await page.screenshot({ path: 'test-results/ai-image-selected.png' })

    // 6. 在附言中输入"油较多"
    const textarea = page.locator('.chat-input textarea')
    await textarea.fill('这道菜油比较多，请准确估算')
    await page.waitForTimeout(300)
    await page.screenshot({ path: 'test-results/ai-description-entered.png' })

    // 7. 点击发送
    const sendBtn = page.locator('.send-btn')
    await sendBtn.click()

    // 8. 观察结果 - 检查是否出现错误
    await page.waitForTimeout(2000)

    // 检查是否有错误提示
    const errorHint = page.locator('.error-hint')
    const errorMsgs = page.locator('.msg-error')
    const hasError = (await errorHint.count()) > 0 || (await errorMsgs.count()) > 0

    if (hasError) {
      const errorText = await errorHint.textContent().catch(() => '') ||
                        await errorMsgs.first().textContent().catch(() => '')
      console.log('发现错误:', errorText)
      await page.screenshot({ path: 'test-results/ai-error.png' })
    } else {
      // 检查是否显示了loading或结果
      const loading = page.locator('.msg-ai .typing')
      const isTyping = (await loading.count()) > 0
      console.log('是否正在加载:', isTyping)

      // 等待结果（最多10秒）
      await page.waitForTimeout(10000)
      await page.screenshot({ path: 'test-results/ai-result.png' })
    }

    // 截图所有消息
    const allMessages = page.locator('.msg')
    const msgCount = await allMessages.count()
    console.log('消息数量:', msgCount)

    for (let i = 0; i < msgCount; i++) {
      const text = await allMessages.nth(i).textContent()
      console.log(`消息${i}:`, text?.trim().slice(0, 100))
    }

    await page.screenshot({ path: 'test-results/ai-final.png' })
  })

  test('检查AI设置状态', async ({ page }) => {
    // 打开设置面板
    await page.click('button:has-text("⚙️")')
    await page.waitForTimeout(500)

    // 截图设置面板
    await page.screenshot({ path: 'test-results/ai-settings.png' })

    // 检查AI和豆包设置
    const settingsPanel = page.locator('.settings-panel')
    const settingsText = await settingsPanel.textContent()
    console.log('设置面板内容:', settingsText?.slice(0, 500))

    await page.click('.settings-panel .close-btn')
  })
})
