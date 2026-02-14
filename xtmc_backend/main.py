"""
XTMC量化交易系统 - FastAPI主入口
自我进化型AI交易系统
"""

import asyncio
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

import aiosqlite
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# 动态路径
BASE_DIR = Path(__file__).parent.resolve()
APP_DIR = BASE_DIR.parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# 确保模块路径
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ============== 数据模型 ==============

class TradeConfig(BaseModel):
    """交易配置"""
    exchange: str = "binance"
    api_key: str = ""
    api_secret: str = ""
    symbol: str = "BTCUSDT"
    timeframe: str = "1h"
    enable_trading: bool = False
    max_position: float = 100.0
    risk_percent: float = 2.0

class ChatMessage(BaseModel):
    """聊天消息"""
    role: str
    content: str
    timestamp: Optional[float] = None
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
    timestamp: float
    details: Optional[List[Dict]] = None

# ============== 全局状态管理 ==============

class XTMCState:
    """XTMC状态管理器"""
    def __init__(self):
        self.data_dir = str(BASE_DIR / "data")
        self.db_path = os.path.join(self.data_dir, "xtmc.db")
        self.config_path = os.path.join(self.data_dir, "config.json")
        self.is_running = False
        self.trade_config: TradeConfig = TradeConfig()
        self.active_connections: List[WebSocket] = []
        self.market_data_cache: Dict[str, List[Dict]] = {}
        self.brain = None
        self.exchange_client = None
        self.last_signals: List[TradeSignal] = []
        
    async def init(self):
        """初始化"""
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "tools_library"), exist_ok=True)
        await self.init_database()
        await self.load_config()
        
        # 初始化AI大脑
        from ai_core import XTMCBrain
        self.brain = XTMCBrain(self.data_dir)
        
        self.is_running = True
        logger.info("XTMC系统初始化完成")
        
    async def init_database(self):
        """初始化SQLite数据库"""
        async with aiosqlite.connect(self.db_path) as db:
            # K线数据表
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
                    timestamp REAL NOT NULL,
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
                    timestamp REAL NOT NULL,
                    executed BOOLEAN DEFAULT FALSE
                )
            """)
            
            # 聊天记录表
            await db.execute("""
                CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    metadata TEXT
                )
            """)
            
            # 进化历史表
            await db.execute("""
                CREATE TABLE IF NOT EXISTS evolution_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cycle_id TEXT NOT NULL,
                    start_time REAL NOT NULL,
                    end_time REAL,
                    status TEXT,
                    summary TEXT
                )
            """)
            
            await db.commit()
        logger.info("数据库初始化完成")
        
    async def load_config(self):
        """加载配置"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as f:
                    config = json.load(f)
                    self.trade_config = TradeConfig(**config.get('trade', {}))
                logger.info("配置加载完成")
        except Exception as e:
            logger.error(f"加载配置失败: {e}")
            
    async def save_config(self):
        """保存配置"""
        try:
            config = {'trade': self.trade_config.dict()}
            with open(self.config_path, 'w') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
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
xtmc_state = XTMCState()

# ============== 生命周期管理 ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动
    await xtmc_state.init()
    
    # 启动后台任务
    tasks = [
        asyncio.create_task(market_data_loop()),
        asyncio.create_task(ai_trading_loop()),
    ]
    
    # 启动AI进化循环
    if xtmc_state.brain:
        tasks.append(asyncio.create_task(xtmc_state.brain.start_evolution_loop()))
    
    logger.info("=" * 60)
    logger.info("XTMC量化交易系统启动完成")
    logger.info("=" * 60)
    
    yield
    
    # 关闭
    xtmc_state.is_running = False
    for task in tasks:
        task.cancel()
    logger.info("XTMC量化交易系统已关闭")

# ============== 后台任务 ==============

