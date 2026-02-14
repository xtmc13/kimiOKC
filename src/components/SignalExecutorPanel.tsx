/**
 * 信号自动执行面板
 * 支持自动根据AI信号执行交易、风控设置、执行日志
 */

import { useState, useEffect } from 'react';
import { 
  Zap,
  Play,
  Pause,
  Settings,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Target,
  Activity
} from 'lucide-react';

interface SignalConfig {
  enabled: boolean;
  minConfidence: number;
  maxPositionSize: number;
  stopLoss: number;
  takeProfit: number;
  maxDailyTrades: number;
  cooldownMinutes: number;
  allowedSignals: ('BUY' | 'SELL')[];
  requireConfirmation: boolean;
}

interface ExecutedSignal {
  id: string;
  timestamp: number;
  action: 'BUY' | 'SELL';
  symbol: string;
  price: number;
  quantity: number;
  confidence: number;
  reason: string;
  status: 'executed' | 'skipped' | 'failed';
  pnl?: number;
}

interface AutoTradeStats {
  totalSignals: number;
  executedSignals: number;
  skippedSignals: number;
  totalPnl: number;
  winRate: number;
  todayTrades: number;
}

interface SignalExecutorPanelProps {
  signals: Array<{
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    price: number;
    confidence: number;
    reason: string;
    timestamp: number;
  }>;
  onExecuteSignal?: (signal: ExecutedSignal) => void;
}

