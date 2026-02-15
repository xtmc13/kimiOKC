/**
 * 币安API直接调用模块
 * 支持公开API（K线）和私有API（账户余额、下单）
 * 通过服务器代理避免CORS问题
 */

import CryptoJS from 'crypto-js';
import type { MarketData } from '../types';

// API配置 - 使用服务器代理
const BINANCE_API = '/api/binance';
const BINANCE_FUTURES_API = '/api/binance-futures';

// 时间周期映射
const TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
};

// 获取签名
function getSignature(queryString: string, apiSecret: string): string {
  return CryptoJS.HmacSHA256(queryString, apiSecret).toString();
}

// 获取K线数据 (公开API，无需认证)
export async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number = 500
): Promise<MarketData[]> {
  const binanceInterval = TIMEFRAME_MAP[interval] || '1h';
  const url = `${BINANCE_API}/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // 转换格式: [openTime, open, high, low, close, volume, closeTime, ...]
    return data.map((kline: any[]) => ({
      time: kline[0], // 开盘时间戳
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
    }));
  } catch (error) {
    console.error('获取K线失败:', error);
    throw error;
  }
}

// 获取当前价格
export async function fetchPrice(symbol: string): Promise<number> {
  const url = `${BINANCE_API}/api/v3/ticker/price?symbol=${symbol}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error('获取价格失败:', error);
    throw error;
  }
}

// 账户余额结构
export interface AccountBalance {
  totalBalance: number;
  availableBalance: number;
  assets: Array<{
    asset: string;
    free: number;
    locked: number;
    usdValue: number;
  }>;
}

// 获取现货账户余额 (需要API Key)
export async function fetchSpotBalance(
  apiKey: string,
  apiSecret: string
): Promise<AccountBalance> {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = getSignature(queryString, apiSecret);
  
  const url = `${BINANCE_API}/api/v3/account?${queryString}&signature=${signature}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'X-MBX-APIKEY': apiKey,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.msg || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // 获取USDT价格用于计算USD价值
    let btcPrice = 0;
    try {
      btcPrice = await fetchPrice('BTCUSDT');
    } catch { /* ignore */ }
    
    // 过滤有余额的资产
    const assets = data.balances
      .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b: any) => {
        const free = parseFloat(b.free);
        const locked = parseFloat(b.locked);
        let usdValue = 0;
        
        if (b.asset === 'USDT' || b.asset === 'BUSD' || b.asset === 'USDC') {
          usdValue = free + locked;
        } else if (b.asset === 'BTC') {
          usdValue = (free + locked) * btcPrice;
        }
        
        return {
          asset: b.asset,
          free,
          locked,
          usdValue,
        };
      });
    
    // 计算总余额
    const totalBalance = assets.reduce((sum: number, a: any) => sum + a.usdValue, 0);
    const availableBalance = assets
      .filter((a: any) => ['USDT', 'BUSD', 'USDC'].includes(a.asset))
      .reduce((sum: number, a: any) => sum + a.free, 0);
    
    return { totalBalance, availableBalance, assets };
  } catch (error) {
    console.error('获取现货余额失败:', error);
    throw error;
  }
}

// 获取合约账户余额 (需要API Key)
export async function fetchFuturesBalance(
  apiKey: string,
  apiSecret: string
): Promise<AccountBalance> {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = getSignature(queryString, apiSecret);
  
  const url = `${BINANCE_FUTURES_API}/fapi/v2/balance?${queryString}&signature=${signature}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'X-MBX-APIKEY': apiKey,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.msg || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    const assets = data.map((b: any) => ({
      asset: b.asset,
      free: parseFloat(b.availableBalance),
      locked: parseFloat(b.balance) - parseFloat(b.availableBalance),
      usdValue: parseFloat(b.balance),
    })).filter((a: any) => a.free > 0 || a.locked > 0);
    
    const totalBalance = assets.reduce((sum: number, a: any) => sum + a.usdValue, 0);
    const availableBalance = assets
      .filter((a: any) => a.asset === 'USDT')
      .reduce((sum: number, a: any) => sum + a.free, 0);
    
    return { totalBalance, availableBalance, assets };
  } catch (error) {
    console.error('获取合约余额失败:', error);
    throw error;
  }
}

