#!/usr/bin/env bash
# ============================================================================
# PlanFlow Android APK 通用打包脚本（bash 版，跨机器、跨用户）
# 用法:
#   bash scripts/build-apk/build.sh [live|release|both]   # 打包
#   bash scripts/build-apk/build.sh detect                # 仅检测环境
#   bash scripts/build-apk/build.sh init                  # 交互式生成配置
#   bash scripts/build-apk/build.sh set-config <key> <val>
#   bash scripts/build-apk/build.sh firewall              # 放行端口（非 Windows）
#
# 配置文件位置：~/.planflow-build/config.json
#
# 环境要求（未装会提示）：
#   JDK 21+ / Android SDK (platform-tools, build-tools, platforms) / Node 18+
# ============================================================================

set -euo pipefail

CMD="${1:-live}"
CONFIG_KEY="${2:-}"
CONFIG_VAL="${3:-}"

# ============ 路径常量 ============
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_DIR="${PLANFLOW_CONFIG_DIR:-${HOME}/.planflow-build}"
CONFIG_FILE="$CONFIG_DIR/config.json"

# ============ 默认配置（bash 用关联数组模拟，需要 bash 4+；退化为 env 变量） ============
# 为了兼容 macOS 自带的旧 bash，用普通变量 + 函数封装
: "${PLANFLOW_JDK:=}"
: "${PLANFLOW_SDK:=}"
: "${PLANFLOW_VITE_PORT:=3012}"
: "${PLANFLOW_AUTO_INSTALL_JDK:=true}"
: "${PLANFLOW_AUTO_INSTALL_SDK:=true}"

# ============ 配置文件读写 ============
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        # 用 grep + sed 简单解析 JSON 关键字段（避免依赖 jq/python）
        PLANFLOW_JDK=$(grep -o '"jdkPath"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" 2>/dev/null | sed -E 's/.*"([^"]+)"$/\1/' || true)
        PLANFLOW_SDK=$(grep -o '"androidSdkPath"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" 2>/dev/null | sed -E 's/.*"([^"]+)"$/\1/' || true)
        local port
        port=$(grep -o '"vitePort"[[:space:]]*:[[:space:]]*[0-9]*' "$CONFIG_FILE" 2>/dev/null | grep -o '[0-9]*$' || true)
        [[ -n "$port" ]] && PLANFLOW_VITE_PORT=$port
        local auto_jdk
        auto_jdk=$(grep -o '"autoInstallJdk"[[:space:]]*:[[:space:]]*(true|false)' "$CONFIG_FILE" 2>/dev/null | grep -oE '(true|false)$' || true)
        [[ -n "$auto_jdk" ]] && PLANFLOW_AUTO_INSTALL_JDK=$auto_jdk
        local auto_sdk
        auto_sdk=$(grep -o '"autoInstallSdk"[[:space:]]*:[[:space:]]*(true|false)' "$CONFIG_FILE" 2>/dev/null | grep -oE '(true|false)$' || true)
        [[ -n "$auto_sdk" ]] && PLANFLOW_AUTO_INSTALL_SDK=$auto_sdk
    fi
}

save_config() {
    mkdir -p "$CONFIG_DIR"
    cat > "$CONFIG_FILE" <<EOF
{
  "jdkPath": "${PLANFLOW_JDK:-null}",
  "androidSdkPath": "${PLANFLOW_SDK:-null}",
  "vitePort": ${PLANFLOW_VITE_PORT:-3012},
  "autoInstallJdk": ${PLANFLOW_AUTO_INSTALL_JDK:-true},
  "autoInstallSdk": ${PLANFLOW_AUTO_INSTALL_SDK:-true},
  "copyToDesktop": true
}
EOF
    # 把 null（字符串）替换成 JSON null
    sed -i.bak -E 's/"null"/null/g' "$CONFIG_FILE" 2>/dev/null || \
    sed    -E 's/"null"/null/g' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    rm -f "$CONFIG_FILE.bak"
}

