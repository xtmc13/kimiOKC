/**
 * XTMC AI聊天组件 v2.0
 * 真正的AI智能体界面
 * - 支持LLM对话（配置API后）
 * - 本地工具执行
 * - 智能体状态显示
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Sparkles, Brain, Zap, Settings, TrendingUp, Wrench, Key } from 'lucide-react';
import type { ChatMessage, SystemStatus, TradeConfig, MarketData, TradeSignal } from '../types';
import { aiAgent, type AIContext } from '../lib/aiAgent';
import type { LLMConfig } from '../lib/llmClient';

interface AIChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  aiEnabled: boolean;
  systemStatus?: SystemStatus;
  tradeConfig?: TradeConfig;
  marketData?: MarketData[];
  signals?: TradeSignal[];
  currentSymbol?: string;
  currentPrice?: number;
  onUpdateConfig?: (config: Partial<TradeConfig>) => void;
  onSwitchSymbol?: (symbol: string) => void;
  onChangeTimeframe?: (tf: string) => void;
  onToggleTrading?: (enabled: boolean) => void;
  onAddIndicator?: (indicatorId: string) => void;
  llmConfig?: LLMConfig;
  onOpenSettings?: () => void;
}

interface LocalMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isLocal?: boolean;
  provider?: string;
}

const QUICK_TOOLS = [
  { category: '系统', icon: Settings, items: [
    { label: '系统状态', action: '查看系统状态' },
    { label: '开始交易', action: '开启自动交易' },
    { label: '停止交易', action: '关闭自动交易' },
  ]},
  { category: '分析', icon: TrendingUp, items: [
    { label: '行情分析', action: '分析当前行情' },
    { label: '交易信号', action: '查看交易信号' },
    { label: '生成信号', action: '生成交易信号' },
  ]},
  { category: '策略', icon: Wrench, items: [
    { label: '策略建议', action: '推荐交易策略' },
    { label: '回测策略', action: '回测EMA交叉策略' },
    { label: '全部功能', action: '你能做什么' },
  ]},
];

export default function AIChat({
  messages,
  onSendMessage,
  aiEnabled,
  systemStatus,
  tradeConfig,
  marketData,
  signals,
  currentSymbol,
  currentPrice,
  onUpdateConfig,
  onSwitchSymbol,
  onChangeTimeframe,
  onToggleTrading,
  onAddIndicator,
  llmConfig,
  onOpenSettings,
}: AIChatProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [showQuickTools, setShowQuickTools] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 设置AI代理上下文和LLM配置
  useEffect(() => {
    if (systemStatus && tradeConfig) {
      const context: AIContext = {
        systemStatus,
        tradeConfig,
        marketData: marketData || [],
        signals: signals || [],
        currentSymbol: currentSymbol || 'BTCUSDT',
        currentPrice: currentPrice || 0,
        onUpdateConfig: onUpdateConfig || (() => {}),
        onSwitchSymbol: onSwitchSymbol || (() => {}),
        onExecuteSignal: () => {},
        onAddIndicator: onAddIndicator || (() => {}),
        onChangeTimeframe: onChangeTimeframe || (() => {}),
        onToggleTrading: onToggleTrading || (() => {}),
      };
      aiAgent.setContext(context);
    }
  }, [systemStatus, tradeConfig, marketData, signals, currentSymbol, currentPrice, onUpdateConfig, onSwitchSymbol, onChangeTimeframe, onToggleTrading, onAddIndicator]);

  // 配置LLM
  useEffect(() => {
    if (llmConfig) {
      aiAgent.setLLMConfig(llmConfig);
    }
  }, [llmConfig]);

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, localMessages, scrollToBottom]);

  const handleLocalProcess = async (content: string) => {
    const userMsg: LocalMessage = { role: 'user', content, timestamp: Date.now(), isLocal: true };
    setLocalMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const response = await aiAgent.processInput(content);
      const provider = aiAgent.isLLMConfigured() ? 'LLM' : '本地';
      const aiMsg: LocalMessage = { role: 'assistant', content: response, timestamp: Date.now(), isLocal: true, provider };
      setLocalMessages(prev => [...prev, aiMsg]);
    } catch {
      onSendMessage(content);
    }
    
    setIsTyping(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    const content = input.trim();
    setInput('');
    await handleLocalProcess(content);
  };

  const handleQuickAction = async (action: string) => {
    setShowQuickTools(false);
    await handleLocalProcess(action);
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const allMessages = [...messages.map(m => ({ ...m, isLocal: false })), ...localMessages];
  const toolCount = aiAgent.getToolList().length;
  const hasLLM = aiAgent.isLLMConfigured();

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">XTMC AI智能体</h3>
            <div className="flex items-center gap-2 text-xs">
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${
                hasLLM
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${hasLLM ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                {hasLLM ? 'LLM' : '本地'}
              </div>
              <span className="text-gray-400 dark:text-slate-500">{toolCount}个工具</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowQuickTools(!showQuickTools)}
          className={`p-1.5 rounded-lg transition-colors ${
            showQuickTools
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700/50'
          }`}
        >
          <Zap className="w-4 h-4" />
        </button>
      </div>

      {/* LLM未配置提示 */}
      {!hasLLM && localMessages.length === 0 && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/10 border-b border-yellow-200 dark:border-yellow-800/30">
          <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
            <Key className="w-3.5 h-3.5" />
            <span>配置AI模型后可使用完整对话能力</span>
            {onOpenSettings && (
              <button onClick={onOpenSettings} className="underline hover:no-underline ml-1">
                前往设置
              </button>
            )}
          </div>
        </div>
      )}

      {/* 快捷工具面板 */}
      {showQuickTools && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-900/30">
          {QUICK_TOOLS.map(({ category, icon: Icon, items }) => (
            <div key={category} className="mb-2 last:mb-0">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">
                <Icon className="w-3 h-3" />
                {category}
              </div>
              <div className="flex flex-wrap gap-1">
                {items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleQuickAction(item.action)}
                    className="px-2 py-1 text-[11px] bg-white dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-md text-gray-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {item.label}
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
            <Sparkles className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">XTMC AI智能体</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">
              {hasLLM ? '已接入大模型，支持自然语言对话' : `${toolCount}个工具，可控制整个交易系统`}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {['分析行情', '交易信号', '推荐策略', '你能做什么'].map(action => (
                <button
                  key={action}
                  onClick={() => handleQuickAction(action)}
                  className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-full transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {allMessages.map((msg, index) => (
          <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' ? 'bg-blue-600' : 'bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500'
            }`}>
              {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-white" />}
            </div>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 rounded-bl-md'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                <span>{formatTime(msg.timestamp)}</span>
                {'provider' in msg && msg.provider && (
                  <span className={`px-1 py-0.5 rounded ${
                    msg.provider === 'LLM' ? 'bg-green-100 dark:bg-green-900/20 text-green-500' : 'bg-gray-100 dark:bg-slate-700/30 text-gray-400 dark:text-slate-500'
                  }`}>
                    {msg.provider}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-gray-100 dark:bg-slate-700 px-3 py-2 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-slate-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasLLM ? '自然语言对话...' : '输入指令（配置AI模型后支持对话）'}
            disabled={!aiEnabled || isTyping}
            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || !aiEnabled || isTyping}
            className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 dark:disabled:from-slate-600 dark:disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
