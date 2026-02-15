/**
 * XTMC AI智能体交互界面
 * 具备完整的系统控制、数据分析、策略执行能力
 * 支持外部AI API (Kimi, DeepSeek等)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Brain, 
  Zap,
  Terminal,
  BarChart2,
  Settings,
  TrendingUp,
  TrendingDown,
  Activity,
  Cpu,
  Target,
  Layers,
  RefreshCw,
  Cloud,
  CloudOff
} from 'lucide-react';
import type { ChatMessage, SystemStatus, TradeConfig, MarketData, TradeSignal } from '../types';
import { aiAgent, type AIContext } from '../lib/aiAgent';
import { getAIClient } from '../lib/aiApi';

interface AIChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  aiEnabled: boolean;
  // 新增：系统控制能力
  systemStatus?: SystemStatus;
  tradeConfig?: TradeConfig;
  marketData?: MarketData[];
  signals?: TradeSignal[];
  currentSymbol?: string;
  currentPrice?: number;
  onUpdateConfig?: (config: Partial<TradeConfig>) => void;
  onSwitchSymbol?: (symbol: string) => void;
  onChangeTimeframe?: (timeframe: string) => void;
  onToggleTrading?: (enabled: boolean) => void;
  onAddIndicator?: (indicatorId: string) => void;
  // AI API配置
  aiSettings?: {
    kimiKey: string;
    deepseekKey: string;
    openaiKey: string;
    claudeKey: string;
    geminiKey: string;
    qwenKey: string;
    glmKey: string;
    ollamaUrl: string;
    ollamaModel: string;
    aiProvider: string;
  };
}

export default function AIChat({ 
  messages, 
  onSendMessage: _onSendMessage, // 保留用于将来的服务器端AI调用
  aiEnabled,
  systemStatus,
  tradeConfig,
  marketData = [],
  signals = [],
  currentSymbol = 'BTCUSDT',
  currentPrice = 0,
  onUpdateConfig,
  onSwitchSymbol,
  onChangeTimeframe,
  onToggleTrading,
  onAddIndicator,
  aiSettings
}: AIChatProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingTime, setThinkingTime] = useState(0);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [showTools, setShowTools] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>('local');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);

  // 检查外部AI是否可用
  useEffect(() => {
    if (aiSettings) {
      const client = getAIClient(aiSettings);
      if (client.isAvailable()) {
        setAiProvider(client.getCurrentProvider());
      } else {
        setAiProvider('local');
      }
    }
  }, [aiSettings]);

  // 合并消息 (包含服务器消息和本地AI消息)
  const allMessages = [...messages, ...localMessages];

  // 初始化AI智能体上下文
  useEffect(() => {
    if (systemStatus && tradeConfig) {
      const context: AIContext = {
        systemStatus,
        tradeConfig,
        marketData,
        signals,
        currentSymbol,
        currentPrice,
        onUpdateConfig: onUpdateConfig || (() => {}),
        onSwitchSymbol: onSwitchSymbol || (() => {}),
        onExecuteSignal: () => {},
        onAddIndicator: onAddIndicator || (() => {}),
        onChangeTimeframe: onChangeTimeframe || (() => {}),
        onToggleTrading: onToggleTrading || (() => {})
      };
      aiAgent.setContext(context);
    }
  }, [systemStatus, tradeConfig, marketData, signals, currentSymbol, currentPrice, onUpdateConfig, onSwitchSymbol, onAddIndicator, onChangeTimeframe, onToggleTrading]);

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (allMessages.length > prevMessagesLengthRef.current) {
      scrollToBottom();
    }
    prevMessagesLengthRef.current = allMessages.length;
  }, [allMessages.length, scrollToBottom]);

  // 处理AI智能体消息
  const handleAIProcess = async (userInput: string) => {
    // 添加用户消息
    const userMessage: ChatMessage = {
      role: 'user',
      content: userInput,
      timestamp: Date.now()
    };
    setLocalMessages(prev => [...prev, userMessage]);

    setIsTyping(true);
    setThinkingTime(0);
    thinkingTimerRef.current = setInterval(() => {
      setThinkingTime(prev => prev + 1);
    }, 1000);
    
    try {
      // 检查是否是系统控制命令（如切换币种、开关交易等）
      const intent = aiAgent.recognizeIntent(userInput);
      const isSystemCommand = intent.suggestedTool && 
        ['toggle_trading', 'switch_symbol', 'change_timeframe', 'add_indicator', 'update_risk_config'].includes(intent.suggestedTool) &&
        intent.confidence > 0.8;
      
      // 系统控制命令使用本地处理
      if (isSystemCommand) {
        const response = await aiAgent.processInput(userInput);
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
          metadata: { processed: true, provider: 'local' }
        };
        setLocalMessages(prev => [...prev, aiMessage]);
      } 
      // 其他请求优先使用外部AI（Ollama等）
      else if (aiSettings) {
        const client = getAIClient(aiSettings);
        
        if (client.isAvailable()) {
          // 构建市场上下文
          const context = buildMarketContext();
          
          try {
            const response = await client.chat(userInput, context);
            const aiMessage: ChatMessage = {
              role: 'assistant',
              content: response.content,
              timestamp: Date.now(),
              metadata: { processed: true, provider: client.getCurrentProvider(), model: response.model }
            };
            setLocalMessages(prev => [...prev, aiMessage]);
          } catch (apiError) {
            // 外部API失败，回退到本地处理
            console.warn('外部AI API调用失败，使用本地处理:', apiError);
            const response = await aiAgent.processInput(userInput);
            const aiMessage: ChatMessage = {
              role: 'assistant',
              content: `${response}\n\n---\n⚠️ AI服务暂时不可用，使用本地处理`,
              timestamp: Date.now(),
              metadata: { processed: true, provider: 'local', fallback: true }
            };
            setLocalMessages(prev => [...prev, aiMessage]);
          }
        } else {
          // 没有外部API配置，使用本地处理
          const response = await aiAgent.processInput(userInput);
          const aiMessage: ChatMessage = {
            role: 'assistant',
            content: response,
            timestamp: Date.now(),
            metadata: { processed: true, provider: 'local' }
          };
          setLocalMessages(prev => [...prev, aiMessage]);
        }
      } else {
        // 没有AI设置，使用本地处理
        const response = await aiAgent.processInput(userInput);
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
          metadata: { processed: true, provider: 'local' }
        };
        setLocalMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `处理失败：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now()
      };
      setLocalMessages(prev => [...prev, errorMessage]);
    }
    
    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    setIsTyping(false);
  };

  // 构建市场上下文 - 增强版
  const buildMarketContext = useCallback(() => {
    if (marketData.length < 20) return '';
    
    const data50 = marketData.slice(-50);
    const data20 = marketData.slice(-20);
    const closes = data50.map(d => d.close);
    const highs = data50.map(d => d.high);
    const lows = data50.map(d => d.low);
    const volumes = data50.map(d => d.volume);
    
    // 价格统计
    const high24h = Math.max(...data20.map(d => d.high));
    const low24h = Math.min(...data20.map(d => d.low));
    const priceChange = ((currentPrice - closes[closes.length - 20]) / closes[closes.length - 20] * 100);
    
    // 均线
    const sma20 = data20.map(d => d.close).reduce((a, b) => a + b, 0) / 20;
    const sma50 = closes.reduce((a, b) => a + b, 0) / closes.length;
    
    // EMA12 & EMA26
    const calcEMA = (data: number[], period: number) => {
      const k = 2 / (period + 1);
      let ema = data[0];
      for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
      }
      return ema;
    };
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    const macdLine = ema12 - ema26;
    
    // RSI
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const rsi = gains + losses > 0 ? (gains / (gains + losses) * 100) : 50;
    
    // 布林带
    const std = Math.sqrt(data20.map(d => d.close).reduce((sum, c) => sum + Math.pow(c - sma20, 2), 0) / 20);
    const bollUpper = sma20 + 2 * std;
    const bollLower = sma20 - 2 * std;
    
    // ATR (平均真实波幅)
    let atrSum = 0;
    for (let i = data20.length - 14; i < data20.length; i++) {
      const tr = Math.max(
        data20[i].high - data20[i].low,
        Math.abs(data20[i].high - data20[i - 1].close),
        Math.abs(data20[i].low - data20[i - 1].close)
      );
      atrSum += tr;
    }
    const atr = atrSum / 14;
    
    // 成交量分析
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const latestVolume = volumes[volumes.length - 1];
    const volumeRatio = latestVolume / avgVolume;
    
    // 趋势判断
    const trend = currentPrice > sma20 && sma20 > sma50 ? '上升趋势' : 
                  currentPrice < sma20 && sma20 < sma50 ? '下降趋势' : '震荡';
    
    // 支撑阻力
    const recentHigh = Math.max(...highs.slice(-20));
    const recentLow = Math.min(...lows.slice(-20));
    
    return `
## 实时市场数据

**交易对**: ${currentSymbol}
**当前价格**: $${currentPrice.toFixed(2)}
**涨跌幅(20周期)**: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%

### 价格区间
- 24h最高: $${high24h.toFixed(2)}
- 24h最低: $${low24h.toFixed(2)}
- 近期阻力: $${recentHigh.toFixed(2)} (距离 ${((recentHigh - currentPrice) / currentPrice * 100).toFixed(2)}%)
- 近期支撑: $${recentLow.toFixed(2)} (距离 ${((currentPrice - recentLow) / currentPrice * 100).toFixed(2)}%)

### 均线系统
- SMA20: $${sma20.toFixed(2)} (价格${currentPrice > sma20 ? '在上方' : '在下方'})
- SMA50: $${sma50.toFixed(2)}
- EMA12: $${ema12.toFixed(2)}
- EMA26: $${ema26.toFixed(2)}

### 技术指标
- **趋势**: ${trend}
- **RSI(14)**: ${rsi.toFixed(1)} (${rsi > 70 ? '超买区间' : rsi < 30 ? '超卖区间' : '中性区间'})
- **MACD**: ${macdLine > 0 ? '多头' : '空头'} (${macdLine.toFixed(2)})
- **布林带**: 上轨$${bollUpper.toFixed(2)} / 中轨$${sma20.toFixed(2)} / 下轨$${bollLower.toFixed(2)}
- **ATR(14)**: $${atr.toFixed(2)} (波动率${(atr / currentPrice * 100).toFixed(2)}%)

### 成交量
- 最新成交量: ${latestVolume.toFixed(0)}
- 平均成交量: ${avgVolume.toFixed(0)}
- 量比: ${volumeRatio.toFixed(2)}x (${volumeRatio > 1.5 ? '放量' : volumeRatio < 0.5 ? '缩量' : '正常'})

### 最近信号
${signals.length > 0 ? signals.slice(0, 3).map(s => `- ${s.action} @ $${s.price.toFixed(2)} (${s.reason})`).join('\n') : '- 暂无信号'}
    `.trim();
  }, [marketData, currentSymbol, currentPrice, signals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const content = input.trim();
    setInput('');
    
    // 本地AI处理
    await handleAIProcess(content);
  };

  // 快捷工具执行
  const executeQuickTool = async (toolId: string, params: Record<string, any> = {}) => {
    setIsTyping(true);
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: `[执行工具: ${toolId}]`,
      timestamp: Date.now()
    };
    setLocalMessages(prev => [...prev, userMessage]);

    try {
      const result = await aiAgent.executeTool(toolId, params);
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: result.message,
        timestamp: Date.now()
      };
      setLocalMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `执行失败：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now()
      };
      setLocalMessages(prev => [...prev, errorMessage]);
    }
    
    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    setIsTyping(false);
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // 快捷操作分组
  const quickTools = [
    { 
      category: '系统',
      icon: Cpu,
      tools: [
        { id: 'get_system_status', label: '系统状态', icon: Activity },
        { id: 'toggle_trading', label: tradeConfig?.enable_trading ? '停止交易' : '开启交易', icon: Zap, params: { enabled: !tradeConfig?.enable_trading } },
      ]
    },
    {
      category: '分析',
      icon: BarChart2,
      tools: [
        { id: 'analyze_market', label: '市场分析', icon: TrendingUp },
        { id: 'generate_signal', label: '生成信号', icon: Target },
        { id: 'get_signals', label: '查看信号', icon: TrendingDown },
      ]
    },
    {
      category: '策略',
      icon: Layers,
      tools: [
        { id: 'suggest_strategy', label: '策略建议', icon: Layers },
        { id: 'list_tools', label: '工具列表', icon: Terminal },
      ]
    }
  ];

  // 状态指示器
  const StatusIndicator = () => (
    <div className="flex items-center gap-2 text-xs">
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
        systemStatus?.ai?.is_running 
          ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
          : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
      }`}>
        <div className={`w-1.5 h-1.5 rounded-full ${systemStatus?.ai?.is_running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        {systemStatus?.ai?.is_running ? '在线' : '离线'}
      </div>
      {/* AI提供商指示 */}
      {aiProvider !== 'local' ? (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          <Cloud className="w-3 h-3" />
          {aiProvider.toUpperCase()}
        </div>
      ) : (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
          <CloudOff className="w-3 h-3" />
          本地
        </div>
      )}
      {systemStatus?.ai?.tool_count && (
        <span className="text-gray-400 dark:text-slate-500">
          {systemStatus.ai.tool_count} 工具
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700/50 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
              aiEnabled ? 'bg-green-500' : 'bg-gray-400'
            }`} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1">
              XTMC AI智能体
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
            </h3>
            <StatusIndicator />
          </div>
        </div>
        <button
          onClick={() => setShowTools(!showTools)}
          className={`p-2 rounded-lg transition-all ${
            showTools 
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
              : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* 快捷工具面板 */}
      {showTools && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50 space-y-3">
          {quickTools.map((group) => (
            <div key={group.category}>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 mb-2">
                <group.icon className="w-3.5 h-3.5" />
                {group.category}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.tools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => executeQuickTool(tool.id, tool.params)}
                    disabled={isTyping}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-gray-700 dark:text-slate-300 transition-all disabled:opacity-50"
                  >
                    <tool.icon className="w-3.5 h-3.5" />
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 消息列表 */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {allMessages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <h4 className="text-gray-900 dark:text-white font-semibold mb-2">XTMC AI智能体</h4>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-4">
              我具备完整的系统控制能力，可以帮你：
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto text-xs">
              <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-slate-700/50 rounded-lg text-gray-600 dark:text-slate-300">
                <BarChart2 className="w-4 h-4 text-blue-500" />
                分析市场行情
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-slate-700/50 rounded-lg text-gray-600 dark:text-slate-300">
                <Target className="w-4 h-4 text-green-500" />
                生成交易信号
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-slate-700/50 rounded-lg text-gray-600 dark:text-slate-300">
                <Settings className="w-4 h-4 text-purple-500" />
                控制系统配置
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-slate-700/50 rounded-lg text-gray-600 dark:text-slate-300">
                <Layers className="w-4 h-4 text-orange-500" />
                推荐交易策略
              </div>
            </div>
          </div>
        )}

        {allMessages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' 
                ? 'bg-blue-600' 
                : 'bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500'
            }`}>
              {msg.role === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block px-4 py-2.5 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 rounded-bl-md'
              }`}>
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              </div>
              <div className="text-xs text-gray-400 dark:text-slate-500 mt-1 flex items-center gap-2">
                {formatTime(msg.timestamp)}
                {msg.metadata?.processed && (
                  <span className="flex items-center gap-0.5 text-purple-500">
                    <Zap className="w-3 h-3" />
                    {msg.metadata.provider === 'local' ? '本地' : msg.metadata.provider?.toUpperCase()}
                  </span>
                )}
                {msg.metadata?.fallback && (
                  <span className="text-yellow-500 text-[10px]">(回退)</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-100 dark:bg-slate-700 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-purple-500 animate-spin" />
              <span className="text-sm text-gray-600 dark:text-slate-300">
                AI已思考 {thinkingTime} 秒...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 快捷指令 */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-slate-700/50">
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: '分析行情', cmd: '分析一下当前行情' },
            { label: '生成信号', cmd: '帮我生成一个交易信号' },
            { label: '策略建议', cmd: '推荐一个交易策略' },
            { label: '系统状态', cmd: '查看系统状态' },
          ].map((item, index) => (
            <button
              key={index}
              onClick={() => handleAIProcess(item.cmd)}
              disabled={isTyping}
              className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-slate-700/50 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full transition-colors disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/30">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={aiEnabled ? '输入指令或问题...' : 'AI已暂停'}
              disabled={!aiEnabled || isTyping}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 pr-10"
            />
            <Terminal className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || !aiEnabled || isTyping}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 dark:disabled:from-slate-600 dark:disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md hover:shadow-lg disabled:shadow-none"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
          <Zap className="w-3 h-3" />
          支持自然语言指令，如："切换到ETH"、"开启交易"、"添加MACD指标"
        </div>
      </form>
    </div>
  );
}
