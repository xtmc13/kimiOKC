"""
XTMC量化交易系统 - FastAPI主入口
自我进化型AI交易系统 (LLM增强版)
"""

import asyncio
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Dict, List, Optional, Any

import aiosqlite
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# 动态路径配置
BASE_DIR = Path(__file__).parent.resolve()
DATA_DIR = BASE_DIR / "data"
LOGS_DIR = BASE_DIR / "logs"
DIST_DIR = BASE_DIR.parent / "dist"

DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# 配置日志
log_handlers = [logging.StreamHandler(sys.stdout)]
try:
    log_handlers.insert(0, RotatingFileHandler(
        str(LOGS_DIR / "xtmc.log"), maxBytes=10*1024*1024, backupCount=3
    ))
except Exception:
    pass

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=log_handlers
)
logger = logging.getLogger(__name__)

# ============== 数据模型 ==============

class TradeConfig(BaseModel):
    exchange: str = "okx"
    api_key: str = ""
    api_secret: str = ""
    okx_passphrase: str = ""
    proxy: str = ""
    symbol: str = "BTCUSDT"
    timeframe: str = "1h"
    enable_trading: bool = False
    max_position: float = 100.0
    risk_percent: float = 2.0

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[float] = None
    metadata: Optional[Dict] = None

class TradeSignal(BaseModel):
    symbol: str
    action: str
    price: float
    confidence: float
    reason: str
    timestamp: float
    details: Optional[List[Dict]] = None

# ============== 全局状态管理 ==============

class XTMCState:
    def __init__(self):
        self.data_dir = str(DATA_DIR)
        self.db_path = str(DATA_DIR / "xtmc.db")
        self.config_path = str(DATA_DIR / "config.json")
        self.is_running = False
        self.trade_config: TradeConfig = TradeConfig()
        self.active_connections: List[WebSocket] = []
        self.market_data_cache: Dict[str, List[Dict]] = {}
        self.brain = None
        self.exchange_client = None
        self.llm_service = None
        self.last_signals: List[TradeSignal] = []

    async def init(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "tools_library"), exist_ok=True)
        await self.init_database()
        await self.load_config()

        # 初始化LLM服务（懒加载，不立即加载模型）
        llm = None
        try:
            from llm import LLMService
            llm = LLMService()
            self.llm_service = llm
            logger.info("LLM服务已初始化（懒加载，首次调用时加载模型）")
        except Exception as e:
            logger.warning("LLM服务初始化失败，将使用规则引擎: %s", e)

        # 初始化AI大脑（注入LLM）
        from ai_core import XTMCBrain
        self.brain = XTMCBrain(self.data_dir, llm=llm)

        self.is_running = True
        logger.info("XTMC系统初始化完成")

    async def init_database(self):
        async with aiosqlite.connect(self.db_path) as db:
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
            await db.execute("""
                CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    metadata TEXT
                )
            """)
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
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r") as f:
                    config = json.load(f)
                    self.trade_config = TradeConfig(**config.get("trade", {}))
                logger.info("配置加载完成")
        except Exception as e:
            logger.error("加载配置失败: %s", e)

    async def save_config(self):
        try:
            config = {"trade": self.trade_config.dict()}
            with open(self.config_path, "w") as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error("保存配置失败: %s", e)

    async def broadcast(self, message: Dict):
        disconnected = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                disconnected.append(conn)
        for conn in disconnected:
            if conn in self.active_connections:
                self.active_connections.remove(conn)

xtmc_state = XTMCState()

# ============== AI聊天核心 ==============

CHAT_SYSTEM_PROMPT = """你是XTMC量化交易AI助手，一个部署在本地设备上的自我进化型加密货币交易系统。

你的核心能力：
- 实时监控虚拟币市场（BTC、ETH等）
- 使用多种技术分析工具（ADX、RSI、KDJ、布林带等）生成交易信号
- 自我进化：定期反思交易表现，自动生成新的分析工具
- 与用户自然对话，解释市场状况和交易决策

回答要求：
- 简洁专业，避免过长的回复
- 如果用户问市场相关问题，结合提供的实时数据回答
- 如果用户想操作系统（开关交易、修改配置等），明确告知如何操作
- 使用中文回复"""


