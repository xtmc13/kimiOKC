/**
 * XTMC DCA定投面板
 * 支持定时定额、智能定投
 */

import { useState } from 'react';
import { Clock, Play, Square, TrendingDown, Calendar, DollarSign, AlertCircle } from 'lucide-react';

interface DCAPanelProps {
  symbol: string;
  currentPrice: number;
}

export default function DCAPanel({ symbol, currentPrice }: DCAPanelProps) {
  const [mode, setMode] = useState<'fixed' | 'smart'>('fixed');
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState('daily');
  const [isRunning, setIsRunning] = useState(false);
  const [smartDip, setSmartDip] = useState(5);
  const [smartMultiplier, setSmartMultiplier] = useState(2);

  const intervals = [
    { key: 'hourly', label: '每小时' },
    { key: 'daily', label: '每天' },
    { key: 'weekly', label: '每周' },
    { key: 'biweekly', label: '每两周' },
    { key: 'monthly', label: '每月' },
  ];

  const simulateCost = amount ? parseFloat(amount) * 30 : 0;

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {/* 状态 */}
      {isRunning && (
        <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-700 dark:text-green-400 font-medium">定投运行中</span>
          <span className="text-xs text-green-600 dark:text-green-500 ml-auto">下次: 2h后</span>
        </div>
      )}

      {/* 模式切换 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode('fixed')}
          className={`py-2 rounded-lg text-xs font-medium transition-all ${
            mode === 'fixed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-slate-700/50 text-gray-600 dark:text-slate-400'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            定时定额
          </div>
        </button>
        <button
          onClick={() => setMode('smart')}
          className={`py-2 rounded-lg text-xs font-medium transition-all ${
            mode === 'smart'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 dark:bg-slate-700/50 text-gray-600 dark:text-slate-400'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" />
            智能定投
          </div>
        </button>
      </div>

      {/* 每次金额 */}
      <div>
        <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">
          <DollarSign className="w-3 h-3 inline" /> 每次投入 (USDT)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 定投频率 */}
      <div>
        <label className="text-xs text-gray-500 dark:text-slate-400 mb-1.5 block">
          <Calendar className="w-3 h-3 inline" /> 定投频率
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {intervals.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setInterval(key)}
              className={`py-1.5 rounded text-[11px] font-medium transition-all ${
                interval === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 智能定投设置 */}
      {mode === 'smart' && (
        <div className="space-y-3 p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30 rounded-lg">
          <div className="text-xs font-medium text-purple-700 dark:text-purple-400">智能加仓设置</div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-gray-500 dark:text-slate-400">跌幅阈值</span>
              <span className="text-[11px] font-bold text-gray-900 dark:text-white">{smartDip}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={smartDip}
              onChange={(e) => setSmartDip(parseInt(e.target.value))}
              className="w-full h-1.5 bg-purple-200 dark:bg-purple-900/30 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-gray-500 dark:text-slate-400">加仓倍数</span>
              <span className="text-[11px] font-bold text-gray-900 dark:text-white">{smartMultiplier}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={0.5}
              value={smartMultiplier}
              onChange={(e) => setSmartMultiplier(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-purple-200 dark:bg-purple-900/30 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>
          <p className="text-[10px] text-purple-600 dark:text-purple-400">
            当价格下跌 {smartDip}% 时，自动以 {smartMultiplier}x 倍金额加仓
          </p>
        </div>
      )}

      {/* 预计成本 */}
      <div className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-slate-400">当前价格</span>
          <span className="text-gray-900 dark:text-white font-medium">${currentPrice.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-slate-400">月预计投入</span>
          <span className="text-gray-900 dark:text-white font-medium">
            ~${interval === 'hourly' ? (simulateCost * 24).toFixed(0) :
              interval === 'daily' ? simulateCost.toFixed(0) :
              interval === 'weekly' ? (simulateCost / 7 * 4).toFixed(0) :
              interval === 'biweekly' ? (simulateCost / 15 * 2).toFixed(0) :
              amount || '0'
            }
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-slate-400">可买入数量</span>
          <span className="text-gray-900 dark:text-white font-medium">
            {amount && currentPrice ? (parseFloat(amount) / currentPrice).toFixed(6) : '--'} {symbol.replace('USDT', '')}
          </span>
        </div>
      </div>

      {/* 按钮 */}
      <button
        onClick={() => setIsRunning(!isRunning)}
        className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
          isRunning
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : mode === 'smart'
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isRunning ? (
          <><Square className="w-4 h-4" /> 停止定投</>
        ) : (
          <><Play className="w-4 h-4" /> 启动{mode === 'smart' ? '智能' : ''}定投 ({symbol})</>
        )}
      </button>

      {/* 提示 */}
      <div className="flex items-start gap-2 p-2.5 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg">
        <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed">
          定投策略通过时间分散降低持仓成本，适合长期投资。智能模式会在大幅下跌时自动加仓。
        </p>
      </div>
    </div>
  );
}
