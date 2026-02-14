#!/bin/bash
# =============================================================================
# XTMC量化交易系统 - 智能安装脚本
# 自动检测设备、检查依赖、自动修复问题
# 支持: Armbian, Debian, Ubuntu, Raspberry Pi OS
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# 检测是否为root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 sudo 运行此脚本"
        log_info "例如: sudo bash $0"
        exit 1
    fi
    log_success "已获取root权限"
}

# 检测系统类型
detect_system() {
    log_step "步骤 1/8: 检测系统信息"
    
    # 检测操作系统
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME="$NAME"
        OS_VERSION="$VERSION_ID"
        OS_ID="$ID"
    else
        log_error "无法识别操作系统"
        exit 1
    fi
    
    # 检测架构
    ARCH=$(uname -m)
    
    # 检测硬件
    if [ -f /proc/device-tree/model ]; then
        HARDWARE=$(cat /proc/device-tree/model 2>/dev/null | tr '\0' ' ' || echo "Unknown")
    elif [ -f /proc/cpuinfo ]; then
        HARDWARE=$(grep -m1 "Model" /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || echo "Unknown")
    else
        HARDWARE="Unknown"
    fi
    
    # 检测内存
    TOTAL_MEM=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo "0")
    
    # 检测存储
    ROOT_SIZE=$(df -m / 2>/dev/null | tail -1 | awk '{print $2}' || echo "0")
    
    # 检测外接硬盘
    if [ -d "/mnt/sda1" ]; then
        EXTERNAL_DISK="/mnt/sda1"
        DISK_SIZE=$(df -h /mnt/sda1 2>/dev/null | tail -1 | awk '{print $2}' || echo "Unknown")
    else
        EXTERNAL_DISK=""
        DISK_SIZE=""
    fi
    
    log_info "操作系统: $OS_NAME $OS_VERSION"
    log_info "系统架构: $ARCH"
    log_info "硬件型号: $HARDWARE"
    log_info "内存大小: ${TOTAL_MEM}MB"
    log_info "根目录大小: ${ROOT_SIZE}MB"
    
    if [ -n "$EXTERNAL_DISK" ]; then
        log_success "检测到外接硬盘: $EXTERNAL_DISK ($DISK_SIZE)"
    else
        log_warn "未检测到外接硬盘，将使用内置存储"
    fi
    
    # 保存到全局变量
    export OS_NAME OS_VERSION ARCH HARDWARE TOTAL_MEM EXTERNAL_DISK
}

# 检查网络连接
check_network() {
    log_step "步骤 2/8: 检查网络连接"
    
    if ping -c 1 -W 5 8.8.8.8 >/dev/null 2>&1 || ping -c 1 -W 5 223.5.5.5 >/dev/null 2>&1; then
        log_success "网络连接正常"
    else
        log_error "无法连接到互联网，请检查网络设置"
        exit 1
    fi
    
    # 测试镜像源速度
    log_info "测试软件源连接..."
    if ! apt-get update -qq >/dev/null 2>&1; then
        log_warn "默认软件源连接失败，尝试更换镜像源..."
        change_mirror_source
    fi
}

# 更换镜像源
change_mirror_source() {
    log_info "更换为国内镜像源..."
    
    # 备份原配置
    cp /etc/apt/sources.list /etc/apt/sources.list.bak.$(date +%Y%m%d) 2>/dev/null || true
    
    # 根据系统选择镜像源
    case "$OS_ID" in
        debian)
            cat > /etc/apt/sources.list << 'EOF'
deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm main contrib non-free non-free-firmware
deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-updates main contrib non-free non-free-firmware
deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-backports main contrib non-free non-free-firmware
deb https://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free non-free-firmware
EOF
            ;;
        ubuntu)
            cat > /etc/apt/sources.list << 'EOF'
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-updates main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-backports main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-security main restricted universe multiverse
EOF
            ;;
        armbian)
            log_info "Armbian系统，尝试更新软件源..."
            apt-get update -qq || true
            return
            ;;
    esac
    
    apt-get update -qq >/dev/null 2>&1 && log_success "镜像源更换成功" || log_warn "镜像源更换可能失败，继续尝试..."
}