async def generate_ai_response(content: str) -> str:
    """LLM驱动的AI对话，失败时回退到增强模板"""

    # 构建上下文
    context_parts = []

    # 系统状态
    if xtmc_state.brain:
        status = xtmc_state.brain.get_status()
        context_parts.append(
            f"[系统状态] 运行中 | 工具数: {status.get('tool_count', 0)} | "
            f"进化次数: {status.get('evolution_count', 0)} | "
            f"胜率: {status.get('win_rate', 0)*100:.1f}% | "
            f"总收益: {status.get('total_profit', 0):.2f} USDT"
        )

    # 最新市场数据
    symbol = xtmc_state.trade_config.symbol
    data = xtmc_state.market_data_cache.get(symbol, [])
    if data:
        latest = data[-1]
        context_parts.append(
            f"[市场数据] {symbol} 最新价: {latest.get('close', 0):.2f} | "
            f"最高: {latest.get('high', 0):.2f} | 最低: {latest.get('low', 0):.2f}"
        )

    # 最新信号
    if xtmc_state.last_signals:
        s = xtmc_state.last_signals[-1]
        context_parts.append(
            f"[最新信号] {s.action} @ {s.price:.2f} | 置信度: {s.confidence:.0%} | 原因: {s.reason}"
        )

    context = "\n".join(context_parts) if context_parts else "暂无实时数据"

    # 尝试LLM
    if xtmc_state.llm_service:
        try:
            # 加载最近5条对话历史
            history_messages = []
            try:
                async with aiosqlite.connect(xtmc_state.db_path) as db:
                    cursor = await db.execute(
                        "SELECT role, content FROM chat_history ORDER BY timestamp DESC LIMIT 10"
                    )
                    rows = await cursor.fetchall()
                    for row in reversed(rows):
                        history_messages.append({"role": row[0], "content": row[1]})
            except Exception:
                pass

            messages = [
                {"role": "system", "content": CHAT_SYSTEM_PROMPT + f"\n\n当前实时数据:\n{context}"},
            ]
            # 加入历史（最多5轮）
            messages.extend(history_messages[-10:])
            messages.append({"role": "user", "content": content})

            response = xtmc_state.llm_service.chat(messages, max_tokens=512)
            if response and len(response) > 5:
                return response
        except Exception as e:
            logger.warning("LLM聊天失败，回退模板: %s", e)

    # 回退：增强模板
    return _template_response(content, context)


def _template_response(content: str, context: str) -> str:
    """模板回退回复"""
    content_lower = content.lower()

    if any(kw in content_lower for kw in ["状态", "status", "运行"]):
        status = xtmc_state.brain.get_status() if xtmc_state.brain else {}
        llm_status = "可用" if xtmc_state.llm_service and xtmc_state.llm_service.is_loaded else "未加载"
        return (
            f"**XTMC系统状态**\n\n"
            f"AI大脑: {'运行中' if status.get('is_running') else '已停止'}\n"
            f"LLM引擎: {llm_status}\n"
            f"工具数量: {status.get('tool_count', 0)} 个\n"
            f"进化次数: {status.get('evolution_count', 0)} 次\n"
            f"胜率: {status.get('win_rate', 0)*100:.1f}%\n"
            f"总收益: {status.get('total_profit', 0):.2f} USDT\n\n"
            f"(LLM未加载，使用模板回复)"
        )

    if any(kw in content_lower for kw in ["工具", "tool", "策略"]):
        tools = xtmc_state.brain.tool_lib.get_all_tools() if xtmc_state.brain else {}
        tool_list = "\n".join(f"- {name}" for name in tools.keys()) if tools else "暂无工具"
        return f"**XTMC工具库** (共{len(tools)}个)\n\n{tool_list}"

    if any(kw in content_lower for kw in ["进化", "evolution", "学习"]):
        return (
            "**XTMC自我进化机制**\n\n"
            "1. 反思 - LLM分析交易表现\n"
            "2. 规划 - LLM识别缺口，规划新工具\n"
            "3. 生成 - LLM编写Python代码\n"
            "4. 测试 - 沙箱验证代码正确性\n"
            "5. 部署 - 添加到工具库\n\n"
            "每6小时执行一次进化周期。"
        )

    return (
        f"**XTMC AI助手**\n\n"
        f"当前数据:\n{context}\n\n"
        f"可以问我：系统状态、工具库、进化机制、市场分析等\n"
        f"(LLM未加载，使用模板回复)"
    )


# ============== 生命周期管理 ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    await xtmc_state.init()

    tasks = [
        asyncio.create_task(market_data_loop()),
        asyncio.create_task(ai_trading_loop()),
    ]
    if xtmc_state.brain:
        tasks.append(asyncio.create_task(xtmc_state.brain.start_evolution_loop()))

    logger.info("=" * 60)
    logger.info("XTMC量化交易系统启动完成")
    logger.info("=" * 60)

    yield

    xtmc_state.is_running = False
    if xtmc_state.brain:
        xtmc_state.brain.stop()
    for task in tasks:
        task.cancel()
    if xtmc_state.exchange_client:
        await xtmc_state.exchange_client.close()
    if xtmc_state.llm_service:
        xtmc_state.llm_service.unload()
    logger.info("XTMC量化交易系统已关闭")

