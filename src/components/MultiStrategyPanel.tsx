/**
 * 多策略组合管理面板
 * 支持同时运行多个策略、资金分配、绩效对比
 */

import { useState } from 'react';
import { 
  Layers,
  Play,
  Pause,
  Plus,
  Trash2,
  PieChart,
  BarChart3,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  type: 'ema_cross' | 'rsi' | 'macd' | 'grid' | 'dca' | 'bollinger';
  allocation: number;
  enabled: boolean;
  pnl: number;
  pnlPercent: number;
  trades: number;
  winRate: number;
  status: 'running' | 'paused' | 'stopped';
}

interface PortfolioStats {
  totalAllocation: number;
  totalPnl: number;
  totalPnlPercent: number;
  totalTrades: number;
  activeStrategies: number;
}

const STRATEGY_TYPES = [
  { value: 'ema_cross', label: 'EMA交叉', desc: 'EMA12/26金叉死叉', color: 'blue' },
  { value: 'rsi', label: 'RSI策略', desc: 'RSI超买超卖信号', color: 'purple' },
  { value: 'macd', label: 'MACD策略', desc: 'MACD金叉死叉', color: 'green' },
  { value: 'grid', label: '网格交易', desc: '区间震荡套利', color: 'amber' },
  { value: 'dca', label: 'DCA定投', desc: '定时定额买入', color: 'cyan' },
  { value: 'bollinger', label: '布林带', desc: '突破/反弹策略', color: 'pink' },
];

