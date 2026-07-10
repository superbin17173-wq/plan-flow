# ui-polish-pass2

## 目标

在首轮 iOS 美化（`ios-ui-beautify.md`）之外，补齐 5 个仍带硬编码色的边角组件，并对整个 UI 做一次浏览器巡检确认美观度、发现风格漂移就现场修。

## 接口 / UI

**待补组件**（首轮未处理）：
- `src/components/common/StatsPanel.vue`（9 处 hex）— 统计弹窗，顶栏 📊 按钮触发，用户可见。改造成 iOS grouped list + 变量化。
- `src/components/health/HealthRecordCard.vue`（1 处）— 健康记录卡片，改用变量。
- `src/components/health/MiniLineChart.vue`（1 处）— 迷你折线图，SVG stroke 用 `var(--ios-blue)`。
- `src/components/calendar/IosCalendarView.vue`（38 处）— 路由 `/ios` 的备用日历视图，全套 hex→variables 替换。
- `src/views/UIStylePreview.vue`（88 处）— 内部演示页 `/ui-preview`。因非生产用户流程，只做**主要色彩**（背景/文字/边框/分隔线）变量化，保留业务示例色。

**巡检**：Playwright 遍历核心用户路径截图 —— 首页 → PlanFlow 月/周/日/年 → 任务表单 → 设置 → 统计（本轮新改）→ 深色模式。

## 关键决策

无新增决策；沿用 `docs/features/ios-ui-beautify.md` 定的 iOS 17 系统色板、Material 毛玻璃、bottom-sheet 模型、`--ios-blue` 主色。

## 验收标准（Acceptance）

- [ ] AC1: `StatsPanel.vue` 中 9 处 hex 全部替换为 CSS 变量，深色模式可用。
- [ ] AC2: `HealthRecordCard.vue` + `MiniLineChart.vue` hex 全清。
- [ ] AC3: `IosCalendarView.vue` 38 处 hex 清理为变量。
- [ ] AC4: `UIStylePreview.vue` 主要色（背景/文字/border/separator）变量化，业务样例色可保留。
- [ ] AC5: Playwright 二次巡检覆盖首页 + PlanFlow 主视图 + 至少一个新改弹窗（StatsPanel），无 console 新增 error，截图入 `.claude/state/evidence/20260710-073627-ui/`。
- [ ] AC6: 主观美观检查记录到 evidence README（发现问题就现场修完再收工）。

## 影响面

- `src/components/common/StatsPanel.vue`
- `src/components/health/HealthRecordCard.vue`、`MiniLineChart.vue`
- `src/components/calendar/IosCalendarView.vue`
- `src/views/UIStylePreview.vue`
- 若巡检发现遗漏，则同步补 `src/components/**/*.vue` 中对应文件。

## 来源

- 首轮 RFC：`docs/features/ios-ui-beautify.md`（同一 iOS 令牌体系）
- 首轮 evidence：`.claude/state/evidence/20260710-040237-beautify-entire-planflow-ui-with-ios-min/README.md`（本轮延续验证策略）
- 剩余 hex 扫描结果：本会话 `grep -rl "#[0-9A-Fa-f]{6}" src/components/ src/views/`（2026-07-10）：
  - `IosCalendarView.vue: 38`
  - `StatsPanel.vue: 9`
  - `HealthRecordCard.vue: 1`
  - `MiniLineChart.vue: 1`
  - `UIStylePreview.vue: 88`
- Apple HIG（复用首轮 RFC 引用）：Human Interface Guidelines — Color / Materials / Sheets。