# ============== 后台任务 ==============

async def market_data_loop():
    from exchange import ExchangeClient

    cfg = xtmc_state.trade_config
    client = ExchangeClient(
        exchange=cfg.exchange,
        api_key=cfg.api_key,
        api_secret=cfg.api_secret,
        proxy=cfg.proxy,
        okx_passphrase=cfg.okx_passphrase,
    )
    xtmc_state.exchange_client = client

    while xtmc_state.is_running:
        try:
            symbol = xtmc_state.trade_config.symbol
            timeframe = xtmc_state.trade_config.timeframe

            data = await client.fetch_ohlcv(symbol, timeframe, limit=100)
            if data:
                xtmc_state.market_data_cache[symbol] = data
                await save_kline_data(symbol, timeframe, data)
                await xtmc_state.broadcast({
                    "type": "market_data", "symbol": symbol, "data": data[-50:]
                })

            await asyncio.sleep(10)
        except Exception as e:
            logger.error("市场数据循环错误: %s", e)
            await asyncio.sleep(30)


async def ai_trading_loop():
    while xtmc_state.is_running:
        try:
            if xtmc_state.brain and xtmc_state.market_data_cache:
                symbol = xtmc_state.trade_config.symbol
                data = xtmc_state.market_data_cache.get(symbol, [])

                if len(data) >= 20:
                    decision = await xtmc_state.brain.make_trading_decision(
                        {"data": data}, symbol
                    )
                    details = decision.get("details", [])
                    reason = details[0].get("reason", "AI决策") if details else "AI决策"
                    signal = TradeSignal(
                        symbol=symbol,
                        action=decision["signal"],
                        price=data[-1]["close"],
                        confidence=decision["confidence"],
                        reason=reason,
                        timestamp=time.time(),
                        details=details,
                    )
                    xtmc_state.last_signals.append(signal)
                    if len(xtmc_state.last_signals) > 100:
                        xtmc_state.last_signals.pop(0)
                    await save_ai_signal(signal)
                    await xtmc_state.broadcast({"type": "ai_signal", "signal": signal.dict()})

            await asyncio.sleep(30)
        except Exception as e:
            logger.error("AI交易循环错误: %s", e)
            await asyncio.sleep(60)


async def save_kline_data(symbol: str, timeframe: str, data: List[Dict]):
    try:
        async with aiosqlite.connect(xtmc_state.db_path) as db:
            for c in data:
                await db.execute(
                    "INSERT OR REPLACE INTO kline_data "
                    "(symbol,timeframe,timestamp,open,high,low,close,volume) "
                    "VALUES (?,?,?,?,?,?,?,?)",
                    (symbol, timeframe, c["time"], c["open"], c["high"], c["low"], c["close"], c["volume"]),
                )
            await db.commit()
    except Exception as e:
        logger.error("保存K线数据失败: %s", e)


async def save_ai_signal(signal: TradeSignal):
    try:
        async with aiosqlite.connect(xtmc_state.db_path) as db:
            await db.execute(
                "INSERT INTO ai_signals (symbol,action,price,confidence,reason,timestamp) VALUES (?,?,?,?,?,?)",
                (signal.symbol, signal.action, signal.price, signal.confidence, signal.reason, signal.timestamp),
            )
            await db.commit()
    except Exception as e:
        logger.error("保存AI信号失败: %s", e)

# ============== FastAPI应用 ==============

