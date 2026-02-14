#!/bin/bash
# ============================================================
# XTMC量化交易系统 - 一键部署脚本
# 支持: Linux / macOS / Windows(WSL/Git Bash)
# 部署方式: Docker / 直接运行 / GitHub Pages
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[XTMC]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============== 检测环境 ==============
detect_env() {
  log "检测系统环境..."

  # OS
  OS="unknown"
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then OS="linux"
  elif [[ "$OSTYPE" == "darwin"* ]]; then OS="macos"
  elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then OS="windows"
  fi
  log "操作系统: $OS"

  # 架构
  ARCH=$(uname -m)
  log "架构: $ARCH"

  # Node.js
  if command -v node &> /dev/null; then
    NODE_VER=$(node -v)
    log "Node.js: $NODE_VER"
    HAS_NODE=true
  else
    warn "未检测到Node.js"
    HAS_NODE=false
  fi

  # Docker
  if command -v docker &> /dev/null; then
    DOCKER_VER=$(docker --version 2>/dev/null || echo "unknown")
    log "Docker: $DOCKER_VER"
    HAS_DOCKER=true
  else
    warn "未检测到Docker"
    HAS_DOCKER=false
  fi

  # npm
  if command -v npm &> /dev/null; then
    NPM_VER=$(npm -v)
    log "npm: $NPM_VER"
    HAS_NPM=true
  else
    HAS_NPM=false
  fi
}

# ============== Docker部署 ==============
deploy_docker() {
  log "=== Docker部署模式 ==="

  if [ "$HAS_DOCKER" = false ]; then
    err "Docker未安装，请先安装Docker"
    echo "  Linux: curl -fsSL https://get.docker.com | sh"
    echo "  macOS: brew install --cask docker"
    echo "  Windows: https://docs.docker.com/desktop/install/windows-install/"
    exit 1
  fi

  # 检查docker-compose
  if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
  elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  else
    warn "docker-compose不可用，使用docker build直接部署"
    log "构建Docker镜像..."
    docker build -t xtmc-trading .
    log "启动容器..."
    docker run -d --name xtmc-trading -p 3000:80 --restart unless-stopped xtmc-trading
    log "✅ 部署完成! 访问: http://localhost:3000"
    return
  fi

  log "使用 $COMPOSE_CMD 部署..."
  $COMPOSE_CMD down 2>/dev/null || true
  $COMPOSE_CMD up -d --build

  log "✅ Docker部署完成! 访问: http://localhost:3000"
}

# ============== 直接运行 ==============
deploy_direct() {
  log "=== 直接运行模式 ==="

  if [ "$HAS_NODE" = false ]; then
    err "Node.js未安装"
    echo "安装方法:"
    echo "  Linux/macOS: curl -fsSL https://fnm.vercel.app/install | bash && fnm install 20"
    echo "  Windows: https://nodejs.org/en/download/"
    exit 1
  fi

  # 检查Node版本
  NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d v)
  if [ "$NODE_MAJOR" -lt 18 ]; then
    err "Node.js版本过低 (需要>=18, 当前: $(node -v))"
    exit 1
  fi

  log "安装依赖..."
  npm ci --no-audit 2>/dev/null || npm install

  log "构建生产版本..."
  npm run build

  log "✅ 构建完成!"
  log "dist/ 目录已生成，可以部署到任何静态服务器"
  echo ""
  echo "预览: npm run preview"
  echo "开发: npm run dev"
  echo ""
  echo "部署到nginx: cp -r dist/* /usr/share/nginx/html/"
  echo "部署到Apache: cp -r dist/* /var/www/html/"
}

# ============== 开发模式 ==============
deploy_dev() {
  log "=== 开发模式 ==="

  if [ "$HAS_NODE" = false ]; then
    err "Node.js未安装"
    exit 1
  fi

  log "安装依赖..."
  npm ci --no-audit 2>/dev/null || npm install

  log "启动开发服务器..."
  npm run dev
}

# ============== 主菜单 ==============
show_menu() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║    XTMC量化交易系统 - 一键部署工具      ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo "  1) Docker部署 (推荐，自动化)"
  echo "  2) 直接构建 (需要Node.js 18+)"
  echo "  3) 开发模式 (热重载)"
  echo "  4) 退出"
  echo ""
}

# ============== 入口 ==============
main() {
  detect_env
  echo ""

  # 如果有命令行参数
  case "${1:-}" in
    docker) deploy_docker; exit 0 ;;
    build)  deploy_direct; exit 0 ;;
    dev)    deploy_dev; exit 0 ;;
  esac

  # 交互式菜单
  while true; do
    show_menu
    read -p "请选择部署方式 [1-4]: " choice
    case $choice in
      1) deploy_docker; break ;;
      2) deploy_direct; break ;;
      3) deploy_dev; break ;;
      4) log "再见!"; exit 0 ;;
      *) warn "无效选择，请重试" ;;
    esac
  done
}

main "$@"
