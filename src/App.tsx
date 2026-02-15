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

// 导入API
import { 
  fetchKlines, 
  fetchFuturesKlines,
  fetchSpotBalance, 
  fetchFuturesBalance,
  subscribeKlines,
  type AccountBalance
} from './lib/binanceApi';

// 默认设置配置
const DEFAULT_SETTINGS = {
  exchange: 'binance',
  apiKey: '',
  apiSecret: '',
  passphrase: '',
  testnet: false,
  ollamaUrl: '/api/ollama',  // 使用服务器代理路径
  ollamaModel: 'qwen2.5:7b',
  deepseekKey: '',
  glmKey: '',
  openaiKey: '',
  claudeKey: '',
  geminiKey: '',
  kimiKey: '',
  qwenKey: '',
  aiProvider: 'ollama' as const,  // 默认使用服务器上的Ollama
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
  const [evolutionRecords, _setEvolutionRecords] = useState<EvolutionRecord[]>([]);
  
  // 交易类型：现货 或 合约
  const [tradeType, setTradeType] = useState<'spot' | 'futures'>(() => {
    const saved = localStorage.getItem('xtmc_trade_type');
    return (saved as 'spot' | 'futures') || 'futures';
  });
  
  // 账户余额
  const [accountBalance, setAccountBalance] = useState<AccountBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  
  // 数据加载状态
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  
  const [mainTab, setMainTab] = useState<'chart' | 'signals' | 'tools' | 'evolution' | 'backtest'>('chart');
  const [rightTab, setRightTab] = useState<'trade' | 'grid' | 'dca' | 'multi' | 'auto' | 'balance' | 'chat'>('trade');
  const [isConnected, setIsConnected] = useState(false);
  const wsUnsubscribeRef = useRef<(() => void) | null>(null);
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

  // ============== 币安数据获取 ==============
  
  // 保存交易类型
  useEffect(() => {
    localStorage.setItem('xtmc_trade_type', tradeType);
  }, [tradeType]);

  // 获取K线数据
  useEffect(() => {
    let isMounted = true;
    
    const loadKlines = async () => {
      setDataLoading(true);
      setDataError(null);
      
      try {
        const fetchFn = tradeType === 'futures' ? fetchFuturesKlines : fetchKlines;
        const data = await fetchFn(currentSymbol, tradeConfig.timeframe, 500);
        
        if (isMounted) {
          setMarketData(data);
          setIsConnected(true);
          setDataError(null);
          
          // 更新系统状态
          setSystemStatus(prev => ({
            ...prev,
            status: 'running',
            data_source: { 
              active: 'binance', 
              stats: { 
                binance: { failures: 0, last_success: Date.now(), healthy: true } 
              } 
            },
            trading: { ...prev.trading, symbol: currentSymbol }
          }));
        }
      } catch (error) {
        if (isMounted) {
          setDataError(error instanceof Error ? error.message : '获取数据失败');
          setIsConnected(false);
        }
      } finally {
        if (isMounted) {
          setDataLoading(false);
        }
      }
    };
    
    loadKlines();
    
    // 定时刷新数据
    const interval = setInterval(loadKlines, 60000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentSymbol, tradeConfig.timeframe, tradeType]);

  // WebSocket实时更新
  useEffect(() => {
    // 清理旧的WebSocket
    if (wsUnsubscribeRef.current) {
      wsUnsubscribeRef.current();
      wsUnsubscribeRef.current = null;
    }
    
    // 订阅实时K线
    const unsubscribe = subscribeKlines(
      currentSymbol,
      tradeConfig.timeframe,
      (newKline) => {
        setMarketData(prev => {
          if (prev.length === 0) return prev;
          
          const lastKline = prev[prev.length - 1];
          // 如果是同一根K线，更新它
          if (lastKline.time === newKline.time) {
            return [...prev.slice(0, -1), newKline];
          }
          // 如果是新K线，添加它
          if (newKline.time > lastKline.time) {
            return [...prev.slice(1), newKline];
          }
          return prev;
        });
      },
      tradeType === 'futures'
    );
    
    wsUnsubscribeRef.current = unsubscribe;
    
    return () => {
      if (wsUnsubscribeRef.current) {
        wsUnsubscribeRef.current();
      }
    };
  }, [currentSymbol, tradeConfig.timeframe, tradeType]);

  // 获取账户余额
  useEffect(() => {
    if (!settings.apiKey || !settings.apiSecret) {
      setAccountBalance(null);
      return;
    }
    
    let isMounted = true;
    
    const loadBalance = async () => {
      setBalanceLoading(true);
      setBalanceError(null);
      
      try {
        const fetchFn = tradeType === 'futures' ? fetchFuturesBalance : fetchSpotBalance;
        const balance = await fetchFn(settings.apiKey, settings.apiSecret);
        
        if (isMounted) {
          setAccountBalance(balance);
          setBalanceError(null);
        }
      } catch (error) {
        if (isMounted) {
          setBalanceError(error instanceof Error ? error.message : '获取余额失败');
          setAccountBalance(null);
        }
      } finally {
        if (isMounted) {
          setBalanceLoading(false);
        }
      }
    };
    
    loadBalance();
    
    // 定时刷新余额
    const interval = setInterval(loadBalance, 30000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [settings.apiKey, settings.apiSecret, tradeType]);

  // ============== 其他数据获取 ==============

  // 信号历史 (本地存储)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('xtmc_signals');
      if (saved) {
        setSignals(JSON.parse(saved).slice(0, 50));
      }
    } catch { /* ignore */ }
  }, []);

  // 保存信号到本地
  useEffect(() => {
    if (signals.length > 0) {
      localStorage.setItem('xtmc_signals', JSON.stringify(signals.slice(0, 50)));
    }
  }, [signals]);

  // AI工具列表 (本地)
  useEffect(() => {
    setAiTools([
      { name: 'analyze_market', description: '分析市场' },
      { name: 'generate_signal', description: '生成信号' },
      { name: 'suggest_strategy', description: '策略建议' },
      { name: 'get_system_status', description: '系统状态' },
      { name: 'toggle_trading', description: '开关交易' },
    ]);
  }, []);

  useEffect(() => {
    // 聊天历史从本地加载
    try {
      const saved = localStorage.getItem('xtmc_chat_history');
      if (saved) {
        setChatMessages(JSON.parse(saved).slice(-50));
      }
    } catch { /* ignore */ }
  }, []);

  // 保存聊天历史
  useEffect(() => {
    if (chatMessages.length > 0) {
      localStorage.setItem('xtmc_chat_history', JSON.stringify(chatMessages.slice(-50)));
    }
  }, [chatMessages]);

  // ============== 操作处理 ==============

  const handleUpdateTradeConfig = useCallback((config: TradeConfig) => {
    setTradeConfig(config);
    if (config.symbol !== currentSymbol) {
      setCurrentSymbol(config.symbol);
    }
    // 保存到本地
    localStorage.setItem('xtmc_trade_config', JSON.stringify(config));
  }, [currentSymbol]);

  const handleSendMessage = useCallback((content: string) => {
    const userMessage: ChatMessage = { role: 'user', content, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMessage]);
    // AI响应由AIChat组件内部处理
  }, []);

  const handleSaveSettings = useCallback((newSettings: typeof settings) => {
    setSettings(newSettings);
  }, []);

  // 切换交易类型
  const handleTradeTypeChange = useCallback((type: 'spot' | 'futures') => {
    setTradeType(type);
    setMarketData([]); // 清空数据，触发重新加载
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

          {/* 数据源指示 & 交易类型切换 */}
          <div className="flex items-center gap-3 text-xs">
            {/* 交易类型切换 */}
            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-slate-600">
              <button
                onClick={() => handleTradeTypeChange('spot')}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${
                  tradeType === 'spot'
                    ? 'bg-green-600 text-white'
                    : theme === 'light'
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                现货
              </button>
              <button
                onClick={() => handleTradeTypeChange('futures')}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${
                  tradeType === 'futures'
                    ? 'bg-orange-600 text-white'
                    : theme === 'light'
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                合约
              </button>
            </div>
            
            {/* 数据源状态 */}
            <span className={`px-2 py-1 rounded ${
              isConnected && !dataError
                ? 'bg-green-600/20 text-green-400'
                : dataLoading
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'bg-red-600/20 text-red-400'
            }`}>
              {dataLoading ? '加载中...' : 
               dataError ? `错误: ${dataError}` :
               isConnected ? `Binance ${tradeType === 'futures' ? '合约' : '现货'}` : '未连接'}
            </span>
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
                  <TradingChart data={marketData} symbol={currentSymbol} />
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
                        <div className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-slate-400'}`}>
                          账户资产 {tradeType === 'futures' ? '(合约)' : '(现货)'}
                        </div>
                        <div className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                          {balanceLoading ? '...' : 
                           balanceError ? '--' :
                           accountBalance ? `$${accountBalance.totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 
                           isApiConfigured ? '获取中...' : '--'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-slate-400'}`}>可用余额</div>
                        <div className={`text-sm font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                          {balanceLoading ? '...' :
                           balanceError ? '--' :
                           accountBalance ? `$${accountBalance.availableBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` :
                           isApiConfigured ? '获取中...' : '--'}
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
                      {balanceError && (
                        <div className="text-[10px] text-red-400" title={balanceError}>
                          API错误
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {rightTab === 'trade' && (
                  <OrderPanel 
                    symbol={currentSymbol} 
                    currentPrice={currentPrice}
                    balance={accountBalance?.availableBalance || 0}
                    tradeType={tradeType}
                  />
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
                        // 触发图表添加指标 - 通过事件或状态传递
                        console.log('添加指标:', indicatorId);
                      }}
                      aiSettings={{
                        kimiKey: settings.kimiKey || '',
                        deepseekKey: settings.deepseekKey || '',
                        openaiKey: settings.openaiKey || '',
                        claudeKey: settings.claudeKey || '',
                        geminiKey: settings.geminiKey || '',
                        qwenKey: settings.qwenKey || '',
                        glmKey: settings.glmKey || '',
                        ollamaUrl: settings.ollamaUrl || '/api/ollama',
                        ollamaModel: settings.ollamaModel || 'qwen2.5:7b',
                        aiProvider: settings.aiProvider || 'ollama',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <StatusBar systemStatus={systemStatus} isConnected={isConnected} />

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
