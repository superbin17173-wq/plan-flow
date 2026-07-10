# Pass 3 — 日历视图列表化改造 + 圆角

## 变更总览

用户反馈:
> 我做计划不会精确到小时,大部分时候是某一天需要做什么,再细一点也只是大致几点到几点要做什么,所以展示每一个时间戳不合适。
> `/ai-frame:ai` 页面中不要使用完全方形的方块,稍微带点圆角,不然太丑了。

**结论**: 彻底放弃 24 小时时间轴表现形式,改为分组列表;所有方块加圆角。

## 组件改动

### 1. `DayView.vue` — 完全改写为列表模式
- 删除 `hours` 数组、`hour-axis`、`task-area`、`TaskBlock` 绝对定位块
- 新增 3 个分组:
  - 🕒 **定时安排** (`timedTasks`) — 有 startTime 的任务,展示 `HH:MM - HH:MM`
  - ⏳ **花费时长** (`durationTasks`) — 有 durationMinutes 无固定时间,展示 `45 分钟` / `1.5 小时`
  - 📌 **全天待办** (`anytimeTasks`) — 全天/待办类,只展示标题
- 空状态: ☀️ 图标 + "今天无计划" + "点击 新建任务 开始规划" 提示 + 蓝色 CTA
- 圆角: `.task-list` = `--radius-lg`, `.task-row` = 无独立圆角(由父容器裁切),`.empty-cta` = `--radius-md`

### 2. `WeekView.vue` — 改写为 7 天列表
- 删除周网格 + 时间轴 + hour-slot + TaskBlock
- 每一天一个 `<section>`,含 header 按钮(星期、日期、任务计数)+ 任务列表
- 定时任务显示 `09:30-10:00`,时长任务显示 `⏳ 45m`,全天任务显示 `📌 全天`
- 圆角: `.task-list` = `--radius-lg`, header 保持无边框跟随 iOS 分组列表风格

### 3. `MonthView.vue` — 保留网格但加圆角
- `.day-cell` 加 `border-radius: var(--radius-md)` + `box-shadow: var(--shadow-xs)`
- `.month-view` 加 `gap: 6px` 使方块之间有间隙
- `today.day-number` 保持圆形高亮,`selected.day-cell` 用 2px 蓝色描边

## 视觉验证证据

| 视图 | 截图 | 验证点 |
|------|------|--------|
| 月视图 | `01-month.png` | 每个日期格独立圆角卡片,间距 6px,当前日蓝色圆形数字 |
| 周视图 | `02-week.png` | 7 天纵向列表,今天蓝色 date 突出显示,无计划显示"无计划" |
| 日视图(空) | `03-day.png` | ☀️ + "今天无计划" + 蓝色 CTA,无时间轴 |

## 未验证但代码已覆盖

- 日视图有任务时的 3 分组渲染 — 由代码结构保证 (`DayView.vue:122-178`)
- 已验证 HMR 3 次热更新成功 (vite 日志)

## 来源

- 用户消息 2026-07-10: "如果有计划就罗列出计划否则直接显示今天无计划,彻底放弃时间段的表现形式"
- 用户消息 2026-07-10: "所有方块" 需圆角
- 参照 iOS 17 HIG: Grouped List + Rounded Corners (radius 10-14pt)
