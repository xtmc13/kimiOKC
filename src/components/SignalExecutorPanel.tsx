/**
 * XTMC 信号自动执行面板
 * 管理AI信号的自动执行
 */

import { useState } from 'react';
import { Zap, Bell, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TradeSignal } from '../types';

interface SignalExecutorPanelProps {
  signals: TradeSignal[];
}

export default function SignalExecutorPanel({ signals }: SignalExecutorPanelProps) {
  const [autoExecute, setAutoExecute] = useState(false);
  const [tab, setTab] = useState<'signals' | 'config' | 'log'>('signals');
  const [minConfidence, setMinConfidence] = useState(70);
  const [maxPositionPct, setMaxPositionPct] = useState(10);
  const [allowedActions, setAllowedActions] = useState<Record<string, boolean>>({
    BUY: true,
    SELL: true,
    HOLD: false,
  });

  const filteredSignals = signals.filter(s => s.confidence * 100 >= minConfidence);

  const tabs = [
    { key: 'signals', label: '信号列表' },
    { key: 'config', label: '执行配置' },
    { key: 'log', label: '执行日志' },
  ];

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {/* 自动执行开关 */}
      <div className={`flex items-center justify-between p-3 rounded-lg border ${
        autoExecute
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30'
          : 'bg-gray-50 dark:bg-slate-700/30 border-gray-200 dark:border-slate-600'
      }`}>
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${autoExecute ? 'text-green-500' : 'text-gray-400 dark:text-slate-500'}`} />
          <div>
            <div className={`text-xs font-semibold ${autoExecute ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-slate-300'}`}>
              自动执行
            </div>
            <div className="text-[10px] text-gray-500 dark:text-slate-400">
              {autoExecute ? '信号将自动执行' : '信号仅通知不执行'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setAutoExecute(!autoExecute)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            autoExecute ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'
          }`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            autoExecute ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {/* 标签 */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700/50 rounded-lg p-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${
              tab === key
                ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 内容 */}
      {tab === 'signals' && (
        <div className="space-y-2">
          {filteredSignals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-slate-500">
              <Bell className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">暂无符合条件的信号</p>
              <p className="text-xs mt-1">最低信度: {minConfidence}%</p>
            </div>
          ) : (
            filteredSignals.slice(0, 20).map((signal, i) => (
              <div key={i} className="p-2.5 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      signal.action === 'BUY' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                      signal.action === 'SELL' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                      'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-slate-400'
                    }`}>
                      {signal.action === 'BUY' ? <TrendingUp className="w-3 h-3" /> :
                       signal.action === 'SELL' ? <TrendingDown className="w-3 h-3" /> :
                       <Minus className="w-3 h-3" />}
                      {signal.action}
                    </span>
                    <span className="text-xs font-medium text-gray-900 dark:text-white">{signal.symbol}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          signal.confidence >= 0.8 ? 'bg-green-500' :
                          signal.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${signal.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400">{(signal.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 dark:text-slate-400">{signal.reason?.slice(0, 30)}</span>
                  <span className="text-gray-400 dark:text-slate-500">
                    {new Date(signal.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {!autoExecute && signal.action !== 'HOLD' && (
                  <button className="mt-2 w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-medium transition-colors">
                    手动执行
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'config' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 dark:text-slate-400">最低信度</label>
              <span className="text-xs font-bold text-gray-900 dark:text-white">{minConfidence}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={95}
              step={5}
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 dark:text-slate-400">最大仓位比例</label>
              <span className="text-xs font-bold text-gray-900 dark:text-white">{maxPositionPct}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={maxPositionPct}
              onChange={(e) => setMaxPositionPct(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 mb-2 block">允许的操作</label>
            <div className="space-y-2">
              {Object.entries(allowedActions).map(([action, enabled]) => (
                <label key={action} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setAllowedActions(prev => ({ ...prev, [action]: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-slate-600 text-blue-500"
                  />
                  <span className={`text-xs ${
                    action === 'BUY' ? 'text-green-600 dark:text-green-400' :
                    action === 'SELL' ? 'text-red-600 dark:text-red-400' :
                    'text-gray-600 dark:text-slate-400'
                  }`}>
                    {action === 'BUY' ? '买入信号' : action === 'SELL' ? '卖出信号' : '持有信号'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-slate-500">
          <p className="text-sm">暂无执行记录</p>
          <p className="text-xs mt-1">开启自动执行后记录将在此显示</p>
        </div>
      )}
    </div>
  );
}
