/**
 * XTMC 网格交易面板
 * 支持等差/等比网格，自动挂单
 */

import { useState } from 'react';
import { Grid3X3, Square, Settings2, AlertCircle } from 'lucide-react';

interface GridTradingPanelProps {
  symbol: string;
  currentPrice: number;
}

export default function GridTradingPanel({ symbol, currentPrice }: GridTradingPanelProps) {
  const [gridType, setGridType] = useState<'arithmetic' | 'geometric'>('arithmetic');
  const [upperPrice, setUpperPrice] = useState('');
  const [lowerPrice, setLowerPrice] = useState('');
  const [gridCount, setGridCount] = useState(10);
  const [totalInvestment, setTotalInvestment] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const gridSpacing = upperPrice && lowerPrice && gridCount > 1
    ? ((parseFloat(upperPrice) - parseFloat(lowerPrice)) / (gridCount - 1)).toFixed(2)
    : '--';

  const profitPerGrid = upperPrice && lowerPrice && gridCount > 1
    ? (((parseFloat(upperPrice) - parseFloat(lowerPrice)) / (gridCount - 1)) / parseFloat(lowerPrice) * 100).toFixed(2)
    : '--';

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {/* 状态 */}
      {isRunning && (
        <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-700 dark:text-green-400 font-medium">网格运行中</span>
          <span className="text-xs text-green-600 dark:text-green-500 ml-auto">已运行 2h 35m</span>
        </div>
      )}

      {/* 网格类型 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setGridType('arithmetic')}
          className={`py-2 rounded-lg text-xs font-medium transition-all ${
            gridType === 'arithmetic'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-slate-700/50 text-gray-600 dark:text-slate-400'
          }`}
        >
          等差网格
        </button>
        <button
          onClick={() => setGridType('geometric')}
          className={`py-2 rounded-lg text-xs font-medium transition-all ${
            gridType === 'geometric'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-slate-700/50 text-gray-600 dark:text-slate-400'
          }`}
        >
          等比网格
        </button>
      </div>

      {/* 价格范围 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">上限价格</label>
          <input
            type="number"
            value={upperPrice}
            onChange={(e) => setUpperPrice(e.target.value)}
            placeholder={currentPrice ? (currentPrice * 1.1).toFixed(2) : '0'}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">下限价格</label>
          <input
            type="number"
            value={lowerPrice}
            onChange={(e) => setLowerPrice(e.target.value)}
            placeholder={currentPrice ? (currentPrice * 0.9).toFixed(2) : '0'}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* 网格数 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">网格数量</label>
          <span className="text-xs font-bold text-gray-900 dark:text-white">{gridCount}</span>
        </div>
        <input
          type="range"
          min={3}
          max={50}
          value={gridCount}
          onChange={(e) => setGridCount(parseInt(e.target.value))}
          className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-gray-400 dark:text-slate-500 mt-1">
          <span>3</span><span>15</span><span>30</span><span>50</span>
        </div>
      </div>

      {/* 投资金额 */}
      <div>
        <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">投入金额 (USDT)</label>
        <input
          type="number"
          value={totalInvestment}
          onChange={(e) => setTotalInvestment(e.target.value)}
          placeholder="1000"
          className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 信息面板 */}
      <div className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-slate-400">每格间距</span>
          <span className="text-gray-900 dark:text-white font-medium">{gridSpacing} USDT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-slate-400">每格利润</span>
          <span className="text-green-500 font-medium">{profitPerGrid}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-slate-400">每单金额</span>
          <span className="text-gray-900 dark:text-white font-medium">
            {totalInvestment && gridCount ? (parseFloat(totalInvestment) / gridCount).toFixed(2) : '--'} USDT
          </span>
        </div>
      </div>

      {/* 高级设置 */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
      >
        <Settings2 className="w-3.5 h-3.5" />
        高级设置
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">止损价</label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="可选"
              className="w-full px-3 py-1.5 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">止盈价</label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="可选"
              className="w-full px-3 py-1.5 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-green-500"
            />
          </div>
        </div>
      )}

      {/* 按钮 */}
      <button
        onClick={() => setIsRunning(!isRunning)}
        className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
          isRunning
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isRunning ? (
          <><Square className="w-4 h-4" /> 停止网格</>
        ) : (
          <><Grid3X3 className="w-4 h-4" /> 启动网格 ({symbol})</>
        )}
      </button>

      {/* 提示 */}
      <div className="flex items-start gap-2 p-2.5 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-lg">
        <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-yellow-700 dark:text-yellow-400 leading-relaxed">
          网格交易适合震荡行情，单边行情可能导致亏损。请确保已配置交易所API。
        </p>
      </div>
    </div>
  );
}
