#!/usr/bin/env bash
# PlanFlow Android APK 打包脚本（bash 版，Git Bash / WSL / MSYS2 均可）
# 用法: bash scripts/build-apk/build.sh [live|release|both]
# 默认: live

set -euo pipefail

MODE="${1:-live}"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
JDK21="/c/Users/ljadmin/jdk-tmp/jdk-21.0.11+10"
ANDROID_SDK="/c/Users/ljadmin/AppData/Local/Android/Sdk"
DESKTOP="$USERPROFILE/Desktop"

# ============ 环境检查 ============
check_env() {
    echo ""
    echo "[1/5] 检查环境..."
    [[ -x "$JDK21/bin/java" ]] || { echo "ERROR: JDK 21 未找到: $JDK21"; exit 1; }
    [[ -d "$ANDROID_SDK/platform-tools" ]] || { echo "ERROR: Android SDK 未找到: $ANDROID_SDK"; exit 1; }
    command -v node >/dev/null || { echo "ERROR: Node.js 未找到"; exit 1; }

    echo "  JDK 21      : $JDK21"
    echo "  Android SDK : $ANDROID_SDK"
    echo "  Node        : $(node -v)"
}

# ============ 获取本机 WLAN IP ============
get_wlan_ip() {
    local ip=""
    if command -v powershell.exe >/dev/null; then
        ip=$(powershell.exe -NoProfile -Command "
            (Get-NetIPAddress -AddressFamily IPv4 |
             Where-Object { \$_.InterfaceAlias -match 'WLAN|Wi-Fi|无线' } |
             Select-Object -First 1 -ExpandProperty IPAddress) -replace '\r',''" 2>/dev/null | tr -d '\r')
    fi
    [[ -z "$ip" ]] && ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [[ -z "$ip" ]] && ip="10.6.4.111"  # 回退到已知 IP
    echo "$ip"
}

# ============ 设置环境并执行 Gradle ============
run_gradle() {
    export JAVA_HOME="$JDK21"
    export ANDROID_HOME="$ANDROID_SDK"
    export ANDROID_SDK_ROOT="$ANDROID_SDK"
    export PATH="$JDK21/bin:$PATH"

    echo ""
    echo "[4/5] 运行 gradlew assembleDebug (首次可能需 5-10 分钟)..."
    cd "$PROJECT_ROOT/android"
    ./gradlew.bat assembleDebug --no-daemon
    cd "$PROJECT_ROOT"
}

# ============ 构建 web 资源 ============
build_web() {
    echo ""
    echo "[2/5] npm run build..."
    cd "$PROJECT_ROOT"
    npm run build
}

# ============ 同步 Capacitor ============
sync_cap() {
    echo ""
    echo "[3/5] npx cap sync android..."
    cd "$PROJECT_ROOT"
    npx cap sync android
}

# ============ 修改 capacitor.config.ts 以适配模式 ============
set_mode() {
    local mode="$1"
    local cfg="$PROJECT_ROOT/capacitor.config.ts"

    if [[ "$mode" == "live" ]]; then
        local ip
        ip=$(get_wlan_ip)
        # 注入 server 块（用 Python 简单处理，避免 sed 多行的跨平台差异）
        python - "$cfg" "$ip" <<'PY' || { echo "ERROR: python 不可用，请手动改 capacitor.config.ts"; exit 1; }
import re, sys
path, ip = sys.argv[1], sys.argv[2]
with open(path, encoding='utf-8') as f:
    s = f.read()
server_block = f"  server: {{\n    url: 'http://{ip}:3012',\n    cleartext: true,\n  }},"
if re.search(r'server\s*:\s*\{', s):
    s = re.sub(r'server\s*:\s*\{[^}]*\},?\s*', server_block + '\n  ', s, flags=re.S)
else:
    s = s.replace('android: {', server_block + '\n  android: {', 1)
with open(path, 'w', encoding='utf-8') as f:
    f.write(s)
print(f"  已应用 live 模式，连接到 http://{ip}:3012")
PY

        # 检查 vite.config.ts 的 server.host
        local vite="$PROJECT_ROOT/vite.config.ts"
        if ! grep -q "host: '0.0.0.0'" "$vite"; then
            python - "$vite" <<'PY'
import re, sys
p = sys.argv[1]
with open(p, encoding='utf-8') as f: s = f.read()
s = s.replace("server: {", "server: {\n    host: '0.0.0.0',", 1)
with open(p, 'w', encoding='utf-8') as f: f.write(s)
PY
            echo "  已为 vite.config.ts 添加 server.host = '0.0.0.0'"
        fi
    else
        # release: 移除 server 块
        python - "$cfg" <<'PY'
import re, sys
p = sys.argv[1]
with open(p, encoding='utf-8') as f: s = f.read()
s = re.sub(r'\s*server\s*:\s*\{[^}]*\},?\s*', '\n  ', s, flags=re.S)
with open(p, 'w', encoding='utf-8') as f: f.write(s)
print("  已应用 release 模式")
PY
    fi
}

# ============ 复制产物到桌面 ============
copy_to_desktop() {
    local name="$1"
    local src="$PROJECT_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
    [[ -f "$src" ]] || { echo "ERROR: APK 未生成: $src"; exit 1; }
    local dest="$DESKTOP/$name"
    cp "$src" "$dest"
    local size
    size=$(du -m "$dest" | awk '{print $1}')
    echo ""
    echo "[5/5] 复制到桌面：$dest (${size} MB)"
}

# ============ 主流程 ============
echo "======================================"
echo " PlanFlow APK Builder"
echo " Mode: $MODE"
echo "======================================"

check_env
build_web

if [[ "$MODE" == "live" || "$MODE" == "both" ]]; then
    echo ""
    echo "--- Live Reload 版本 ---"
    set_mode live
    sync_cap
    run_gradle
    copy_to_desktop 'PlanFlow-livereload.apk'
fi

if [[ "$MODE" == "release" || "$MODE" == "both" ]]; then
    echo ""
    echo "--- Release 版本 ---"
    set_mode release
    sync_cap
    run_gradle
    copy_to_desktop 'PlanFlow-release.apk'
fi

echo ""
echo "======================================"
echo " 完成！APK 在桌面上。"
echo " 安装方式：USB 传输 / 微信文件助手 / adb install"
echo " Live 模式：启动 npm run dev，手机连同一 WiFi 打开 APP 即可热更新"
echo "======================================"
