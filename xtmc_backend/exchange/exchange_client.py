"""
交易所客户端 - 多数据源自动切换
支持 Bybit / OKX / Binance 公开API（无需API Key）
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional

import aiohttp

logger = logging.getLogger(__name__)


class ExchangeClient:
    """多数据源交易所客户端 - 自动故障切换"""

    # 数据源配置（按优先级排序）
    SOURCES = [
        {
            "name": "bybit",
            "base_url": "https://api.bybit.com",
            "kline_path": "/v5/market/kline",
            "ticker_path": "/v5/market/tickers",
        },
        {
            "name": "okx",
            "base_url": "https://www.okx.com",
            "kline_path": "/api/v5/market/candles",
            "ticker_path": "/api/v5/market/ticker",
        },
        {
            "name": "binance",
            "base_url": "https://api.binance.com",
            "kline_path": "/api/v3/klines",
            "ticker_path": "/api/v3/ticker/24hr",
        },
        {
            "name": "binance_backup",
            "base_url": "https://data-api.binance.vision",
            "kline_path": "/api/v3/klines",
            "ticker_path": "/api/v3/ticker/24hr",
        },
    ]

    def __init__(self, exchange: str = "auto", api_key: str = "", api_secret: str = ""):
        self.preferred_exchange = exchange.lower()
        self.api_key = api_key
        self.api_secret = api_secret
        self.session: Optional[aiohttp.ClientSession] = None

        # 数据源健康状态
        self._source_failures: Dict[str, int] = {}
        self._source_last_success: Dict[str, float] = {}
        self._active_source: Optional[str] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=12, connect=6),
                headers={"User-Agent": "XTMC-Trading/1.0"},
            )
        return self.session

    def _get_ordered_sources(self) -> list:
        """按健康度排序数据源"""
        # 如果指定了具体交易所且不是 auto，优先使用
        if self.preferred_exchange not in ("auto", ""):
            preferred = [s for s in self.SOURCES if s["name"] == self.preferred_exchange]
            others = [s for s in self.SOURCES if s["name"] != self.preferred_exchange]
            return preferred + others

        # auto 模式：按失败次数排序，失败少的优先
        def sort_key(src):
            failures = self._source_failures.get(src["name"], 0)
            last_ok = self._source_last_success.get(src["name"], 0)
            return (failures, -last_ok)

        return sorted(self.SOURCES, key=sort_key)

    def _mark_success(self, name: str):
        self._source_failures[name] = 0
        self._source_last_success[name] = time.time()
        self._active_source = name

    def _mark_failure(self, name: str):
        self._source_failures[name] = self._source_failures.get(name, 0) + 1

    # ============== 符号格式转换 ==============

    @staticmethod
    def _to_bybit_symbol(symbol: str) -> str:
        """BTCUSDT -> BTCUSDT (Bybit直接用)"""
        return symbol.upper().replace("-", "")

    @staticmethod
    def _to_okx_symbol(symbol: str) -> str:
        """BTCUSDT -> BTC-USDT"""
        s = symbol.upper().replace("-", "")
        for quote in ("USDT", "USDC", "USD", "BTC", "ETH"):
            if s.endswith(quote) and len(s) > len(quote):
                return s[: -len(quote)] + "-" + quote
        return s

    @staticmethod
    def _to_binance_symbol(symbol: str) -> str:
        """BTCUSDT -> BTCUSDT"""
        return symbol.upper().replace("-", "")

    # ============== 时间周期转换 ==============

    @staticmethod
    def _to_bybit_interval(timeframe: str) -> str:
        m = {
            "1m": "1", "3m": "3", "5m": "5", "15m": "15", "30m": "30",
            "1h": "60", "2h": "120", "4h": "240", "6h": "360", "12h": "720",
            "1d": "D", "1w": "W", "1M": "M",
        }
        return m.get(timeframe, "60")

    @staticmethod
    def _to_okx_interval(timeframe: str) -> str:
        m = {
            "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
            "1h": "1H", "2h": "2H", "4h": "4H", "6h": "6H", "12h": "12H",
            "1d": "1D", "1w": "1W", "1M": "1M",
        }
        return m.get(timeframe, "1H")

    @staticmethod
    def _to_binance_interval(timeframe: str) -> str:
        m = {
            "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
            "1h": "1h", "2h": "2h", "4h": "4h", "6h": "6h", "8h": "8h",
            "12h": "12h", "1d": "1d", "1w": "1w", "1M": "1M",
        }
        return m.get(timeframe, "1h")

    # ============== K线数据获取 ==============

    async def fetch_ohlcv(
        self, symbol: str, timeframe: str = "1h", limit: int = 200
    ) -> List[Dict]:
        """获取K线数据 - 自动在多个数据源间切换"""
        sources = self._get_ordered_sources()

        for source in sources:
            name = source["name"]
            try:
                if name in ("binance", "binance_backup"):
                    data = await self._fetch_binance_kline(source, symbol, timeframe, limit)
                elif name == "okx":
                    data = await self._fetch_okx_kline(source, symbol, timeframe, limit)
                elif name == "bybit":
                    data = await self._fetch_bybit_kline(source, symbol, timeframe, limit)
                else:
                    continue

                if data:
                    self._mark_success(name)
                    logger.info(f"[{name}] 成功获取 {symbol} K线数据 ({len(data)} 条)")
                    return data

            except asyncio.TimeoutError:
                self._mark_failure(name)
                logger.warning(f"[{name}] 获取 {symbol} K线超时")
            except Exception as e:
                self._mark_failure(name)
                logger.warning(f"[{name}] 获取 {symbol} K线失败: {e}")

        logger.error(f"所有数据源获取 {symbol} K线失败")
        return []

    async def _fetch_bybit_kline(
        self, source: dict, symbol: str, timeframe: str, limit: int
    ) -> List[Dict]:
        """Bybit V5 公开API - 无需API Key"""
        session = await self._get_session()
        url = source["base_url"] + source["kline_path"]
        params = {
            "category": "spot",
            "symbol": self._to_bybit_symbol(symbol),
            "interval": self._to_bybit_interval(timeframe),
            "limit": min(limit, 1000),
        }

        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                raise Exception(f"HTTP {resp.status}")
            result = await resp.json()

            if result.get("retCode") != 0:
                raise Exception(f"API error: {result.get('retMsg', 'unknown')}")

            items = result.get("result", {}).get("list", [])
            candles = []
            for item in reversed(items):  # Bybit返回倒序，需要翻转
                candles.append({
                    "time": int(item[0]),
                    "open": float(item[1]),
                    "high": float(item[2]),
                    "low": float(item[3]),
                    "close": float(item[4]),
                    "volume": float(item[5]),
                })
            return candles

    async def _fetch_okx_kline(
        self, source: dict, symbol: str, timeframe: str, limit: int
    ) -> List[Dict]:
        """OKX V5 公开API - 无需API Key"""
        session = await self._get_session()
        url = source["base_url"] + source["kline_path"]

        # OKX 单次最多300条，需要分页
        all_candles = []
        after = ""
        remaining = min(limit, 1000)

        while remaining > 0:
            batch = min(remaining, 300)
            params = {
                "instId": self._to_okx_symbol(symbol),
                "bar": self._to_okx_interval(timeframe),
                "limit": str(batch),
            }
            if after:
                params["after"] = after

            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    raise Exception(f"HTTP {resp.status}")
                result = await resp.json()

                if result.get("code") != "0":
                    raise Exception(f"API error: {result.get('msg', 'unknown')}")

                data = result.get("data", [])
                if not data:
                    break

                for item in reversed(data):
                    all_candles.append({
                        "time": int(item[0]),
                        "open": float(item[1]),
                        "high": float(item[2]),
                        "low": float(item[3]),
                        "close": float(item[4]),
                        "volume": float(item[5]),
                    })

                after = data[-1][0]  # 最后一条的时间戳用于分页
                remaining -= len(data)

                if len(data) < batch:
                    break

        # 按时间排序
        all_candles.sort(key=lambda x: x["time"])
        return all_candles

    async def _fetch_binance_kline(
        self, source: dict, symbol: str, timeframe: str, limit: int
    ) -> List[Dict]:
        """Binance 公开API - 无需API Key"""
        session = await self._get_session()
        url = source["base_url"] + source["kline_path"]
        params = {
            "symbol": self._to_binance_symbol(symbol),
            "interval": self._to_binance_interval(timeframe),
            "limit": min(limit, 1000),
        }

        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                raise Exception(f"HTTP {resp.status}")
            data = await resp.json()

            candles = []
            for item in data:
                candles.append({
                    "time": int(item[0]),
                    "open": float(item[1]),
                    "high": float(item[2]),
                    "low": float(item[3]),
                    "close": float(item[4]),
                    "volume": float(item[5]),
                })
            return candles

    # ============== Ticker数据获取 ==============

    async def fetch_ticker(self, symbol: str) -> Optional[Dict]:
        """获取最新价格 - 多数据源自动切换"""
        sources = self._get_ordered_sources()

        for source in sources:
            name = source["name"]
            try:
                if name in ("binance", "binance_backup"):
                    data = await self._fetch_binance_ticker(source, symbol)
                elif name == "okx":
                    data = await self._fetch_okx_ticker(source, symbol)
                elif name == "bybit":
                    data = await self._fetch_bybit_ticker(source, symbol)
                else:
                    continue

                if data:
                    self._mark_success(name)
                    return data

            except asyncio.TimeoutError:
                self._mark_failure(name)
            except Exception as e:
                self._mark_failure(name)
                logger.warning(f"[{name}] 获取 {symbol} ticker失败: {e}")

        return None

    async def _fetch_bybit_ticker(self, source: dict, symbol: str) -> Optional[Dict]:
        session = await self._get_session()
        url = source["base_url"] + source["ticker_path"]
        params = {
            "category": "spot",
            "symbol": self._to_bybit_symbol(symbol),
        }

        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                return None
            result = await resp.json()
            if result.get("retCode") != 0:
                return None

            items = result.get("result", {}).get("list", [])
            if not items:
                return None

            d = items[0]
            price = float(d.get("lastPrice", 0))
            prev_price = float(d.get("prevPrice24h", 0)) or price
            change_pct = ((price - prev_price) / prev_price * 100) if prev_price else 0

            return {
                "symbol": symbol.upper(),
                "price": price,
                "change_24h": round(change_pct, 2),
                "high_24h": float(d.get("highPrice24h", 0)),
                "low_24h": float(d.get("lowPrice24h", 0)),
                "volume_24h": float(d.get("volume24h", 0)),
            }

    async def _fetch_okx_ticker(self, source: dict, symbol: str) -> Optional[Dict]:
        session = await self._get_session()
        url = source["base_url"] + source["ticker_path"]
        params = {"instId": self._to_okx_symbol(symbol)}

        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                return None
            result = await resp.json()
            if result.get("code") != "0" or not result.get("data"):
                return None

            d = result["data"][0]
            last = float(d.get("last", 0))
            open24 = float(d.get("open24h", 0)) or last
            change_pct = ((last - open24) / open24 * 100) if open24 else 0

            return {
                "symbol": symbol.upper(),
                "price": last,
                "change_24h": round(change_pct, 2),
                "high_24h": float(d.get("high24h", 0)),
                "low_24h": float(d.get("low24h", 0)),
                "volume_24h": float(d.get("vol24h", 0)),
            }

    async def _fetch_binance_ticker(self, source: dict, symbol: str) -> Optional[Dict]:
        session = await self._get_session()
        url = source["base_url"] + source["ticker_path"]
        params = {"symbol": self._to_binance_symbol(symbol)}

        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                return None
            data = await resp.json()
            return {
                "symbol": data.get("symbol", symbol.upper()),
                "price": float(data.get("lastPrice", 0)),
                "change_24h": float(data.get("priceChangePercent", 0)),
                "high_24h": float(data.get("highPrice", 0)),
                "low_24h": float(data.get("lowPrice", 0)),
                "volume_24h": float(data.get("volume", 0)),
            }

    # ============== 状态查询 ==============

    def get_active_source(self) -> str:
        """获取当前活跃的数据源名称"""
        return self._active_source or "none"

    def get_source_stats(self) -> Dict:
        """获取所有数据源状态"""
        stats = {}
        for src in self.SOURCES:
            name = src["name"]
            failures = self._source_failures.get(name, 0)
            last_ok = self._source_last_success.get(name, 0)
            stats[name] = {
                "failures": failures,
                "last_success": last_ok,
                "healthy": failures < 3,
            }
        return stats

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
            logger.info("交易所客户端连接已关闭")
