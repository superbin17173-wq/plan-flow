# ios-ui-beautify

## 目标

按 iOS 17 简约设计语言，统一整个 PlanFlow 应用的视觉：所有硬编码颜色改用 CSS 变量、卡片/按钮/弹窗采用 iOS grouped-card 与 bottom-sheet 模式、顶部/常驻栏使用毛玻璃、暗色模式一致可用。目的是消除主题不一致、支持深色模式、贴合 iOS 观感。

## 接口 / UI

**全局**
- `src/styles/variables.scss` — 扩充为 iOS 17 设计令牌：系统色 (blue/green/orange/red/pink/purple/indigo/teal 等)、分组背景 (bg-primary/secondary/tertiary/card/elevated/fill-quaternary)、材质 (material-thin/regular/thick + backdrop-blur)、文字层级 (primary/secondary/tertiary/quaternary)、分隔线、阴影 xs/sm/md/lg/xl、字号阶梯 (caption2..largetitle)、iOS 圆角 (xs..xxl/full)、弹簧动画 (`--spring`)、安全区 (safe-top/bottom/left/right)。深色模式镜像所有变量。
- `src/styles/ios-theme.scss` — 通用工具类：`.ios-card`、`.ios-list/-item/-group`、`.ios-btn/-tinted/-plain/-secondary/-danger`、`.ios-input`、`.ios-chip`、`.ios-sheet-mask/-sheet`、`.ios-blur-bar/-tabbar`、`.ios-segmented`、`.ios-toast`、`.ios-fab`、`.ios-tap`。含 `iosFadeIn`/`iosSlideUp`/`iosScaleIn` 动画。
- `src/styles/index.scss` — 全局 base：iOS 字体栈、抗锯齿、细滚动条、iOS 焦点环 (蓝色 3px 半透明)、`.card` 用变量、Element Plus 下拉菜单覆盖、`prefers-reduced-motion` 兼容。
- `src/App.vue` — 使用 `var(--bg-primary/--text-primary)`，移除硬编码 `#F2F2F7/#1A1A1A`。

**顶部导航**
- `src/components/layout/AppHeader.vue` — 毛玻璃 `backdrop-filter: var(--backdrop-blur)`，所有色值走变量。nav-btn 交互补 `:active { scale(0.94) }` 弹簧。
- `src/components/layout/ViewSwitcher.vue` — iOS 分段控件样式 (2px 内边距、9px 圆角、激活项白底 + 阴影)。

**主视图**
- `src/views/HomeView.vue` — 卡片阴影/图标胶囊/badge 全变量化，featured 卡渐变 icon + 蓝色柔阴影。
- `src/views/PlanFlowView.vue` — Toast 改为毛玻璃通知样式，Loading spinner 走变量。

**弹窗组件**（统一 bottom-sheet + 大圆角 + backdrop-blur）
- `src/components/task/TaskCard.vue` — 卡片头部保留分类色、body 用变量、footer 三按钮走 iOS filled/tinted/danger 变体。
- `src/components/task/TaskForm.vue` — 整套表单变量化：category-btn / priority-btn / toggle-btn (iOS 开关 51x31 + 27px 拇指) / weekday-btn / time-mode-tabs / duration-chip / anytime-hint。
- `src/components/common/SettingsPanel.vue` — grouped-list（每个 row/field 之间 0.5px 分隔线、section 标题 uppercase 灰）+ 变量化。
- `src/components/common/BulkTaskDialog.vue`、`ProfileDialog.vue`、`MealQuickLog.vue`、`SearchBar.vue` — 变量化 + iOS 分段/胶囊/圆角。

**日历视图**
- `src/components/calendar/MonthView.vue`、`WeekView.vue`、`DayView.vue`、`YearWeekView.vue`、`DayTimePie.vue` — 所有硬编码 `#F2F2F7/#FFFFFF/#E5E5EA/#007AFF/#1A1A1A/#8E8E93/#C7C7CC/#FF9500/#34C759/#5856D6` 换为 `var(--bg-primary/-card/--separator/--ios-blue/--text-primary/--text-tertiary/--text-quaternary/--ios-orange/--ios-green/--ios-indigo)`。

**常驻组件**
- `src/components/ai/ChatBubble.vue`、`ChatPanel.vue` — 泡泡 + 面板 iOS 化 (毛玻璃、圆角、变量色)。
- `src/components/common/OtaUpdate.vue` — 弹窗变量化 + iOS 按钮风格。

## 关键决策

