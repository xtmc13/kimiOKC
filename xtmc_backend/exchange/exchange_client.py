"""
交易所客户端 - 支持Binance和OKX
增强版：代理支持、速率限制、OKX签名、认证交易
"""

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode

import aiohttp

logger = logging.getLogger(__name__)


class RateLimiter:
    """简单的令牌桶速率限制器"""

    def __init__(self, max_calls: int, period: float):
        self.max_calls = max_calls
        self.period = period
        self._calls: List[float] = []

    async def acquire(self):
        now = time.monotonic()
        self._calls = [t for t in self._calls if now - t < self.period]
        if len(self._calls) >= self.max_calls:
            wait = self.period - (now - self._calls[0])
            if wait > 0:
                await asyncio.sleep(wait)
        self._calls.append(time.monotonic())


class ExchangeClient:
    """交易所客户端 - Binance / OKX"""

    def __init__(
        self,
        exchange: str = "binance",
        api_key: str = "",
        api_secret: str = "",
        proxy: str = "",
        okx_passphrase: str = "",
    ):
        self.exchange = exchange.lower()
        self.api_key = api_key
        self.api_secret = api_secret
        self.proxy = proxy or ""
        self.okx_passphrase = okx_passphrase
        self.session: Optional[aiohttp.ClientSession] = None

        if self.exchange == "binance":
            self.base_url = "https://api.binance.com"
            self.ws_url = "wss://stream.binance.com:9443/ws"
            self._limiter = RateLimiter(max_calls=10, period=1.0)
        elif self.exchange == "okx":
            self.base_url = "https://www.okx.com"
            self.ws_url = "wss://ws.okx.com:8443/ws/v5/public"
            self._limiter = RateLimiter(max_calls=18, period=2.0)
        else:
            raise ValueError(f"不支持的交易所: {exchange}")

    # ------------------------------------------------------------------
    # 会话管理
    # ------------------------------------------------------------------

    async def _get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            connector = aiohttp.TCPConnector(ssl=True)
            self.session = aiohttp.ClientSession(
                connector=connector,
                timeout=aiohttp.ClientTimeout(total=30),
                headers={"User-Agent": "XTMC-Trading/2.0"},
            )
        return self.session

    def _get_proxy(self) -> Optional[str]:
        return self.proxy if self.proxy else None

    async def _request(
        self,
        method: str,
        url: str,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        retries: int = 3,
    ) -> Optional[Any]:
        """带重试的HTTP请求"""
        await self._limiter.acquire()
        session = await self._get_session()
        proxy = self._get_proxy()

        for attempt in range(retries):
            try:
                async with session.request(
                    method, url, params=params, headers=headers, proxy=proxy
                ) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    elif resp.status == 429:
                        wait = 2 ** (attempt + 1)
                        logger.warning("速率限制，等待 %ds 后重试", wait)
                        await asyncio.sleep(wait)
                        continue
                    else:
                        text = await resp.text()
                        logger.error("%s 请求失败 [%d]: %s", self.exchange, resp.status, text[:200])
                        return None
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                if attempt < retries - 1:
                    wait = 2 ** attempt
                    logger.warning("请求异常 (%s)，%ds后重试: %s", self.exchange, wait, e)
                    await asyncio.sleep(wait)
                else:
                    logger.error("请求失败，已用尽重试: %s", e)
                    return None
        return None

    # ------------------------------------------------------------------
    # 签名
    # ------------------------------------------------------------------

    def _binance_sign(self, params: Dict) -> Dict:
        """Binance HMAC-SHA256签名"""
        params["timestamp"] = int(time.time() * 1000)
        query = urlencode(params)
        signature = hmac.new(
            self.api_secret.encode(), query.encode(), hashlib.sha256
        ).hexdigest()
        params["signature"] = signature
        return params

    def _okx_headers(self, method: str, path: str, body: str = "") -> Dict:
        """OKX请求签名头"""
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        prehash = ts + method.upper() + path + body
        signature = base64.b64encode(
            hmac.new(
                self.api_secret.encode(), prehash.encode(), hashlib.sha256
            ).digest()
        ).decode()
        return {
            "OK-ACCESS-KEY": self.api_key,
            "OK-ACCESS-SIGN": signature,
            "OK-ACCESS-TIMESTAMP": ts,
            "OK-ACCESS-PASSPHRASE": self.okx_passphrase,
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # 公开数据接口
    # ------------------------------------------------------------------

    async def fetch_ohlcv(
        self, symbol: str, timeframe: str = "1h", limit: int = 100
    ) -> List[Dict]:
        """获取K线数据"""
        try:
            if self.exchange == "binance":
                interval_map = {
                    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
                    "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w",
                }
                params = {
                    "symbol": symbol.upper(),
                    "interval": interval_map.get(timeframe, "1h"),
                    "limit": limit,
                }
                data = await self._request("GET", f"{self.base_url}/api/v3/klines", params=params)
                if data is None:
                    return []
                return [
                    {
                        "time": int(item[0]),
                        "open": float(item[1]),
                        "high": float(item[2]),
                        "low": float(item[3]),
                        "close": float(item[4]),
                        "volume": float(item[5]),
                    }
                    for item in data
                ]

            elif self.exchange == "okx":
                interval_map = {
                    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
                    "1h": "1H", "4h": "4H", "1d": "1D", "1w": "1W",
                }
                inst_id = symbol.upper()
                if "-" not in inst_id:
                    inst_id = inst_id.replace("USDT", "-USDT")
                params = {
                    "instId": inst_id,
                    "bar": interval_map.get(timeframe, "1H"),
                    "limit": str(limit),
                }
                result = await self._request("GET", f"{self.base_url}/api/v5/market/candles", params=params)
                if result is None or result.get("code") != "0":
                    return []
                return [
                    {
                        "time": int(item[0]),
                        "open": float(item[1]),
                        "high": float(item[2]),
                        "low": float(item[3]),
                        "close": float(item[4]),
                        "volume": float(item[5]),
                    }
                    for item in reversed(result.get("data", []))
                ]

            return []
        except Exception as e:
            logger.error("获取K线数据失败: %s", e)
            return []

    async def fetch_ticker(self, symbol: str) -> Optional[Dict]:
        """获取最新价格"""
        try:
            if self.exchange == "binance":
                params = {"symbol": symbol.upper()}
                data = await self._request("GET", f"{self.base_url}/api/v3/ticker/24hr", params=params)
                if data is None:
                    return None
                return {
                    "symbol": data["symbol"],
                    "price": float(data["lastPrice"]),
                    "change_24h": float(data["priceChangePercent"]),
                    "high_24h": float(data["highPrice"]),
                    "low_24h": float(data["lowPrice"]),
                    "volume_24h": float(data["volume"]),
                }

            elif self.exchange == "okx":
                inst_id = symbol.upper()
                if "-" not in inst_id:
                    inst_id = inst_id.replace("USDT", "-USDT")
                params = {"instId": inst_id}
                result = await self._request("GET", f"{self.base_url}/api/v5/market/ticker", params=params)
                if result is None or result.get("code") != "0" or not result.get("data"):
                    return None
                d = result["data"][0]
                open_price = float(d.get("open24h", d.get("last", "0")))
                last_price = float(d["last"])
                change = ((last_price - open_price) / open_price * 100) if open_price else 0
                return {
                    "symbol": symbol.upper(),
                    "price": last_price,
                    "change_24h": change,
                    "high_24h": float(d.get("high24h", 0)),
                    "low_24h": float(d.get("low24h", 0)),
                    "volume_24h": float(d.get("vol24h", 0)),
                }

            return None
        except Exception as e:
            logger.error("获取ticker失败: %s", e)
            return None

    # ------------------------------------------------------------------
    # 认证交易接口
    # ------------------------------------------------------------------

    async def place_order(
        self, symbol: str, side: str, quantity: float, price: Optional[float] = None
    ) -> Optional[Dict]:
        """下单（市价或限价）"""
        if not self.api_key or not self.api_secret:
            logger.error("交易需要API Key和Secret")
            return None

        try:
            if self.exchange == "binance":
                params = {
                    "symbol": symbol.upper(),
                    "side": side.upper(),
                    "type": "MARKET" if price is None else "LIMIT",
                    "quantity": str(quantity),
                }
                if price is not None:
                    params["price"] = str(price)
                    params["timeInForce"] = "GTC"

                params = self._binance_sign(params)
                session = await self._get_session()
                proxy = self._get_proxy()
                headers = {"X-MBX-APIKEY": self.api_key}

                await self._limiter.acquire()
                async with session.post(
                    f"{self.base_url}/api/v3/order",
                    params=params,
                    headers=headers,
                    proxy=proxy,
                ) as resp:
                    result = await resp.json()
                    if resp.status == 200:
                        logger.info("Binance下单成功: %s", result.get("orderId"))
                        return result
                    else:
                        logger.error("Binance下单失败: %s", result)
                        return None

            elif self.exchange == "okx":
                inst_id = symbol.upper()
                if "-" not in inst_id:
                    inst_id = inst_id.replace("USDT", "-USDT")
                body_dict = {
                    "instId": inst_id,
                    "tdMode": "cash",
                    "side": side.lower(),
                    "ordType": "market" if price is None else "limit",
                    "sz": str(quantity),
                }
                if price is not None:
                    body_dict["px"] = str(price)

                body = json.dumps(body_dict)
                path = "/api/v5/trade/order"
                headers = self._okx_headers("POST", path, body)
                session = await self._get_session()
                proxy = self._get_proxy()

                await self._limiter.acquire()
                async with session.post(
                    f"{self.base_url}{path}",
                    data=body,
                    headers=headers,
                    proxy=proxy,
                ) as resp:
                    result = await resp.json()
                    if result.get("code") == "0":
                        order_id = result["data"][0].get("ordId", "")
                        logger.info("OKX下单成功: %s", order_id)
                        return result
                    else:
                        logger.error("OKX下单失败: %s", result)
                        return None

            return None
        except Exception as e:
            logger.error("下单失败: %s", e)
            return None

    async def get_balance(self) -> Optional[Dict]:
        """查询账户余额"""
        if not self.api_key or not self.api_secret:
            return None

        try:
            if self.exchange == "binance":
                params = self._binance_sign({})
                headers = {"X-MBX-APIKEY": self.api_key}
                data = await self._request(
                    "GET",
                    f"{self.base_url}/api/v3/account",
                    params=params,
                    headers=headers,
                )
                if data is None:
                    return None
                balances = {
                    b["asset"]: {"free": float(b["free"]), "locked": float(b["locked"])}
                    for b in data.get("balances", [])
                    if float(b["free"]) > 0 or float(b["locked"]) > 0
                }
                return balances

            elif self.exchange == "okx":
                path = "/api/v5/account/balance"
                headers = self._okx_headers("GET", path)
                result = await self._request(
                    "GET",
                    f"{self.base_url}{path}",
                    headers=headers,
                )
                if result is None or result.get("code") != "0":
                    return None
                balances = {}
                for detail in result.get("data", [{}])[0].get("details", []):
                    ccy = detail["ccy"]
                    balances[ccy] = {
                        "free": float(detail.get("availBal", 0)),
                        "locked": float(detail.get("frozenBal", 0)),
                    }
                return balances

            return None
        except Exception as e:
            logger.error("查询余额失败: %s", e)
            return None

    # ------------------------------------------------------------------

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
            logger.info("交易所客户端连接已关闭")