# ============ 环境扫描 ============
find_jdk() {
    # 已配置的 PLANFLOW_JDK 优先
    if [[ -n "$PLANFLOW_JDK" && -x "$PLANFLOW_JDK/bin/java" ]]; then
        local ver
        ver=$("$PLANFLOW_JDK/bin/java" -version 2>&1 | head -n1)
        if [[ $ver =~ \"([0-9]+) ]]; then
            local major="${BASH_REMATCH[1]}"
            (( major >= 21 )) && { echo "$PLANFLOW_JDK"; return 0; }
        fi
    fi

    # 系统 JAVA_HOME
    if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
        local ver
        ver=$("$JAVA_HOME/bin/java" -version 2>&1 | head -n1)
        if [[ $ver =~ \"([0-9]+) ]]; then
            local major="${BASH_REMATCH[1]}"
            (( major >= 21 )) && { echo "$JAVA_HOME"; return 0; }
        fi
    fi

    # 常见路径扫描
    local patterns=(
        "$HOME/jdk-tmp/jdk-"*
        "$HOME/jdk-"*
        "/usr/lib/jvm/java-"*"*/"
        "/Library/Java/JavaVirtualMachines/jdk-"*"*/"
        "$HOME/.sdkman/candidates/java/"*"/"
    )
    for pat in "${patterns[@]}"; do
        for d in $pat; do
            [[ -d "$d" && -x "$d/bin/java" ]] || continue
            local ver
            ver=$("$d/bin/java" -version 2>&1 | head -n1)
            if [[ $ver =~ \"([0-9]+) ]]; then
                local major="${BASH_REMATCH[1]}"
                (( major >= 21 )) && { echo "$d"; return 0; }
            fi
        done
    done
    return 1
}

find_android_sdk() {
    if [[ -n "$PLANFLOW_SDK" && -d "$PLANFLOW_SDK/platform-tools" ]]; then
        echo "$PLANFLOW_SDK"; return 0
    fi
    for var in ANDROID_HOME ANDROID_SDK_ROOT; do
        local v="${!var:-}"
        [[ -n "$v" && -d "$v/platform-tools" ]] && { echo "$v"; return 0; }
    done
    local candidates=(
        "$HOME/Library/Android/sdk"
        "$HOME/Android/Sdk"
        "$HOME/.android/sdk"
        "$LOCALAPPDATA/Android/Sdk"
        "/opt/android-sdk"
    )
    for c in "${candidates[@]}"; do
        [[ -d "$c/platform-tools" ]] && { echo "$c"; return 0; }
    done
    return 1
}

find_node() {
    command -v node 2>/dev/null
}

# ============ 自动安装 ============
install_jdk21() {
    echo ""
    echo "⚠  本机未找到 JDK 21+"
    local install_dir="$HOME/jdk-tmp"
    echo "  将下载 Microsoft OpenJDK 21 便携版到：$install_dir"

    local os_name
    os_name=$(uname -s)
    local arch
    arch=$(uname -m)

    local url zip_name
    case "$os_name" in
        Linux*)
            case "$arch" in
                x86_64)  url="https://aka.ms/download-jdk/microsoft-jdk-21-linux-x64.tar.gz"; zip_name="msjdk21.tar.gz" ;;
                aarch64) url="https://aka.ms/download-jdk/microsoft-jdk-21-linux-aarch64.tar.gz"; zip_name="msjdk21.tar.gz" ;;
                *) echo "不支持的架构：$arch"; return 1 ;;
            esac
            ;;
        Darwin*)
            case "$arch" in
                x86_64)  url="https://aka.ms/download-jdk/microsoft-jdk-21-macos-x64.tar.gz"; zip_name="msjdk21.tar.gz" ;;
                arm64)   url="https://aka.ms/download-jdk/microsoft-jdk-21-macos-aarch64.tar.gz"; zip_name="msjdk21.tar.gz" ;;
                *) echo "不支持的架构：$arch"; return 1 ;;
            esac
            ;;
        MINGW*|MSYS*|CYGWIN*)
            url="https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip"
            zip_name="msjdk21.zip"
            ;;
        *)
            echo "不支持的系统：$os_name"
            return 1
            ;;
    esac

    read -rp "  继续下载？[Y/n] " ans
    case "$ans" in
        [nN]*) echo "已取消"; return 1 ;;
    esac

    mkdir -p "$install_dir"
    cd "$install_dir"
    echo "  下载中..."
    if command -v curl >/dev/null; then curl -L -o "$zip_name" "$url"
    elif command -v wget >/dev/null; then wget -O "$zip_name" "$url"
    else echo "需要 curl 或 wget"; return 1
    fi

    echo "  解压中..."
    case "$zip_name" in
        *.tar.gz) tar -xzf "$zip_name" ;;
        *.zip)
            if command -v unzip >/dev/null; then unzip -q "$zip_name"
            else echo "需要 unzip"; return 1
            fi
            ;;
    esac
    rm -f "$zip_name"

    # 递归找 jdk-* 目录
    local jdk_dir
    jdk_dir=$(find "$install_dir" -maxdepth 2 -type d -name "jdk-*" -print -quit)
    if [[ -n "$jdk_dir" && -x "$jdk_dir/bin/java" ]]; then
        echo "  ✓ JDK 安装到：$jdk_dir"
        echo "$jdk_dir"
        return 0
    fi
    return 1
}

