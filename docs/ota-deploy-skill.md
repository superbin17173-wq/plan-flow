# PlanFlow OTA 部署 Skill

## 功能概述

一键将 PlanFlow 前端代码部署到 Cloudflare Pages，实现手机 APP 远程热更新。

## 触发关键词

用户说以下话时自动调用：
- "部署 OTA" / "远程更新" / "热更新部署"
- "推送到 Cloudflare" / "更新手机 APP"
- `/deploy-ota`

## 一键部署命令

```bash
npm run deploy:ota
```

这条命令会：
1. 构建前端代码 (`vue-tsc -b && vite build`)
2. 生成 `version.json` + `dist.zip`
3. 自动上传到 Cloudflare Pages

## OTA 更新地址

```
https://planflow-aot.pages.dev/version.json
https://planflow-aot.pages.dev/dist.zip
```

## 首次配置（已完成）

1. 安装 Wrangler CLI：`npm install wrangler --save-dev`
2. 登录授权：`npx wrangler login`
3. 创建项目：`npx wrangler pages project create planflow`
4. 部署：`npm run deploy:ota`

## 关键文件

| 文件 | 作用 |
|------|------|
| `src/utils/otaUpdate.ts` | OTA 核心逻辑（检查版本、下载、解压） |
| `src/components/common/OtaUpdate.vue` | 更新对话框 UI |
| `scripts/generate-ota.mjs` | 构建 post-process，生成 version.json + dist.zip |
| `package.json` | `deploy:ota` 命令定义 |

## 手机 APP 更新流程

1. APP 启动时检查 `version.json`
2. 发现新版本弹出对话框
3. 用户点击"立即更新"
4. 下载 `dist.zip` → 解压 → 重启生效

## 版本号管理

版本号来自 `package.json` 的 `version` 字段。

更新版本后重新部署：
```bash
# 修改 package.json version 字段
npm run deploy:ota
```

## 验证部署

```bash
# 检查版本文件
curl https://planflow-aot.pages.dev/version.json

# 查看部署列表
npx wrangler pages deployment list --project-name planflow
```

## 打包带 OTA 功能的 APK

```bash
# 设置正确的 JAVA_HOME
export JAVA_HOME="C:/Users/ljadmin/jdk-tmp/jdk-21.0.11+10"
export ANDROID_HOME="C:/Users/ljadmin/AppData/Local/Android/Sdk"

# 构建 web + 同步 + 打包
npm run build && npx cap sync android
cd android && ./gradlew.bat assembleDebug --no-daemon

# 复制到桌面
cp android/app/build/outputs/apk/debug/app-debug.apk ~/Desktop/PlanFlow-release.apk
```

## 常见问题

### Q: Page not found

项目刚创建时需要等待几分钟。检查部署状态：
```bash
npx wrangler pages deployment list --project-name planflow
```

### Q: Production 分支不对

Production 分支应设置为 `master`（或当前使用的分支）。
在 Cloudflare Dashboard → Pages → Settings → Builds & deployments 修改。

### Q: 版本没更新

确保 `package.json` 的 version 字段已修改，且重新执行了 `npm run deploy:ota`。

## 架构图

```
┌─────────────────┐     HTTPS     ┌──────────────────┐
│ Cloudflare Pages│◄────────────►│   手机 APP        │
│ planflow-aot    │              │  OtaUpdate.vue    │
│ ├─ version.json │  检查版本     │                  │
│ ├─ dist.zip     │  下载更新     │  planflow-updates│
│ └─ assets/      │              │  ├─ index.html   │
└─────────────────┘              │  ├─ assets/      │
                                 └──────────────────┘
```