export default function SignalExecutorPanel({ signals, onExecuteSignal }: SignalExecutorPanelProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'log' | 'stats'>('config');
  const [config, setConfig] = useState<SignalConfig>(() => {
    try {
      const saved = localStorage.getItem('signal_executor_config');
      return saved ? JSON.parse(saved) : {
        enabled: false,
        minConfidence: 70,
        maxPositionSize: 10,
        stopLoss: 2,
        takeProfit: 4,
        maxDailyTrades: 10,
        cooldownMinutes: 5,
        allowedSignals: ['BUY', 'SELL'],
        requireConfirmation: true,
      };
    } catch {
      return {
        enabled: false,
        minConfidence: 70,
        maxPositionSize: 10,
        stopLoss: 2,
        takeProfit: 4,
        maxDailyTrades: 10,
        cooldownMinutes: 5,
        allowedSignals: ['BUY', 'SELL'],
        requireConfirmation: true,
      };
    }
  });

  const [executedSignals, setExecutedSignals] = useState<ExecutedSignal[]>([]);
  const [lastExecutionTime, setLastExecutionTime] = useState<number>(0);
  const [pendingSignal, setPendingSignal] = useState<ExecutedSignal | null>(null);

  // 保存配置
  useEffect(() => {
    localStorage.setItem('signal_executor_config', JSON.stringify(config));
  }, [config]);

  // 计算统计
  const stats: AutoTradeStats = {
    totalSignals: executedSignals.length,
    executedSignals: executedSignals.filter(s => s.status === 'executed').length,
    skippedSignals: executedSignals.filter(s => s.status === 'skipped').length,
    totalPnl: executedSignals.reduce((sum, s) => sum + (s.pnl || 0), 0),
    winRate: executedSignals.filter(s => s.status === 'executed').length > 0
      ? (executedSignals.filter(s => s.status === 'executed' && (s.pnl || 0) > 0).length / 
         executedSignals.filter(s => s.status === 'executed').length) * 100
      : 0,
    todayTrades: executedSignals.filter(s => {
      const today = new Date();
      const signalDate = new Date(s.timestamp);
      return signalDate.toDateString() === today.toDateString() && s.status === 'executed';
    }).length,
  };

  // 监听新信号
  useEffect(() => {
    if (!config.enabled || signals.length === 0) return;

    const latestSignal = signals[0];
    if (!latestSignal || latestSignal.action === 'HOLD') return;

    // 检查是否满足执行条件
    const canExecute = checkExecutionConditions(latestSignal);
    
    if (canExecute) {
      const newSignal: ExecutedSignal = {
        id: `exec-${Date.now()}`,
        timestamp: latestSignal.timestamp || Date.now(),
        action: latestSignal.action as 'BUY' | 'SELL',
        symbol: latestSignal.symbol,
        price: latestSignal.price,
        quantity: (config.maxPositionSize / 100) * 1000 / latestSignal.price,
        confidence: latestSignal.confidence,
        reason: latestSignal.reason,
        status: 'executed',
        pnl: 0,
      };

      if (config.requireConfirmation) {
        setPendingSignal(newSignal);
      } else {
        executeSignal(newSignal);
      }
    }
  }, [signals, config.enabled]);

  const checkExecutionConditions = (signal: typeof signals[0]): boolean => {
    // 检查信号类型是否允许
    if (!config.allowedSignals.includes(signal.action as 'BUY' | 'SELL')) {
      return false;
    }

    // 检查置信度
    if (signal.confidence < config.minConfidence) {
      return false;
    }

    // 检查冷却时间
    const timeSinceLastExec = (Date.now() - lastExecutionTime) / 1000 / 60;
    if (timeSinceLastExec < config.cooldownMinutes) {
      return false;
    }

    // 检查每日交易限制
    if (stats.todayTrades >= config.maxDailyTrades) {
      return false;
    }

    return true;
  };

  const executeSignal = (signal: ExecutedSignal) => {
    // 模拟执行收益
    signal.pnl = (Math.random() - 0.4) * 100;
    
    setExecutedSignals(prev => [signal, ...prev]);
    setLastExecutionTime(Date.now());
    setPendingSignal(null);
    
    if (onExecuteSignal) {
      onExecuteSignal(signal);
    }
  };

  const skipSignal = (signal: ExecutedSignal) => {
    signal.status = 'skipped';
    setExecutedSignals(prev => [signal, ...prev]);
    setPendingSignal(null);
  };

  const toggleSignalType = (type: 'BUY' | 'SELL') => {
    setConfig(prev => ({
      ...prev,
      allowedSignals: prev.allowedSignals.includes(type)
        ? prev.allowedSignals.filter(t => t !== type)
        : [...prev.allowedSignals, type],
    }));
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900/50">
      {/* 头部状态 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <Zap className={`w-5 h-5 ${config.enabled ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-400 dark:text-slate-400'}`} />
          <span className="font-medium text-gray-900 dark:text-white">信号执行</span>
          {config.enabled && (
            <span className="px-2 py-0.5 text-xs bg-yellow-600/20 text-yellow-400 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
              监听中
            </span>
          )}
        </div>
        <button
          onClick={() => setConfig({ ...config, enabled: !config.enabled })}
          className={`flex items-center gap-1 px-3 py-1.5 text-white text-xs rounded-lg transition-all ${
            config.enabled
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {config.enabled ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              停止
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              启动
            </>
          )}
        </button>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-gray-200 dark:border-slate-700/50">
        {[
          { key: 'config', label: '配置', icon: Settings },
          { key: 'log', label: '日志', icon: Clock },
          { key: 'stats', label: '统计', icon: Activity },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${
              activeTab === key
                ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-600/10 border-b-2 border-yellow-500 dark:border-yellow-400'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* 待确认信号 */}
      {pendingSignal && (
        <div className="p-3 bg-yellow-900/30 border-b border-yellow-600/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-400 font-medium">待确认信号</span>
            </div>
            <span className="text-xs text-yellow-400/70">
              置信度: {pendingSignal.confidence}%
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 text-xs rounded ${
              pendingSignal.action === 'BUY' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
            }`}>
              {pendingSignal.action === 'BUY' ? '买入' : '卖出'}
            </span>
            <span className="text-sm text-white">{pendingSignal.symbol}</span>
            <span className="text-sm text-slate-400">@ ${pendingSignal.price.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => executeSignal(pendingSignal)}
              className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-all"
            >
              确认执行
            </button>
            <button
              onClick={() => skipSignal(pendingSignal)}
              className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
            >
              跳过
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {/* 配置面板 */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            {/* 信号类型 */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">允许的信号类型</label>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleSignalType('BUY')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    config.allowedSignals.includes('BUY')
                      ? 'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400 border border-green-300 dark:border-green-600/50'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-transparent'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 inline mr-1" />
                  买入信号
                </button>
                <button
                  onClick={() => toggleSignalType('SELL')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    config.allowedSignals.includes('SELL')
                      ? 'bg-red-100 dark:bg-red-600/20 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600/50'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-transparent'
                  }`}
                >
                  <TrendingDown className="w-4 h-4 inline mr-1" />
                  卖出信号
                </button>
              </div>
            </div>

            {/* 置信度阈值 */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs text-gray-500 dark:text-slate-400">最低置信度</label>
                <span className="text-xs text-gray-900 dark:text-white">{config.minConfidence}%</span>
              </div>
              <input
                type="range"
                value={config.minConfidence}
                onChange={(e) => setConfig({ ...config, minConfidence: Number(e.target.value) })}
                min={50}
                max={95}
                className="w-full accent-yellow-500"
              />
            </div>

            {/* 仓位大小 */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                <Target className="w-3 h-3 inline mr-1" />最大仓位 (%)
              </label>
              <input
                type="number"
                value={config.maxPositionSize}
                onChange={(e) => setConfig({ ...config, maxPositionSize: Number(e.target.value) })}
                min={1}
                max={100}
                className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500"
              />
            </div>

            {/* 止盈止损 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                  <AlertTriangle className="w-3 h-3 inline mr-1 text-red-500 dark:text-red-400" />止损 (%)
                </label>
                <input
                  type="number"
                  value={config.stopLoss}
                  onChange={(e) => setConfig({ ...config, stopLoss: Number(e.target.value) })}
                  step={0.5}
                  min={0.5}
                  max={20}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                  <CheckCircle className="w-3 h-3 inline mr-1 text-green-500 dark:text-green-400" />止盈 (%)
                </label>
                <input
                  type="number"
                  value={config.takeProfit}
                  onChange={(e) => setConfig({ ...config, takeProfit: Number(e.target.value) })}
                  step={0.5}
                  min={1}
                  max={50}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            {/* 交易限制 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">每日最大交易</label>
                <input
                  type="number"
                  value={config.maxDailyTrades}
                  onChange={(e) => setConfig({ ...config, maxDailyTrades: Number(e.target.value) })}
                  min={1}
                  max={100}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">冷却时间 (分钟)</label>
                <input
                  type="number"
                  value={config.cooldownMinutes}
                  onChange={(e) => setConfig({ ...config, cooldownMinutes: Number(e.target.value) })}
                  min={0}
                  max={60}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            {/* 确认模式 */}
            <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
              <div>
                <div className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                  <Shield className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  手动确认
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400">执行前需要手动确认</div>
              </div>
              <button
                onClick={() => setConfig({ ...config, requireConfirmation: !config.requireConfirmation })}
                className={`w-12 h-6 rounded-full transition-all ${
                  config.requireConfirmation ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-700'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  config.requireConfirmation ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        )}

        {/* 执行日志 */}
        {activeTab === 'log' && (
          <div className="space-y-2">
            {executedSignals.length === 0 ? (
              <div className="py-12 text-center text-gray-400 dark:text-slate-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <div>暂无执行记录</div>
                <div className="text-xs mt-1">启用自动执行后显示</div>
              </div>
            ) : (
              executedSignals.map((signal) => (
                <div key={signal.id} className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        signal.action === 'BUY' ? 'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-600/20 text-red-600 dark:text-red-400'
                      }`}>
                        {signal.action === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white font-medium">
                          {signal.action === 'BUY' ? '买入' : '卖出'} {signal.symbol}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {new Date(signal.timestamp).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        signal.status === 'executed' 
                          ? 'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400'
                          : signal.status === 'skipped'
                            ? 'bg-yellow-100 dark:bg-yellow-600/20 text-yellow-600 dark:text-yellow-400'
                            : 'bg-red-100 dark:bg-red-600/20 text-red-600 dark:text-red-400'
                      }`}>
                        {signal.status === 'executed' ? '已执行' : signal.status === 'skipped' ? '已跳过' : '失败'}
                      </span>
                      {signal.pnl !== undefined && signal.status === 'executed' && (
                        <div className={`text-xs mt-1 ${signal.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {signal.pnl >= 0 ? '+' : ''}{signal.pnl.toFixed(2)} USDT
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-500 flex justify-between">
                    <span>价格: ${signal.price.toFixed(2)}</span>
                    <span>置信度: {signal.confidence}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 统计面板 */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {/* 总收益 */}
            <div className={`p-4 rounded-xl ${stats.totalPnl >= 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-600/30' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600/30'}`}>
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">自动交易收益</div>
              <div className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)} USDT
              </div>
            </div>

            {/* 统计数据 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">总信号数</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.totalSignals}</div>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">已执行</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.executedSignals}</div>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">胜率</div>
                <div className={`text-lg font-bold ${stats.winRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {stats.winRate.toFixed(1)}%
                </div>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">今日交易</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {stats.todayTrades}/{config.maxDailyTrades}
                </div>
              </div>
            </div>

            {/* 执行状态 */}
            <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
              <div className="text-sm text-gray-700 dark:text-slate-300 font-medium mb-2">执行状态</div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-slate-400">自动执行</span>
                  <span className={config.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-slate-500'}>
                    {config.enabled ? '已启用' : '已停用'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-slate-400">手动确认</span>
                  <span className={config.requireConfirmation ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}>
                    {config.requireConfirmation ? '需要确认' : '自动执行'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-slate-400">冷却状态</span>
                  <span className="text-gray-900 dark:text-white">
                    {Date.now() - lastExecutionTime < config.cooldownMinutes * 60 * 1000
                      ? `冷却中 (${Math.ceil((config.cooldownMinutes * 60 * 1000 - (Date.now() - lastExecutionTime)) / 1000)}秒)`
                      : '就绪'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