install_android_sdk() {
    echo ""
    echo "⚠  本机未找到 Android SDK"
    local install_dir
    case "$(uname -s)" in
        Darwin*) install_dir="$HOME/Library/Android/sdk" ;;
        *) install_dir="$HOME/Android/Sdk" ;;
    esac
    echo "  将安装 Android cmdline-tools 到：$install_dir"
    read -rp "  继续？[Y/n] " ans
    case "$ans" in
        [nN]*) echo "已取消，请手动安装 Android Studio 后设置 ANDROID_HOME"; return 1 ;;
    esac

    mkdir -p "$install_dir"
    local url="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
    case "$(uname -s)" in
        Darwin*) url="https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip" ;;
        MINGW*|MSYS*|CYGWIN*) url="https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" ;;
    esac
    local tmp_zip="$install_dir/cmdline-tools.zip"
    echo "  下载中..."
    curl -L -o "$tmp_zip" "$url" || { echo "下载失败"; return 1; }

    echo "  解压..."
    unzip -q "$tmp_zip" -d "$install_dir/cmdline-tools-tmp"
    rm -f "$tmp_zip"

    mkdir -p "$install_dir/cmdline-tools"
    mv "$install_dir/cmdline-tools-tmp/cmdline-tools" "$install_dir/cmdline-tools/latest" 2>/dev/null || true
    rm -rf "$install_dir/cmdline-tools-tmp"

    local sdk_mgr="$install_dir/cmdline-tools/latest/bin/sdkmanager"
    [[ ! -x "$sdk_mgr" ]] && sdk_mgr="$install_dir/cmdline-tools/latest/bin/sdkmanager.bat"

    local jdk
    jdk=$(find_jdk)
    [[ -z "$jdk" ]] && { echo "需要 JDK 才能安装 SDK，请先装 JDK"; return 1; }
    export JAVA_HOME="$jdk"

    echo "  安装 platform-tools / platforms / build-tools..."
    yes | "$sdk_mgr" --sdk_root="$install_dir" --install \
        "platform-tools" "platforms;android-36" "build-tools;36.0.0" || true

    if [[ -d "$install_dir/platform-tools" ]]; then
        echo "  ✓ Android SDK 安装到：$install_dir"
        echo "$install_dir"
        return 0
    fi
    return 1
}

# ============ 环境检测主函数 ============
ensure_env() {
    load_config
    echo ""
    echo "[1/5] 检查环境..."

    local jdk sdk node nodev

    # JDK
    if [[ -n "$PLANFLOW_JDK" && ! -x "$PLANFLOW_JDK/bin/java" ]]; then PLANFLOW_JDK=""; fi
    jdk=$(find_jdk) || jdk=""
    if [[ -z "$jdk" && "$PLANFLOW_AUTO_INSTALL_JDK" == "true" ]]; then
        jdk=$(install_jdk21) || jdk=""
    fi
    [[ -z "$jdk" ]] && { echo "✗ 未找到 JDK 21+。运行: bash build.sh init 或 .\\build.ps1 -Init"; exit 1; }
    PLANFLOW_JDK="$jdk"
    echo "  JDK    : $jdk"

    # Android SDK
    if [[ -n "$PLANFLOW_SDK" && ! -d "$PLANFLOW_SDK/platform-tools" ]]; then PLANFLOW_SDK=""; fi
    sdk=$(find_android_sdk) || sdk=""
    if [[ -z "$sdk" && "$PLANFLOW_AUTO_INSTALL_SDK" == "true" ]]; then
        sdk=$(install_android_sdk) || sdk=""
    fi
    [[ -z "$sdk" ]] && { echo "✗ 未找到 Android SDK。运行: bash build.sh init 或安装 Android Studio"; exit 1; }
    PLANFLOW_SDK="$sdk"
    echo "  SDK    : $sdk"

    # Node
    node=$(find_node) || { echo "✗ Node.js 未找到"; exit 1; }
    nodev=$(node -v)
    echo "  Node   : $nodev ($node)"

    save_config
}

