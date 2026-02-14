/**
 * XTMC 持仓面板组件
 * 显示当前持仓、挂单和历史交易
 */

import { useState } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';

interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  markPrice: number;
  quantity: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  margin: number;
  liqPrice: number;
}

interface OpenOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  price: number;
  quantity: number;
  filled: number;
  time: number;
}

export default function PositionPanel() {
  const [tab, setTab] = useState<'positions' | 'orders' | 'history'>('positions');
  
  // 模拟数据
  const positions: Position[] = [];
  const openOrders: OpenOrder[] = [];

  const tabs = [
    { key: 'positions', label: '持仓', count: positions.length },
    { key: 'orders', label: '挂单', count: openOrders.length },
    { key: 'history', label: '成交历史', count: 0 },
  ];

  return (
    <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-slate-700/50 overflow-hidden">
      {/* 标签 */}
      <div className="flex border-b border-gray-200 dark:border-slate-700/50">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex-1 py-2.5 text-xs font-medium transition-all ${
              tab === key
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
            }`}
          >
            {label} {count > 0 && <span className="ml-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px]">{count}</span>}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="p-4 min-h-[200px]">
        {tab === 'positions' && (
          <>
            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-slate-500">
                <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">暂无持仓</p>
                <p className="text-xs mt-1">配置交易所API后可查看实时持仓</p>
              </div>
            ) : (
              <div className="space-y-3">
                {positions.map((pos) => (
                  <div key={pos.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                          pos.side === 'long' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        }`}>
                          {pos.side === 'long' ? '多' : '空'} {pos.leverage}x
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{pos.symbol}</span>
                      </div>
                      <span className={`text-sm font-bold ${pos.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)} ({pos.pnlPercent.toFixed(2)}%)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-500 dark:text-slate-400">
                      <div>
                        <div>开仓价</div>
                        <div className="text-gray-900 dark:text-white font-medium">{pos.entryPrice}</div>
                      </div>
                      <div>
                        <div>标记价</div>
                        <div className="text-gray-900 dark:text-white font-medium">{pos.markPrice}</div>
                      </div>
                      <div>
                        <div>强平价</div>
                        <div className="text-orange-500 font-medium">{pos.liqPrice}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'orders' && (
          <>
            {openOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-slate-500">
                <TrendingDown className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">暂无挂单</p>
                <p className="text-xs mt-1">当前没有活跃的委托订单</p>
              </div>
            ) : (
              <div className="space-y-2">
                {openOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700/30 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${
                        order.side === 'buy' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      }`}>
                        {order.side === 'buy' ? '买' : '卖'}
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">{order.symbol}</span>
                    </div>
                    <div className="text-gray-500 dark:text-slate-400">
                      {order.price} × {order.quantity}
                    </div>
                    <button className="text-gray-400 dark:text-slate-500 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'history' && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-slate-500">
            <p className="text-sm">暂无成交记录</p>
            <p className="text-xs mt-1">历史交易记录将在此显示</p>
          </div>
        )}
      </div>
    </div>
  );
}
