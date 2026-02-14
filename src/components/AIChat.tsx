/**
 * XTMC AI智能体交互界面
 * 具备完整的系统控制、数据分析、策略执行能力
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
  RefreshCw
} from 'lucide-react';
import type { ChatMessage, SystemStatus, TradeConfig, MarketData, TradeSignal } from '../types';
import { aiAgent, type AIContext } from '../lib/aiAgent';

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
  onAddIndicator
}: AIChatProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [showTools, setShowTools] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);

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
    
    try {
      // 使用AI智能体处理
      const response = await aiAgent.processInput(userInput);
      
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        metadata: { processed: true }
      };
      setLocalMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `处理失败：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now()
      };
      setLocalMessages(prev => [...prev, errorMessage]);
    }
    
    setIsTyping(false);
  };

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
      {systemStatus?.ai?.tool_count && (
        <span className="text-gray-400 dark:text-slate-500">
          {systemStatus.ai.tool_count} 工具
        </span>
      )}
      {systemStatus?.ai?.win_rate !== undefined && systemStatus.ai.win_rate > 0 && (
        <span className={`${systemStatus.ai.win_rate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
          {systemStatus.ai.win_rate.toFixed(1)}% 胜率
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
                    智能体
                  </span>
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
              <span className="text-sm text-gray-600 dark:text-slate-300">AI正在处理...</span>
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