# ============ 获取 WLAN IP ============
get_wlan_ip() {
    local ip=""
    case "$(uname -s)" in
        Linux*)
            ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
            ;;
        Darwin*)
            ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
            ;;
        MINGW*|MSYS*|CYGWIN*)
            ip=$(powershell.exe -NoProfile -Command "
                (Get-NetIPAddress -AddressFamily IPv4 |
                 Where-Object { \$_.InterfaceAlias -match 'WLAN|Wi-Fi|无线' -and \$_.PrefixOrigin -ne 'WellKnown' } |
                 Select-Object -First 1 -ExpandProperty IPAddress) -replace '\r',''" 2>/dev/null | tr -d '\r')
            ;;
    esac
    echo "$ip"
}

# ============ 构建 web ============
build_web() {
    echo ""
    echo "[2/5] npm install (如需要) + npm run build..."
    cd "$PROJECT_ROOT"
    [[ ! -d node_modules ]] && npm install
    npm run build
}

# ============ 同步 Capacitor ============
sync_cap() {
    echo ""
    echo "[3/5] npx cap sync android..."
    cd "$PROJECT_ROOT"
    [[ ! -d android/gradlew ]] && [[ ! -f android/gradlew.bat ]] && npx cap add android
    npx cap sync android
}

# ============ 修改 capacitor.config.ts ============
set_mode() {
    local mode="$1"
    local cfg="$PROJECT_ROOT/capacitor.config.ts"
    local vite="$PROJECT_ROOT/vite.config.ts"

    if [[ "$mode" == "live" ]]; then
        local ip
        ip=$(get_wlan_ip)
        [[ -z "$ip" ]] && { echo "✗ 获取不到本机 WLAN IP"; exit 1; }

        # 使用 python（通用）或 awk 来修改 TS 文件
        if command -v python3 >/dev/null; then
            python3 - "$cfg" "$ip" "$PLANFLOW_VITE_PORT" <<'PY'
import re, sys
path, ip, port = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, encoding='utf-8') as f: s = f.read()
block = f"  server: {{\n    url: 'http://{ip}:{port}',\n    cleartext: true,\n  }},"
m = re.search(r'server\s*:\s*\{', s)
if m:
    pos = s.index('{', m.start()); d = 0; end = -1
    for i in range(pos, len(s)):
        if s[i] == '{': d += 1
        elif s[i] == '}':
            d -= 1
            if d == 0: end = i; break
    s = s[:m.start()] + block + '\n  ' + s[end+1:].lstrip(', \t\r\n')
else:
    s = re.sub(r'(\s*android\s*:\s*\{)', '\n' + block + r'\1', s, count=1, flags=re.S)
with open(path, 'w', encoding='utf-8') as f: f.write(s)
print(f"  ✓ 已应用 live 模式，APP 连接到 http://{ip}:{port}")
PY
        elif command -v awk >/dev/null; then
            # awk 后备方案（略）
            echo "  警告：需要 python3 或 awk 才能修改 capacitor.config.ts，请手动编辑"
        fi

        # vite.config.ts host
        if ! grep -q "host: '0.0.0.0'" "$vite" 2>/dev/null; then
            if command -v python3 >/dev/null; then
                python3 - "$vite" <<'PY'
import re, sys
p = sys.argv[1]
with open(p, encoding='utf-8') as f: s = f.read()
if 'host:' not in s.split('server')[1].split('}')[0] if 'server' in s else '':
    s = s.replace('server: {', "server: {\n    host: '0.0.0.0',", 1)
with open(p, 'w', encoding='utf-8') as f: f.write(s)
PY
                echo "  ✓ 已为 vite.config.ts 添加 server.host = '0.0.0.0'"
            fi
        fi
    else
        if command -v python3 >/dev/null; then
            python3 - "$cfg" <<'PY'