app = FastAPI(title="XTMC量化交易系统", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# ============== API路由 ==============

@app.get("/api/status")
async def get_status():
    try:
        import psutil
        sys_info = {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "memory_used": psutil.virtual_memory().used // (1024*1024),
            "memory_total": psutil.virtual_memory().total // (1024*1024),
        }
    except Exception:
        sys_info = {"cpu_percent": 0, "memory_percent": 0, "memory_used": 0, "memory_total": 0}

    brain_status = xtmc_state.brain.get_status() if xtmc_state.brain else {}
    llm_status = None
    if xtmc_state.llm_service:
        llm_status = xtmc_state.llm_service.get_status()

    return {
        "status": "running" if xtmc_state.is_running else "stopped",
        "timestamp": time.time(),
        "system": sys_info,
        "trading": {
            "enabled": xtmc_state.trade_config.enable_trading,
            "exchange": xtmc_state.trade_config.exchange,
            "symbol": xtmc_state.trade_config.symbol,
        },
        "ai": brain_status,
        "llm": llm_status,
    }

@app.get("/api/market/data")
async def get_market_data(
    symbol: str = Query(default=None),
    timeframe: str = Query(default="1h"),
    limit: int = Query(default=500, le=1000),
):
    if not symbol:
        symbol = xtmc_state.trade_config.symbol
    try:
        async with aiosqlite.connect(xtmc_state.db_path) as db:
            cursor = await db.execute(
                "SELECT timestamp,open,high,low,close,volume FROM kline_data "
                "WHERE symbol=? AND timeframe=? ORDER BY timestamp DESC LIMIT ?",
                (symbol, timeframe, limit),
            )
            rows = await cursor.fetchall()
            data = [
                {"time": r[0], "open": r[1], "high": r[2], "low": r[3], "close": r[4], "volume": r[5]}
                for r in reversed(rows)
            ]
            return {"symbol": symbol, "timeframe": timeframe, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals")
async def get_signals(limit: int = Query(default=50, le=100)):
    try:
        async with aiosqlite.connect(xtmc_state.db_path) as db:
            cursor = await db.execute(
                "SELECT symbol,action,price,confidence,reason,timestamp,executed "
                "FROM ai_signals ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            )
            rows = await cursor.fetchall()
            return {
                "signals": [
                    {"symbol": r[0], "action": r[1], "price": r[2], "confidence": r[3],
                     "reason": r[4], "timestamp": r[5], "executed": r[6]}
                    for r in rows
                ]
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/tools")
async def get_ai_tools():
    if xtmc_state.brain:
        return xtmc_state.brain.tool_lib.get_tool_stats()
    return {"total_tools": 0, "tool_list": []}

@app.get("/api/ai/reflections")
async def get_reflections(limit: int = Query(default=10, le=50)):
    if xtmc_state.brain:
        return {"reflections": xtmc_state.brain.reflection.get_reflection_history(limit)}
    return {"reflections": []}

@app.post("/api/config/trade")
async def update_trade_config(config: TradeConfig):
    xtmc_state.trade_config = config
    await xtmc_state.save_config()
    return {"status": "success", "config": config.dict()}

@app.get("/api/config/trade")
async def get_trade_config():
    return xtmc_state.trade_config.dict()

@app.get("/api/llm/status")
async def get_llm_status():
    """获取LLM状态"""
    if xtmc_state.llm_service:
        return xtmc_state.llm_service.get_status()
    return {"loaded": False, "model": "none", "model_exists": False}

@app.post("/api/chat")
async def chat(message: ChatMessage):
    try:
        msg_ts = time.time()
        async with aiosqlite.connect(xtmc_state.db_path) as db:
            await db.execute(
                "INSERT INTO chat_history (role,content,timestamp,metadata) VALUES (?,?,?,?)",
                (message.role, message.content, msg_ts,
                 json.dumps(message.metadata) if message.metadata else None),
            )
            await db.commit()

        response_content = await generate_ai_response(message.content)

        async with aiosqlite.connect(xtmc_state.db_path) as db:
            await db.execute(
                "INSERT INTO chat_history (role,content,timestamp,metadata) VALUES (?,?,?,?)",
                ("assistant", response_content, time.time(), None),
            )
            await db.commit()

        return {"content": response_content, "metadata": {"intent": "chat"}}
    except Exception as e:
        logger.error("AI对话错误: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/history")
async def get_chat_history(limit: int = Query(default=50, le=100)):
    try:
        async with aiosqlite.connect(xtmc_state.db_path) as db:
            cursor = await db.execute(
                "SELECT role,content,timestamp,metadata FROM chat_history ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            )
            rows = await cursor.fetchall()
            return {
                "messages": [
                    {"role": r[0], "content": r[1], "timestamp": r[2],
                     "metadata": json.loads(r[3]) if r[3] else None}
                    for r in reversed(rows)
                ]
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============== WebSocket ==============

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    xtmc_state.active_connections.append(websocket)
    try:
        await websocket.send_json({"type": "connected", "message": "XTMC WebSocket连接成功"})
        while xtmc_state.is_running:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                if data.get("action") == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WebSocket错误: %s", e)
    finally:
        if websocket in xtmc_state.active_connections:
            xtmc_state.active_connections.remove(websocket)

# ============== 静态文件 ==============

_dist_dir = str(DIST_DIR)
if os.path.exists(_dist_dir):
    app.mount("/", StaticFiles(directory=_dist_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=False, workers=1, loop="asyncio")
