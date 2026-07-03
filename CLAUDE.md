# PlanFlow 项目 - Claude 内部指令

## 自定义 Skill：`build-apk`

**用途**：把 PlanFlow Vue 项目打包成可安装到 Android 手机的 APK，支持 Live Reload 热重载开发模式。

**触发关键词**（用户说这些话就调用）：
- "打包 APK" / "生成安装包" / "部署到手机"
- "想在手机上看效果" / "手机调试" / "热重载开发"
- `/build-apk [live|release|both]`

**脚本特性（通用、跨机器、跨用户）**：
- 首次运行**自动扫描**本机所有常见路径的 JDK 21+ / Android SDK / Node
- 找不到就**交互式引导**自动下载补装（JDK 21 便携版 + Android cmdline-tools）
- 配置**持久化**到 `~/.planflow-build/config.json`，换项目复用
- 支持 4 个子命令：`detect` / `init` / `set-config` / `firewall`
- 兼容 Windows PowerShell、Git Bash、Linux bash、macOS bash

### 执行方式

**Windows PowerShell**：
```powershell
.\scripts\build-apk\build.ps1              # 默认 live
.\scripts\build-apk\build.ps1 live         # Live Reload 版
.\scripts\build-apk\build.ps1 release      # 生产正式版
.\scripts\build-apk\build.ps1 both         # 两种都打
.\scripts\build-apk\build.ps1 -Detect      # 检测环境
.\scripts\build-apk\build.ps1 -Init        # 交互式生成配置
.\scripts\build-apk\build.ps1 -SetConfig jdkPath "C:\jdk21"   # 手动指定路径
.\scripts\build-apk\build.ps1 -Firewall    # 放行 vite 端口
```

**Bash（Git Bash / Linux / macOS）**：
```bash
bash scripts/build-apk/build.sh live|release|both
bash scripts/build-apk/build.sh detect
bash scripts/build-apk/build.sh init
bash scripts/build-apk/build.sh set-config jdkPath /path/to/jdk
bash scripts/build-apk/build.sh firewall
```

### 配置文件（自动生成，位于 `~/.planflow-build/config.json`）

```json
{
  "jdkPath": "自动检测的 JDK 路径（可手动覆盖）",
  "androidSdkPath": "自动检测的 Android SDK 路径",
  "vitePort": 3012,
  "autoInstallJdk": true,
  "autoInstallSdk": true,
  "copyToDesktop": true
}
```

环境变量覆盖（临时）：`PLANFLOW_JDK` / `PLANFLOW_SDK` / `PLANFLOW_VITE_PORT`

### 前置环境要求（未满足脚本会引导安装）

- JDK 21+（Capacitor 8 硬性要求）
- Android SDK（platform-tools、build-tools、platforms）
- Node 18+ / npm
- Live 模式需放行防火墙端口 3012

### 产物位置

- `C:\Users\<当前用户>\Desktop\PlanFlow-livereload.apk`
- `C:\Users\<当前用户>\Desktop\PlanFlow-release.apk`

### 执行完后必须告知用户

1. APK 在桌面，可 USB / 微信文件助手 / adb 传手机安装
2. 首次安装允许"未知来源"
3. Live 模式需启动 `npm run dev`，手机连同一 WiFi 打开 APP 即实时刷新
4. 切 WiFi / 换电脑 IP 需重打 live 版（IP 写死在 APK 里）
5. 用 Chrome `chrome://inspect` 可远程调试手机 WebView

### 其他重要路径

- `capacitor.config.ts`：Capacitor 配置，live 模式脚本会改 server.url
- `android/`：Android 原生工程
- `android/app/build/outputs/apk/debug/`：原始 APK 位置

---

## 自定义 Skill：`deploy-ota`

**用途**：一键部署 PlanFlow 前端代码到 Cloudflare Pages，实现手机 APP 远程热更新。

**触发关键词**（用户说这些话就调用）：
- "部署 OTA" / "远程更新" / "热更新部署"
- "推送到 Cloudflare" / "更新手机 APP"
- `/deploy-ota`

### 一键部署命令

```bash
npm run deploy:ota
```

这条命令会：
1. 构建前端代码 (`vue-tsc -b && vite build`)
2. 生成 `version.json` + `dist.zip`
3. 自动上传到 Cloudflare Pages

### OTA 更新地址

```
https://planflow-aot.pages.dev/version.json
https://planflow-aot.pages.dev/dist.zip
```

### 手机 APP 更新流程

1. APP 启动时检查 `version.json`
2. 发现新版本弹出对话框
3. 用户点击"立即更新"
4. 下载 `dist.zip` → 解压 → 重启生效

### 关键文件

| 文件 | 作用 |
|------|------|
| `src/utils/otaUpdate.ts` | OTA 核心逻辑（检查版本、下载、解压） |
| `src/components/common/OtaUpdate.vue` | 更新对话框 UI |
| `scripts/generate-ota.mjs` | 构建 post-process，生成 version.json + dist.zip |
| `docs/ota-update.md` | OTA 功能完整文档 |
| `docs/ota-deploy-skill.md` | 本 skill 详细文档 |

### 版本号管理

版本号来自 `package.json` 的 `version` 字段。更新版本后重新部署：

```bash
# 修改 package.json version 字段
npm run deploy:ota
```

### 验证部署

```bash
curl https://planflow-aot.pages.dev/version.json
npx wrangler pages deployment list --project-name planflow
```