import re, sys
p = sys.argv[1]
with open(p, encoding='utf-8') as f: s = f.read()
m = re.search(r'server\s*:\s*\{', s)
if m:
    pos = s.index('{', m.start()); d = 0; end = -1
    for i in range(pos, len(s)):
        if s[i] == '{': d += 1
        elif s[i] == '}':
            d -= 1
            if d == 0: end = i; break
    s = s[:m.start()].rstrip() + '\n  ' + s[end+1:].lstrip(', \t\r\n')
with open(p, 'w', encoding='utf-8') as f: f.write(s)
print("  ✓ 已应用 release 模式")
PY
        fi
    fi
}

# ============ Gradle ============
run_gradle() {
    export JAVA_HOME="$PLANFLOW_JDK"
    export ANDROID_HOME="$PLANFLOW_SDK"
    export ANDROID_SDK_ROOT="$PLANFLOW_SDK"
    export PATH="$PLANFLOW_JDK/bin:$PATH"

    local local_props="$PROJECT_ROOT/android/local.properties"
    if [[ ! -f "$local_props" ]]; then
        local sdk_win_path
        sdk_win_path=$(echo "$PLANFLOW_SDK" | sed 's|/|\\\\|g')
        echo "sdk.dir=$sdk_win_path" > "$local_props"
    fi

    echo ""
    echo "[4/5] 运行 gradlew assembleDebug (首次可能 5-10 分钟)..."
    cd "$PROJECT_ROOT/android"
    if [[ -f gradlew.bat ]] && [[ "$(uname -s)" =~ MINGW|MSYS|CYGWIN ]]; then
        cmd //c "gradlew.bat assembleDebug --no-daemon"
    else
        ./gradlew assembleDebug --no-daemon
    fi
}

# ============ 复制产物 ============
copy_apk() {
    local name="$1"
    local src="$PROJECT_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
    [[ ! -f "$src" ]] && { echo "✗ APK 未生成：$src"; exit 1; }

    local desktop=""
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) desktop="$USERPROFILE/Desktop" ;;
        *) desktop="$HOME/Desktop" ;;
    esac
    [[ ! -d "$desktop" ]] && desktop="$PROJECT_ROOT"

    local dest="$desktop/$name"
    cp "$src" "$dest"
    local size
    size=$(du -h "$dest" | awk '{print $1}')
    echo ""
    echo "[5/5] 复制到：$dest ($size)"
}

# ============ 子命令：detect ============
do_detect() {
    load_config
    echo ""
    echo "=== 环境检测结果 ==="
    local jdk sdk node ip
    jdk=$(find_jdk) || jdk=""
    sdk=$(find_android_sdk) || sdk=""
    node=$(find_node) || node=""
    ip=$(get_wlan_ip)

    if [[ -n "$jdk" ]]; then echo "  ✓ JDK 21+    : $jdk"
    else echo "  ✗ JDK 21+    : 未找到"; fi

    if [[ -n "$sdk" ]]; then echo "  ✓ Android SDK: $sdk"
    else echo "  ✗ Android SDK: 未找到"; fi

    if [[ -n "$node" ]]; then
        echo "  ✓ Node       : $(node -v) ($node)"
    else echo "  ✗ Node       : 未找到"; fi

    [[ -n "$ip" ]] && echo "  WLAN IP    : $ip"
    echo ""
    echo "  配置文件   : $CONFIG_FILE"
}

