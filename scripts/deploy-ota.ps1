# PlanFlow OTA 一键部署脚本 (Windows PowerShell)
# 用法: .\scripts\deploy-ota.ps1 -ServerIP <服务器IP> [-SSHUser root]

param(
  [Parameter(Mandatory=$true)]
  [string]$ServerIP,

  [string]$SSHUser = "root"
)

Write-Host "=== PlanFlow OTA 部署 ===" -ForegroundColor Cyan
Write-Host "服务器: $ServerIP"
Write-Host "用户: $SSHUser"

# 1. 打包
Write-Host "\n[1] 打包构建..." -ForegroundColor Yellow
npm run build:ota

if (-not (Test-Path "dist")) {
  Write-Host "错误: dist 目录不存在" -ForegroundColor Red
  exit 1
}

# 2. 上传 (使用 scp，需安装 OpenSSH 或 Git Bash)
Write-Host "\n[2] 上传到服务器..." -ForegroundColor Yellow
# Windows 上使用 scp（Git Bash 自带）
$distPath = "dist/*"
$remotePath = "$SSHUser@$ServerIP:/var/www/planflow/dist/"

# 先创建目录
ssh $SSHUser@$ServerIP "mkdir -p /var/www/planflow/dist"

# 使用 pscp (PuTTY) 或 scp
if (Get-Command scp -ErrorAction SilentlyContinue) {
  scp -r $distPath $remotePath
} elseif (Get-Command pscp -ErrorAction SilentlyContinue) {
  pscp -r $distPath $remotePath
} else {
  Write-Host "警告: 未找到 scp 命令，请手动上传 dist/ 目录" -ForegroundColor Red
  Write-Host "或使用 WinSCP/FileZilla 上传到 /var/www/planflow/dist/"
  exit 1
}

# 3. 验证
Write-Host "\n[3] 验证上传..." -ForegroundColor Yellow
ssh $SSHUser@$ServerIP "ls -la /var/www/planflow/dist/"

Write-Host "\n✅ 部署完成！" -ForegroundColor Green
Write-Host "OTA 更新地址: http://$ServerIP/version.json"
Write-Host "\n测试: curl http://$ServerIP/version.json"