# 移动端 Header 按钮可见性修复

## 问题
用户反馈设置按钮和主题切换按钮在手机端看不到。

## 原因
`AppHeader.vue` 在移动端（≤768px）通过 `.desktop-only { display: none !important; }` 隐藏了这些按钮，只显示溢出菜单（⋯）。

## 修复
1. 移除设置按钮和 ThemeToggle 组件的 `.desktop-only` 类
2. 调整移动端按钮尺寸（32px × 32px）
3. 溢出菜单只保留批量/导入、统计等低频功能

## 验证证据

| 截图 | 说明 |
|------|------|
| `mobile-header-fixed.png` | 375px 视口下，header 右侧显示 + 🔍 ⚙️ 🌙 四个按钮 |

## 来源

- 用户反馈：设置按钮、主题切换按钮在手机端看不到
- iOS HIG：常用功能应直接可触达