export default function MultiStrategyPanel() {
  const [strategies, setStrategies] = useState<Strategy[]>([
    {
      id: 'strat-1',
      name: 'EMA趋势跟踪',
      type: 'ema_cross',
      allocation: 30,
      enabled: true,
      pnl: 156.32,
      pnlPercent: 5.21,
      trades: 12,
      winRate: 66.7,
      status: 'running',
    },
    {
      id: 'strat-2',
      name: 'RSI反转',
      type: 'rsi',
      allocation: 20,
      enabled: true,
      pnl: -42.18,
      pnlPercent: -2.11,
      trades: 8,
      winRate: 37.5,
      status: 'running',
    },
    {
      id: 'strat-3',
      name: '网格套利',
      type: 'grid',
      allocation: 50,
      enabled: false,
      pnl: 89.45,
      pnlPercent: 1.79,
      trades: 24,
      winRate: 58.3,
      status: 'paused',
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    type: 'ema_cross' as Strategy['type'],
    allocation: 10,
  });

  // 计算组合统计
  const portfolioStats: PortfolioStats = {
    totalAllocation: strategies.reduce((sum, s) => sum + (s.enabled ? s.allocation : 0), 0),
    totalPnl: strategies.reduce((sum, s) => sum + s.pnl, 0),
    totalPnlPercent: strategies.length > 0 
      ? strategies.reduce((sum, s) => sum + s.pnlPercent * s.allocation, 0) / 
        strategies.reduce((sum, s) => sum + s.allocation, 0)
      : 0,
    totalTrades: strategies.reduce((sum, s) => sum + s.trades, 0),
    activeStrategies: strategies.filter(s => s.status === 'running').length,
  };

  // 添加策略
  const addStrategy = () => {
    if (!newStrategy.name.trim()) return;
    
    const strategy: Strategy = {
      id: `strat-${Date.now()}`,
      name: newStrategy.name,
      type: newStrategy.type,
      allocation: newStrategy.allocation,
      enabled: false,
      pnl: 0,
      pnlPercent: 0,
      trades: 0,
      winRate: 0,
      status: 'stopped',
    };
    
    setStrategies(prev => [...prev, strategy]);
    setShowAddModal(false);
    setNewStrategy({ name: '', type: 'ema_cross', allocation: 10 });
  };

  // 删除策略
  const removeStrategy = (id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id));
  };

  // 切换策略状态
  const toggleStrategy = (id: string) => {
    setStrategies(prev => prev.map(s => {
      if (s.id !== id) return s;
      const newStatus = s.status === 'running' ? 'paused' : 'running';
      return { ...s, status: newStatus, enabled: newStatus === 'running' };
    }));
  };

  // 更新分配
  const updateAllocation = (id: string, allocation: number) => {
    setStrategies(prev => prev.map(s => 
      s.id === id ? { ...s, allocation: Math.max(0, Math.min(100, allocation)) } : s
    ));
  };

  const getStrategyColor = (type: Strategy['type']): string => {
    return STRATEGY_TYPES.find(t => t.value === type)?.color || 'slate';
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900/50">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          <span className="font-medium text-gray-900 dark:text-white">策略组合</span>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {portfolioStats.activeStrategies}/{strategies.length} 运行中
          </span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          添加策略
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 组合概览 */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-xl ${portfolioStats.totalPnl >= 0 ? 'bg-green-900/20 border border-green-600/30' : 'bg-red-900/20 border border-red-600/30'}`}>
            <div className="text-xs text-slate-400 mb-1">组合收益</div>
            <div className={`text-xl font-bold ${portfolioStats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {portfolioStats.totalPnl >= 0 ? '+' : ''}{portfolioStats.totalPnl.toFixed(2)}
            </div>
            <div className={`text-xs ${portfolioStats.totalPnl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
              {portfolioStats.totalPnlPercent >= 0 ? '+' : ''}{portfolioStats.totalPnlPercent.toFixed(2)}%
            </div>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-xl">
            <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">资金分配</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{portfolioStats.totalAllocation}%</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">{portfolioStats.totalTrades} 笔交易</div>
          </div>
        </div>

        {/* 分配可视化 */}
        <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-slate-400">资金分配比例</span>
            <PieChart className="w-4 h-4 text-gray-400 dark:text-slate-500" />
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-300 dark:bg-slate-700">
            {strategies.filter(s => s.enabled).map((strategy) => (
              <div
                key={strategy.id}
                className={`bg-${getStrategyColor(strategy.type)}-500 transition-all`}
                style={{ width: `${strategy.allocation}%` }}
                title={`${strategy.name}: ${strategy.allocation}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {strategies.filter(s => s.enabled).map((strategy) => (
              <span key={strategy.id} className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full bg-${getStrategyColor(strategy.type)}-500`} />
                {strategy.name} ({strategy.allocation}%)
              </span>
            ))}
          </div>
        </div>

        {/* 策略列表 */}
        <div className="space-y-2">
          <div className="text-sm text-gray-700 dark:text-slate-300 font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            策略列表
          </div>
          
          {strategies.length === 0 ? (
            <div className="py-8 text-center text-gray-400 dark:text-slate-500">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <div>暂无策略</div>
              <div className="text-xs mt-1">点击"添加策略"创建新策略</div>
            </div>
          ) : (
            strategies.map((strategy) => (
              <div
                key={strategy.id}
                className={`p-3 rounded-lg border transition-all ${
                  strategy.status === 'running'
                    ? 'bg-gray-100 dark:bg-slate-800/70 border-gray-300 dark:border-slate-600/50'
                    : 'bg-gray-50 dark:bg-slate-800/30 border-gray-200 dark:border-slate-700/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      strategy.status === 'running' ? 'bg-green-400 animate-pulse' :
                      strategy.status === 'paused' ? 'bg-yellow-400' : 'bg-gray-400 dark:bg-slate-500'
                    }`} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{strategy.name}</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded bg-${getStrategyColor(strategy.type)}-600/20 text-${getStrategyColor(strategy.type)}-400`}>
                      {STRATEGY_TYPES.find(t => t.value === strategy.type)?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleStrategy(strategy.id)}
                      className={`p-1.5 rounded transition-all ${
                        strategy.status === 'running'
                          ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
                          : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                      }`}
                    >
                      {strategy.status === 'running' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => removeStrategy(strategy.id)}
                      className="p-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-slate-500">分配</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="number"
                        value={strategy.allocation}
                        onChange={(e) => updateAllocation(strategy.id, Number(e.target.value))}
                        className="w-12 bg-gray-200 dark:bg-slate-700 border-none rounded px-1 py-0.5 text-gray-900 dark:text-white text-center"
                        min={0}
                        max={100}
                      />
                      <span className="text-gray-500 dark:text-slate-400">%</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-slate-500">收益</span>
                    <div className={`mt-0.5 font-medium ${strategy.pnl >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {strategy.pnl >= 0 ? '+' : ''}{strategy.pnl.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-slate-500">胜率</span>
                    <div className="mt-0.5 text-gray-900 dark:text-white">{strategy.winRate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-slate-500">交易</span>
                    <div className="mt-0.5 text-gray-900 dark:text-white">{strategy.trades}笔</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 分配警告 */}
        {portfolioStats.totalAllocation > 100 && (
          <div className="p-3 bg-red-900/20 rounded-lg border border-red-600/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
            <div className="text-xs text-red-400">
              总分配比例超过100%（当前{portfolioStats.totalAllocation}%），请调整各策略的资金分配。
            </div>
          </div>
        )}

        {portfolioStats.totalAllocation < 100 && portfolioStats.totalAllocation > 0 && (
          <div className="p-3 bg-amber-900/20 rounded-lg border border-amber-600/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
            <div className="text-xs text-amber-400">
              当前总分配{portfolioStats.totalAllocation}%，剩余{100 - portfolioStats.totalAllocation}%资金未分配。
            </div>
          </div>
        )}

        {portfolioStats.totalAllocation === 100 && (
          <div className="p-3 bg-green-900/20 rounded-lg border border-green-600/30 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
            <div className="text-xs text-green-400">
              资金分配完成，100%资金已分配到各策略。
            </div>
          </div>
        )}
      </div>

      {/* 添加策略模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 w-80 max-w-[90%]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">添加策略</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">策略名称</label>
                <input
                  type="text"
                  value={newStrategy.name}
                  onChange={(e) => setNewStrategy({ ...newStrategy, name: e.target.value })}
                  placeholder="输入策略名称"
                  className="w-full bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">策略类型</label>
                <select
                  value={newStrategy.type}
                  onChange={(e) => setNewStrategy({ ...newStrategy, type: e.target.value as Strategy['type'] })}
                  className="w-full bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  {STRATEGY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label} - {type.desc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">资金分配 (%)</label>
                <input
                  type="number"
                  value={newStrategy.allocation}
                  onChange={(e) => setNewStrategy({ ...newStrategy, allocation: Number(e.target.value) })}
                  min={1}
                  max={100}
                  className="w-full bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-white text-sm rounded-lg transition-all"
                >
                  取消
                </button>
                <button
                  onClick={addStrategy}
                  disabled={!newStrategy.name.trim()}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-all disabled:opacity-50"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
