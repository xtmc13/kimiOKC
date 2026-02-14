/**
 * XTMC量化交易系统 - 类型定义
 */

// 系统状态
export interface SystemStatus {
  status: string;
  timestamp: number;
  system: {
    cpu_percent: number;
    memory_percent: number;
    memory_used: number;
    memory_total: number;
  };
  trading: {
    enabled: boolean;
    exchange: string;
    symbol: string;
  };
  ai: {
    is_running: boolean;
    tool_count: number;
    evolution_count: number;
    win_rate: number;
    total_profit: number;
  };
  data_source?: {
    active: string;
    stats: Record<string, { failures: number; last_success: number; healthy: boolean }>;
  };
}

// 交易配置
export interface TradeConfig {
  exchange: string;
  api_key: string;
  api_secret: string;
  symbol: string;
  timeframe: string;
  enable_trading: boolean;
  max_position: number;
  risk_percent: number;
}

// 市场数据 (K线)
export interface MarketData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 交易信号
export interface TradeSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  price: number;
  confidence: number;
  reason: string;
  timestamp: number;
  executed?: boolean;
  details?: Array<{
    tool: string;
    signal: string;
    confidence: number;
    reason: string;
  }>;
}

// 聊天消息
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: {
    intent?: string;
    confidence?: number;
    [key: string]: any;
  };
}

// AI工具
export interface AITool {
  name: string;
  description: string;
  indicators?: string[];
  signals?: string[];
  complexity?: string;
}

// 进化记录
export interface EvolutionRecord {
  timestamp: number;
  summary: string;
  gaps: number;
  recommendations: number;
}

// 交易记录
export interface Trade {
  id: number;
  symbol: string;
  action: string;
  price: number;
  quantity: number;
  timestamp: number;
  profit: number;
  status: string;
}
