#!/bin/bash
# AI量化交易系统 - 部署脚本
# 专为网心云OES Plus (Armbian)优化

set -e

echo "========================================"
echo "  AI量化交易系统 - 部署脚本"
echo "  目标设备: 网心云OES Plus"
echo "========================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的信息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    print_warning "请使用sudo运行此脚本"
    exit 1
fi

# 检查系统
if [ ! -f /etc/os-release ]; then
    print_error "无法识别操作系统"
    exit 1
fi

source /etc/os-release
print_info "检测到操作系统: $NAME $VERSION_ID"

# 检查硬件
print_info "检查硬件信息..."
if [ -f /proc/device-tree/model ]; then
    MODEL=$(cat /proc/device-tree/model | tr '\0' ' ')
    print_info "设备型号: $MODEL"
fi

TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
print_info "总内存: ${TOTAL_MEM}MB"

# 设置变量
INSTALL_DIR="/opt/ai-trading"
DATA_DIR="/mnt/sda1/ai-trading-data"  # 使用外接硬盘存储数据
SERVICE_NAME="ai-trading"
USER="ai-trading"

# 创建用户
if ! id "$USER" &>/dev/null; then
    print_info "创建用户: $USER"
    useradd -r -s /bin/false -d "$INSTALL_DIR" "$USER"
fi

# 安装依赖
print_info "安装系统依赖..."
apt-get update
apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    libssl-dev \
    libffi-dev \
    nginx \
    sqlite3 \
    htop \
    vim \
    curl \
    wget \
    git \
    nodejs \
    npm

# 检查外接硬盘
print_info "检查存储设备..."
if [ -d "/mnt/sda1" ]; then
    print_success "检测到外接硬盘 /mnt/sda1"
    mkdir -p "$DATA_DIR"
    chown -R "$USER:$USER" "$DATA_DIR"
else
    print_warning "未检测到外接硬盘 /mnt/sda1，使用默认位置"
    DATA_DIR="$INSTALL_DIR/data"
fi

# 创建安装目录
print_info "创建安装目录..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/backend"
mkdir -p "$INSTALL_DIR/frontend"
mkdir -p "$DATA_DIR"
mkdir -p "$DATA_DIR/logs"