# 修复Python环境
fix_python_environment() {
    log_step "步骤 3/8: 修复Python环境"
    
    # 检查python命令
    if ! command -v python3 &>/dev/null; then
        log_info "安装 Python3..."
        apt-get install -y python3 python3-pip python3-venv
    fi
    
    # 检查pip
    if ! command -v pip3 &>/dev/null; then
        log_info "安装 pip3..."
        apt-get install -y python3-pip
    fi
    
    # 处理PEP 668问题 (外部管理环境)
    if [ -f /usr/lib/python3.*/EXTERNALLY-MANAGED ]; then
        log_warn "检测到PEP 668外部管理环境限制"
        log_info "创建方案: 使用虚拟环境安装"
        
        # 移除标记文件 (不推荐但有效)
        # rm -f /usr/lib/python3.*/EXTERNALLY-MANAGED
        
        # 或者使用 --break-system-packages (Debian 12+)
        PIP_BREAK="--break-system-packages"
    else
        PIP_BREAK=""
    fi
    
    # 确保python命令可用
    if ! command -v python &>/dev/null; then
        ln -sf $(which python3) /usr/local/bin/python 2>/dev/null || true
    fi
    
    # 升级pip
    log_info "升级 pip..."
    python3 -m pip install --upgrade pip $PIP_BREAK 2>/dev/null || pip3 install --upgrade pip
    
    # 显示Python版本
    PYTHON_VERSION=$(python3 --version 2>&1)
    log_success "Python环境就绪: $PYTHON_VERSION"
    
    export PIP_BREAK
}

# 安装系统依赖
install_system_deps() {
    log_step "步骤 4/8: 安装系统依赖"
    
    log_info "更新软件包列表..."
    apt-get update
    
    log_info "安装必要组件..."
    
    # 基础工具
    apt-get install -y \
        curl \
        wget \
        git \
        vim \
        htop \
        net-tools \
        2>/dev/null || log_warn "部分基础工具安装失败"
    
    # Python开发依赖
    apt-get install -y \
        python3-dev \
        python3-venv \
        build-essential \
        libssl-dev \
        libffi-dev \
        2>/dev/null || log_warn "部分Python开发依赖安装失败"
    
    # Web服务器
    apt-get install -y nginx 2>/dev/null || log_warn "nginx安装失败"
    
    # 数据库
    apt-get install -y sqlite3 2>/dev/null || log_warn "sqlite3安装失败"
    
    log_success "系统依赖安装完成"
}

# 安装Python依赖
install_python_deps() {
    log_step "步骤 5/8: 安装Python依赖"
    
    # 创建工作目录
    INSTALL_DIR="/opt/xtmc-trading"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # 创建虚拟环境 (推荐做法)
    log_info "创建Python虚拟环境..."
    python3 -m venv venv
    source venv/bin/activate
    
    # 升级虚拟环境中的pip
    pip install --upgrade pip
    
    # 安装依赖
    log_info "安装Python包..."
    
    # 创建requirements.txt
    cat > requirements.txt << 'EOF'
# XTMC量化交易系统依赖
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-socketio==5.11.0
websockets==12.0
numpy==1.26.3
pandas==2.1.4
aiosqlite==0.19.0
aiofiles==23.2.1
python-binance==1.0.19
ccxt==4.2.18
aiohttp==3.9.1
scikit-learn==1.4.0
scipy==1.12.0
schedule==1.2.1
apscheduler==3.10.4
psutil==5.9.8
requests==2.31.0
pydantic==2.5.3
pydantic-settings==2.1.0
python-dotenv==1.0.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
EOF
    
    # 安装依赖
    pip install -r requirements.txt && log_success "Python依赖安装完成" || {
        log_error "Python依赖安装失败"
        log_info "尝试单独安装关键包..."
        pip install fastapi uvicorn numpy pandas aiohttp requests
    }
    
    # 退出虚拟环境
    deactivate
}

