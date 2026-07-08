#!/bin/bash
# PlanFlow 服务器安全加固脚本
# 用法: ssh root@服务器IP 'bash -s' < scripts/harden-server.sh

set -e

echo "=== PlanFlow 服务器安全加固 ==="

# 1. 安装 fail2ban（防暴力破解）
echo "[1] 安装 fail2ban..."
apt update -qq
apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'F2B'
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
F2B

systemctl enable fail2ban
systemctl restart fail2ban
echo "   fail2ban: 3次失败登录自动封IP 1小时"

# 2. 禁用密码登录，仅允许密钥
echo "[2] 加固 SSH..."
SSH_CONFIG="/etc/ssh/sshd_config"

# 备份
cp $SSH_CONFIG ${SSH_CONFIG}.bak

# 禁用密码认证
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' $SSH_CONFIG
sed -i 's/^#*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' $SSH_CONFIG

# 禁用 root 密码登录（保留密钥登录）
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' $SSH_CONFIG

# 重启 SSH
systemctl reload sshd
echo "   SSH: 已禁用密码登录，仅允许密钥"

# 3. 安装 Nginx
echo "[3] 安装 Nginx..."
apt install -y nginx

# 配置 PlanFlow OTA
cat > /etc/nginx/sites-available/planflow << 'NGINX'
server {
    listen 80;
    server_name _;

    root /var/www/planflow/dist;
    index index.html;

    # OTA 更新文件 - 禁止缓存
    location ~* \.(json|zip)$ {
        expires 0;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Access-Control-Allow-Origin "*";
    }

    # 静态资源 - 长缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
        add_header Access-Control-Allow-Origin "*";
    }
}
NGINX

# 启用站点
ln -sf /etc/nginx/sites-available/planflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl enable nginx && systemctl restart nginx

# 创建目录
mkdir -p /var/www/planflow/dist

echo ""
echo "=== 加固完成 ==="
echo "fail2ban: 3次SSH失败 → 封IP 1小时"
echo "SSH: 仅允许密钥登录，密码已禁用"
echo "Nginx: 80端口已就绪"
echo "OTA目录: /var/www/planflow/dist"
echo ""
echo "⚠️  重要: 请确保你已配置 SSH 密钥再执行此脚本！"
echo "    否则会锁死无法登录！"