- 使用现有 iOS 官方系统色 (developer.apple.com/design/human-interface-guidelines/color) 作为基准，深色模式采用 Apple vibrant 变体（#0A84FF vs #007AFF 等）。这是行业公认的"iOS 简约"色板，无需向用户求证。
- Bottom-sheet 圆角 28px、桌面居中 20px；抓手条 36×5px @ 50% 透明；backdrop 蒙层 `rgba(0,0,0,0.35) + blur(6px)`。参考 iOS 15+ sheet presentation。
- 顶部导航毛玻璃：`saturate(180%) blur(20px)` + `rgba(255,255,255,0.82)` (深色 `rgba(30,30,32,0.82)`)。参考 iOS SF Symbols/Navigation Bar Material。
- 弹簧动画：`cubic-bezier(0.34, 1.56, 0.64, 1)` 0.32s (iOS 常见 tap-back)；sheet 展开 `cubic-bezier(0.32, 0.72, 0, 1)` 0.34s (iOS 默认)。

## 验收标准（Acceptance）

- [x] AC1: `variables.scss` 定义 iOS 17 完整设计令牌，深色模式镜像所有变量。
- [x] AC2: `ios-theme.scss` 提供 iOS 通用工具类 (card/list/btn/input/chip/sheet/segmented/toast/fab)。
- [x] AC3: `index.scss` 全局 base 移除硬编码色、使用 CSS 变量、支持 reduced-motion。
- [x] AC4: AppHeader 使用 backdrop-blur 毛玻璃、所有色值走变量。
- [x] AC5: HomeView、PlanFlowView、Toast 完成变量化。
- [x] AC6: TaskCard、TaskForm、SettingsPanel、BulkTaskDialog、ProfileDialog、MealQuickLog、SearchBar 完成 iOS 化重构。
- [ ] AC7: MonthView、WeekView、DayView、YearWeekView、DayTimePie 完成硬编码色替换。
- [ ] AC8: ChatBubble、ChatPanel、OtaUpdate 完成 iOS 化。
- [ ] AC9: Playwright 启动 dev server、遍历首页 → PlanFlow 主视图 → 各日历视图 → 弹窗，截图证明视觉正确，无浏览器 console error。
- [ ] AC10: 深色模式切换后主要页面无残留硬编码浅色，视觉一致。

## 影响面

- `src/styles/*.scss` (全部 4 个文件)
- `src/App.vue`
- `src/views/HomeView.vue`、`PlanFlowView.vue`
- `src/components/layout/AppHeader.vue`、`ViewSwitcher.vue`
- `src/components/common/SettingsPanel.vue`、`BulkTaskDialog.vue`、`ProfileDialog.vue`、`MealQuickLog.vue`、`SearchBar.vue`、`OtaUpdate.vue`
- `src/components/task/TaskCard.vue`、`TaskForm.vue`
- `src/components/calendar/MonthView.vue`、`WeekView.vue`、`DayView.vue`、`YearWeekView.vue`、`DayTimePie.vue`
- `src/components/ai/ChatBubble.vue`、`ChatPanel.vue`

**不动**：`src/wing/*`、`android/*`、路由/store/utils（纯 UI 任务）。

## 来源

- iOS 系统色板：Apple Human Interface Guidelines — Color (`developer.apple.com/design/human-interface-guidelines/color`)。用于 `--ios-blue #007AFF`、暗色 `#0A84FF` 等取值。
- iOS 材质与毛玻璃：Apple HIG — Materials (`developer.apple.com/design/human-interface-guidelines/materials`)。用于 `backdrop-filter: saturate(180%) blur(20px)` 参数。
- iOS Sheet 展示样式：Apple HIG — Sheets (`developer.apple.com/design/human-interface-guidelines/sheets`)。用于抓手条、圆角、上滑动画曲线 `cubic-bezier(0.32, 0.72, 0, 1)`。
- 现有代码基线：`src/styles/ios-theme.scss:1-152`（原设计令牌）、`src/styles/variables.scss:1-85`（原变量）、`CLAUDE.md`（项目 iOS 定位）。变量补齐的目标即基于此文件。
- 已完成部分变量与组件变更：本会话内提交前的 Edit 记录（TaskCard/TaskForm/SettingsPanel 等 style 块整体替换）。
- 硬编码色扫描结果：本会话 `grep -n "#[0-9A-Fa-f]{6}" src/components/calendar/*.vue`（2026-07-10）—— 定位剩余日历视图 60+ 处硬编码色，属于 AC7 待办输入。
