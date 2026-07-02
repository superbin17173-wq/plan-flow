# PlanFlow 后台微信推送（可选部署）

**此目录不参与前端构建**，仅是可选的云函数模板。当前 PlanFlow 内置的 PushPlus 推送在浏览器/PWA 打开时已经工作。如果你希望 **完全关闭 APP 也能收到微信提醒**，才需要部署这里的内容。

## 前置条件

需要一个「云端存放任务数据」的地方。当前 PlanFlow 只把任务存在浏览器 IndexedDB 里，云函数无法直接读取。你需要选择一种同步方案：

### 方案 A：手动导出（最简单）
- 每天早上从 APP 导出今日任务 JSON
- 上传到 GitHub Gist / Vercel KV / 任意可访问的 URL
- 云函数从该 URL 拉取

### 方案 B：接入 Supabase / Firebase（推荐）
- 免费云数据库
- 前端改造：每次编辑任务时也写入云端
- 云函数直接查询

### 方案 C：本机 cron（无需云）
- 在自己电脑上跑一个 Node.js 脚本，定时读取导出的 JSON
- 缺点：电脑要开机

---

## 云函数模板（Vercel Cron）

以下是一个 Vercel Serverless Function 示例。部署到 Vercel 后配合 Vercel Cron 每分钟触发。

**目录结构：**
```
your-repo/
  api/
    cron-reminder.js   ← 下方代码
  vercel.json           ← 见下方
```

**api/cron-reminder.js：**
```js
// Vercel Serverless Function - 每分钟触发一次
export default async function handler(req, res) {
  // 1. 从你选的存储读取今日任务（示例：从公开 URL 拉 JSON）
  const TASKS_URL = process.env.TASKS_URL // 你的任务 JSON URL
  const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN
  const PUSHPLUS_TOPIC = process.env.PUSHPLUS_TOPIC || ''

  if (!TASKS_URL || !PUSHPLUS_TOKEN) {
    return res.status(400).json({ error: '未配置环境变量' })
  }

  const today = new Date().toISOString().slice(0, 10)
  const tasksRes = await fetch(TASKS_URL)
  const allTasks = await tasksRes.json()
  const tasks = allTasks.filter(t => t.date === today && !t.isCompleted && t.remindAt)

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const pushed = []
  for (const task of tasks) {
    const [h, m] = task.startTime.split(':').map(Number)
    const remindMinute = h * 60 + m - task.remindAt
    if (Math.abs(currentMinutes - remindMinute) <= 1) {
      // 命中提醒时间点
      const body = {
        token: PUSHPLUS_TOKEN,
        title: `任务提醒: ${task.title}`,
        content: `<h3>${task.title}</h3><p>开始时间：${task.startTime}</p><p>${task.description || ''}</p>`,
        template: 'html',
      }
      if (PUSHPLUS_TOPIC) body.topic = PUSHPLUS_TOPIC

      await fetch('https://www.pushplus.plus/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      pushed.push(task.id)
    }
  }

  res.status(200).json({ checked: tasks.length, pushed })
}
```

**vercel.json：**
```json
{
  "crons": [
    {
      "path": "/api/cron-reminder",
      "schedule": "* * * * *"
    }
  ]
}
```

**环境变量（在 Vercel 项目设置里加）：**
- `PUSHPLUS_TOKEN` — 你的 PushPlus token
- `PUSHPLUS_TOPIC` — 群组编码（可选，留空推送到个人）
- `TASKS_URL` — 今日任务 JSON 的公开 URL

---

## 备选：本机 Node.js cron

如果不想上云，可在自己电脑跑：

```bash
npm install node-cron node-fetch
```

```js
// local-cron.js
import cron from 'node-cron'
import fs from 'fs'

cron.schedule('* * * * *', async () => {
  const tasks = JSON.parse(fs.readFileSync('./tasks.json', 'utf-8'))
  // ...同上逻辑
})
```

配合 Windows 任务计划 / macOS launchd 开机自启。

---

## 推荐路径

个人使用 → **先只用 PlanFlow 内置推送就够了**。手机装成 PWA 并让 Chrome 保持后台运行，绝大部分场景能覆盖。等真的发现"关掉浏览器错过重要提醒"了，再考虑部署云函数。
