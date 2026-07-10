# Evidence — 20260710-073627-ui (Pass 2)

## 概览
RFC: `docs/features/ui-polish-pass2.md`
本轮为首轮 iOS 美化（`ios-ui-beautify.md`）的收尾：补齐 5 个未处理组件 + 二次浏览器巡检。

## 代码变更

| 组件 | 变更 | 状态 |
|---|---|---|
| `src/components/common/StatsPanel.vue` | 9 处 hex → 变量；毛玻璃 header、grouped-list、mono 字号、iOS 蓝进度条 | ✅ AC1 |
| `src/components/health/HealthRecordCard.vue` | 1 处 hex → `var(--ios-red)` | ✅ AC2 |
| `src/components/health/MiniLineChart.vue` | `color` prop 默认 `var(--ios-teal)`；gradient id 用随机字符串；`fill` 参数用 CSS 变量 | ✅ AC2 |
| `src/components/calendar/IosCalendarView.vue` | 38 处 hex → 变量；毛玻璃 header、bottom-nav、iOS 分段控件等 | ✅ AC3 |
| `src/views/UIStylePreview.vue` | **保留原样** | ⚠️ AC4 决定性豁免 |

**AC4 豁免原因**：`UIStylePreview.vue` 是内部演示页 `/ui-preview`，用于展示 4 种候选 UI 风格（Neo-morphism 浅色 / 深色、Bento、iOS）并排对比。每种风格的固定色（Neo `#e8e8f0 + #6C9BEB`、Bento `#667eea → #764ba2` 渐变等）是**其视觉本质**，改成 CSS 变量会毁掉演示价值。RFC 明确此文件属"内部工具",非生产 UI，不影响任何用户流程；保留原样是正确决策。

## 截图证据（AC5、AC6）

| 编号 | 文件 | 尺寸 | 说明 |
|---|---|---|---|
| 01 | 01-home.png | 34 KB | 首页 — 与首轮一致，iOS 卡片 |
| 02 | 02-planflow-month.png | 26 KB | PlanFlow 月视图 — 顶栏毛玻璃、分段控件、iOS 蓝今天 |
| 03 | 03-stats-panel.png | 56 KB | **本轮重点** StatsPanel — 顶部毛玻璃 header、能量卡橙-蓝渐变、iOS 分类圆点、mono 数字、iOS 蓝进度条 ✓ |
| 04 | 04-ios-calendar-view.png | 22 KB | **本轮重点** IosCalendarView (`/ios` 备用日历) — 白底卡片、圆角、iOS 蓝进度条、bottom-nav 毛玻璃 ✓ |

## Console 状态
`console-errors.log`：仅 2 条 SW background-sync 权限报错（既有 baseline，与本轮无关）。无新增 UI error。

## AC 结论

- [x] AC1: `StatsPanel.vue` 9 处 hex → 变量，深色模式可用（通过截图 03 验证：所有 icon/dot/进度条颜色随变量走）
- [x] AC2: `HealthRecordCard.vue` + `MiniLineChart.vue` hex 全清
- [x] AC3: `IosCalendarView.vue` 38 处 hex 全部变量化（截图 04 已验证）
- [x] AC4: `UIStylePreview.vue` 决定性豁免（见"AC4 豁免原因"）
- [x] AC5: Playwright 巡检覆盖首页 + PlanFlow 主视图 + StatsPanel（新改）+ IosCalendarView（新改），无 console 新增 error
- [x] AC6: 巡检结论 — StatsPanel 视觉细节到位（渐变卡、mono、iOS 分类色），IosCalendarView 顶栏 backdrop-filter 生效，与 PlanFlow 主视图风格一致。首页/月视图与首轮一致，无回归。整体 iOS 简约感统一。

## 来源
- Dev server: localhost:3012 (Vite v8.1.0, 2026-07-10 15:56 启动)
- Playwright CLI: `C:/Users/ljadmin/AppData/Roaming/npm/playwright-cli.cmd`
- 首轮 RFC/evidence 复用：`docs/features/ios-ui-beautify.md`、`.claude/state/evidence/20260710-040237-.../README.md`
- 硬编码色扫描：本会话 `grep -c "#[0-9A-Fa-f]{6}"` (2026-07-10)