def generate_demo_data(symbol: str, count: int = 200) -> List[Dict]:
    """生成模拟K线数据用于展示"""
    import random
    import math
    
    now_ms = int(time.time() * 1000)
    interval_ms = 3600 * 1000  # 1h
    
    base_prices = {
        'BTCUSDT': 97000.0,
        'ETHUSDT': 2700.0,
        'BNBUSDT': 600.0,
    }
    base = base_prices.get(symbol, 50000.0)
    price = base
    candles = []
    
    for i in range(count):
        t = now_ms - (count - i) * interval_ms
        # 使用正弦波+随机游走模拟价格
        trend = math.sin(i / 30.0) * base * 0.03
        noise = random.gauss(0, base * 0.005)
        price = price + trend * 0.02 + noise
        price = max(price, base * 0.8)
        
        spread = price * random.uniform(0.002, 0.012)
        o = price + random.gauss(0, spread * 0.3)
        c = price + random.gauss(0, spread * 0.3)
        h = max(o, c) + abs(random.gauss(0, spread * 0.5))
        l = min(o, c) - abs(random.gauss(0, spread * 0.5))
        vol = random.uniform(50, 500) * (base / 50000)
        
        candles.append({
            'time': t,
            'open': round(o, 2),
            'high': round(h, 2),
            'low': round(l, 2),
            'close': round(c, 2),
            'volume': round(vol, 4),
        })
    
    return candles

async def market_data_loop():
    """市场数据获取循环 - 多数据源自动切换"""
    from exchange import ExchangeClient
    
    # 使用 auto 模式自动选择最优数据源
    client = ExchangeClient("auto")
    xtmc_state.exchange_client = client
    
    consecutive_failures = 0
    demo_mode = False
    
    while xtmc_state.is_running:
        try:
            symbol = xtmc_state.trade_config.symbol
            timeframe = xtmc_state.trade_config.timeframe
            
            data = await client.fetch_ohlcv(symbol, timeframe, limit=200)
            if data:
                consecutive_failures = 0
                if demo_mode:
                    demo_mode = False
                    logger.info(f"已恢复真实数据源: {client.get_active_source()}")
                
                xtmc_state.market_data_cache[symbol] = data
                
                # 保存到数据库
                await save_kline_data(symbol, timeframe, data)
                
                # 广播给前端（含数据源信息）
                await xtmc_state.broadcast({
                    'type': 'market_data',
                    'symbol': symbol,
                    'source': client.get_active_source(),
                    'data': data[-50:]
                })
            else:
                consecutive_failures += 1
                
                # 连续失败5次后才切换到模拟数据模式（给真实源更多机会）
                if consecutive_failures >= 5 and not demo_mode:
                    demo_mode = True
                    logger.warning(f"所有数据源不可达，切换到模拟数据模式 (symbol={symbol})")
                    demo_data = generate_demo_data(symbol)
                    xtmc_state.market_data_cache[symbol] = demo_data
                    await save_kline_data(symbol, timeframe, demo_data)
                    await xtmc_state.broadcast({
                        'type': 'market_data',
                        'symbol': symbol,
                        'source': 'demo',
                        'data': demo_data[-50:]
                    })
                
            # 正常模式15秒，模拟模式120秒
            await asyncio.sleep(120 if demo_mode else 15)
        except asyncio.CancelledError:
            break
        except Exception as e:
            consecutive_failures += 1
            logger.error(f"市场数据循环错误: {e}")
            await asyncio.sleep(min(60, 15 * consecutive_failures))

async def ai_trading_loop():
    """AI交易决策循环"""
    while xtmc_state.is_running:
        try:
            if xtmc_state.brain and xtmc_state.market_data_cache:
                symbol = xtmc_state.trade_config.symbol
                data = xtmc_state.market_data_cache.get(symbol, [])
                
                if len(data) >= 20:
                    # AI决策
                    decision = await xtmc_state.brain.make_trading_decision(
                        {'data': data}, symbol
                    )
                    
                    details = decision.get('details', [])
                    first_detail = details[0] if details else {}
                    
                    signal = TradeSignal(
                        symbol=symbol,
                        action=decision.get('signal', 'HOLD'),
                        price=data[-1]['close'],
                        confidence=decision.get('confidence', 0.5),
                        reason=first_detail.get('reason', 'AI决策'),
                        timestamp=time.time(),
                        details=details
                    )
                    
                    xtmc_state.last_signals.append(signal)
                    if len(xtmc_state.last_signals) > 100:
                        xtmc_state.last_signals.pop(0)
                    
                    # 保存信号
                    await save_ai_signal(signal)
                    
                    # 广播信号
                    await xtmc_state.broadcast({
                        'type': 'ai_signal',
                        'signal': signal.dict()
                    })
                    
            await asyncio.sleep(30)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"AI交易循环错误: {e}")
            await asyncio.sleep(60)

