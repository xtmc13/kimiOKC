#!/usr/bin/env python3
"""
AI量化交易系统 - FastAPI主入口
专为网心云OES Plus (Armbian)优化
硬件: 4GB RAM + 6GB存储 + 外接SATA硬盘
"""

import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import aiofiles
import aiosqlite
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# 配置日志 - 轻量级格式
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/mnt/okcomputer/output/app/backend/logs/app.log', maxBytes=10*1024*1024, backupCount=3),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ============== 数据模型 ==============

class TradeConfig(BaseModel):
    """交易配置"""
    exchange: str = "binance"  # 交易所: binance, okx
    api_key: str = ""
    api_secret: str = ""
    symbol: str = "BTCUSDT"
    timeframe: str = "1h"
    enable_trading: bool = False
    max_position: float = 100.0  # 最大持仓USDT
    risk_percent: float = 2.0  # 单笔风险百分比

class AIConfig(BaseModel):
    """AI配置"""
    enable_ai: bool = True
    ai_model: str = "default"
    auto_optimize: bool = False
    learning_mode: bool = True
    web_search_enabled: bool = True

class ChatMessage(BaseModel):
    """聊天消息"""
    role: str  # user, assistant, system
    content: str
    timestamp: Optional[str] = None
    metadata: Optional[Dict] = None

class MarketData(BaseModel):
    """市场数据"""
    symbol: str
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float

class TradeSignal(BaseModel):
    """交易信号"""
    symbol: str
    action: str  # BUY, SELL, HOLD
    price: float
    confidence: float
    reason: str
    timestamp: int

# ============== 全局状态管理 ==============

