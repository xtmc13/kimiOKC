/**
 * XTMC量化交易系统 - 主应用组件
 * 专业量化交易界面 v2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

// 导入组件
import Header from './components/Header';
import TradingChart from './components/TradingChart';
import ControlPanel from './components/ControlPanel';
import AIChat from './components/AIChat';
import SignalPanel from './components/SignalPanel';
import StatusBar from './components/StatusBar';
import ToolLibrary from './components/ToolLibrary';
import EvolutionPanel from './components/EvolutionPanel';
import OrderPanel from './components/OrderPanel';
import PositionPanel from './components/PositionPanel';
import CoinSearch from './components/CoinSearch';
import BacktestPanel from './components/BacktestPanel';
import GridTradingPanel from './components/GridTradingPanel';
import DCAPanel from './components/DCAPanel';
import MultiStrategyPanel from './components/MultiStrategyPanel';
import SignalExecutorPanel from './components/SignalExecutorPanel';
import SettingsPanel from './components/SettingsPanel';

// 导入数据源和LLM
import { dataSourceManager } from './lib/dataSource';

// 导入类型
import type { 
  SystemStatus, 
  TradeConfig, 
  MarketData, 
  TradeSignal,
  ChatMessage,
  AITool,
  EvolutionRecord
} from './types';

// API基础URL
const API_BASE = window.location.origin;

// ============== 模拟数据生成（无后端时使用） ==============

function generateMockMarketData(symbol: string, count = 300): MarketData[] {
  const now = Date.now();
  const interval = 60 * 60 * 1000; // 1小时
  const data: MarketData[] = [];

  // 不同币种的基础价格
  const basePrices: Record<string, number> = {
    'BTCUSDT': 42000, 'ETHUSDT': 2600, 'SOLUSDT': 98,
    'ADAUSDT': 0.45, 'DOGEUSDT': 0.082, 'XRPUSDT': 0.62,
  };
  let price = basePrices[symbol] || 42000;
  const volatility = price * 0.008; // 0.8% 波动率

  for (let i = count; i >= 0; i--) {
    const time = now - i * interval;
    const change = (Math.random() - 0.48) * volatility; // 轻微上涨趋势
    const open = price;
    price = Math.max(price * 0.9, price + change); // 不会跌到0
    const close = price;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = 100 + Math.random() * 900;
    data.push({ time, open, high, low, close, volume });
  }
  return data;
}

function generateMockSignals(data: MarketData[], symbol: string): TradeSignal[] {
  const signals: TradeSignal[] = [];
  for (let i = 30; i < data.length; i += Math.floor(15 + Math.random() * 25)) {
    const d = data[i];
    const isBuy = Math.random() > 0.45;
    signals.push({
      symbol,
      action: isBuy ? 'BUY' : 'SELL',
      price: d.close,
      confidence: 0.6 + Math.random() * 0.35,
      reason: isBuy ? 'EMA金叉 + RSI超卖反弹' : 'EMA死叉 + RSI超买回落',
      timestamp: d.time,
    });
  }
  return signals;
}

// 默认设置配置
const DEFAULT_SETTINGS = {
  exchange: 'binance',
  apiKey: '',
  apiSecret: '',
  passphrase: '',
  testnet: false,
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:7b',
  deepseekKey: '',
  glmKey: '',
  openaiKey: '',
  claudeKey: '',
  geminiKey: '',
  kimiKey: '',
  qwenKey: '',
  aiProvider: 'auto' as const,
  // AI进化配置
  aiEvolutionEnabled: true,
  aiEvolutionInterval: 6,
  aiEvolutionGoals: [
    '提高交易信号准确率',
    '优化入场时机判断',
    '降低假信号率',
    '提升趋势识别能力',
    '改进止损止盈策略',
  ],
  aiRiskTolerance: 'balanced' as const,
  aiMaxDrawdown: 10,
  aiTargetWinRate: 60,
  theme: 'dark' as const,
  language: 'zh-CN',
  notifications: true,
};

// ============== 错误边界 ==============

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <div className="text-center p-8 bg-slate-800 rounded-xl max-w-md">
            <h2 className="text-xl font-bold text-red-400 mb-4">页面渲染出错</h2>
            <p className="text-slate-300 mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============== 主应用 ==============

function App() {
  // ============== 状态管理 ==============
  
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    status: 'stopped',
    timestamp: Date.now(),
    system: { cpu_percent: 0, memory_percent: 0, memory_used: 0, memory_total: 4096 },
    trading: { enabled: false, exchange: 'binance', symbol: 'BTCUSDT' },
    ai: { is_running: false, tool_count: 0, evolution_count: 0, win_rate: 0, total_profit: 0 }
  });

  const [tradeConfig, setTradeConfig] = useState<TradeConfig>({
    exchange: 'binance',
    api_key: '',
    api_secret: '',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    enable_trading: false,
    max_position: 100,
    risk_percent: 2,
  });

  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [currentSymbol, setCurrentSymbol] = useState('BTCUSDT');
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiTools, setAiTools] = useState<AITool[]>([]);
  const [evolutionRecords, setEvolutionRecords] = useState<EvolutionRecord[]>([]);
  
  const [mainTab, setMainTab] = useState<'chart' | 'signals' | 'tools' | 'evolution' | 'backtest'>('chart');
  const [rightTab, setRightTab] = useState<'trade' | 'grid' | 'dca' | 'multi' | 'auto' | 'balance' | 'chat'>('trade');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timeframeRef = useRef(tradeConfig.timeframe);

  // 设置相关状态
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('xtmc_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // 主题状态
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (settings.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return settings.theme;
  });

  // 当前价格
  const currentPrice = marketData.length > 0 ? marketData[marketData.length - 1].close : 0;

  // 是否已配置API
  const isApiConfigured = Boolean(settings.apiKey && settings.apiSecret);

  useEffect(() => {
    timeframeRef.current = tradeConfig.timeframe;
  }, [tradeConfig.timeframe]);

  // 保存设置
  useEffect(() => {
    localStorage.setItem('xtmc_settings', JSON.stringify(settings));
    
    // 更新主题
    if (settings.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    } else {
      setTheme(settings.theme);
    }
  }, [settings]);

  // 监听系统主题变化
  useEffect(() => {
    if (settings.theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [settings.theme]);

  // ============== WebSocket连接 ==============
  
  useEffect(() => {
    let ws: WebSocket | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        const wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws';
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          heartbeatTimer = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ action: 'ping' }));
            }
          }, 30000);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'market_data' && message.data && Array.isArray(message.data)) {
              setMarketData(message.data);
            } else if (message.type === 'ai_signal' && message.signal) {
              setSignals(prev => [message.signal, ...prev].slice(0, 100));
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          reconnectTimer = setTimeout(connect, 5000);
        };

        ws.onerror = () => setIsConnected(false);
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  // ============== 数据获取 ==============

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/status`);
        if (response.ok) {
          const data = await response.json();
          setSystemStatus(data);
        }
      } catch { /* ignore */ }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/config/trade`);
        if (response.ok) {
          const data = await response.json();
          setTradeConfig(prev => ({ ...prev, ...data }));
          if (data.symbol) setCurrentSymbol(data.symbol);
        }
      } catch { /* ignore */ }
    };
    fetchConfigs();
  }, []);

  useEffect(() => {
    const fetchMarketData = async () => {
      // 优先尝试后端API
      try {
        const response = await fetch(
          `${API_BASE}/api/market/data?symbol=${currentSymbol}&timeframe=${timeframeRef.current}&limit=500`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            setMarketData(data.data);
            setSystemStatus(prev => ({
              ...prev,
              data_source: { active: 'backend', stats: {} },
            }));
            return;
          }
        }
      } catch { /* 后端不可用 */ }

      // 使用多数据源系统获取真实数据 (Bybit → OKX → Binance → Binance Backup)
      try {
        const result = await dataSourceManager.fetchKlines(currentSymbol, timeframeRef.current, 300);
        if (result.data.length > 0) {
          setMarketData(result.data);
          const dsStatus = dataSourceManager.getStatus();
          setSystemStatus(prev => ({
            ...prev,
            data_source: {
              active: result.source,
              stats: Object.fromEntries(
                Object.entries(dsStatus.stats).map(([k, v]) => [k, { failures: v.failures, last_success: v.lastSuccess, healthy: v.healthy }])
              ),
            },
          }));
          return;
        }
      } catch (err) {
        console.warn('[App] 多数据源获取失败:', err);
      }

      // 所有源都失败，使用本地模拟数据
      const mockData = generateMockMarketData(currentSymbol, 300);
      setMarketData(mockData);
      setSystemStatus(prev => ({
        ...prev,
        data_source: { active: 'demo', stats: {} },
      }));
    };
    fetchMarketData();

    // 定期刷新数据 (每30秒)
    const refreshTimer = setInterval(fetchMarketData, 30000);
    return () => clearInterval(refreshTimer);
  }, [currentSymbol, tradeConfig.timeframe]);

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/signals?limit=50`);
        if (response.ok) {
          const data = await response.json();
          if (data.signals && data.signals.length > 0) {
            setSignals(data.signals);
            return;
          }
        }
      } catch { /* ignore */ }

      // 后端不可用时，基于模拟市场数据生成信号
      if (marketData.length > 30) {
        setSignals(generateMockSignals(marketData, currentSymbol));
      }
    };
    fetchSignals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSymbol, marketData.length > 0]);

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/chat/history?limit=50`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages) setChatMessages(data.messages);
        }
      } catch { /* ignore */ }
    };
    fetchChatHistory();
  }, []);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/ai/tools`);
        if (response.ok) {
          const data = await response.json();
          if (data.tool_list) {
            setAiTools(data.tool_list.map((name: string) => ({ name, description: '' })));
          }
        }
      } catch { /* ignore */ }
    };
    fetchTools();
  }, []);

  useEffect(() => {
    const fetchReflections = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/ai/reflections?limit=10`);
        if (response.ok) {
          const data = await response.json();
          if (data.reflections) {
            setEvolutionRecords(data.reflections.map((r: any) => ({
              timestamp: r.timestamp,
              summary: r.summary,
              gaps: r.gaps?.length || 0,
              recommendations: r.recommendations?.length || 0
            })));
          }
        }
      } catch { /* ignore */ }
    };
    fetchReflections();
  }, []);

  // ============== 操作处理 ==============

  const handleUpdateTradeConfig = useCallback(async (config: TradeConfig) => {
    // 总是更新本地状态
    setTradeConfig(config);
    if (config.symbol !== currentSymbol) {
      setCurrentSymbol(config.symbol);
    }
    // 尝试同步到后端
    try {
      await fetch(`${API_BASE}/api/config/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch {
      // 后端不可用时仅本地更新
    }
  }, [currentSymbol]);

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: ChatMessage = { role: 'user', content, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userMessage),
      });
      if (response.ok) {
        const data = await response.json();
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: data.content || '抱歉，暂时无法回复。',
          timestamp: Date.now(),
          metadata: data.metadata,
        };
        setChatMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '网络错误，请稍后重试。',
        timestamp: Date.now(),
      }]);
    }
  }, []);

  const handleSaveSettings = useCallback((newSettings: typeof settings) => {
    setSettings(newSettings);
  }, []);

  // ============== 主题类名 ==============
  const themeClasses = theme === 'light' 
    ? 'bg-gray-50 text-gray-900' 
    : 'dark bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white';

  // ============== 渲染 ==============

  return (
    <div className={`min-h-screen ${themeClasses}`} data-theme={theme}>
      <Header 
        systemStatus={systemStatus} 
        isConnected={isConnected} 
        onOpenSettings={() => setShowSettings(true)}
        theme={theme}
      />

      <main className="container mx-auto px-4 py-3 pb-16">
        {/* 交易对选择和快捷操作 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            {/* 币种搜索组件 */}
            <CoinSearch
              value={currentSymbol}
              onChange={(symbol) => {
                setCurrentSymbol(symbol);
                handleUpdateTradeConfig({ ...tradeConfig, symbol });
              }}
            />

            {/* 时间周期 */}
            <div className="flex gap-1">
              {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => handleUpdateTradeConfig({ ...tradeConfig, timeframe: tf })}
                  className={`px-2.5 py-1.5 text-xs rounded transition-all ${
                    tradeConfig.timeframe === tf
                      ? 'bg-blue-600 text-white'
                      : theme === 'light'
                        ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* 数据源指示 */}
          <div className="flex items-center gap-4 text-xs">
            <span className={`px-2 py-1 rounded flex items-center gap-1.5 ${
              systemStatus.data_source?.active && systemStatus.data_source.active !== 'none' && systemStatus.data_source.active !== 'demo'
                ? 'bg-green-600/20 text-green-400'
                : systemStatus.data_source?.active === 'demo'
                  ? 'bg-yellow-600/20 text-yellow-400'
                  : 'bg-slate-700/50 text-slate-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                systemStatus.data_source?.active && systemStatus.data_source.active !== 'none' && systemStatus.data_source.active !== 'demo'
                  ? 'bg-green-500 animate-pulse'
                  : systemStatus.data_source?.active === 'demo'
                    ? 'bg-yellow-500'
                    : 'bg-slate-500'
              }`} />
              {systemStatus.data_source?.active === 'demo' ? '模拟数据' : 
               systemStatus.data_source?.active && systemStatus.data_source.active !== 'none' 
                 ? `实时: ${systemStatus.data_source.active}` 
                 : '连接中...'}
            </span>
            {/* 数据源列表 */}
            {dataSourceManager.getSourceList().map(src => (
              <span
                key={src.id}
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  src.active
                    ? 'bg-green-600/20 text-green-400 font-semibold'
                    : src.healthy
                      ? theme === 'light' ? 'bg-gray-100 text-gray-400' : 'bg-slate-800/50 text-slate-500'
                      : 'bg-red-600/10 text-red-400/50 line-through'
                }`}
              >
                {src.name}
              </span>
            ))}
          </div>
        </div>

        {/* 主布局 */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* 左侧: 图表区 (3列) */}
          <div className="xl:col-span-3 space-y-4">
            {/* 图表 */}
            <div className={`backdrop-blur-sm rounded-xl border overflow-hidden ${
              theme === 'light' 
                ? 'bg-white border-gray-200' 
                : 'bg-slate-800/50 border-slate-700/50'
            }`}>
              {/* 图表标签页 */}
              <div className={`flex items-center justify-between px-4 py-2 border-b ${
                theme === 'light' ? 'border-gray-200' : 'border-slate-700/50'
              }`}>
                <div className="flex gap-1">
                  {[
                    { key: 'chart', label: 'K线图' },
                    { key: 'signals', label: '信号' },
                    { key: 'backtest', label: '回测' },
                    { key: 'tools', label: 'AI工具' },
                    { key: 'evolution', label: '进化记录' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setMainTab(key as typeof mainTab)}
                      className={`px-3 py-1.5 text-xs rounded transition-all ${
                        mainTab === key
                          ? 'bg-blue-600 text-white'
                          : theme === 'light'
                            ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 图表内容 */}
              <div className="h-[450px]">
                {mainTab === 'chart' && (
                  <TradingChart symbol={currentSymbol} timeframe={tradeConfig.timeframe} theme={theme} />
                )}
                {mainTab === 'signals' && <SignalPanel signals={signals} />}
                {mainTab === 'backtest' && <BacktestPanel symbol={currentSymbol} />}
                {mainTab === 'tools' && <ToolLibrary tools={aiTools} />}
                {mainTab === 'evolution' && <EvolutionPanel records={evolutionRecords} />}
              </div>
            </div>

            {/* 底部: 持仓和配置 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PositionPanel />
              <ControlPanel
                tradeConfig={tradeConfig}
                systemStatus={systemStatus}
                onUpdateTradeConfig={handleUpdateTradeConfig}
                onOpenSettings={() => setShowSettings(true)}
              />
            </div>
          </div>

          {/* 右侧: 交易面板 (1列) */}
          <div className="xl:col-span-1 space-y-4">
            {/* 右侧标签页 */}
            <div className={`rounded-xl border overflow-hidden flex flex-col ${
              theme === 'light' 
                ? 'bg-white border-gray-200' 
                : 'bg-slate-800/50 border-slate-700/50'
            }`}>
              <div className={`flex border-b overflow-x-auto flex-shrink-0 ${
                theme === 'light' ? 'border-gray-200 bg-gray-50' : 'border-slate-700/50 bg-slate-900/30'
              }`}>
                {[
                  { key: 'trade', label: '交易' },
                  { key: 'grid', label: '网格' },
                  { key: 'dca', label: '定投' },
                  { key: 'multi', label: '组合' },
                  { key: 'auto', label: '自动' },
                  { key: 'chat', label: 'AI' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setRightTab(key as typeof rightTab)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-all whitespace-nowrap px-2 min-w-0 ${
                      rightTab === key
                        ? theme === 'light'
                          ? 'text-blue-600 bg-white border-b-2 border-blue-500'
                          : 'text-blue-400 bg-slate-800 border-b-2 border-blue-400'
                        : theme === 'light'
                          ? 'text-gray-600 hover:text-blue-600 hover:bg-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                {/* 资产摘要 - 除AI选项外都显示 */}
                {rightTab !== 'chat' && (
                  <div className={`p-3 border-b ${
                    theme === 'light' ? 'border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50' : 'border-slate-700/50 bg-gradient-to-r from-blue-900/20 to-purple-900/20'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-slate-400'}`}>账户资产</div>
                        <div className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                          {isApiConfigured ? '$27,261.03' : '--'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-slate-400'}`}>可用余额</div>
                        <div className={`text-sm font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                          {isApiConfigured ? '$10,000.00' : '--'}
                        </div>
                      </div>
                      {!isApiConfigured && (
                        <button 
                          onClick={() => setShowSettings(true)}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                          配置API
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {rightTab === 'trade' && (
                  <OrderPanel symbol={currentSymbol} currentPrice={currentPrice} />
                )}
                {rightTab === 'grid' && (
                  <GridTradingPanel symbol={currentSymbol} currentPrice={currentPrice} />
                )}
                {rightTab === 'dca' && (
                  <DCAPanel symbol={currentSymbol} currentPrice={currentPrice} />
                )}
                {rightTab === 'multi' && (
                  <MultiStrategyPanel />
                )}
                {rightTab === 'auto' && (
                  <SignalExecutorPanel signals={signals} />
                )}
                {rightTab === 'chat' && (
                  <div className="h-full" style={{ minHeight: '500px' }}>
                    <AIChat
                      messages={chatMessages}
                      onSendMessage={handleSendMessage}
                      aiEnabled={true}
                      systemStatus={systemStatus}
                      tradeConfig={tradeConfig}
                      marketData={marketData}
                      signals={signals}
                      currentSymbol={currentSymbol}
                      currentPrice={currentPrice}
                      onUpdateConfig={(config) => handleUpdateTradeConfig({ ...tradeConfig, ...config })}
                      onSwitchSymbol={(symbol) => {
                        setCurrentSymbol(symbol);
                        handleUpdateTradeConfig({ ...tradeConfig, symbol });
                      }}
                      onChangeTimeframe={(tf) => handleUpdateTradeConfig({ ...tradeConfig, timeframe: tf })}
                      onToggleTrading={(enabled) => handleUpdateTradeConfig({ ...tradeConfig, enable_trading: enabled })}
                      onAddIndicator={(indicatorId) => {
                        console.log('添加指标:', indicatorId);
                      }}
                      llmConfig={{
                        provider: settings.aiProvider || 'auto',
                        ollamaUrl: settings.ollamaUrl,
                        ollamaModel: settings.ollamaModel,
                        deepseekKey: settings.deepseekKey,
                        glmKey: settings.glmKey,
                        openaiKey: settings.openaiKey,
                        claudeKey: settings.claudeKey,
                        kimiKey: settings.kimiKey,
                        qwenKey: settings.qwenKey,
                        geminiKey: settings.geminiKey,
                      }}
                      onOpenSettings={() => setShowSettings(true)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <StatusBar 
        systemStatus={systemStatus} 
        isConnected={isConnected} 
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* 设置面板 */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
