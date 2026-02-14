"""
交易所客户端 - 支持Binance和OKX
轻量级设计，适合低内存设备
"""

import asyncio
import hashlib
import hmac
import json
import logging
import time
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode

import aiohttp

logger = logging.getLogger(__name__)

class ExchangeClient:
    """交易所客户端"""
    
    def __init__(self, exchange: str = "binance", api_key: str = "", api_secret: str = ""):
        self.exchange = exchange.lower()
        self.api_key = api_key
        self.api_secret = api_secret
        self.session: Optional[aiohttp.ClientSession] = None
        
        # API配置
        if self.exchange == "binance":
            self.base_url = "https://api.binance.com"
            self.ws_url = "wss://stream.binance.com:9443/ws"
        elif self.exchange == "okx":
            self.base_url = "https://www.okx.com"
            self.ws_url = "wss://ws.okx.com:8443/ws/v5/public"
        else:
            raise ValueError(f"不支持的交易所: {exchange}")
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """获取HTTP会话"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30),
                headers={
                    'User-Agent': 'AI-Trading-System/1.0'
                }
            )
        return self.session
    
    def _generate_signature(self, params: Dict[str, Any]) -> str:
        """生成API签名"""
        if self.exchange == "binance":
            query_string = urlencode(params)
            return hmac.new(
                self.api_secret.encode('utf-8'),
                query_string.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
        elif self.exchange == "okx":
            timestamp = str(int(time.time()))
            message = timestamp + 'GET' + '/api/v5/account/balance'
            return hmac.new(
                self.api_secret.encode('utf-8'),
                message.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
        return ""
    
    async def fetch_ohlcv(
        self, 
        symbol: str, 
        timeframe: str = "1h", 
        limit: int = 100,
        since: Optional[int] = None
    ) -> List[Dict]:
        """
        获取K线数据
        
        Args:
            symbol: 交易对，如 BTCUSDT
            timeframe: 时间周期: 1m, 5m, 15m, 30m, 1h, 4h, 1d
            limit: 获取条数
            since: 开始时间戳（毫秒）
        
        Returns:
            K线数据列表
        """
        try:
            session = await self._get_session()
            
            if self.exchange == "binance":
                # Binance K线API
                interval_map = {
                    '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
                    '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w'
                }
                interval = interval_map.get(timeframe, '1h')
                
                params = {
                    'symbol': symbol.upper(),
                    'interval': interval,
                    'limit': limit
                }
                if since:
                    params['startTime'] = since
                
                url = f"{self.base_url}/api/v3/klines"
                
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        # Binance返回格式: [[time, open, high, low, close, volume, ...], ...]
                        candles = []
                        for item in data:
                            candles.append({
                                'time': int(item[0]),  # 开盘时间
                                'open': float(item[1]),
                                'high': float(item[2]),
                                'low': float(item[3]),
                                'close': float(item[4]),
                                'volume': float(item[5]),
                                'close_time': int(item[6]),
                                'quote_volume': float(item[7]),
                                'trades': int(item[8])
                            })
                        return candles
                    else:
                        error = await response.text()
                        logger.error(f"Binance API错误: {error}")
                        return []
                        
            elif self.exchange == "okx":
                # OKX K线API
                interval_map = {
                    '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
                    '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W'
                }
                interval = interval_map.get(timeframe, '1H')
                
                params = {
                    'instId': symbol.upper().replace('USDT', '-USDT'),
                    'bar': interval,
                    'limit': limit
                }
                if since:
                    params['before'] = since
                
                url = f"{self.base_url}/api/v5/market/candles"
                
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get('code') == '0':
                            data = result.get('data', [])
                            # OKX返回格式: [[time, open, high, low, close, vol, ...], ...]
                            candles = []
                            for item in reversed(data):  # OKX是倒序的
                                candles.append({
                                    'time': int(item[0]),
                                    'open': float(item[1]),
                                    'high': float(item[2]),
                                    'low': float(item[3]),
                                    'close': float(item[4]),
                                    'volume': float(item[5]),
                                    'quote_volume': float(item[6])
                                })
                            return candles
                        else:
                            logger.error(f"OKX API错误: {result}")
                            return []
                    else:
                        error = await response.text()
                        logger.error(f"OKX API错误: {error}")
                        return []
            
            return []
            
        except Exception as e:
            logger.error(f"获取K线数据失败: {e}")
            return []
    
    async def fetch_ticker(self, symbol: str) -> Optional[Dict]:
        """获取最新价格"""
        try:
            session = await self._get_session()
            
            if self.exchange == "binance":
                url = f"{self.base_url}/api/v3/ticker/24hr"
                params = {'symbol': symbol.upper()}
                
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            'symbol': data['symbol'],
                            'price': float(data['lastPrice']),
                            'change_24h': float(data['priceChange']),
                            'change_percent': float(data['priceChangePercent']),
                            'high_24h': float(data['highPrice']),
                            'low_24h': float(data['lowPrice']),
                            'volume_24h': float(data['volume']),
                            'quote_volume_24h': float(data['quoteVolume'])
                        }
                        
            elif self.exchange == "okx":
                url = f"{self.base_url}/api/v5/market/ticker"
                params = {'instId': symbol.upper().replace('USDT', '-USDT')}
                
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get('code') == '0' and result.get('data'):
                            data = result['data'][0]
                            return {
                                'symbol': symbol.upper(),
                                'price': float(data['last']),
                                'change_24h': float(data['change24h']),
                                'change_percent': float(data['change24h']) * 100,
                                'high_24h': float(data['high24h']),
                                'low_24h': float(data['low24h']),
                                'volume_24h': float(data['vol24h']),
                                'quote_volume_24h': float(data['volCcy24h'])
                            }
            
            return None
            
        except Exception as e:
            logger.error(f"获取ticker失败: {e}")
            return None
    
    async def fetch_order_book(self, symbol: str, limit: int = 20) -> Optional[Dict]:
        """获取订单簿"""
        try:
            session = await self._get_session()
            
            if self.exchange == "binance":
                url = f"{self.base_url}/api/v3/depth"
                params = {'symbol': symbol.upper(), 'limit': limit}
                
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            'bids': [[float(p), float(q)] for p, q in data['bids']],
                            'asks': [[float(p), float(q)] for p, q in data['asks']],
                            'timestamp': data.get('lastUpdateId', int(time.time() * 1000))
                        }
                        
            elif self.exchange == "okx":
                url = f"{self.base_url}/api/v5/market/books"
                params = {'instId': symbol.upper().replace('USDT', '-USDT'), 'sz': limit}
                
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get('code') == '0' and result.get('data'):
                            data = result['data'][0]
                            return {
                                'bids': [[float(p), float(q)] for p, q in data['bids']],
                                'asks': [[float(p), float(q)] for p, q in data['asks']],
                                'timestamp': int(data['ts'])
                            }
            
            return None
            
        except Exception as e:
            logger.error(f"获取订单簿失败: {e}")
            return None
    
    async def get_balance(self) -> Optional[Dict]:
        """获取账户余额（需要API Key）"""
        if not self.api_key or not self.api_secret:
            logger.warning("未配置API Key，无法获取余额")
            return None
        
        try:
            session = await self._get_session()
            
            if self.exchange == "binance":
                timestamp = int(time.time() * 1000)
                params = {
                    'timestamp': timestamp,
                    'recvWindow': 5000
                }
                params['signature'] = self._generate_signature(params)
                
                headers = {'X-MBX-APIKEY': self.api_key}
                url = f"{self.base_url}/api/v3/account"
                
                async with session.get(url, params=params, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        balances = {}
                        for asset in data.get('balances', []):
                            free = float(asset['free'])
                            locked = float(asset['locked'])
                            if free > 0 or locked > 0:
                                balances[asset['asset']] = {
                                    'free': free,
                                    'locked': locked,
                                    'total': free + locked
                                }
                        return {
                            'balances': balances,
                            'timestamp': timestamp
                        }
                    else:
                        error = await response.text()
                        logger.error(f"获取余额失败: {error}")
                        
            elif self.exchange == "okx":
                timestamp = str(int(time.time()))
                message = timestamp + 'GET' + '/api/v5/account/balance'
                signature = self._generate_signature({})
                
                headers = {
                    'OK-ACCESS-KEY': self.api_key,
                    'OK-ACCESS-SIGN': signature,
                    'OK-ACCESS-TIMESTAMP': timestamp,
                    'OK-ACCESS-PASSPHRASE': ''  # 需要设置
                }
                url = f"{self.base_url}/api/v5/account/balance"
                
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get('code') == '0':
                            balances = {}
                            for detail in result.get('data', [{}])[0].get('details', []):
                                balances[detail['ccy']] = {
                                    'free': float(detail.get('availBal', 0)),
                                    'locked': float(detail.get('frozenBal', 0)),
                                    'total': float(detail.get('eq', 0))
                                }
                            return {
                                'balances': balances,
                                'timestamp': int(time.time() * 1000)
                            }
            
            return None
            
        except Exception as e:
            logger.error(f"获取余额失败: {e}")
            return None
    
    async def create_order(
        self,
        symbol: str,
        side: str,  # BUY or SELL
        order_type: str = "MARKET",  # MARKET, LIMIT
        quantity: float = 0,
        price: float = 0
    ) -> Optional[Dict]:
        """创建订单（需要API Key）"""
        if not self.api_key or not self.api_secret:
            logger.warning("未配置API Key，无法创建订单")
            return None
        
        try:
            session = await self._get_session()
            
            if self.exchange == "binance":
                timestamp = int(time.time() * 1000)
                params = {
                    'symbol': symbol.upper(),
                    'side': side.upper(),
                    'type': order_type.upper(),
                    'timestamp': timestamp,
                    'recvWindow': 5000
                }
                
                if order_type.upper() == "MARKET":
                    params['quantity'] = quantity
                else:
                    params['quantity'] = quantity
                    params['price'] = price
                    params['timeInForce'] = 'GTC'
                
                params['signature'] = self._generate_signature(params)
                headers = {'X-MBX-APIKEY': self.api_key}
                url = f"{self.base_url}/api/v3/order"
                
                async with session.post(url, params=params, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            'order_id': str(data['orderId']),
                            'symbol': data['symbol'],
                            'status': data['status'],
                            'side': data['side'],
                            'type': data['type'],
                            'price': float(data.get('price', 0)),
                            'quantity': float(data.get('origQty', 0)),
                            'executed_qty': float(data.get('executedQty', 0)),
                            'timestamp': data['transactTime']
                        }
                    else:
                        error = await response.text()
                        logger.error(f"创建订单失败: {error}")
                        
            elif self.exchange == "okx":
                # OKX订单创建
                pass  # 实现类似逻辑
            
            return None
            
        except Exception as e:
            logger.error(f"创建订单失败: {e}")
            return None
    
    async def close(self):
        """关闭连接"""
        if self.session and not self.session.closed:
            await self.session.close()
            logger.info("交易所客户端连接已关闭")


# 测试代码
async def test():
    """测试交易所客户端"""
    client = ExchangeClient("binance")
    
    # 测试获取K线
    data = await client.fetch_ohlcv("BTCUSDT", "1h", 10)
    print(f"获取到 {len(data)} 条K线数据")
    if data:
        print(f"最新K线: {data[-1]}")
    
    # 测试获取ticker
    ticker = await client.fetch_ticker("BTCUSDT")
    print(f"最新价格: {ticker}")
    
    await client.close()


if __name__ == "__main__":
    asyncio.run(test())
