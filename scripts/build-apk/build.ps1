<#
.SYNOPSIS
    PlanFlow Android APK 通用打包脚本（跨机器、跨用户）
.DESCRIPTION
    把 Vue 项目打成 Android APK，支持两种模式：
      live    - Live Reload 模式，APP 连接电脑 dev server，改代码手机秒刷（默认）
      release - 生产模式，APP 加载打包好的静态资源，可离线运行
      both    - 两种都打

    特性：
      - 首次运行自动扫描本机 JDK 21+ / Android SDK / Node，找到就复用
      - 找不到就交互式引导安装（支持自动下载 JDK 21 便携版 + Android cmdline-tools）
      - 配置持久化到 ~/.planflow-build/config.json，换机器只装一次
      - 支持 -Detect / -Init / -SetConfig / -Firewall 等管理命令
.PARAMETER Mode
    打包模式：live / release / both（默认 live）
.EXAMPLE
    .\build.ps1                       # 默认 live 模式
    .\build.ps1 release               # 生产正式版
    .\build.ps1 both                  # 两种都打
    .\build.ps1 -Detect               # 仅检测环境，不构建
    .\build.ps1 -Init                 # 交互生成配置文件
    .\build.ps1 -SetConfig jdk "C:\jdk21"   # 手动指定 JDK 路径
    .\build.ps1 -Firewall             # 放行 vite dev server 端口
#>

[CmdletBinding(DefaultParameterSetName='Build')]
param(
    [Parameter(ParameterSetName='Build', Position=0)]
    [ValidateSet('live', 'release', 'both')]
    [string]$Mode = 'live',

    [Parameter(ParameterSetName='Detect')]
    [switch]$Detect,

    [Parameter(ParameterSetName='Init')]
    [switch]$Init,

    [Parameter(ParameterSetName='SetConfig')]
    [switch]$SetConfig,

    [Parameter(ParameterSetName='Firewall')]
    [switch]$Firewall,

    # -SetConfig 时的两个参数：key 和 value
    [Parameter(Position=1)]
    [string]$ConfigKey,
    [Parameter(Position=2)]
    [string]$ConfigValue
)

$ErrorActionPreference = 'Stop'

# ============ 项目常量 ============
$script:ProjectRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName
$script:ConfigDir   = Join-Path $env:USERPROFILE '.planflow-build'
$script:ConfigFile  = Join-Path $script:ConfigDir 'config.json'
$script:Desktop     = [Environment]::GetFolderPath('Desktop')

# ============ 默认配置 ============
function Get-DefaultConfig {
    @{
        jdkPath         = $null   # 自动检测 / 手动设置
        androidSdkPath  = $null
        nodePath        = $null
        vitePort        = 3012
        viteHost        = '0.0.0.0'
        autoInstallJdk  = $true
        autoInstallSdk  = $true
        copyToDesktop   = $true
    }
}

function Load-Config {
    if (Test-Path $script:ConfigFile) {
        try {
            $raw = Get-Content $script:ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
            $cfg = Get-DefaultConfig
            foreach ($k in @($cfg.Keys)) {
                if ($null -ne $raw.$k) { $cfg[$k] = $raw.$k }
            }
            return $cfg
        }
        catch {
            Write-Warning "配置文件损坏，已重置：$_"
        }
    }
    return Get-DefaultConfig
}

function Save-Config {
    param([hashtable]$Cfg)
    if (!(Test-Path $script:ConfigDir)) { New-Item -ItemType Directory -Path $script:ConfigDir -Force | Out-Null }
    $Cfg | ConvertTo-Json -Depth 4 | Set-Content $script:ConfigFile -Encoding UTF8 -NoNewline
}

