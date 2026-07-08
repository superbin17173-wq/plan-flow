#!/bin/bash
# PlanFlow OTA 一键部署脚本
# 用法: bash scripts/deploy-ota.sh <服务器IP> [SSH用户]

SERVER_IP=${1:-""}
SSH_USER=${2:-"root"}

if [ -z "$SERVER_IP" ]; then
  echo "用法: bash scripts/deploy-ota.sh <服务器IP> [SSH用户]"
  echo "示例: bash scripts/deploy-ota.sh 123.45.67.89 root"
  exit 1
fi

echo "=== PlanFlow OTA 部署 ==="
echo "服务器: $SERVER_IP"
echo "用户: $SSH_USER"

# 1. 打包
echo "\n[1] 打包构建..."
npm run build:ota

if [ ! -d "dist" ]; then
  echo "错误: dist 目录不存在"
  exit 1
fi

# 2. 上传
echo "\n[2] 上传到服务器..."
ssh $SSH_USER@$SERVER_IP "mkdir -p /var/www/planflow/dist"
scp -r dist/* $SSH_USER@$SERVER_IP:/var/www/planflow/dist/

# 3. 验证
echo "\n[3] 验证上传..."
ssh $SSH_USER@$SERVER_IP "ls -la /var/www/planflow/dist/"

echo "\n✅ 部署完成！"
echo "OTA 更新地址: http://$SERVER_IP/version.json"
echo "\n测试命令:"
echo "curl http://$SERVER_IP/version.json"