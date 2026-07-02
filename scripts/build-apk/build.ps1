<#
.SYNOPSIS
    PlanFlow Android APK 打包脚本
.DESCRIPTION
    把 Vue 项目打成 Android APK，支持两种模式：
      live    - Live Reload 模式，APP 连接电脑 dev server，改代码手机秒刷（默认）
      release - 生产模式，APP 加载打包好的静态资源，可离线运行
      both    - 两种都打
.EXAMPLE
    .\build.ps1              # 默认 live 模式
    .\build.ps1 live
    .\build.ps1 release
    .\build.ps1 both
.NOTES
    前置环境要求：
      - JDK 21（已安装在 C:\Users\ljadmin\jdk-tmp\jdk-21.0.11+10）
      - Android SDK（C:\Users\ljadmin\AppData\Local\Android\Sdk）
      - Node 18+ / npm
      - Live 模式需先添加防火墙规则：
        New-NetFirewallRule -DisplayName "Vite Dev 3012" -Direction Inbound -Protocol TCP -LocalPort 3012 -Action Allow
#>

param(
    [ValidateSet('live', 'release', 'both')]
    [string]$Mode = 'live'
)

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = "PlanFlow APK Builder [$Mode]"

# ============ 路径配置 ============
$ProjectRoot   = (Get-Item $PSScriptRoot).Parent.Parent.FullName   # 项目根目录
$JDK21         = 'C:\Users\ljadmin\jdk-tmp\jdk-21.0.11+10'
$AndroidSdk    = 'C:\Users\ljadmin\AppData\Local\Android\Sdk'
$Desktop       = [Environment]::GetFolderPath('Desktop')

# ============ 环境检查 ============
function Check-Env {
    Write-Host "`n[1/5] 检查环境..." -ForegroundColor Cyan

    if (!(Test-Path "$JDK21\bin\java.exe")) {
        Write-Error "JDK 21 未找到：$JDK21。请执行以下命令安装：
        `nmkdir C:\Users\ljadmin\jdk-tmp
        cd C:\Users\ljadmin\jdk-tmp
        Invoke-WebRequest -Uri 'https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip' -OutFile msjdk21.zip
        Expand-Archive -Path msjdk21.zip -DestinationPath . -Force"
    }
    if (!(Test-Path "$AndroidSdk\platform-tools")) {
        Write-Error "Android SDK 未找到：$AndroidSdk"
    }
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js 未找到"
    }

    Write-Host "  JDK 21       : $JDK21" -ForegroundColor Green
    Write-Host "  Android SDK  : $AndroidSdk" -ForegroundColor Green
    Write-Host "  Node         : $(node -v)" -ForegroundColor Green
}

# ============ 获取本机 WLAN IP ============
function Get-WlanIP {
    $ip = Get-NetIPAddress -AddressFamily IPv4 |
          Where-Object { $_.InterfaceAlias -match 'WLAN|Wi-Fi|无线' } |
          Select-Object -First 1 -ExpandProperty IPAddress
    if (!$ip) {
        $ip = Get-NetIPAddress -AddressFamily IPv4 |
              Where-Object { $_.InterfaceAlias -notmatch 'Loopback|Loopback|虚拟|VPN' -and $_.IPAddress -ne '127.0.0.1' } |
              Select-Object -First 1 -ExpandProperty IPAddress
    }
    $ip
}

# ============ 设置环境并执行 Gradle ============
function Run-Gradle {
    $env:JAVA_HOME = $JDK21
    $env:ANDROID_HOME = $AndroidSdk
    $env:ANDROID_SDK_ROOT = $AndroidSdk
    $env:PATH = "$JDK21\bin;$env:PATH"

    Push-Location "$ProjectRoot\android"
    try {
        Write-Host "`n[4/5] 运行 gradlew assembleDebug (首次可能需 5-10 分钟)..." -ForegroundColor Cyan
        cmd /c "gradlew.bat assembleDebug --no-daemon 2>&1" | ForEach-Object { $_ }
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Gradle 编译失败（退出码 $LASTEXITCODE）"
        }
    }
    finally {
        Pop-Location
    }
}

# ============ 构建 web 资源 ============
function Build-Web {
    Write-Host "`n[2/5] npm run build..." -ForegroundColor Cyan
    Push-Location $ProjectRoot
    try {
        npm run build 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { Write-Error "npm run build 失败" }
    }
    finally { Pop-Location }
}

# ============ 同步 Capacitor ============
function Sync-Capacitor {
    Write-Host "`n[3/5] npx cap sync android..." -ForegroundColor Cyan
    Push-Location $ProjectRoot
    try {
        npx cap sync android 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { Write-Error "cap sync 失败" }
    }
    finally { Pop-Location }
}

