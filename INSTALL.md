# AI量化交易系统 - 安装指南

## 系统要求

- **设备**: 网心云OES Plus (或其他Armbian设备)
- **CPU**: Amlogic A311D 或同等性能ARM处理器
- **内存**: 4GB RAM
- **存储**: 6GB+ (强烈推荐外接SATA硬盘)
- **系统**: Armbian (Debian/Ubuntu基础)
- **网络**: 稳定的互联网连接

## 快速安装

### 方法一: 一键安装脚本

```bash
# 1. 下载项目到设备
git clone <项目地址> /tmp/ai-trading
cd /tmp/ai-trading

# 2. 运行安装脚本
sudo bash deploy.sh
```

### 方法二: 手动安装

#### 1. 安装系统依赖

```bash
sudo apt update
sudo apt install -y \
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
```

#### 2. 创建安装目录

```bash
sudo mkdir -p /opt/ai-trading
sudo mkdir -p /mnt/sda1/ai-trading-data
sudo mkdir -p /mnt/sda1/ai-trading-data/logs
```

#### 3. 复制文件

```bash
# 复制后端代码
sudo cp -r backend/* /opt/ai-trading/backend/

# 复制前端构建文件
sudo cp -r dist/* /opt/ai-trading/frontend/

# 设置权限
sudo chown -R www-data:www-data /opt/ai-trading
sudo chown -R www-data:www-data /mnt/sda1/ai-trading-data
```

#### 4. 安装Python依赖

```bash
cd /opt/ai-trading/backend
sudo python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

#### 5. 配置Nginx

```bash
sudo tee /etc/nginx/sites-available/ai-trading << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /opt/ai-trading/frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
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

sudo ln -sf /etc/nginx/sites-available/ai-trading /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
```

#### 6. 创建Systemd服务

```bash
sudo tee /etc/systemd/system/ai-trading.service << 'EOF'
[Unit]
Description=AI量化交易系统
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/ai-trading/backend
Environment=PATH=/opt/ai-trading/backend/venv/bin
Environment=DATA_DIR=/mnt/sda1/ai-trading-data
Environment=PYTHONUNBUFFERED=1
ExecStart=/opt/ai-trading/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080 --workers 1
Restart=always
RestartSec=10

# 资源限制
LimitAS=2G
LimitRSS=1G
LimitNOFILE=65535

# 日志
StandardOutput=append:/mnt/sda1/ai-trading-data/logs/app.log
StandardError=append:/mnt/sda1/ai-trading-data/logs/error.log

[Install]
WantedBy=multi-user.target
EOF
```

#### 7. 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable ai-trading
sudo systemctl enable nginx
sudo systemctl start ai-trading
sudo systemctl start nginx
```

## 配置说明

### 1. 交易所API配置

编辑 `/opt/ai-trading/config.env`:

```env
# 交易所配置
EXCHANGE=binance
API_KEY=your_api_key_here
API_SECRET=your_api_secret_here

# 交易配置
SYMBOL=BTCUSDT
TIMEFRAME=1h
ENABLE_TRADING=false  # 测试时保持false
MAX_POSITION=100
RISK_PERCENT=2
```

### 2. AI配置

```env
# AI配置
ENABLE_AI=true
AUTO_OPTIMIZE=false
LEARNING_MODE=true
WEB_SEARCH_ENABLED=false  # 需要配置搜索API
```

## 管理命令

```bash
# 查看状态
sudo systemctl status ai-trading

# 启动/停止/重启
sudo systemctl start ai-trading
sudo systemctl stop ai-trading
sudo systemctl restart ai-trading

# 查看日志
sudo journalctl -u ai-trading -f
sudo tail -f /mnt/sda1/ai-trading-data/logs/app.log

# Nginx管理
sudo systemctl status nginx
sudo systemctl restart nginx
```

## 访问系统

安装完成后，通过浏览器访问:

```
http://<设备IP地址>
```

## 故障排除

### 1. 服务无法启动

```bash
# 检查日志
sudo journalctl -u ai-trading -n 100

# 检查端口占用
sudo netstat -tlnp | grep 8080

# 手动运行测试
cd /opt/ai-trading/backend
source venv/bin/activate
python main.py
```

### 2. 前端无法访问

```bash
# 检查Nginx配置
sudo nginx -t

# 检查前端文件
ls -la /opt/ai-trading/frontend/

# 重启Nginx
sudo systemctl restart nginx
```

### 3. 数据库错误

```bash
# 检查数据目录权限
ls -la /mnt/sda1/ai-trading-data/

# 修复权限
sudo chown -R www-data:www-data /mnt/sda1/ai-trading-data
```

### 4. 内存不足

```bash
# 清理缓存
sudo sync && echo 3 > /proc/sys/vm/drop_caches

# 查看内存使用
free -h

# 重启服务
sudo systemctl restart ai-trading
```

## 安全建议

1. **修改默认配置**: 首次安装后立即修改默认API密钥
2. **使用只读API**: 测试阶段使用只读API密钥
3. **防火墙设置**: 配置防火墙限制访问
4. **定期备份**: 使用 `ai-trading backup` 定期备份数据
5. **监控日志**: 定期检查日志文件发现异常

## 更新系统

```bash
# 停止服务
sudo systemctl stop ai-trading

# 备份数据
sudo ai-trading backup

# 更新代码
cd /tmp/ai-trading
git pull

# 重新部署
sudo bash deploy.sh

# 重启服务
sudo systemctl start ai-trading
```

## 卸载系统

```bash
# 停止服务
sudo systemctl stop ai-trading
sudo systemctl disable ai-trading

# 删除文件
sudo rm -rf /opt/ai-trading
sudo rm /etc/systemd/system/ai-trading.service
sudo rm /etc/nginx/sites-available/ai-trading
sudo rm /etc/nginx/sites-enabled/ai-trading

# 重载配置
sudo systemctl daemon-reload
sudo systemctl restart nginx

# 可选: 删除数据
# sudo rm -rf /mnt/sda1/ai-trading-data
```

## 技术支持

如有问题，请检查:
1. 日志文件: `/mnt/sda1/ai-trading-data/logs/`
2. 系统状态: `sudo systemctl status ai-trading`
3. 网络连接: `curl http://localhost:8080/api/status`

---

**注意**: 请确保您了解量化交易的风险，不要投入超过您能承受损失的资金。