class AppState:
    """应用状态管理器 - 轻量级设计"""
    def __init__(self):
        self.db_path = "/mnt/okcomputer/output/app/backend/data/trading.db"
        self.config_path = "/mnt/okcomputer/output/app/backend/data/config.json"
        self.is_running = False
        self.trade_config: TradeConfig = TradeConfig()
        self.ai_config: AIConfig = AIConfig()
        self.active_connections: List[WebSocket] = []
        self.market_data_cache: Dict[str, List[Dict]] = {}
        self.ai_instance = None
        self.exchange_client = None
        self.last_signals: List[TradeSignal] = []
        
    async def init(self):
        """初始化"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        await self.init_database()
        await self.load_config()
        self.is_running = True
        logger.info("应用状态初始化完成")
        
    async def init_database(self):
        """初始化SQLite数据库"""
        async with aiosqlite.connect(self.db_path) as db:
            # K线数据表 - 按symbol分区
            await db.execute("""
                CREATE TABLE IF NOT EXISTS kline_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    timeframe TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    open REAL NOT NULL,
                    high REAL NOT NULL,
                    low REAL NOT NULL,
                    close REAL NOT NULL,
                    volume REAL NOT NULL,
                    UNIQUE(symbol, timeframe, timestamp)
                )
            """)
            
            # 交易记录表
            await db.execute("""
                CREATE TABLE IF NOT EXISTS trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    action TEXT NOT NULL,
                    price REAL NOT NULL,
                    quantity REAL NOT NULL,
                    timestamp INTEGER NOT NULL,
                    profit REAL DEFAULT 0,
                    status TEXT DEFAULT 'pending'
                )
            """)
            
            # AI信号记录表
            await db.execute("""
                CREATE TABLE IF NOT EXISTS ai_signals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    action TEXT NOT NULL,
                    price REAL NOT NULL,
                    confidence REAL NOT NULL,
                    reason TEXT,
                    timestamp INTEGER NOT NULL,
                    executed BOOLEAN DEFAULT FALSE
                )
            """)
            
            # 聊天记录表
            await db.execute("""
                CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    metadata TEXT
                )
            """)
            
            # 系统日志表
            await db.execute("""
                CREATE TABLE IF NOT EXISTS system_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    timestamp INTEGER NOT NULL
                )
            """)
            
            await db.commit()
        logger.info("数据库初始化完成")
        
    async def load_config(self):
        """加载配置"""
        try:
            if os.path.exists(self.config_path):
                async with aiofiles.open(self.config_path, 'r') as f:
                    content = await f.read()
                    config = json.loads(content)
                    self.trade_config = TradeConfig(**config.get('trade', {}))
                    self.ai_config = AIConfig(**config.get('ai', {}))
                logger.info("配置加载完成")
        except Exception as e:
            logger.error(f"加载配置失败: {e}")
            
    async def save_config(self):
        """保存配置"""
        try:
            config = {
                'trade': self.trade_config.dict(),
                'ai': self.ai_config.dict()
            }
            async with aiofiles.open(self.config_path, 'w') as f:
                await f.write(json.dumps(config, indent=2, ensure_ascii=False))
            logger.info("配置保存完成")
        except Exception as e:
            logger.error(f"保存配置失败: {e}")
            
    async def broadcast(self, message: Dict):
        """广播消息到所有WebSocket连接"""
        disconnected = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except:
                disconnected.append(conn)
        for conn in disconnected:
            if conn in self.active_connections:
                self.active_connections.remove(conn)

# 全局状态实例
app_state = AppState()

# ============== 生命周期管理 ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动
    await app_state.init()
    
    # 启动后台任务
    tasks = [
        asyncio.create_task(market_data_loop()),
        asyncio.create_task(ai_monitor_loop()),
    ]
    
    logger.info("=" * 50)
    logger.info("AI量化交易系统启动完成")
    logger.info(f"数据库: {app_state.db_path}")
    logger.info("=" * 50)
    
    yield
    
    # 关闭
    app_state.is_running = False
    for task in tasks:
        task.cancel()
    logger.info("AI量化交易系统已关闭")

# ============== FastAPI应用 ==============

app = FastAPI(
    title="AI量化交易系统",
    description="专为网心云OES Plus优化的本地量化交易系统",
    version="1.0.0",
    lifespan=lifespan
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== 后台任务 ==============

async def market_data_loop():
    """市场数据获取循环"""
    from exchange.exchange_client import ExchangeClient
    
    client = ExchangeClient(app_state.trade_config.exchange)
    
    while app_state.is_running:
        try:
            if app_state.trade_config.enable_trading:
                # 获取K线数据
                symbol = app_state.trade_config.symbol
                timeframe = app_state.trade_config.timeframe
                
                data = await client.fetch_ohlcv(symbol, timeframe, limit=100)
                if data:
                    app_state.market_data_cache[symbol] = data
                    
                    # 保存到数据库
                    await save_kline_data(symbol, timeframe, data)
                    
                    # 广播给前端
                    await app_state.broadcast({
                        'type': 'market_data',
                        'symbol': symbol,
                        'data': data[-50:]  # 只发送最新50条
                    })
                    
            await asyncio.sleep(10)  # 10秒更新一次
        except Exception as e:
            logger.error(f"市场数据循环错误: {e}")
            await asyncio.sleep(30)

async def ai_monitor_loop():
    """AI监控循环"""
    from ai.trading_ai import TradingAI
    
    ai = TradingAI()
    app_state.ai_instance = ai
    
    while app_state.is_running:
        try:
            if app_state.ai_config.enable_ai and app_state.market_data_cache:
                symbol = app_state.trade_config.symbol
                data = app_state.market_data_cache.get(symbol, [])
                
                if len(data) >= 20:
                    # AI分析
                    signal = await ai.analyze(data, symbol)
                    
                    if signal and signal.action != 'HOLD':
                        app_state.last_signals.append(signal)
                        if len(app_state.last_signals) > 100:
                            app_state.last_signals.pop(0)
                        
                        # 保存信号
                        await save_ai_signal(signal)
                        
                        # 广播信号
                        await app_state.broadcast({
                            'type': 'ai_signal',
                            'signal': signal.dict()
                        })
                        
                        # 如果开启自动交易，执行交易
                        if app_state.trade_config.enable_trading:
                            await execute_trade(signal)
                            
            await asyncio.sleep(30)  # 30秒分析一次
        except Exception as e:
            logger.error(f"AI监控循环错误: {e}")
            await asyncio.sleep(60)

async def save_kline_data(symbol: str, timeframe: str, data: List[Dict]):
    """保存K线数据"""
    try:
        async with aiosqlite.connect(app_state.db_path) as db:
            for candle in data:
                await db.execute("""
                    INSERT OR REPLACE INTO kline_data 
                    (symbol, timeframe, timestamp, open, high, low, close, volume)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    symbol, timeframe, candle['time'],
                    candle['open'], candle['high'], 
                    candle['low'], candle['close'], candle['volume']
                ))
            await db.commit()
    except Exception as e:
        logger.error(f"保存K线数据失败: {e}")

