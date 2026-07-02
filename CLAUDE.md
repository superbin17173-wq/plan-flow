# PlanFlow 项目 - CLAUDE 内部指令

## 自定义 Skill：`build-apk`

**用途**：把 PlanFlow Vue 项目打包成可安装到 Android 手机的 APK，支持 Live Reload 热重载开发模式。

**触发关键词**（用户说这些话就调用）：
- "打包 APK" / "生成安装包" / "部署到手机"
- "想在手机上看效果" / "手机调试" / "热重载开发"
- `/build-apk [live|release|both]`

**执行方式**：
```powershell
# PowerShell（推荐，Windows 原生）
powershell -ExecutionPolicy Bypass -File ./scripts/build-apk/build.ps1 live
powershell -ExecutionPolicy Bypass -File ./scripts/build-apk/build.ps1 release
powershell -ExecutionPolicy Bypass -File ./scripts/build-apk/build.ps1 both

# 或 bash（Git Bash / WSL）
bash ./scripts/build-apk/build.sh live|release|both
```

**前置环境**（首次打包前确认）：
- JDK 21：`C:\Users\ljadmin\jdk-tmp\jdk-21.0.11+10`
- Android SDK：`C:\Users\ljadmin\AppData\Local\Android\Sdk`
- Node 18+、npm（已装）
- 防火墙规则（Live 模式需要）：
  ```powershell
  New-NetFirewallRule -DisplayName "Vite Dev 3012" -Direction Inbound -Protocol TCP -LocalPort 3012 -Action Allow
  ```

**产物位置**：
- `C:\Users\ljadmin\Desktop\PlanFlow-livereload.apk`（Live Reload 版）
- `C:\Users\ljadmin\Desktop\PlanFlow-release.apk`（生产正式版）

**执行完后必须告知用户**：
1. APK 在桌面，可 USB/微信/adb 传手机安装
2. 首次安装允许"未知来源"
3. Live 模式需启动 `npm run dev`，手机连同一 WiFi 打开 APP 即实时刷新
4. 切 WiFi / 换电脑 IP 需重打 live 版（IP 写死在 APK 里）
5. 用 Chrome `chrome://inspect` 可远程调试手机 WebView

## 其他重要路径

- `capacitor.config.ts`：Capacitor 配置，live 模式会改这里的 server.url
- `android/`：Android 原生工程
- `android/app/build/outputs/apk/debug/`：原始 APK 位置
