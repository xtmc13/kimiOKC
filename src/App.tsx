/**
 * XTMC量化交易系统 - 主应用组件
 * 自我进化型AI交易系统
 */

import { useState, useEffect, useCallback } from 'react';
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
const API_BASE = window.location.origin.includes('localhost') 
  ? 'http://localhost:8080' 
  : '';

function App() {
  // ============== 状态管理 ==============
  
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    status: 'stopped',
    timestamp: Date.now(),
    system: {
      cpu_percent: 0,
      memory_percent: 0,
      memory_used: 0,
      memory_total: 4096,
    },
    trading: {
      enabled: false,
      exchange: 'binance',
      symbol: 'BTCUSDT',
    },
    ai: {
      is_running: false,
      tool_count: 0,
      evolution_count: 0,
      win_rate: 0,
      total_profit: 0
    }
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
  
  const [activeTab, setActiveTab] = useState<'chart' | 'signals' | 'tools' | 'evolution'>('chart');
  const [isConnected, setIsConnected] = useState(false);

  // ============== WebSocket连接 ==============
  
  useEffect(() => {
    const wsUrl = API_BASE.replace('http', 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('XTMC WebSocket已连接');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    ws.onclose = () => {
      console.log('XTMC WebSocket已断开');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
      setIsConnected(false);
    };

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      ws.close();
    };
  }, []);

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'market_data':
        if (message.data && Array.isArray(message.data)) {
          setMarketData(message.data);
        }
        break;
      case 'ai_signal':
        if (message.signal) {
          setSignals(prev => [message.signal, ...prev].slice(0, 100));
        }
        break;
    }
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
      } catch (error) {
        console.error('获取状态失败:', error);
      }
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
          setTradeConfig(data);
          setCurrentSymbol(data.symbol);
        }
      } catch (error) {
        console.error('获取配置失败:', error);
      }
    };

    fetchConfigs();
  }, []);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/market/data?symbol=${currentSymbol}&timeframe=${tradeConfig.timeframe}&limit=500`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.data) {
            setMarketData(data.data);
          }
        }
      } catch (error) {
        console.error('获取市场数据失败:', error);
      }
    };

    fetchMarketData();
  }, [currentSymbol, tradeConfig.timeframe]);

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/signals?limit=50`);
        if (response.ok) {
          const data = await response.json();
          if (data.signals) {
            setSignals(data.signals);
          }
        }
      } catch (error) {
        console.error('获取信号失败:', error);
      }
    };

    fetchSignals();
  }, []);

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/chat/history?limit=50`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages) {
            setChatMessages(data.messages);
          }
        }
      } catch (error) {
        console.error('获取聊天记录失败:', error);
      }
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
      } catch (error) {
        console.error('获取工具库失败:', error);
      }
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
      } catch (error) {
        console.error('获取反思历史失败:', error);
      }
    };

    fetchReflections();
  }, []);

  // ============== 操作处理 ==============

  const handleUpdateTradeConfig = async (config: TradeConfig) => {
    try {
      const response = await fetch(`${API_BASE}/api/config/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        setTradeConfig(config);
        setCurrentSymbol(config.symbol);
      }
    } catch (error) {
      console.error('更新交易配置失败:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };
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
          content: data.content,
          timestamp: Date.now(),
          metadata: data.metadata,
        };
        setChatMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
    }
  };

  // ============== 渲染 ==============

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* 头部 */}
      <Header 
        systemStatus={systemStatus}
        isConnected={isConnected}
      />

      {/* 主内容区 */}
      <main className="container mx-auto px-4 py-4 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左侧: 图表和控制面板 */}
          <div className="lg:col-span-2 space-y-4">
            {/* 图表区域 */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-white">
                    {currentSymbol}
                  </h2>
                  <div className="flex gap-2">
                    {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
                      <button
                        key={tf}
                        onClick={() => handleUpdateTradeConfig({ ...tradeConfig, timeframe: tf })}
                        className={`px-2 py-1 text-xs rounded ${
                          tradeConfig.timeframe === tf
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('chart')}
                    className={`px-3 py-1 text-sm rounded ${
                      activeTab === 'chart'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    图表
                  </button>
                  <button
                    onClick={() => setActiveTab('signals')}
                    className={`px-3 py-1 text-sm rounded ${
                      activeTab === 'signals'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    信号
                  </button>
                  <button
                    onClick={() => setActiveTab('tools')}
                    className={`px-3 py-1 text-sm rounded ${
                      activeTab === 'tools'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    工具库
                  </button>
                  <button
                    onClick={() => setActiveTab('evolution')}
                    className={`px-3 py-1 text-sm rounded ${
                      activeTab === 'evolution'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    进化
                  </button>
                </div>
              </div>
              
              <div className="h-[400px]">
                {activeTab === 'chart' && (
                  <TradingChart 
                    data={marketData} 
                    symbol={currentSymbol}
                    signals={signals}
                  />
                )}
                {activeTab === 'signals' && <SignalPanel signals={signals} />}
                {activeTab === 'tools' && <ToolLibrary tools={aiTools} />}
                {activeTab === 'evolution' && <EvolutionPanel records={evolutionRecords} />}
              </div>
            </div>

            {/* 控制面板 */}
            <ControlPanel
              tradeConfig={tradeConfig}
              systemStatus={systemStatus}
              onUpdateTradeConfig={handleUpdateTradeConfig}
            />
          </div>

          {/* 右侧: AI对话 */}
          <div className="lg:col-span-1">
            <AIChat
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              aiEnabled={true}
            />
          </div>
        </div>
      </main>

      {/* 状态栏 */}
      <StatusBar systemStatus={systemStatus} isConnected={isConnected} />
    </div>
  );
}

export default App;
