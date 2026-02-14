/**
 * XTMC 多数据源自动切换系统
 * 支持: Bybit (首选, 公开API无需Key) → OKX → Binance → Binance Backup
 * 自动failover: 某个源失败时自动切换到下一个
 */

import type { MarketData } from '../types';

// 数据源状态
export interface DataSourceStatus {
  active: string;
  stats: Record<string, { failures: number; lastSuccess: number; healthy: boolean }>;
}

// 数据源接口
interface DataSource {
  id: string;
  name: string;
  priority: number;
  fetchKlines: (symbol: string, timeframe: string, limit: number) => Promise<MarketData[]>;
  fetchPrice: (symbol: string) => Promise<number>;
}

// 时间周期映射
const TIMEFRAME_MAP: Record<string, Record<string, string>> = {
  bybit: { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D' },
  okx: { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D' },
  binance: { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' },
};

// ============== Bybit 数据源 ==============
const bybitSource: DataSource = {
  id: 'bybit',
  name: 'Bybit',
  priority: 1,
  fetchKlines: async (symbol, timeframe, limit) => {
    const interval = TIMEFRAME_MAP.bybit[timeframe] || '60';
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
    const json = await res.json();
    if (json.retCode !== 0) throw new Error(`Bybit API: ${json.retMsg}`);
    const list = json.result?.list || [];
    // Bybit返回 [timestamp, open, high, low, close, volume, turnover] 倒序
    return list.map((item: string[]) => ({
      time: parseInt(item[0]),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    })).reverse();
  },
  fetchPrice: async (symbol) => {
    const url = `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
    const json = await res.json();
    return parseFloat(json.result?.list?.[0]?.lastPrice || '0');
  },
};

// ============== OKX 数据源 ==============
const okxSource: DataSource = {
  id: 'okx',
  name: 'OKX',
  priority: 2,
  fetchKlines: async (symbol, timeframe, limit) => {
    // OKX 使用 BTC-USDT 格式
    const instId = symbol.replace('USDT', '-USDT');
    const bar = TIMEFRAME_MAP.okx[timeframe] || '1H';
    const url = `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== '0') throw new Error(`OKX API: ${json.msg}`);
    const list = json.data || [];
    // OKX返回 [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm] 倒序
    return list.map((item: string[]) => ({
      time: parseInt(item[0]),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    })).reverse();
  },
  fetchPrice: async (symbol) => {
    const instId = symbol.replace('USDT', '-USDT');
    const url = `https://www.okx.com/api/v5/market/ticker?instId=${instId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
    const json = await res.json();
    return parseFloat(json.data?.[0]?.last || '0');
  },
};

// ============== Binance 数据源 ==============
const binanceSource: DataSource = {
  id: 'binance',
  name: 'Binance',
  priority: 3,
  fetchKlines: async (symbol, timeframe, limit) => {
    const interval = TIMEFRAME_MAP.binance[timeframe] || '1h';
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    const list = await res.json();
    // Binance返回 [openTime, open, high, low, close, volume, closeTime, ...]
    return list.map((item: (string | number)[]) => ({
      time: item[0] as number,
      open: parseFloat(item[1] as string),
      high: parseFloat(item[2] as string),
      low: parseFloat(item[3] as string),
      close: parseFloat(item[4] as string),
      volume: parseFloat(item[5] as string),
    }));
  },
  fetchPrice: async (symbol) => {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    const json = await res.json();
    return parseFloat(json.price || '0');
  },
};

// ============== Binance Backup 数据源 ==============
const binanceBackupSource: DataSource = {
  id: 'binance_backup',
  name: 'Binance Backup',
  priority: 4,
  fetchKlines: async (symbol, timeframe, limit) => {
    const interval = TIMEFRAME_MAP.binance[timeframe] || '1h';
    const url = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance Backup HTTP ${res.status}`);
    const list = await res.json();
    return list.map((item: (string | number)[]) => ({
      time: item[0] as number,
      open: parseFloat(item[1] as string),
      high: parseFloat(item[2] as string),
      low: parseFloat(item[3] as string),
      close: parseFloat(item[4] as string),
      volume: parseFloat(item[5] as string),
    }));
  },
  fetchPrice: async (symbol) => {
    const url = `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance Backup HTTP ${res.status}`);
    const json = await res.json();
    return parseFloat(json.price || '0');
  },
};

// ============== 数据源管理器 ==============

export class DataSourceManager {
  private sources: DataSource[];
  private stats: Map<string, { failures: number; lastSuccess: number; healthy: boolean }>;
  private activeSourceId: string = '';
  private maxFailures = 3;
  private healthCheckInterval = 60000; // 60s后重新尝试不健康的源

  constructor() {
    this.sources = [bybitSource, okxSource, binanceSource, binanceBackupSource];
    this.stats = new Map();
    this.sources.forEach(src => {
      this.stats.set(src.id, { failures: 0, lastSuccess: 0, healthy: true });
    });
  }

  getStatus(): DataSourceStatus {
    const statsObj: Record<string, { failures: number; lastSuccess: number; healthy: boolean }> = {};
    this.stats.forEach((v, k) => { statsObj[k] = { ...v }; });
    return { active: this.activeSourceId || 'none', stats: statsObj };
  }

  getSourceList(): Array<{ id: string; name: string; healthy: boolean; active: boolean }> {
    return this.sources.map(src => {
      const stat = this.stats.get(src.id);
      return {
        id: src.id,
        name: src.name,
        healthy: stat?.healthy ?? true,
        active: src.id === this.activeSourceId,
      };
    });
  }

  private getHealthySources(): DataSource[] {
    const now = Date.now();
    return this.sources.filter(src => {
      const stat = this.stats.get(src.id);
      if (!stat) return true;
      if (stat.healthy) return true;
      // 超过healthCheckInterval后重新尝试
      if (now - stat.lastSuccess > this.healthCheckInterval) {
        stat.healthy = true;
        stat.failures = 0;
        return true;
      }
      return false;
    });
  }

  private markSuccess(sourceId: string) {
    const stat = this.stats.get(sourceId);
    if (stat) {
      stat.failures = 0;
      stat.lastSuccess = Date.now();
      stat.healthy = true;
    }
    this.activeSourceId = sourceId;
  }

  private markFailure(sourceId: string) {
    const stat = this.stats.get(sourceId);
    if (stat) {
      stat.failures++;
      if (stat.failures >= this.maxFailures) {
        stat.healthy = false;
      }
    }
  }

  async fetchKlines(symbol: string, timeframe: string, limit: number = 300): Promise<{ data: MarketData[]; source: string }> {
    const sources = this.getHealthySources();
    
    for (const src of sources) {
      try {
        const data = await src.fetchKlines(symbol, timeframe, limit);
        if (data && data.length > 0) {
          this.markSuccess(src.id);
          return { data, source: src.id };
        }
      } catch (err) {
        console.warn(`[DataSource] ${src.name} klines failed:`, err);
        this.markFailure(src.id);
      }
    }

    // 所有源都失败，返回空
    this.activeSourceId = 'none';
    return { data: [], source: 'none' };
  }

  async fetchPrice(symbol: string): Promise<{ price: number; source: string }> {
    const sources = this.getHealthySources();
    
    for (const src of sources) {
      try {
        const price = await src.fetchPrice(symbol);
        if (price > 0) {
          this.markSuccess(src.id);
          return { price, source: src.id };
        }
      } catch (err) {
        console.warn(`[DataSource] ${src.name} price failed:`, err);
        this.markFailure(src.id);
      }
    }

    return { price: 0, source: 'none' };
  }
}

// 全局单例
export const dataSourceManager = new DataSourceManager();