async def save_kline_data(symbol: str, timeframe: str, data: List[Dict]):
    """保存K线数据"""
    try:
        async with aiosqlite.connect(xtmc_state.db_path) as db:
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
        async with aiosqlite.connect(xtmc_state.db_path) as db:
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

# ============== FastAPI应用 ==============

app = FastAPI(
    title="XTMC量化交易系统",
    description="自我进化型AI量化交易系统",
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

# ============== API路由 ==============

@app.get("/api/status")
async def get_status():
    """获取系统状态"""
    import psutil
    
    brain_status = xtmc_state.brain.get_status() if xtmc_state.brain else {}
    
    return {
        'status': 'running' if xtmc_state.is_running else 'stopped',
        'timestamp': time.time(),
        'system': {
            'cpu_percent': psutil.cpu_percent(),
            'memory_percent': psutil.virtual_memory().percent,
            'memory_used': psutil.virtual_memory().used // (1024*1024),
            'memory_total': psutil.virtual_memory().total // (1024*1024),
        },
        'trading': {
            'enabled': xtmc_state.trade_config.enable_trading,
            'exchange': xtmc_state.trade_config.exchange,
            'symbol': xtmc_state.trade_config.symbol,
        },
        'ai': brain_status,
        'data_source': {
            'active': xtmc_state.exchange_client.get_active_source() if xtmc_state.exchange_client else 'none',
            'stats': xtmc_state.exchange_client.get_source_stats() if xtmc_state.exchange_client else {},
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
        symbol = xtmc_state.trade_config.symbol
        
    try:
        async with aiosqlite.connect(xtmc_state.db_path) as db:
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
            
            # 数据库无数据时，尝试直接从交易所获取
            if not data:
                cached = xtmc_state.market_data_cache.get(symbol, [])
                if cached:
                    data = cached[-limit:]
                elif xtmc_state.exchange_client:
                    # 尝试实时获取
                    live_data = await xtmc_state.exchange_client.fetch_ohlcv(symbol, timeframe, limit)
                    if live_data:
                        data = live_data
                        xtmc_state.market_data_cache[symbol] = live_data
                        await save_kline_data(symbol, timeframe, live_data)
                
                # 最终兜底
                if not data:
                    data = generate_demo_data(symbol, min(limit, 200))
                    xtmc_state.market_data_cache[symbol] = data
            
            source = "demo"
            if xtmc_state.exchange_client:
                source = xtmc_state.exchange_client.get_active_source()
            
            return {'symbol': symbol, 'timeframe': timeframe, 'data': data, 'source': source}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals")
async def get_signals(limit: int = Query(default=50, le=100)):
    """获取AI信号历史"""
    try:
        async with aiosqlite.connect(xtmc_state.db_path) as db:
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

@app.get("/api/ai/tools")
async def get_ai_tools():
    """获取AI工具库"""
    if xtmc_state.brain:
        tools = xtmc_state.brain.tool_lib.get_tool_stats()
        return tools
    return {'total_tools': 0, 'tool_list': []}

@app.get("/api/ai/reflections")
async def get_reflections(limit: int = Query(default=10, le=50)):
    """获取AI反思历史"""
    if xtmc_state.brain:
        reflections = xtmc_state.brain.reflection.get_reflection_history(limit)
        return {'reflections': reflections}
    return {'reflections': []}

@app.post("/api/config/trade")
async def update_trade_config(config: TradeConfig):
    """更新交易配置"""
    xtmc_state.trade_config = config
    await xtmc_state.save_config()
    return {'status': 'success', 'config': config.dict()}

@app.get("/api/config/trade")
async def get_trade_config():
    """获取交易配置"""
    return xtmc_state.trade_config.dict()

@app.post("/api/chat")
async def chat(message: ChatMessage):
    """AI对话接口 - 使用LLM客户端"""
    try:
        # 保存用户消息
        msg_dict = message.dict()
        msg_dict['timestamp'] = time.time()
        
        async with aiosqlite.connect(xtmc_state.db_path) as db:
            await db.execute("""
                INSERT INTO chat_history (role, content, timestamp, metadata)
                VALUES (?, ?, ?, ?)
            """, (
                message.role, message.content, msg_dict['timestamp'],
                json.dumps(message.metadata) if message.metadata else None
            ))
            await db.commit()
        
        # 生成AI回复 - 优先使用LLM，降级到规则引擎
        response_content = await generate_ai_response_async(message.content)
        
        # 保存AI回复
        async with aiosqlite.connect(xtmc_state.db_path) as db:
            await db.execute("""
                INSERT INTO chat_history (role, content, timestamp, metadata)
                VALUES (?, ?, ?, ?)
            """, (
                'assistant', response_content, time.time(), None
            ))
            await db.commit()
        
        return {'content': response_content, 'metadata': {'intent': 'chat'}}
    except Exception as e:
        logger.error(f"AI对话错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def generate_ai_response_async(content: str) -> str:
    """异步生成AI回复 - 先尝试LLM，失败则用本地规则"""
    from ai_core import get_llm_client
    
    # 获取LLM客户端
    llm = get_llm_client()
    
    # 构建增强的上下文信息
    context_info = _build_context_info()
    enhanced_prompt = f"""当前系统状态:
{context_info}

用户问题: {content}"""
    
    try:
        # 尝试使用LLM
        response = await llm.chat(enhanced_prompt)
        if response:
            return response
    except Exception as e:
        logger.warning(f"LLM调用失败，使用本地规则: {e}")
    
    # 降级到本地规则引擎
    return generate_ai_response(content)


def _build_context_info() -> str:
    """构建上下文信息供LLM参考"""
    symbol = xtmc_state.trade_config.symbol
    data = xtmc_state.market_data_cache.get(symbol, [])
    
    info_parts = []
    
    # 市场数据
    if data:
        last = data[-1]
        info_parts.append(f"交易对: {symbol}")
        info_parts.append(f"当前价格: ${last['close']:,.2f}")
        
        if len(data) >= 2:
            change = ((last['close'] - data[-2]['close']) / data[-2]['close']) * 100
            info_parts.append(f"涨跌幅: {change:+.2f}%")
    
    # 数据源
    if xtmc_state.exchange_client:
        source = xtmc_state.exchange_client.get_active_source()
        info_parts.append(f"数据源: {source}")
    
    # AI状态
    if xtmc_state.brain:
        status = xtmc_state.brain.get_status()
        info_parts.append(f"AI工具数: {status.get('tool_count', 0)}")
    
    # 最新信号
    if xtmc_state.last_signals:
        sig = xtmc_state.last_signals[-1]
        info_parts.append(f"最新信号: {sig.action} (置信度{sig.confidence*100:.0f}%)")
    
    return "\n".join(info_parts)

def generate_ai_response(content: str) -> str:
    """生成AI回复 - 基于关键词匹配和上下文"""
    content_lower = content.lower().strip()
    
    # 系统状态查询
    if any(kw in content_lower for kw in ['状态', 'status', '运行', '系统']):
        brain_status = xtmc_state.brain.get_status() if xtmc_state.brain else {}
        perf = brain_status.get('performance', {})
        
        # 数据源状态
        source_name = 'none'
        source_info = ''
        if xtmc_state.exchange_client:
            source_name = xtmc_state.exchange_client.get_active_source()
            stats = xtmc_state.exchange_client.get_source_stats()
            healthy = [n for n, s in stats.items() if s['healthy']]
            source_info = f"\n**数据源**: {source_name} (可用: {', '.join(healthy) if healthy else '无'})"
        
        return f"""📊 **XTMC系统状态**

**AI大脑**: {'运行中' if brain_status.get('is_running') else '已停止'}
**工具数量**: {brain_status.get('tool_count', 0)} 个
**进化次数**: {brain_status.get('evolution_count', 0)} 次
**胜率**: {perf.get('win_rate', 0)*100:.1f}%
**总收益**: {perf.get('total_profit', 0):.2f} USDT
**总交易**: {perf.get('total_trades', 0)} 笔
**最大回撤**: {perf.get('max_drawdown', 0)*100:.1f}%{source_info}

交易所: {xtmc_state.trade_config.exchange} | 交易对: {xtmc_state.trade_config.symbol} | 周期: {xtmc_state.trade_config.timeframe}"""
    
    # 工具库查询
    elif any(kw in content_lower for kw in ['工具', 'tool', '策略', '指标']):
        tools = xtmc_state.brain.tool_lib.get_all_tools() if xtmc_state.brain else {}
        tool_list = '\n'.join([f"  • {name}" for name in tools.keys()]) if tools else "  暂无工具"
        return f"""🛠️ **AI工具库** (共 {len(tools)} 个)

{tool_list}

这些工具由AI自动生成，用于分析市场数据和生成交易信号。每个进化周期，AI会评估工具表现并自动优化。"""
    
    # 进化机制
    elif any(kw in content_lower for kw in ['进化', 'evolution', '学习', '自我']):
        return """🧬 **自我进化机制**

XTMC每6小时执行一次进化周期:

1. **反思** → 分析最近交易的胜率、收益、风险
2. **规划** → 识别能力缺口，决定需要哪些新工具
3. **生成** → 自动编写Python分析工具代码
4. **测试** → 在沙箱中验证代码正确性
5. **部署** → 通过测试的工具加入工具库

当前所有工具会对每个交易信号进行投票，多数决胜出最终建议。"""
    
    # 行情分析
    elif any(kw in content_lower for kw in ['行情', '分析', '趋势', '价格', '涨', '跌', 'btc', 'eth']):
        symbol = xtmc_state.trade_config.symbol
        data = xtmc_state.market_data_cache.get(symbol, [])
        if data and len(data) >= 2:
            last = data[-1]
            prev = data[-2]
            change = ((last['close'] - prev['close']) / prev['close']) * 100
            high = max(d['high'] for d in data[-20:]) if len(data) >= 20 else last['high']
            low = min(d['low'] for d in data[-20:]) if len(data) >= 20 else last['low']
            direction = "上涨📈" if change > 0 else "下跌📉" if change < 0 else "横盘➡️"
            
            # 简单趋势判断
            if len(data) >= 20:
                closes = [d['close'] for d in data[-20:]]
                ma20 = sum(closes) / len(closes)
                trend = "多头" if last['close'] > ma20 else "空头"
            else:
                trend = "数据不足"
            
            return f"""📈 **{symbol} 行情分析**

当前价格: ${last['close']:,.2f} ({direction} {abs(change):.2f}%)
20周期高点: ${high:,.2f}
20周期低点: ${low:,.2f}
MA20趋势: {trend} (MA20=${ma20:,.2f} vs 现价${last['close']:,.2f})
数据源: {xtmc_state.exchange_client.get_active_source() if xtmc_state.exchange_client else 'cache'}

最近信号数: {len(xtmc_state.last_signals)} 个
AI工具投票: {xtmc_state.brain.tool_lib.get_tool_stats().get('total_tools', 0)} 个工具参与决策"""
        else:
            return f"📊 {symbol} 暂无足够的市场数据进行分析。交易所API连接中，请稍等数据加载..."
    
    # 交易建议
    elif any(kw in content_lower for kw in ['建议', '买', '卖', '交易', '信号', '操作']):
        if xtmc_state.last_signals:
            last_signal = xtmc_state.last_signals[-1]
            action_map = {'BUY': '买入🟢', 'SELL': '卖出🔴', 'HOLD': '观望⚪'}
            action_text = action_map.get(last_signal.action, last_signal.action)
            return f"""📋 **最新交易信号**

信号: {action_text}
价格: ${last_signal.price:,.2f}
置信度: {last_signal.confidence*100:.0f}%
原因: {last_signal.reason}

⚠️ 注意: AI信号仅供参考，不构成投资建议。请结合自身判断做出决策。"""
        else:
            return "📋 暂无交易信号。AI正在分析市场数据，信号生成后会自动推送。"
    
    # 时间相关
    elif any(kw in content_lower for kw in ['时间', '几点', '日期']):
        now = datetime.now()
        return f"🕐 当前时间: {now.strftime('%Y年%m月%d日 %H:%M:%S')}"
    
    # 帮助
    elif any(kw in content_lower for kw in ['帮助', 'help', '功能', '什么']):
        return """💡 **XTMC AI助手功能**

您可以问我:
• **"系统状态"** → 查看AI运行状态和交易表现
• **"工具库"** → 查看AI自动生成的分析工具
• **"进化机制"** → 了解AI如何自我进化
• **"分析行情"** → 获取当前市场分析
• **"交易建议"** → 查看最新AI交易信号
• **"几点了"** → 查看当前时间

也可以直接输入任何问题，我会尽力回答！"""
    
    # 打招呼
    elif any(kw in content_lower for kw in ['你好', 'hello', 'hi', '嗨', '早']):
        tool_count = xtmc_state.brain.tool_lib.get_tool_stats().get('total_tools', 0) if xtmc_state.brain else 0
        return f"""👋 你好！我是XTMC AI交易助手。

当前系统已加载 {tool_count} 个分析工具，正在监控 {xtmc_state.trade_config.symbol}。

有什么我可以帮你的？试试问"分析行情"或"系统状态"。"""
    
    # 默认回复 - 尝试给出有用的信息而不是固定模板
    else:
        symbol = xtmc_state.trade_config.symbol
        data = xtmc_state.market_data_cache.get(symbol, [])
        price_info = f"${data[-1]['close']:,.2f}" if data else "加载中"
        tool_count = xtmc_state.brain.tool_lib.get_tool_stats().get('total_tools', 0) if xtmc_state.brain else 0
        signal_count = len(xtmc_state.last_signals)
        
        return f"""收到您的消息: "{content[:50]}"

目前我的理解能力还比较基础，暂时无法处理复杂对话。以下是一些我能做的事:

📊 {symbol} 当前价格: {price_info}
🛠️ 已加载工具: {tool_count} 个
📋 历史信号: {signal_count} 个

💡 试试问我: "分析行情"、"系统状态"、"交易建议"、"工具库" """

@app.get("/api/chat/history")
async def get_chat_history(limit: int = Query(default=50, le=100)):
    """获取聊天历史"""
    try:
        async with aiosqlite.connect(xtmc_state.db_path) as db:
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

# ============== WebSocket ==============

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket实时数据推送"""
    await websocket.accept()
    xtmc_state.active_connections.append(websocket)
    
    try:
        await websocket.send_json({
            'type': 'connected',
            'message': 'XTMC WebSocket连接成功'
        })
        
        while xtmc_state.is_running:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=30.0
                )
                
                if data.get('action') == 'ping':
                    await websocket.send_json({'type': 'pong'})
                    
            except asyncio.TimeoutError:
                await websocket.send_json({'type': 'heartbeat'})
                
    except WebSocketDisconnect:
        if websocket in xtmc_state.active_connections:
            xtmc_state.active_connections.remove(websocket)
        logger.info("WebSocket客户端断开连接")
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
        if websocket in xtmc_state.active_connections:
            xtmc_state.active_connections.remove(websocket)

# ============== 静态文件 ==============

dist_dir = APP_DIR / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    
    os.makedirs(str(BASE_DIR / "data"), exist_ok=True)
    os.makedirs(str(BASE_DIR / "logs"), exist_ok=True)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        reload=False,
        workers=1,
        loop="asyncio"
    )