# ============ 修改 capacitor.config.ts 以适配模式 ============
function Set-Mode {
    param([string]$TargetMode)

    $cfgPath = "$ProjectRoot\capacitor.config.ts"
    $content = Get-Content $cfgPath -Raw -Encoding UTF8

    if ($TargetMode -eq 'live') {
        $ip = Get-WlanIP
        if (!$ip) { Write-Error "获取不到本机 WLAN IP" }

        # 构造要插入的 server 块
        $serverBlock = @"
  server: {
    url: 'http://$ip`:3012',
    cleartext: true,
  },
"@

        # 如果已存在 server 块，替换（含多行）
        if ($content -match '(?ms)server\s*:\s*\{') {
            # 找到 server: { 起始，向后配对数直到 } 闭合
            $startIdx = [regex]::Match($content, '(?ms)server\s*:\s*\{').Index
            $pos = $content.IndexOf('{', $startIdx)
            $depth = 0
            $endIdx = -1
            for ($i = $pos; $i -lt $content.Length; $i++) {
                if ($content[$i] -eq '{') { $depth++ }
                elseif ($content[$i] -eq '}') {
                    $depth--
                    if ($depth -eq 0) { $endIdx = $i; break }
                }
            }
            # 把 server: { ... } 整段（以及后面可能跟的 ,）替换
            $before = $content.Substring(0, $startIdx)
            $after  = $content.Substring($endIdx + 1).TrimStart(',', ' ', "`t", "`r", "`n")
            $content = $before + $serverBlock + "`n  " + $after
        }
        else {
            # 没有 server 块，插入到 android: { 前
            $content = $content -replace '(?ms)(\s*android\s*:\s*\{)', "`n$serverBlock`n`$1"
        }

        # 检查 vite.config.ts 的 server.host
        $vitePath = "$ProjectRoot\vite.config.ts"
        $viteContent = Get-Content $vitePath -Raw -Encoding UTF8
        if ($viteContent -notmatch "host\s*:\s*'0\.0\.0\.0'") {
            $viteContent = $viteContent -replace "server\s*:\s*\{", "server: {`n    host: '0.0.0.0',"
            Set-Content -Path $vitePath -Value $viteContent -NoNewline -Encoding UTF8
            Write-Host "  已为 vite.config.ts 添加 server.host = '0.0.0.0'" -ForegroundColor Yellow
        }

        Write-Host "  已应用 live 模式" -ForegroundColor Green
        Write-Host "  APP 将连接到: http://$ip`:3012" -ForegroundColor Yellow
    }
    else {
        # release: 移除 server 块
        if ($content -match '(?ms)server\s*:\s*\{') {
            $startIdx = [regex]::Match($content, '(?ms)server\s*:\s*\{').Index
            # 回退到前面的空白（含换行）
            while ($startIdx -gt 0 -and $content[$startIdx - 1] -match '[ \t]') { $startIdx-- }
            if ($startIdx -gt 0 -and $content[$startIdx - 1] -match '[\r\n]') { $startIdx-- }

            $pos = $content.IndexOf('{', [regex]::Match($content, '(?ms)server\s*:\s*\{').Index)
            $depth = 0
            $endIdx = -1
            for ($i = $pos; $i -lt $content.Length; $i++) {
                if ($content[$i] -eq '{') { $depth++ }
                elseif ($content[$i] -eq '}') {
                    $depth--
                    if ($depth -eq 0) { $endIdx = $i; break }
                }
            }
            # 跳过结尾的 , 和空白
            while ($endIdx + 1 -lt $content.Length -and $content[$endIdx + 1] -match '[, \t\r\n]') { $endIdx++ }
            $content = $content.Substring(0, $startIdx) + $content.Substring($endIdx + 1)
        }
        Write-Host "  已应用 release 模式" -ForegroundColor Green
    }

    Set-Content -Path $cfgPath -Value $content -NoNewline -Encoding UTF8
}

# ============ 复制产物到桌面 ============
function Copy-ToDesktop {
    param([string]$DestName)

    $src = "$ProjectRoot\android\app\build\outputs\apk\debug\app-debug.apk"
    if (!(Test-Path $src)) { Write-Error "APK 未生成：$src" }

    $dest = "$Desktop\$DestName"
    Copy-Item $src $dest -Force
    Write-Host "`n[5/5] 复制到桌面：$dest" -ForegroundColor Cyan
    Write-Host "  大小：$([math]::Round((Get-Item $dest).Length/1MB, 2)) MB" -ForegroundColor Green
}

# ============ 主流程 ============
Write-Host "======================================" -ForegroundColor Magenta
Write-Host " PlanFlow APK Builder" -ForegroundColor Magenta
Write-Host " Mode: $Mode" -ForegroundColor Magenta
Write-Host "======================================" -ForegroundColor Magenta

Check-Env
Build-Web

if ($Mode -eq 'live' -or $Mode -eq 'both') {
    Write-Host "`n--- Live Reload 版本 ---" -ForegroundColor Yellow
    Set-Mode 'live'
    Sync-Capacitor
    Run-Gradle
    Copy-ToDesktop -DestName 'PlanFlow-livereload.apk'
}

if ($Mode -eq 'release' -or $Mode -eq 'both') {
    Write-Host "`n--- Release 版本 ---" -ForegroundColor Yellow
    Set-Mode 'release'
    Sync-Capacitor
    Run-Gradle
    Copy-ToDesktop -DestName 'PlanFlow-release.apk'
}

Write-Host "`n======================================" -ForegroundColor Magenta
Write-Host " 完成！APK 在桌面上。" -ForegroundColor Green
Write-Host " 安装方式：USB 传输 / 微信文件助手 / adb install" -ForegroundColor Gray
Write-Host " Live 模式：启动 npm run dev，手机连同一 WiFi 打开 APP 即可热更新" -ForegroundColor Gray
Write-Host "======================================" -ForegroundColor Magenta
