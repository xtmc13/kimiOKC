/**
 * XTMC 下单面板组件
 * 支持市价单/限价单，买入/卖出
 */

import { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Info } from 'lucide-react';

interface OrderPanelProps {
  symbol: string;
  currentPrice: number;
}

export default function OrderPanel({ symbol, currentPrice }: OrderPanelProps) {
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState('');
  const [leverage, setLeverage] = useState(1);

  const percentages = [25, 50, 75, 100];

  const handlePercentClick = (pct: number) => {
    const available = 10000; // 模拟可用余额
    const t = (available * pct / 100).toFixed(2);
    setTotal(t);
    const p = price ? parseFloat(price) : currentPrice;
    if (p > 0) setAmount((parseFloat(t) / p).toFixed(6));
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const p = price ? parseFloat(price) : currentPrice;
    if (p > 0 && val) setTotal((parseFloat(val) * p).toFixed(2));
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    if (amount && val) setTotal((parseFloat(amount) * parseFloat(val)).toFixed(2));
  };

  return (
    <div className="p-4 space-y-4">
      {/* 买卖切换 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSide('buy')}
          className={`py-2.5 rounded-lg font-semibold text-sm transition-all ${
            side === 'buy'
              ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
              : 'bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <ArrowUpCircle className="w-4 h-4" />
            买入/做多
          </div>
        </button>
        <button
          onClick={() => setSide('sell')}
          className={`py-2.5 rounded-lg font-semibold text-sm transition-all ${
            side === 'sell'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
              : 'bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <ArrowDownCircle className="w-4 h-4" />
            卖出/做空
          </div>
        </button>
      </div>

      {/* 订单类型 */}
      <div className="flex gap-2">
        {(['limit', 'market'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={`flex-1 py-1.5 text-xs rounded transition-all ${
              orderType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400'
            }`}
          >
            {type === 'limit' ? '限价单' : '市价单'}
          </button>
        ))}
      </div>

      {/* 杠杆 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 dark:text-slate-400">杠杆</span>
          <span className="text-xs font-bold text-gray-900 dark:text-white">{leverage}x</span>
        </div>
        <input
          type="range"
          min={1}
          max={125}
          value={leverage}
          onChange={(e) => setLeverage(parseInt(e.target.value))}
          className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-gray-400 dark:text-slate-500 mt-1">
          <span>1x</span><span>25x</span><span>50x</span><span>100x</span><span>125x</span>
        </div>
      </div>

      {/* 价格 */}
      {orderType === 'limit' && (
        <div>
          <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">价格 (USDT)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder={currentPrice.toFixed(2)}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* 数量 */}
      <div>
        <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">数量 ({symbol.replace('USDT', '')})</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder="0.000000"
          className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 百分比快捷 */}
      <div className="grid grid-cols-4 gap-1">
        {percentages.map((pct) => (
          <button
            key={pct}
            onClick={() => handlePercentClick(pct)}
            className="py-1 text-xs bg-gray-100 dark:bg-slate-700/50 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 rounded transition-colors"
          >
            {pct}%
          </button>
        ))}
      </div>

      {/* 总额 */}
      <div>
        <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">总额 (USDT)</label>
        <input
          type="number"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 止盈止损 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
            止盈 <Info className="w-3 h-3" />
          </label>
          <input
            type="number"
            placeholder="--"
            className="w-full px-3 py-1.5 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-green-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
            止损 <Info className="w-3 h-3" />
          </label>
          <input
            type="number"
            placeholder="--"
            className="w-full px-3 py-1.5 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* 下单按钮 */}
      <button
        className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
          side === 'buy'
            ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20'
            : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20'
        }`}
      >
        {side === 'buy' ? `买入/做多 ${symbol}` : `卖出/做空 ${symbol}`}
      </button>

      {/* 可用余额 */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
        <span>可用余额</span>
        <span className="text-gray-900 dark:text-white font-medium">-- USDT</span>
      </div>
    </div>
  );
}
