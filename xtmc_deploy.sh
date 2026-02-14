#!/bin/bash
# XTMC量化交易系统 - 部署脚本
# 自我进化型AI交易系统

set -e

echo "========================================"
echo "  XTMC量化交易系统 - 部署脚本"
echo "  自我进化型AI交易系统"
echo "========================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 设置变量
INSTALL_DIR="/opt/xtmc-trading"
DATA_DIR="/mnt/sda1/xtmc-data"
SERVICE_NAME="xtmc-trading"
USER="xtmc"

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
    git

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
mkdir -p "$INSTALL_DIR/xtmc_backend"
mkdir -p "$INSTALL_DIR/frontend"
mkdir -p "$DATA_DIR"
mkdir -p "$DATA_DIR/logs"
mkdir -p "$DATA_DIR/tools_library"

# 复制文件
print_info "复制应用文件..."
cp -r xtmc_backend/* "$INSTALL_DIR/xtmc_backend/"
cp -r dist/* "$INSTALL_DIR/frontend/"

# 设置权限
chown -R "$USER:$USER" "$INSTALL_DIR"
chown -R "$USER:$USER" "$DATA_DIR"

# 创建Python虚拟环境
print_info "创建Python虚拟环境..."
cd "$INSTALL_DIR/xtmc_backend"
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
# XTMC量化交易系统配置

# 服务器配置
HOST=0.0.0.0
PORT=8080
DEBUG=false

# 数据目录
DATA_DIR=/mnt/sda1/xtmc-data
LOG_DIR=/mnt/sda1/xtmc-data/logs

# 交易配置
EXCHANGE=binance
SYMBOL=BTCUSDT
TIMEFRAME=1h
ENABLE_TRADING=false
MAX_POSITION=100
RISK_PERCENT=2
EOF

chown "$USER:$USER" "$INSTALL_DIR/config.env"

# 创建systemd服务
print_info "创建系统服务..."
cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=XTMC量化交易系统
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR/xtmc_backend
Environment=PATH=$INSTALL_DIR/xtmc_backend/venv/bin
Environment=DATA_DIR=$DATA_DIR
Environment=PYTHONUNBUFFERED=1
ExecStart=$INSTALL_DIR/xtmc_backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080 --workers 1
Restart=always
RestartSec=10

# 资源限制
LimitAS=2G
LimitRSS=1G
LimitNOFILE=65535

# 日志
StandardOutput=append:$DATA_DIR/logs/xtmc.log
StandardError=append:$DATA_DIR/logs/error.log

[Install]
WantedBy=multi-user.target
EOF

# 配置Nginx
print_info "配置Nginx..."
cat > "/etc/nginx/sites-available/$SERVICE_NAME" << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /opt/xtmc-trading/frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
    
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
}
EOF

# 启用nginx配置
ln -sf "/etc/nginx/sites-available/$SERVICE_NAME" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default
nginx -t

# 创建管理脚本
print_info "创建管理脚本..."
cat > "$INSTALL_DIR/xtmc.sh" << 'EOF'
#!/bin/bash

ACTION=$1
SERVICE_NAME="xtmc-trading"

case $ACTION in
    start)
        echo "启动XTMC量化交易系统..."
        sudo systemctl start $SERVICE_NAME
        sudo systemctl start nginx
        echo "系统已启动，访问 http://$(hostname -I | awk '{print $1}')"
        ;;
    stop)
        echo "停止XTMC量化交易系统..."
        sudo systemctl stop $SERVICE_NAME
        sudo systemctl stop nginx
        echo "系统已停止"
        ;;
    restart)
        echo "重启XTMC量化交易系统..."
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
        sudo tail -f /mnt/sda1/xtmc-data/logs/xtmc.log
        ;;
    backup)
        BACKUP_FILE="/mnt/sda1/xtmc-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        echo "创建备份: $BACKUP_FILE"
        sudo tar -czf $BACKUP_FILE /mnt/sda1/xtmc-data
        echo "备份完成"
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs|backup}"
        exit 1
        ;;
esac
EOF

chmod +x "$INSTALL_DIR/xtmc.sh"
ln -sf "$INSTALL_DIR/xtmc.sh" /usr/local/bin/xtmc

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
}
EOF

# 完成
print_success "部署完成!"
echo ""
echo "========================================"
echo "  XTMC量化交易系统安装信息"
echo "========================================"
echo "安装目录: $INSTALL_DIR"
echo "数据目录: $DATA_DIR"
echo "日志目录: $DATA_DIR/logs"
echo ""
echo "管理命令:"
echo "  xtmc start    - 启动系统"
echo "  xtmc stop     - 停止系统"
echo "  xtmc restart  - 重启系统"
echo "  xtmc status   - 查看状态"
echo "  xtmc logs     - 查看日志"
echo "  xtmc backup   - 备份数据"
echo ""
echo "访问地址:"
echo "  http://$(hostname -I | awk '{print $1}')"
echo "========================================"
echo ""
print_warning "请修改配置文件: $INSTALL_DIR/config.env"
print_warning "设置您的交易所API密钥后再启动交易功能"