# 配置系统
configure_system() {
    log_step "步骤 6/8: 配置系统"
    
    INSTALL_DIR="/opt/xtmc-trading"
    
    # 创建数据目录
    if [ -n "$EXTERNAL_DISK" ]; then
        DATA_DIR="$EXTERNAL_DISK/xtmc-data"
    else
        DATA_DIR="$INSTALL_DIR/data"
    fi
    
    mkdir -p "$DATA_DIR"
    mkdir -p "$DATA_DIR/logs"
    mkdir -p "$DATA_DIR/tools_library"
    
    # 创建用户
    if ! id "xtmc" &>/dev/null; then
        log_info "创建 xtmc 用户..."
        useradd -r -s /bin/false -d "$INSTALL_DIR" xtmc 2>/dev/null || true
    fi
    
    # 设置权限
    chown -R xtmc:xtmc "$INSTALL_DIR" 2>/dev/null || true
    chown -R xtmc:xtmc "$DATA_DIR" 2>/dev/null || true
    
    log_success "系统配置完成"
    log_info "数据目录: $DATA_DIR"
}

# 创建启动脚本
create_launcher() {
    log_step "步骤 7/8: 创建启动脚本"
    
    INSTALL_DIR="/opt/xtmc-trading"
    
    # 创建启动脚本
    cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash
# XTMC启动脚本

INSTALL_DIR="/opt/xtmc-trading"
DATA_DIR="${DATA_DIR:-$INSTALL_DIR/data}"

cd "$INSTALL_DIR"

# 激活虚拟环境
source venv/bin/activate

# 启动后端
echo "正在启动XTMC后端服务..."
python3 -m uvicorn main:app --host 0.0.0.0 --port 8080 --workers 1 &
BACKEND_PID=$!

echo "后端PID: $BACKEND_PID"
echo "等待服务启动..."
sleep 3

# 检查服务状态
if curl -s http://localhost:8080/api/status >/dev/null 2>&1; then
    echo "✓ XTMC服务启动成功!"
    echo "访问地址: http://$(hostname -I | awk '{print $1}'):8080"
else
    echo "✗ 服务启动可能失败，请检查日志"
fi

echo ""
echo "按 Ctrl+C 停止服务"
wait $BACKEND_PID
EOF
    
    chmod +x "$INSTALL_DIR/start.sh"
    ln -sf "$INSTALL_DIR/start.sh" /usr/local/bin/xtmc-start 2>/dev/null || true
    
    # 创建systemd服务
    cat > /etc/systemd/system/xtmc-trading.service << EOF
[Unit]
Description=XTMC量化交易系统
After=network.target

[Service]
Type=simple
User=xtmc
Group=xtmc
WorkingDirectory=$INSTALL_DIR
Environment=PATH=$INSTALL_DIR/venv/bin
Environment=DATA_DIR=$DATA_DIR
Environment=PYTHONUNBUFFERED=1
ExecStart=$INSTALL_DIR/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8080 --workers 1
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload 2>/dev/null || true
    systemctl enable xtmc-trading 2>/dev/null || true
    
    log_success "启动脚本创建完成"
}

# 显示安装信息
show_info() {
    log_step "步骤 8/8: 安装完成"
    
    INSTALL_DIR="/opt/xtmc-trading"
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         XTMC量化交易系统 安装成功!                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    log_info "安装目录: $INSTALL_DIR"
    log_info "数据目录: ${DATA_DIR:-$INSTALL_DIR/data}"
    log_info "日志目录: ${DATA_DIR:-$INSTALL_DIR/data}/logs"
    echo ""
    log_info "启动命令:"
    echo "  方式1 (推荐): sudo systemctl start xtmc-trading"
    echo "  方式2: sudo xtmc-start"
    echo "  方式3: cd $INSTALL_DIR && sudo bash start.sh"
    echo ""
    log_info "管理命令:"
    echo "  查看状态: sudo systemctl status xtmc-trading"
    echo "  查看日志: sudo journalctl -u xtmc-trading -f"
    echo "  停止服务: sudo systemctl stop xtmc-trading"
    echo ""
    log_info "访问地址:"
    echo "  http://$(hostname -I | awk '{print $1}'):8080"
    echo ""
    log_warn "注意: 首次启动前请配置交易所API密钥!"
    echo ""
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║     XTMC量化交易系统 - 智能安装脚本                        ║"
    echo "║     自我进化型AI交易系统                                   ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    check_root
    detect_system
    check_network
    fix_python_environment
    install_system_deps
    install_python_deps
    configure_system
    create_launcher
    show_info
}

# 错误处理
trap 'log_error "安装过程中出现错误，请查看上方日志"' ERR

# 运行主函数
main "$@"
