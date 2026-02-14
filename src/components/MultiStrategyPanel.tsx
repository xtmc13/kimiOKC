/**
 * XTMC 多策略组合面板
 * 支持同时运行多个策略并管理
 */

import { useState } from 'react';
import { Plus, Play, Pause, Trash2, BarChart3, X, Check } from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  type: string;
  symbol: string;
  status: 'running' | 'paused' | 'stopped';
  pnl: number;
  trades: number;
  winRate: number;
  allocation: number;
}

const STRATEGY_TEMPLATES = [
  { type: 'ema_cross', name: 'EMA交叉', description: '基于EMA12/26交叉信号' },
  { type: 'rsi_reversal', name: 'RSI反转', description: '超买超卖区间反转交易' },
  { type: 'bb_breakout', name: '布林带突破', description: '突破布林带上下轨交易' },
  { type: 'macd_divergence', name: 'MACD背离', description: '价格与MACD背离信号' },
  { type: 'grid', name: '网格交易', description: '区间内自动低买高卖' },
  { type: 'dca', name: '定投策略', description: '定时定额分批建仓' },
  { type: 'trend_follow', name: '趋势跟踪', description: '多周期趋势确认跟随' },
  { type: 'mean_reversion', name: '均值回归', description: '偏离均值后的回归交易' },
];

export default function MultiStrategyPanel() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [newStrategySymbol, setNewStrategySymbol] = useState('BTCUSDT');
  const [newStrategyAllocation, setNewStrategyAllocation] = useState(25);

  const totalPnl = strategies.reduce((sum, s) => sum + s.pnl, 0);
  const totalAllocation = strategies.reduce((sum, s) => sum + s.allocation, 0);

  const addStrategy = () => {
    if (!selectedTemplate) return;
    const template = STRATEGY_TEMPLATES.find(t => t.type === selectedTemplate);
    if (!template) return;

    const newStrategy: Strategy = {
      id: Date.now().toString(),
      name: template.name,
      type: template.type,
      symbol: newStrategySymbol,
      status: 'stopped',
      pnl: 0,
      trades: 0,
      winRate: 0,
      allocation: newStrategyAllocation,
    };

    setStrategies(prev => [...prev, newStrategy]);
    setShowAddModal(false);
    setSelectedTemplate('');
  };

  const toggleStrategy = (id: string) => {
    setStrategies(prev => prev.map(s =>
      s.id === id ? { ...s, status: s.status === 'running' ? 'paused' : 'running' } : s
    ));
  };

  const removeStrategy = (id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {/* 概览 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 bg-gray-50 dark:bg-slate-700/30 rounded-lg text-center">
          <div className="text-[10px] text-gray-500 dark:text-slate-400">策略数</div>
          <div className="text-sm font-bold text-gray-900 dark:text-white">{strategies.length}</div>
        </div>
        <div className="p-2.5 bg-gray-50 dark:bg-slate-700/30 rounded-lg text-center">
          <div className="text-[10px] text-gray-500 dark:text-slate-400">总盈亏</div>
          <div className={`text-sm font-bold ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="p-2.5 bg-gray-50 dark:bg-slate-700/30 rounded-lg text-center">
          <div className="text-[10px] text-gray-500 dark:text-slate-400">已分配</div>
          <div className={`text-sm font-bold ${totalAllocation > 100 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
            {totalAllocation}%
          </div>
        </div>
      </div>

      {/* 策略列表 */}
      {strategies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-slate-500">
          <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">暂无策略</p>
          <p className="text-xs mt-1">添加策略开始组合交易</p>
        </div>
      ) : (
        <div className="space-y-2">
          {strategies.map((strategy) => (
            <div key={strategy.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    strategy.status === 'running' ? 'bg-green-500 animate-pulse' :
                    strategy.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-400'
                  }`} />
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">{strategy.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 rounded">{strategy.symbol}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleStrategy(strategy.id)}
                    className={`p-1 rounded transition-colors ${
                      strategy.status === 'running'
                        ? 'text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/20'
                        : 'text-green-500 hover:bg-green-100 dark:hover:bg-green-900/20'
                    }`}
                  >
                    {strategy.status === 'running' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => removeStrategy(strategy.id)}
                    className="p-1 rounded text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <span className="text-gray-500 dark:text-slate-400">盈亏</span>
                  <div className={`font-medium ${strategy.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {strategy.pnl >= 0 ? '+' : ''}{strategy.pnl.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-slate-400">交易数</span>
                  <div className="text-gray-900 dark:text-white font-medium">{strategy.trades}</div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-slate-400">分配</span>
                  <div className="text-gray-900 dark:text-white font-medium">{strategy.allocation}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加按钮 */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-500 dark:text-slate-400 hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-all flex items-center justify-center gap-1"
      >
        <Plus className="w-4 h-4" />
        添加策略
      </button>

      {/* 添加策略模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">添加策略</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1.5 block">选择策略</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
                  {STRATEGY_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.type}
                      onClick={() => setSelectedTemplate(tmpl.type)}
                      className={`p-2 rounded-lg text-left transition-all ${
                        selectedTemplate === tmpl.type
                          ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-500'
                          : 'bg-gray-50 dark:bg-slate-700/30 border border-transparent hover:bg-gray-100 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-900 dark:text-white">{tmpl.name}</div>
                      <div className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">{tmpl.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">交易对</label>
                <input
                  type="text"
                  value={newStrategySymbol}
                  onChange={(e) => setNewStrategySymbol(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-slate-400">资金分配</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{newStrategyAllocation}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={newStrategyAllocation}
                  onChange={(e) => setNewStrategyAllocation(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <button
                onClick={addStrategy}
                disabled={!selectedTemplate}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <Check className="w-4 h-4" />
                添加策略
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