# ============ 环境扫描（多候选路径） ============
function Find-Jdk {
    # 1. 系统 JAVA_HOME 若已是 21+
    if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
        $ver = & "$env:JAVA_HOME\bin\java.exe" -version 2>&1 | Select-Object -First 1
        if ($ver -match '"(\d+)') {
            $major = [int]$matches[1]
            if ($major -ge 21) { return $env:JAVA_HOME }
        }
    }
    # 2. 常见安装路径（Windows）
    $candidates = @(
        "$env:USERPROFILE\jdk-tmp\jdk-*"
        "$env:USERPROFILE\jdk-*"
        "$env:ProgramFiles\Microsoft\jdk-*"
        "$env:ProgramFiles\Eclipse Adoptium\jdk-*"
        "$env:ProgramFiles\Java\jdk-*"
        "$env:ProgramFiles\AdoptOpenJDK\jdk-*"
        "$env:ProgramFiles\Zulu\zulu-*"
        "$env:LOCALAPPDATA\Programs\Eclipse Adoptium\jdk-*"
        # macOS
        "/Library/Java/JavaVirtualMachines/jdk-*"
        "$env:HOME/.sdkman/candidates/java/*/bin/java"
    )
    foreach ($pat in $candidates) {
        $dirs = Get-ChildItem -Path $pat -Directory -ErrorAction SilentlyContinue |
                Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') -or
                               Test-Path (Join-Path $_.FullName 'bin/java') } |
                Sort-Object LastWriteTime -Descending
        foreach ($d in $dirs) {
            $javaBin = if (Test-Path (Join-Path $d.FullName 'bin\java.exe')) {
                Join-Path $d.FullName 'bin\java.exe'
            } else {
                Join-Path $d.FullName 'bin/java'
            }
            try {
                $ver = & $javaBin -version 2>&1 | Select-Object -First 1
                if ($ver -match '"(\d+)') {
                    $major = [int]$matches[1]
                    if ($major -ge 21) { return $d.FullName }
                }
            } catch { continue }
        }
    }
    return $null
}

function Find-AndroidSdk {
    # 1. 环境变量
    foreach ($var in @('ANDROID_HOME', 'ANDROID_SDK_ROOT')) {
        $v = [Environment]::GetEnvironmentVariable($var, 'User')
        if (!$v) { $v = [Environment]::GetEnvironmentVariable($var, 'Machine') }
        if (!$v) { $v = (Get-Item "env:$var" -ErrorAction SilentlyContinue).Value }
        if ($v -and (Test-Path "$v\platform-tools")) { return $v }
    }
    # 2. 常见路径
    $candidates = @(
        "$env:LOCALAPPDATA\Android\Sdk"
        "$env:ProgramFiles\Android\android-sdk"
        "$env:ProgramFiles(x86)\Android\android-sdk"
        "$env:USERPROFILE\AppData\Local\Android\Sdk"
        # macOS
        "$env:HOME\Library\Android\sdk"
        "$env:HOME\Android\Sdk"
        # Linux
        "$env:HOME\Android\Sdk"
        "/opt/android-sdk"
    )
    foreach ($p in $candidates) {
        $expanded = [Environment]::ExpandEnvironmentVariables($p)
        if ((Test-Path "$expanded\platform-tools") -or (Test-Path "$expanded/platform-tools")) {
            return $expanded
        }
    }
    return $null
}

function Find-Node {
    $n = Get-Command node -ErrorAction SilentlyContinue
    if ($n) { return $n.Source }
    return $null
}