# ============ 子命令：init ============
do_init() {
    echo ""
    echo "=== 交互式初始化配置 ==="
    load_config

    read -rp "  自动下载安装缺失的 JDK 21？[Y/n] " ans
    case "$ans" in [nN]*) PLANFLOW_AUTO_INSTALL_JDK=false ;; *) PLANFLOW_AUTO_INSTALL_JDK=true ;; esac

    read -rp "  自动下载安装缺失的 Android SDK？[Y/n] " ans
    case "$ans" in [nN]*) PLANFLOW_AUTO_INSTALL_SDK=false ;; *) PLANFLOW_AUTO_INSTALL_SDK=true ;; esac

    read -rp "  Vite dev server 端口 [默认 $PLANFLOW_VITE_PORT] " p
    [[ "$p" =~ ^[0-9]+$ ]] && PLANFLOW_VITE_PORT=$p

    local jdk
    jdk=$(find_jdk) || jdk=""
    if [[ -n "$jdk" ]]; then
        echo "  检测到 JDK: $jdk"
        read -rp "  使用这个 JDK？[Y/n/直接输入其他路径] " ans
        case "$ans" in
            ""|[yY]) PLANFLOW_JDK=$jdk ;;
            [nN]) PLANFLOW_JDK="" ;;
            *) [[ -d "$ans" ]] && PLANFLOW_JDK=$ans ;;
        esac
    fi

    local sdk
    sdk=$(find_android_sdk) || sdk=""
    if [[ -n "$sdk" ]]; then
        echo "  检测到 Android SDK: $sdk"
        read -rp "  使用这个 SDK？[Y/n/直接输入其他路径] " ans
        case "$ans" in
            ""|[yY]) PLANFLOW_SDK=$sdk ;;
            [nN]) PLANFLOW_SDK="" ;;
            *) [[ -d "$ans" ]] && PLANFLOW_SDK=$ans ;;
        esac
    fi

    save_config
    echo ""
    echo "✓ 配置已保存到 $CONFIG_FILE"
}

# ============ 子命令：set-config ============
do_set_config() {
    [[ -z "$CONFIG_KEY" ]] && { echo "用法: build.sh set-config <key> <value>"; exit 1; }
    load_config
    case "$CONFIG_KEY" in
        jdkPath|jdk) PLANFLOW_JDK=$CONFIG_VAL ;;
        androidSdkPath|sdk) PLANFLOW_SDK=$CONFIG_VAL ;;
        vitePort|port) PLANFLOW_VITE_PORT=$CONFIG_VAL ;;
        autoInstallJdk) PLANFLOW_AUTO_INSTALL_JDK=$CONFIG_VAL ;;
        autoInstallSdk) PLANFLOW_AUTO_INSTALL_SDK=$CONFIG_VAL ;;
        *) echo "未知键：$CONFIG_KEY"; exit 1 ;;
    esac
    save_config
    echo "✓ $CONFIG_KEY = $CONFIG_VAL"
}

# ============ 子命令：firewall ============
do_firewall() {
    load_config
    case "$(uname -s)" in
        Linux*) echo "请手动: sudo ufw allow $PLANFLOW_VITE_PORT/tcp" ;;
        Darwin*) echo "请手动：系统偏好设置 → 安全性与隐私 → 防火墙 → 选项 → 允许传入连接" ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "将以管理员权限添加防火墙规则：放行 TCP $PLANFLOW_VITE_PORT 入站"
            powershell.exe -Command "Start-Process powershell -ArgumentList '-NoProfile -Command \"New-NetFirewallRule -DisplayName ''Vite Dev $PLANFLOW_VITE_PORT'' -Direction Inbound -Protocol TCP -LocalPort $PLANFLOW_VITE_PORT -Action Allow\"' -Verb RunAs -Wait"
            ;;
    esac
}

# ============ 主流程 ============
echo "======================================"
echo " PlanFlow APK Builder (bash)"
echo " Command: $CMD"
echo "======================================"

case "$CMD" in
    detect) do_detect ;;
    init) do_init ;;
    set-config) do_set_config ;;
    firewall) do_firewall ;;
    live|release|both)
        ensure_env
        build_web

        if [[ "$CMD" == "live" || "$CMD" == "both" ]]; then
            echo ""
            echo "--- Live Reload 版本 ---"
            set_mode live
            sync_cap
            run_gradle
            copy_apk "PlanFlow-livereload.apk"
        fi
        if [[ "$CMD" == "release" || "$CMD" == "both" ]]; then
            echo ""
            echo "--- Release 版本 ---"
            set_mode release
            sync_cap
            run_gradle
            copy_apk "PlanFlow-release.apk"
        fi

        echo ""
        echo "======================================"
        echo " ✓ 完成！APK 已放到桌面"
        echo "   安装：USB / 微信文件助手 / adb install"
        echo "   Live 模式：另开窗口 npm run dev，手机连同一 WiFi 打开 APP"
        echo "======================================"
        ;;
    *)
        echo "用法：bash $0 [live|release|both|detect|init|set-config|firewall]"
        exit 1
        ;;
esac