# 复制文件
print_info "复制应用文件..."
cp -r backend/* "$INSTALL_DIR/backend/"
cp -r dist/* "$INSTALL_DIR/frontend/"

# 设置权限
chown -R "$USER:$USER" "$INSTALL_DIR"
chown -R "$USER:$USER" "$DATA_DIR"

# 创建Python虚拟环境
print_info "创建Python虚拟环境..."
cd "$INSTALL_DIR/backend"
python3 -m venv venv
source venv/bin/activate

# 安装Python依赖
print_info "安装Python依赖..."
pip install --upgrade pip
pip install -r requirements.txt

deactivate

# 创建配置文件
print_info "创建配置文件..."
cat > "$INSTALL_DIR/config.env" << 'EOF'
# AI量化交易系统配置

# 服务器配置
HOST=0.0.0.0
PORT=8080
DEBUG=false

# 数据目录
DATA_DIR=/mnt/sda1/ai-trading-data
LOG_DIR=/mnt/sda1/ai-trading-data/logs

# 安全配置
SECRET_KEY=$(openssl rand -hex 32)

# 交易配置（请修改为您的实际配置）
EXCHANGE=binance
SYMBOL=BTCUSDT
TIMEFRAME=1h
ENABLE_TRADING=false

# AI配置
ENABLE_AI=true
AUTO_OPTIMIZE=false
LEARNING_MODE=true
EOF

chown "$USER:$USER" "$INSTALL_DIR/config.env"

# 创建systemd服务
print_info "创建系统服务..."
cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=AI量化交易系统
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR/backend
Environment=PATH=$INSTALL_DIR/backend/venv/bin
Environment=DATA_DIR=$DATA_DIR
Environment=PYTHONUNBUFFERED=1
ExecStart=$INSTALL_DIR/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080 --workers 1
Restart=always
RestartSec=10

# 资源限制（适合4GB内存设备）
LimitAS=2G
LimitRSS=1G
LimitNOFILE=65535

# 日志
StandardOutput=append:$DATA_DIR/logs/app.log
StandardError=append:$DATA_DIR/logs/error.log

[Install]
WantedBy=multi-user.target
EOF

# 创建前端服务（使用nginx）
print_info "配置Nginx..."
cat > "/etc/nginx/sites-available/$SERVICE_NAME" << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /opt/ai-trading/frontend;
    index index.html;
    
    # 前端静态文件
    location / {
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
    
    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket代理
    location /ws {
        proxy_pass http://127.0.0.1:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
    
    # 错误页面
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

# 启用nginx配置
ln -sf "/etc/nginx/sites-available/$SERVICE_NAME" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default
nginx -t

# 创建管理脚本
print_info "创建管理脚本..."
cat > "$INSTALL_DIR/manage.sh" << 'EOF'
#!/bin/bash

ACTION=$1
SERVICE_NAME="ai-trading"

 case $ACTION in
    start)
        echo "启动AI量化交易系统..."
        sudo systemctl start $SERVICE_NAME
        sudo systemctl start nginx
        echo "系统已启动，访问 http://$(hostname -I | awk '{print $1}')"
        ;;
    stop)
        echo "停止AI量化交易系统..."
        sudo systemctl stop $SERVICE_NAME
        sudo systemctl stop nginx
        echo "系统已停止"
        ;;
    restart)
        echo "重启AI量化交易系统..."
        sudo systemctl restart $SERVICE_NAME
        sudo systemctl restart nginx
        echo "系统已重启"
        ;;
    status)
        echo "系统状态:"
        sudo systemctl status $SERVICE_NAME --no-pager
        echo ""
        echo "Nginx状态:"
        sudo systemctl status nginx --no-pager
        ;;
    logs)
        echo "查看日志 (按Ctrl+C退出)..."
        sudo tail -f /mnt/sda1/ai-trading-data/logs/app.log
        ;;
    update)
        echo "更新系统..."
        cd /opt/ai-trading/backend
        source venv/bin/activate
        pip install -r requirements.txt --upgrade
        sudo systemctl restart $SERVICE_NAME
        echo "更新完成"
        ;;
    backup)
        BACKUP_FILE="/mnt/sda1/ai-trading-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        echo "创建备份: $BACKUP_FILE"
        sudo tar -czf $BACKUP_FILE /mnt/sda1/ai-trading-data
        echo "备份完成"
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs|update|backup}"
        exit 1
        ;;
esac
EOF

chmod +x "$INSTALL_DIR/manage.sh"
ln -sf "$INSTALL_DIR/manage.sh" /usr/local/bin/ai-trading

# 创建启动脚本
print_info "创建启动脚本..."
cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash

# AI量化交易系统启动脚本

echo "========================================"
echo "  启动AI量化交易系统"
echo "========================================"

# 检查服务状态
check_service() {
    if systemctl is-active --quiet $1; then
        echo "✓ $1 运行中"
        return 0
    else
        echo "✗ $1 未运行"
        return 1
    fi
}

# 启动服务
echo "启动服务..."
sudo systemctl daemon-reload
sudo systemctl enable ai-trading
sudo systemctl enable nginx

sudo systemctl start ai-trading
sudo systemctl start nginx

sleep 2

echo ""
echo "服务状态:"
check_service "ai-trading"
check_service "nginx"

echo ""
echo "========================================"
echo "  系统已启动!"
echo "  访问地址:"
echo "  - 本地: http://localhost"
echo "  - 局域网: http://$(hostname -I | awk '{print $1}')"
echo "========================================"
echo ""
echo "管理命令:"
echo "  ai-trading start    - 启动系统"
echo "  ai-trading stop     - 停止系统"
echo "  ai-trading restart  - 重启系统"
echo "  ai-trading status   - 查看状态"
echo "  ai-trading logs     - 查看日志"
echo "========================================"
EOF

chmod +x "$INSTALL_DIR/start.sh"

# 重载systemd
print_info "重载systemd配置..."
systemctl daemon-reload

# 设置开机自启
print_info "设置开机自启..."
systemctl enable "$SERVICE_NAME"
systemctl enable nginx

# 创建日志轮转配置
print_info "配置日志轮转..."
cat > "/etc/logrotate.d/$SERVICE_NAME" << EOF
$DATA_DIR/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $USER $USER
    sharedscripts
    postrotate
        systemctl reload $SERVICE_NAME
    endscript
}
EOF

# 创建监控脚本
print_info "创建监控脚本..."
cat > "$INSTALL_DIR/monitor.sh" << 'EOF'
#!/bin/bash

# 系统监控脚本

LOG_FILE="/mnt/sda1/ai-trading-data/logs/monitor.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 检查内存使用
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
log "内存使用率: ${MEMORY_USAGE}%"

if (( $(echo "$MEMORY_USAGE > 85" | bc -l) )); then
    log "警告: 内存使用率过高!"
    # 清理缓存
    sync && echo 3 > /proc/sys/vm/drop_caches
fi

# 检查磁盘使用
DISK_USAGE=$(df -h /mnt/sda1 | tail -1 | awk '{print $5}' | sed 's/%//')
log "磁盘使用率: ${DISK_USAGE}%"

if [ "$DISK_USAGE" -gt 90 ]; then
    log "警告: 磁盘空间不足!"
fi

# 检查服务状态
if ! systemctl is-active --quiet ai-trading; then
    log "错误: ai-trading服务未运行，尝试重启..."
    systemctl restart ai-trading
fi

if ! systemctl is-active --quiet nginx; then
    log "错误: nginx服务未运行，尝试重启..."
    systemctl restart nginx
fi

log "监控检查完成"
EOF

chmod +x "$INSTALL_DIR/monitor.sh"

# 添加定时任务
print_info "添加定时任务..."
(crontab -l 2>/dev/null; echo "*/5 * * * * $INSTALL_DIR/monitor.sh > /dev/null 2>&1") | crontab -

# 完成
print_success "部署完成!"
echo ""
echo "========================================"
echo "  安装信息"
echo "========================================"
echo "安装目录: $INSTALL_DIR"
echo "数据目录: $DATA_DIR"
echo "日志目录: $DATA_DIR/logs"
echo ""
echo "管理命令:"
echo "  ai-trading start    - 启动系统"
echo "  ai-trading stop     - 停止系统"
echo "  ai-trading restart  - 重启系统"
echo "  ai-trading status   - 查看状态"
echo "  ai-trading logs     - 查看日志"
echo "  ai-trading backup   - 备份数据"
echo ""
echo "启动系统:"
echo "  $INSTALL_DIR/start.sh"
echo ""
echo "访问地址:"
echo "  http://$(hostname -I | awk '{print $1}')"
echo "========================================"
echo ""
print_warning "请修改配置文件: $INSTALL_DIR/config.env"
print_warning "设置您的交易所API密钥后再启动交易功能"
echo ""
read -p "是否现在启动系统? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    "$INSTALL_DIR/start.sh"
fi