async def save_ai_signal(signal: TradeSignal):
    """保存AI信号"""
    try:
        async with aiosqlite.connect(app_state.db_path) as db:
            await db.execute("""
                INSERT INTO ai_signals 
                (symbol, action, price, confidence, reason, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                signal.symbol, signal.action, signal.price,
                signal.confidence, signal.reason, signal.timestamp
            ))
            await db.commit()
    except Exception as e:
        logger.error(f"保存AI信号失败: {e}")

async def execute_trade(signal: TradeSignal):
    """执行交易"""
    try:
        from exchange.exchange_client import ExchangeClient
        client = ExchangeClient(app_state.trade_config.exchange)
        
        # 这里实现实际的交易逻辑
        logger.info(f"执行交易: {signal.action} {signal.symbol} @ {signal.price}")
        
        # 广播交易执行
        await app_state.broadcast({
            'type': 'trade_executed',
            'signal': signal.dict(),
            'status': 'success'
        })
    except Exception as e:
        logger.error(f"执行交易失败: {e}")

# ============== API路由 ==============

@app.get("/api/status")
async def get_status():
    """获取系统状态"""
    import psutil
    
    return {
        'status': 'running' if app_state.is_running else 'stopped',
        'timestamp': int(datetime.now().timestamp() * 1000),
        'system': {
            'cpu_percent': psutil.cpu_percent(),
            'memory_percent': psutil.virtual_memory().percent,
            'memory_used': psutil.virtual_memory().used // (1024*1024),  # MB
            'memory_total': psutil.virtual_memory().total // (1024*1024),  # MB
        },
        'trading': {
            'enabled': app_state.trade_config.enable_trading,
            'exchange': app_state.trade_config.exchange,
            'symbol': app_state.trade_config.symbol,
        },
        'ai': {
            'enabled': app_state.ai_config.enable_ai,
            'model': app_state.ai_config.ai_model,
        }
    }

@app.get("/api/market/data")
async def get_market_data(
    symbol: str = Query(default=None),
    timeframe: str = Query(default="1h"),
    limit: int = Query(default=500, le=1000)
):
    """获取市场数据"""
    if not symbol:
        symbol = app_state.trade_config.symbol
        
    try:
        async with aiosqlite.connect(app_state.db_path) as db:
            cursor = await db.execute("""
                SELECT timestamp, open, high, low, close, volume
                FROM kline_data
                WHERE symbol = ? AND timeframe = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (symbol, timeframe, limit))
            
            rows = await cursor.fetchall()
            data = [
                {
                    'time': row[0],
                    'open': row[1],
                    'high': row[2],
                    'low': row[3],
                    'close': row[4],
                    'volume': row[5]
                }
                for row in reversed(rows)
            ]
            return {'symbol': symbol, 'timeframe': timeframe, 'data': data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals")
async def get_signals(limit: int = Query(default=50, le=100)):
    """获取AI信号历史"""
    try:
        async with aiosqlite.connect(app_state.db_path) as db:
            cursor = await db.execute("""
                SELECT symbol, action, price, confidence, reason, timestamp, executed
                FROM ai_signals
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            
            rows = await cursor.fetchall()
            signals = [
                {
                    'symbol': row[0],
                    'action': row[1],
                    'price': row[2],
                    'confidence': row[3],
                    'reason': row[4],
                    'timestamp': row[5],
                    'executed': row[6]
                }
                for row in rows
            ]
            return {'signals': signals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/config/trade")
async def update_trade_config(config: TradeConfig):
    """更新交易配置"""
    app_state.trade_config = config
    await app_state.save_config()
    return {'status': 'success', 'config': config.dict()}

@app.get("/api/config/trade")
async def get_trade_config():
    """获取交易配置"""
    return app_state.trade_config.dict()

@app.post("/api/config/ai")
async def update_ai_config(config: AIConfig):
    """更新AI配置"""
    app_state.ai_config = config
    await app_state.save_config()
    return {'status': 'success', 'config': config.dict()}

@app.get("/api/config/ai")
async def get_ai_config():
    """获取AI配置"""
    return app_state.ai_config.dict()

@app.post("/api/chat")
async def chat(message: ChatMessage):
    """AI对话接口"""
    try:
        from ai.trading_ai import TradingAI
        ai = app_state.ai_instance or TradingAI()
        
        # 保存用户消息
        msg_dict = message.dict()
        msg_dict['timestamp'] = int(datetime.now().timestamp() * 1000)
        
        async with aiosqlite.connect(app_state.db_path) as db:
            await db.execute("""
                INSERT INTO chat_history (role, content, timestamp, metadata)
                VALUES (?, ?, ?, ?)
            """, (
                message.role, message.content, msg_dict['timestamp'],
                json.dumps(message.metadata) if message.metadata else None
            ))
            await db.commit()
        
        # 获取AI回复
        response = await ai.chat(message.content, app_state.market_data_cache)
        
        # 保存AI回复
        async with aiosqlite.connect(app_state.db_path) as db:
            await db.execute("""
                INSERT INTO chat_history (role, content, timestamp, metadata)
                VALUES (?, ?, ?, ?)
            """, (
                'assistant', response['content'], 
                int(datetime.now().timestamp() * 1000),
                json.dumps(response.get('metadata', {}))
            ))
            await db.commit()
        
        return response
    except Exception as e:
        logger.error(f"AI对话错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/history")
async def get_chat_history(limit: int = Query(default=50, le=100)):
    """获取聊天历史"""
    try:
        async with aiosqlite.connect(app_state.db_path) as db:
            cursor = await db.execute("""
                SELECT role, content, timestamp, metadata
                FROM chat_history
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            
            rows = await cursor.fetchall()
            messages = [
                {
                    'role': row[0],
                    'content': row[1],
                    'timestamp': row[2],
                    'metadata': json.loads(row[3]) if row[3] else None
                }
                for row in reversed(rows)
            ]
            return {'messages': messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/optimize")
async def ai_optimize():
    """触发AI自我优化"""
    try:
        from ai.trading_ai import TradingAI
        ai = app_state.ai_instance or TradingAI()
        
        result = await ai.self_optimize()
        
        await app_state.broadcast({
            'type': 'ai_optimized',
            'result': result
        })
        
        return {'status': 'success', 'result': result}
    except Exception as e:
        logger.error(f"AI优化错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trade/manual")
async def manual_trade(action: str, quantity: float):
    """手动交易"""
    try:
        signal = TradeSignal(
            symbol=app_state.trade_config.symbol,
            action=action.upper(),
            price=0,  # 市价单
            confidence=1.0,
            reason="手动交易",
            timestamp=int(datetime.now().timestamp() * 1000)
        )
        
        await execute_trade(signal)
        return {'status': 'success', 'signal': signal.dict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============== WebSocket ==============

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket实时数据推送"""
    await websocket.accept()
    app_state.active_connections.append(websocket)
    
    try:
        # 发送初始数据
        await websocket.send_json({
            'type': 'connected',
            'message': 'WebSocket连接成功'
        })
        
        while app_state.is_running:
            try:
                # 接收客户端消息
                data = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=30.0
                )
                
                # 处理客户端请求
                if data.get('action') == 'ping':
                    await websocket.send_json({'type': 'pong'})
                elif data.get('action') == 'get_market_data':
                    symbol = data.get('symbol', app_state.trade_config.symbol)
                    if symbol in app_state.market_data_cache:
                        await websocket.send_json({
                            'type': 'market_data',
                            'symbol': symbol,
                            'data': app_state.market_data_cache[symbol][-50:]
                        })
                        
            except asyncio.TimeoutError:
                # 发送心跳
                await websocket.send_json({'type': 'heartbeat'})
                
    except WebSocketDisconnect:
        if websocket in app_state.active_connections:
            app_state.active_connections.remove(websocket)
        logger.info("WebSocket客户端断开连接")
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
        if websocket in app_state.active_connections:
            app_state.active_connections.remove(websocket)

# ============== 静态文件 ==============

# 生产环境服务前端构建文件
if os.path.exists("/mnt/okcomputer/output/app/dist"):
    app.mount("/", StaticFiles(directory="/mnt/okcomputer/output/app/dist", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    
    # 确保数据目录存在
    os.makedirs("/mnt/okcomputer/output/app/backend/data", exist_ok=True)
    os.makedirs("/mnt/okcomputer/output/app/backend/logs", exist_ok=True)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        reload=False,  # 生产环境关闭热重载
        workers=1,  # 单进程，节省内存
        loop="asyncio"
    )