// 获取合约K线
export async function fetchFuturesKlines(
  symbol: string,
  interval: string,
  limit: number = 500
): Promise<MarketData[]> {
  const binanceInterval = TIMEFRAME_MAP[interval] || '1h';
  const url = `${BINANCE_FUTURES_API}/fapi/v1/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    return data.map((kline: any[]) => ({
      time: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
    }));
  } catch (error) {
    console.error('获取合约K线失败:', error);
    throw error;
  }
}

// 获取持仓信息
export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  marginType: 'cross' | 'isolated';
  liquidationPrice: number;
}

export async function fetchFuturesPositions(
  apiKey: string,
  apiSecret: string
): Promise<Position[]> {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = getSignature(queryString, apiSecret);
  
  const url = `${BINANCE_FUTURES_API}/fapi/v2/positionRisk?${queryString}&signature=${signature}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'X-MBX-APIKEY': apiKey },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.msg || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    return data
      .filter((p: any) => parseFloat(p.positionAmt) !== 0)
      .map((p: any) => ({
        symbol: p.symbol,
        side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
        size: Math.abs(parseFloat(p.positionAmt)),
        entryPrice: parseFloat(p.entryPrice),
        markPrice: parseFloat(p.markPrice),
        unrealizedPnl: parseFloat(p.unRealizedProfit),
        leverage: parseInt(p.leverage),
        marginType: p.marginType.toLowerCase(),
        liquidationPrice: parseFloat(p.liquidationPrice),
      }));
  } catch (error) {
    console.error('获取持仓失败:', error);
    throw error;
  }
}

// 下单接口
export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
}

export async function placeSpotOrder(
  apiKey: string,
  apiSecret: string,
  order: OrderParams
): Promise<any> {
  const timestamp = Date.now();
  const params: Record<string, any> = {
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    quantity: order.quantity.toFixed(8),
    timestamp,
  };
  
  if (order.price) params.price = order.price.toFixed(2);
  if (order.timeInForce) params.timeInForce = order.timeInForce;
  
  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const signature = getSignature(queryString, apiSecret);
  
  const url = `${BINANCE_API}/api/v3/order?${queryString}&signature=${signature}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export async function placeFuturesOrder(
  apiKey: string,
  apiSecret: string,
  order: OrderParams
): Promise<any> {
  const timestamp = Date.now();
  const params: Record<string, any> = {
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    quantity: order.quantity.toFixed(3),
    timestamp,
  };
  
  if (order.price) params.price = order.price.toFixed(2);
  if (order.stopPrice) params.stopPrice = order.stopPrice.toFixed(2);
  if (order.timeInForce) params.timeInForce = order.timeInForce;
  if (order.reduceOnly) params.reduceOnly = 'true';
  
  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const signature = getSignature(queryString, apiSecret);
  
  const url = `${BINANCE_FUTURES_API}/fapi/v1/order?${queryString}&signature=${signature}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// WebSocket实时K线
export function subscribeKlines(
  symbol: string,
  interval: string,
  onMessage: (data: MarketData) => void,
  isFutures: boolean = false
): () => void {
  const wsUrl = isFutures
    ? `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_${interval}`
    : `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;
  
  const ws = new WebSocket(wsUrl);
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.k) {
        onMessage({
          time: data.k.t,
          open: parseFloat(data.k.o),
          high: parseFloat(data.k.h),
          low: parseFloat(data.k.l),
          close: parseFloat(data.k.c),
          volume: parseFloat(data.k.v),
        });
      }
    } catch (e) {
      console.error('WebSocket消息解析失败:', e);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket错误:', error);
  };
  
  // 返回关闭函数
  return () => {
    ws.close();
  };
}