function Test-AndroidSdkComplete {
    param([string]$SdkPath)
    if (!$SdkPath) { return $false }
    $need = @('platform-tools', 'build-tools', 'platforms')
    foreach ($n in $need) {
        if (!(Test-Path (Join-Path $SdkPath $n)) -and
            !(Test-Path (Join-Path $SdkPath $n.Replace('\', '/')))) { return $false }
    }
    return $true
}

# ============ 自动安装缺失依赖 ============
function Install-Jdk21 {
    Write-Host "`n⚠ 本机未找到 JDK 21+" -ForegroundColor Yellow
    Write-Host "  将下载 Microsoft OpenJDK 21 便携版（约 190MB）到：" -ForegroundColor Gray
    $installDir = Join-Path $env:USERPROFILE 'jdk-tmp'
    Write-Host "  $installDir" -ForegroundColor Cyan
    $ans = Read-Host "  继续？[Y/n]"
    if ($ans -and $ans -notin @('y', 'Y', 'yes', '')) {
        throw "已取消，JDK 21 是必须的（Capacitor 8 硬性要求）。"
    }

    if (!(Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir -Force | Out-Null }
    $zipPath = Join-Path $installDir 'msjdk21.zip'

    Write-Host "`n  下载中..." -ForegroundColor Cyan
    try {
        # 优先 Invoke-WebRequest，失败回退到 curl
        Invoke-WebRequest -Uri 'https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip' `
                          -OutFile $zipPath -UseBasicParsing
    }
    catch {
        Write-Warning "Invoke-WebRequest 失败，尝试 curl..."
        curl.exe -L -o $zipPath 'https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip'
    }

    if (!(Test-Path $zipPath)) { throw "JDK 下载失败" }
    Write-Host "  解压中..." -ForegroundColor Cyan
    Expand-Archive -Path $zipPath -DestinationPath $installDir -Force
    Remove-Item $zipPath -ErrorAction SilentlyContinue

    $jdk = Find-Jdk
    if (!$jdk) { throw "解压完成但未找到 JDK 21，请检查 $installDir" }
    Write-Host "  ✓ JDK 21 安装到：$jdk" -ForegroundColor Green
    return $jdk
}

function Install-AndroidSdk {
    Write-Host "`n⚠ 本机未找到 Android SDK" -ForegroundColor Yellow
    $installDir = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    Write-Host "  将下载 Android cmdline-tools 并安装到：$installDir" -ForegroundColor Gray
    $ans = Read-Host "  继续？[Y/n]"
    if ($ans -and $ans -notin @('y', 'Y', 'yes', '')) {
        throw "已取消，请手动安装 Android Studio 或设置环境变量 ANDROID_HOME。"
    }

    if (!(Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir -Force | Out-Null }
    $zipPath = Join-Path $env:TEMP 'cmdline-tools.zip'

    # 判断系统架构
    $arch = if ([Environment]::Is64BitOperatingSystem) { 'win' } else { 'win' }
    $url = "https://dl.google.com/android/repository/commandlinetools-$arch-11076708_latest.zip"

    Write-Host "`n  下载 cmdline-tools..." -ForegroundColor Cyan
    try { Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing }
    catch { curl.exe -L -o $zipPath $url }

    Write-Host "  解压..." -ForegroundColor Cyan
    Expand-Archive -Path $zipPath -DestinationPath "$installDir\cmdline-tools-tmp" -Force
    Remove-Item $zipPath -ErrorAction SilentlyContinue

    # cmdline-tools 解压出来是 cmdline-tools/ 目录，需要重命名为 cmdline-tools/latest
    $src = "$installDir\cmdline-tools-tmp\cmdline-tools"
    $dst = "$installDir\cmdline-tools\latest"
    if (Test-Path "$installDir\cmdline-tools-tmp") {
        if (!(Test-Path "$installDir\cmdline-tools")) { New-Item -ItemType Directory -Path "$installDir\cmdline-tools" -Force | Out-Null }
        Move-Item $src $dst -Force
        Remove-Item "$installDir\cmdline-tools-tmp" -Recurse -Force -ErrorAction SilentlyContinue
    }

    # 用 sdkmanager 安装必要组件
    $sdkMgr = "$dst\bin\sdkmanager.bat"
    if (!(Test-Path $sdkMgr)) { $sdkMgr = "$dst\bin\sdkmanager" }

    Write-Host "  安装 platform-tools / platforms / build-tools..." -ForegroundColor Cyan
    $env:JAVA_HOME = Find-Jdk
    & $sdkMgr --sdk_root="$installDir" --install "platform-tools" "platforms;android-36" "build-tools;36.0.0" 2>&1 | Out-Host

    if (Test-AndroidSdkComplete $installDir) {
        Write-Host "  ✓ Android SDK 安装到：$installDir" -ForegroundColor Green
        return $installDir
    }
    throw "Android SDK 安装未完成，请手动安装 Android Studio 后重试。"
}

# ============ 环境检测主函数 ============
function Ensure-Env {
    $cfg = Load-Config
    Write-Host "`n[1/5] 检查环境..." -ForegroundColor Cyan

    # JDK
    $jdk = $cfg.jdkPath
    if ($jdk -and !(Test-Path "$jdk\bin\java.exe")) { $jdk = $null }
    if (!$jdk) { $jdk = Find-Jdk }
    if (!$jdk -and $cfg.autoInstallJdk) { $jdk = Install-Jdk21 }
    if (!$jdk) { throw "未找到 JDK 21+。运行 .\build.ps1 -SetConfig jdkPath '路径' 或 .\build.ps1 -Init" }
    $cfg.jdkPath = $jdk
    Write-Host "  JDK    : $jdk" -ForegroundColor Green

    # Android SDK
    $sdk = $cfg.androidSdkPath
    if ($sdk -and !(Test-AndroidSdkComplete $sdk)) { $sdk = $null }
    if (!$sdk) { $sdk = Find-AndroidSdk }
    if (!$sdk -and $cfg.autoInstallSdk) { $sdk = Install-AndroidSdk }
    if (!$sdk) { throw "未找到 Android SDK。运行 .\build.ps1 -SetConfig androidSdkPath '路径' 或安装 Android Studio" }
    $cfg.androidSdkPath = $sdk
    Write-Host "  SDK    : $sdk" -ForegroundColor Green

    # Node
    $node = Find-Node
    if (!$node) {
        throw "Node.js 未找到，请从 https://nodejs.org 安装 LTS 版本。"
    }
    $nodeVer = & node -v
    $cfg.nodePath = (Get-Command node).Source
    Write-Host "  Node   : $nodeVer ($($cfg.nodePath))" -ForegroundColor Green

    Save-Config $cfg
    return $cfg
}

# ============ 获取本机 WLAN IP ============
function Get-WlanIP {
    # Windows
    if ($env:OS -match 'Windows_NT') {
        $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
              Where-Object { $_.InterfaceAlias -match 'WLAN|Wi-Fi|无线' -and $_.PrefixOrigin -ne 'WellKnown' } |
              Select-Object -First 1 -ExpandProperty IPAddress
        if (!$ip) {
            $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                  Where-Object {
                      $_.IPAddress -notin @('127.0.0.1') -and
                      $_.InterfaceAlias -notmatch 'Loopback|虚拟|VPN|VMware|Virtual' -and
                      $_.PrefixOrigin -ne 'WellKnown'
                  } | Select-Object -First 1 -ExpandProperty IPAddress
        }
        return $ip
    }
    # Linux/macOS
    $ip = hostname -I 2>$null | ForEach-Object { ($_ -split '\s+')[0] }
    return $ip
}

# ============ 构建 web ============
function Build-Web {
    Write-Host "`n[2/5] npm install (如需要) + npm run build..." -ForegroundColor Cyan
    Push-Location $script:ProjectRoot
    try {
        if (!(Test-Path 'node_modules')) {
            Write-Host "  node_modules 缺失，执行 npm install..." -ForegroundColor Yellow
            npm install 2>&1 | Out-Host
        }
        npm run build 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "npm run build 失败" }
    }
    finally { Pop-Location }
}

# ============ 同步 Capacitor ============
function Sync-Capacitor {
    Write-Host "`n[3/5] npx cap sync android..." -ForegroundColor Cyan
    Push-Location $script:ProjectRoot
    try {
        if (!(Test-Path 'android\gradlew.bat') -and !(Test-Path 'android\gradlew')) {
            Write-Host "  android 目录缺失，执行 npx cap add android..." -ForegroundColor Yellow
            npx cap add android 2>&1 | Out-Host
        }
        npx cap sync android 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "cap sync 失败" }
    }
    finally { Pop-Location }
}

# ============ 修改 capacitor.config.ts ============
function Set-Mode {
    param([string]$TargetMode, [hashtable]$Cfg)

    $cfgPath  = Join-Path $script:ProjectRoot 'capacitor.config.ts'
    $vitePath = Join-Path $script:ProjectRoot 'vite.config.ts'
    $content  = Get-Content $cfgPath -Raw -Encoding UTF8
    $port     = $Cfg.vitePort

    if ($TargetMode -eq 'live') {
        $ip = Get-WlanIP
        if (!$ip) { throw "获取不到本机 WLAN IP。请手动设置。" }

        $serverBlock = "  server: {`n    url: 'http://$ip`:$port',`n    cleartext: true,`n  },"

        if ($content -match '(?ms)server\s*:\s*\{') {
            $startIdx = [regex]::Match($content, '(?ms)server\s*:\s*\{').Index
            $pos = $content.IndexOf('{', $startIdx)
            $depth = 0; $endIdx = -1
            for ($i = $pos; $i -lt $content.Length; $i++) {
                if ($content[$i] -eq '{') { $depth++ }
                elseif ($content[$i] -eq '}') { $depth--; if ($depth -eq 0) { $endIdx = $i; break } }
            }
            $before = $content.Substring(0, $startIdx)
            $after  = $content.Substring($endIdx + 1).TrimStart(',', ' ', "`t", "`r", "`n")
            $content = $before + $serverBlock + "`n  " + $after
        }
        else {
            $content = $content -replace '(?ms)(\s*android\s*:\s*\{)', "`n$serverBlock`n`$1"
        }

        # 确保 vite.config.ts 监听 0.0.0.0
        $viteContent = Get-Content $vitePath -Raw -Encoding UTF8
        $hostPattern = "host:\s*['" + [char]34 + "]0\.0\.0\.0['" + [char]34 + "]"
        if ($viteContent -notmatch $hostPattern) {
            $viteContent = $viteContent -replace "server\s*:\s*\{", "server: {`n    host: '0.0.0.0',"
            Set-Content -Path $vitePath -Value $viteContent -NoNewline -Encoding UTF8
            Write-Host "  ✓ 已为 vite.config.ts 添加 server.host = '0.0.0.0'" -ForegroundColor Yellow
        }

        Write-Host "  ✓ 已应用 live 模式，APP 连接到 http://$ip`:$port" -ForegroundColor Green
    }
    else {
        if ($content -match '(?ms)server\s*:\s*\{') {
            $startIdx = [regex]::Match($content, '(?ms)server\s*:\s*\{').Index
            while ($startIdx -gt 0 -and $content[$startIdx - 1] -match '[ \t]') { $startIdx-- }
            if ($startIdx -gt 0 -and $content[$startIdx - 1] -match '[\r\n]') { $startIdx-- }
            $pos = $content.IndexOf('{', [regex]::Match($content, '(?ms)server\s*:\s*\{').Index)
            $depth = 0; $endIdx = -1
            for ($i = $pos; $i -lt $content.Length; $i++) {
                if ($content[$i] -eq '{') { $depth++ }
                elseif ($content[$i] -eq '}') { $depth--; if ($depth -eq 0) { $endIdx = $i; break } }
            }
            while ($endIdx + 1 -lt $content.Length -and $content[$endIdx + 1] -match '[, \t\r\n]') { $endIdx++ }
            $content = $content.Substring(0, $startIdx) + $content.Substring($endIdx + 1)
        }
        Write-Host "  ✓ 已应用 release 模式" -ForegroundColor Green
    }

    Set-Content -Path $cfgPath -Value $content -NoNewline -Encoding UTF8
}

# ============ Gradle ============
function Run-Gradle {
    param([hashtable]$Cfg)

    $env:JAVA_HOME = $Cfg.jdkPath
    $env:ANDROID_HOME = $Cfg.androidSdkPath
    $env:ANDROID_SDK_ROOT = $Cfg.androidSdkPath
    $env:PATH = "$($Cfg.jdkPath)\bin;$env:PATH"

    # 写 local.properties（如不存在）
    $localProps = Join-Path $script:ProjectRoot 'android\local.properties'
    if (!(Test-Path $localProps)) {
        $sdkPathWin = $Cfg.androidSdkPath -replace '\\', '\\\\'
        "sdk.dir=$sdkPathWin" | Set-Content $localProps -Encoding UTF8
    }

    Push-Location (Join-Path $script:ProjectRoot 'android')
    try {
        Write-Host "`n[4/5] 运行 gradlew assembleDebug (首次可能 5-10 分钟)..." -ForegroundColor Cyan
        if ($env:OS -match 'Windows_NT') {
            cmd /c "gradlew.bat assembleDebug --no-daemon 2>&1" | ForEach-Object { $_ }
        }
        else {
            ./gradlew assembleDebug --no-daemon 2>&1 | ForEach-Object { $_ }
        }
        if ($LASTEXITCODE -ne 0) { throw "Gradle 编译失败（退出码 $LASTEXITCODE）" }
    }
    finally { Pop-Location }
}

# ============ 复制产物 ============
function Copy-Apk {
    param([string]$DestName)
    $src = Join-Path $script:ProjectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (!(Test-Path $src)) { throw "APK 未生成：$src" }

    $dest = Join-Path $script:Desktop $DestName
    Copy-Item $src $dest -Force
    $sizeMB = [math]::Round((Get-Item $dest).Length/1MB, 2)
    Write-Host "`n[5/5] 复制到桌面：$dest ($sizeMB MB)" -ForegroundColor Cyan
}

# ============ 子命令：-Detect ============
function Invoke-Detect {
    Write-Host "`n=== 环境检测结果 ===" -ForegroundColor Cyan
    $jdk = Find-Jdk
    $sdk = Find-AndroidSdk
    $node = Find-Node

    if ($jdk) { Write-Host "  ✓ JDK 21+    : $jdk" -ForegroundColor Green }
    else      { Write-Host "  ✗ JDK 21+    : 未找到" -ForegroundColor Red }

    if ($sdk -and (Test-AndroidSdkComplete $sdk)) {
        Write-Host "  ✓ Android SDK: $sdk" -ForegroundColor Green
    }
    else { Write-Host "  ✗ Android SDK: 未找到或不完整" -ForegroundColor Red }

    if ($node) {
        $v = & node -v
        Write-Host "  ✓ Node       : $v ($node)" -ForegroundColor Green
    }
    else { Write-Host "  ✗ Node       : 未找到" -ForegroundColor Red }

    $ip = Get-WlanIP
    if ($ip) { Write-Host "`n  WLAN IP    : $ip" -ForegroundColor Gray }
    else     { Write-Host "`n  WLAN IP    : 未连接" -ForegroundColor Yellow }

    Write-Host "`n  配置文件   : $script:ConfigFile" -ForegroundColor Gray
}

# ============ 子命令：-Init ============
function Invoke-Init {
    Write-Host "`n=== 交互式初始化配置 ===" -ForegroundColor Cyan
    $cfg = Get-DefaultConfig

    $ans = Read-Host "  自动下载安装缺失的 JDK 21？[Y/n]"
    $cfg.autoInstallJdk = !($ans -and $ans -match '^[nN]')

    $ans = Read-Host "  自动下载安装缺失的 Android SDK？[Y/n]"
    $cfg.autoInstallSdk = !($ans -and $ans -match '^[nN]')

    $port = Read-Host "  Vite dev server 端口 [默认 3012]"
    if ($port -match '^\d+$') { $cfg.vitePort = [int]$port }

    $jdk = Find-Jdk
    if ($jdk) {
        Write-Host "  检测到 JDK: $jdk" -ForegroundColor Green
        $ans = Read-Host "  使用这个 JDK？[Y/n/直接输入其他路径]"
        if ($ans -and $ans -notin @('y', 'Y', '')) {
            if (Test-Path $ans) { $cfg.jdkPath = $ans }
            else { $cfg.jdkPath = $jdk }
        } else { $cfg.jdkPath = $jdk }
    } else {
        Write-Host "  未检测到 JDK 21+，将在首次打包时自动安装" -ForegroundColor Yellow
    }

    $sdk = Find-AndroidSdk
    if ($sdk) {
        Write-Host "  检测到 Android SDK: $sdk" -ForegroundColor Green
        $ans = Read-Host "  使用这个 SDK？[Y/n/直接输入其他路径]"
        if ($ans -and $ans -notin @('y', 'Y', '')) {
            if (Test-Path $ans) { $cfg.androidSdkPath = $ans }
            else { $cfg.androidSdkPath = $sdk }
        } else { $cfg.androidSdkPath = $sdk }
    } else {
        Write-Host "  未检测到 Android SDK，将在首次打包时自动安装" -ForegroundColor Yellow
    }

    Save-Config $cfg
    Write-Host "`n✓ 配置已保存到 $script:ConfigFile" -ForegroundColor Green
}

# ============ 子命令：-SetConfig key value ============
function Invoke-SetConfig {
    if (!$ConfigKey) { throw "用法：.\build.ps1 -SetConfig <key> <value>" }
    $cfg = Load-Config
    $cfg[$ConfigKey] = switch ($ConfigKey) {
        'vitePort' { [int]$ConfigValue }
        'autoInstallJdk' { $ConfigValue -match '^(true|1|yes|y)$' }
        'autoInstallSdk' { $ConfigValue -match '^(true|1|yes|y)$' }
        'copyToDesktop'  { $ConfigValue -match '^(true|1|yes|y)$' }
        default { $ConfigValue }
    }
    Save-Config $cfg
    Write-Host "✓ $ConfigKey = $($cfg[$ConfigKey])" -ForegroundColor Green
}

# ============ 子命令：-Firewall ============
function Invoke-Firewall {
    $port = (Load-Config).vitePort
    if ($env:OS -notmatch 'Windows_NT') {
        Write-Host "`n非 Windows 系统，请手动放行端口 $port" -ForegroundColor Yellow
        Write-Host "  Linux : sudo ufw allow $port/tcp" -ForegroundColor Gray
        Write-Host "  macOS : 系统偏好设置 → 安全性与隐私 → 防火墙 → 选项 → 允许传入连接" -ForegroundColor Gray
        return
    }

    $existing = Get-NetFirewallRule -Direction Inbound -ErrorAction SilentlyContinue |
                Where-Object { $_.DisplayName -match "Vite Dev $port" } |
                Select-Object -First 1
    if ($existing) {
        Write-Host "✓ 防火墙规则已存在：$($existing.DisplayName)" -ForegroundColor Green
        return
    }

    Write-Host "`n将添加防火墙规则：放行 TCP $port 入站（需要管理员权限）" -ForegroundColor Cyan
    try {
        New-NetFirewallRule -DisplayName "Vite Dev $port" `
                            -Direction Inbound -Protocol TCP `
                            -LocalPort $port -Action Allow | Out-Null
        Write-Host "✓ 防火墙规则已添加" -ForegroundColor Green
    }
    catch {
        Write-Error "添加防火墙规则失败，请以管理员身份重新运行此脚本：`n  $_"
    }
}

# ============ 主流程 ============
$Host.UI.RawUI.WindowTitle = "PlanFlow APK Builder"

try {
    if ($Detect)    { Invoke-Detect; return }
    if ($Init)      { Invoke-Init; return }
    if ($SetConfig) { Invoke-SetConfig; return }
    if ($Firewall)  { Invoke-Firewall; return }

    # 打包主流程
    Write-Host "======================================" -ForegroundColor Magenta
    Write-Host " PlanFlow APK Builder" -ForegroundColor Magenta
    Write-Host " Mode: $Mode" -ForegroundColor Magenta
    Write-Host "======================================" -ForegroundColor Magenta

    $cfg = Ensure-Env
    Build-Web

    if ($Mode -eq 'live' -or $Mode -eq 'both') {
        Write-Host "`n--- Live Reload 版本 ---" -ForegroundColor Yellow
        Set-Mode 'live' $cfg
        Sync-Capacitor
        Run-Gradle $cfg
        Copy-Apk 'PlanFlow-livereload.apk'
    }
    if ($Mode -eq 'release' -or $Mode -eq 'both') {
        Write-Host "`n--- Release 版本 ---" -ForegroundColor Yellow
        Set-Mode 'release' $cfg
        Sync-Capacitor
        Run-Gradle $cfg
        Copy-Apk 'PlanFlow-release.apk'
    }

    Write-Host "`n======================================" -ForegroundColor Magenta
    Write-Host " ✓ 完成！APK 已放到桌面" -ForegroundColor Green
    Write-Host "   安装：USB 传输 / 微信文件助手 / adb install" -ForegroundColor Gray
    Write-Host "   Live 模式：另开窗口运行 npm run dev，手机连同一 WiFi 打开 APP" -ForegroundColor Gray
    Write-Host "======================================" -ForegroundColor Magenta
}
catch {
    Write-Host "`n✗ 失败：$_" -ForegroundColor Red
    exit 1
}
