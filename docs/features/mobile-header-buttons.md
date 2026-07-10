# 移动端 Header 按钮可见性优化

## 问题

用户反馈：在手机端，设置按钮和主题切换按钮"看不到"。

## 现状分析

`src/components/layout/AppHeader.vue` 当前的移动端布局：

```scss
@media (max-width: 768px) {
  .mobile-only { display: flex; }
  .desktop-only { display: none !important; }
}
```

- 设置按钮（⚙️）和 ThemeToggle 组件在移动端被 `.desktop-only` 隐藏
- 只显示溢出菜单（⋯），用户需要点击后才能看到设置/主题切换选项

## 设计决策

**目标**：确保常用功能按钮在移动端直接可见，减少点击次数。

**方案**：在移动端 header 右侧直接显示设置和主题切换按钮，而不是藏在溢出菜单里。

### 具体改动

1. 移除设置按钮的 `.desktop-only` 类，让它在移动端也显示
2. 移除 ThemeToggle 的 `.desktop-only` 类
3. 溢出菜单（⋯）只保留批量/导入、统计等低频功能
4. 调整 header-right 区域的 gap，确保按钮不被挤压

### 布局预览（移动端 375px）

修改后 header 右侧：
```
[+ 🔍 ⚙️ 🌙]  ← 4个常用按钮直接显示
```

如果空间不够，可以：
- 方案A：隐藏 🔍（搜索），因为 PlanFlow 的搜索频率较低
- 方案B：减小按钮尺寸（width: 32px）
- 方案C：只显示 + ⚙️ 🌙，隐藏其他

## 影响

- 单文件修改：`src/components/layout/AppHeader.vue`
- 不影响桌面端布局
- 溢出菜单仍然存在，用于低频功能

## 来源

- 用户反馈：设置按钮、主题切换按钮在手机端看不到
- iOS HIG：常用功能应直接可触达，不需要多次点击