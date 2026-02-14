/**
 * 持仓和订单面板组件
 * 真实交易所风格设计
 */

import { useState } from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  XCircle, 
  Edit3, 
  AlertTriangle,
  Check,
  RefreshCw,
  Target,
  Shield
} from 'lucide-react';

interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  markPrice: number;
  pnl: number;
  pnlPercent: number;
  leverage: number;
  margin: number;
  marginRatio: number;
  liquidationPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  openTime: number;
}

interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'MARKET' | 'TAKE_PROFIT' | 'TRAILING_STOP';
  price: number;
  triggerPrice?: number;
  amount: number;
  filled: number;
  status: 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'EXPIRED';
  reduceOnly: boolean;
  postOnly: boolean;
  timestamp: number;
}

interface TradeHistory {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: number;
  amount: number;
  fee: number;
  realizedPnl: number;
  timestamp: number;
}

interface PositionPanelProps {
  positions?: Position[];
  orders?: Order[];
  history?: TradeHistory[];
  onClosePosition?: (id: string, size?: number) => void;
  onCancelOrder?: (id: string) => void;
  onModifyPosition?: (id: string, stopLoss?: number, takeProfit?: number) => void;
}

// 模拟真实持仓数据
const mockPositions: Position[] = [
  {
    id: 'pos_1',
    symbol: 'BTCUSDT',
    side: 'LONG',
    size: 0.1,
    entryPrice: 68500,
    currentPrice: 69774,
    markPrice: 69780,
    pnl: 127.4,
    pnlPercent: 1.86,
    leverage: 10,
    margin: 685,
    marginRatio: 15.2,
    liquidationPrice: 62015,
    stopLoss: 67000,
    takeProfit: 72000,
    openTime: Date.now() - 86400000,
  },
  {
    id: 'pos_2',
    symbol: 'ETHUSDT',
    side: 'SHORT',
    size: 2.5,
    entryPrice: 2650,
    currentPrice: 2620,
    markPrice: 2618,
    pnl: 75,
    pnlPercent: 1.13,
    leverage: 5,
    margin: 1325,
    marginRatio: 8.5,
    liquidationPrice: 2915,
    stopLoss: 2750,
    takeProfit: 2500,
    openTime: Date.now() - 172800000,
  },
];

const mockOrders: Order[] = [
  {
    id: 'ord_1',
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'LIMIT',
    price: 68000,
    amount: 0.05,
    filled: 0,
    status: 'OPEN',
    reduceOnly: false,
    postOnly: true,
    timestamp: Date.now() - 3600000,
  },
  {
    id: 'ord_2',
    symbol: 'ETHUSDT',
    side: 'SELL',
    type: 'STOP_LIMIT',
    price: 2550,
    triggerPrice: 2560,
    amount: 1,
    filled: 0,
    status: 'OPEN',
    reduceOnly: true,
    postOnly: false,
    timestamp: Date.now() - 7200000,
  },
  {
    id: 'ord_3',
    symbol: 'SOLUSDT',
    side: 'BUY',
    type: 'LIMIT',
    price: 145,
    amount: 10,
    filled: 3,
    status: 'PARTIAL',
    reduceOnly: false,
    postOnly: false,
    timestamp: Date.now() - 1800000,
  },
];

const mockHistory: TradeHistory[] = [
  {
    id: 'his_1',
    symbol: 'BTCUSDT',
    side: 'SELL',
    type: '平多',
    price: 69200,
    amount: 0.05,
    fee: 1.73,
    realizedPnl: 35.27,
    timestamp: Date.now() - 43200000,
  },
  {
    id: 'his_2',
    symbol: 'ETHUSDT',
    side: 'BUY',
    type: '平空',
    price: 2580,
    amount: 1.5,
    fee: 0.97,
    realizedPnl: -22.53,
    timestamp: Date.now() - 86400000,
  },
];

export default function PositionPanel({
  positions = mockPositions,
  orders = mockOrders,
  history = mockHistory,
  onClosePosition,
  onCancelOrder,
  onModifyPosition,
}: PositionPanelProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [editStopLoss, setEditStopLoss] = useState<string>('');
  const [editTakeProfit, setEditTakeProfit] = useState<string>('');
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [closeAmount, setCloseAmount] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalMargin = positions.reduce((sum, p) => sum + p.margin, 0);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}天${hours % 24}时`;
    return `${hours}时${Math.floor((diff % 3600000) / 60000)}分`;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsRefreshing(false);
  };

  const startEditPosition = (pos: Position) => {
    setEditingPosition(pos.id);
    setEditStopLoss(pos.stopLoss?.toString() || '');
    setEditTakeProfit(pos.takeProfit?.toString() || '');
  };

  const saveEditPosition = (posId: string) => {
    onModifyPosition?.(
      posId,
      editStopLoss ? parseFloat(editStopLoss) : undefined,
      editTakeProfit ? parseFloat(editTakeProfit) : undefined
    );
    setEditingPosition(null);
  };

  const startClosePosition = (pos: Position) => {
    setClosingPosition(pos.id);
    setCloseAmount(pos.size.toString());
  };

  const confirmClosePosition = (posId: string) => {
    const amount = parseFloat(closeAmount);
    if (amount > 0) {
      onClosePosition?.(posId, amount);
    }
    setClosingPosition(null);
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700/50 overflow-hidden">
      {/* 标签页 */}
      <div className="flex border-b border-gray-200 dark:border-slate-700/50">
        {[
          { key: 'positions', label: '持仓', count: positions.length },
          { key: 'orders', label: '当前委托', count: orders.filter(o => o.status === 'OPEN' || o.status === 'PARTIAL').length },
          { key: 'history', label: '成交历史', count: history.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex-1 py-2.5 text-xs font-medium transition-all relative ${
              activeTab === tab.key
                ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-700/50'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700/30'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                tab.key === 'positions' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        ))}
        <button
          onClick={handleRefresh}
          className="px-3 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 持仓列表 */}
      {activeTab === 'positions' && (
        <div className="p-3">
          {positions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-slate-500 text-sm">
              <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
              暂无持仓
              <p className="text-xs mt-1 text-gray-400 dark:text-slate-600">开始交易后将在此显示</p>
            </div>
          ) : (
            <>
              {/* 总览 */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="px-3 py-2 bg-gray-100 dark:bg-slate-900/50 rounded-lg">
                  <div className="text-[10px] text-gray-500 dark:text-slate-500">总未实现盈亏</div>
                  <div className={`text-sm font-mono font-semibold ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USDT
                  </div>
                </div>
                <div className="px-3 py-2 bg-gray-100 dark:bg-slate-900/50 rounded-lg">
                  <div className="text-[10px] text-gray-500 dark:text-slate-500">占用保证金</div>
                  <div className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                    {totalMargin.toFixed(2)} USDT
                  </div>
                </div>
              </div>

              {/* 持仓卡片 */}
              {positions.map((pos) => (
                <div key={pos.id} className="bg-gray-50 dark:bg-slate-900/30 rounded-lg p-3 mb-2 border border-gray-200 dark:border-slate-700/30">
                  {/* 头部 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{pos.symbol}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        pos.side === 'LONG' 
                          ? 'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400' 
                          : 'bg-red-100 dark:bg-red-600/20 text-red-600 dark:text-red-400'
                      }`}>
                        {pos.side === 'LONG' ? '多' : '空'} {pos.leverage}x
                      </span>
                      {pos.marginRatio > 80 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-orange-500">
                          <AlertTriangle className="w-3 h-3" />
                          风险
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditPosition(pos)}
                        className="p-1 text-gray-400 dark:text-slate-500 hover:text-blue-500 transition-colors"
                        title="修改止盈止损"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => startClosePosition(pos)}
                        className="p-1 text-gray-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                        title="平仓"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 编辑止盈止损 */}
                  {editingPosition === pos.id && (
                    <div className="mb-3 p-2 bg-white dark:bg-slate-800 rounded border border-blue-300 dark:border-blue-600">
                      <div className="text-[10px] text-blue-500 mb-2 font-medium">修改止盈止损</div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-[10px] text-gray-500 dark:text-slate-500">止损价</label>
                          <input
                            type="number"
                            value={editStopLoss}
                            onChange={(e) => setEditStopLoss(e.target.value)}
                            placeholder="不设置"
                            className="w-full bg-gray-100 dark:bg-slate-700 border-0 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 dark:text-slate-500">止盈价</label>
                          <input
                            type="number"
                            value={editTakeProfit}
                            onChange={(e) => setEditTakeProfit(e.target.value)}
                            placeholder="不设置"
                            className="w-full bg-gray-100 dark:bg-slate-700 border-0 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEditPosition(pos.id)}
                          className="flex-1 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded flex items-center justify-center gap-1"
                        >
                          <Check className="w-3 h-3" /> 确认
                        </button>
                        <button
                          onClick={() => setEditingPosition(null)}
                          className="flex-1 py-1 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 text-xs rounded"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 平仓确认 */}
                  {closingPosition === pos.id && (
                    <div className="mb-3 p-2 bg-white dark:bg-slate-800 rounded border border-red-300 dark:border-red-600">
                      <div className="text-[10px] text-red-500 mb-2 font-medium">确认平仓</div>
                      <div className="mb-2">
                        <label className="text-[10px] text-gray-500 dark:text-slate-500">平仓数量</label>
                        <div className="flex gap-1 items-center">
                          <input
                            type="number"
                            value={closeAmount}
                            onChange={(e) => setCloseAmount(e.target.value)}
                            max={pos.size}
                            step="0.001"
                            className="flex-1 bg-gray-100 dark:bg-slate-700 border-0 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
                          />
                          <button
                            onClick={() => setCloseAmount(pos.size.toString())}
                            className="px-2 py-1 bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 text-[10px] rounded"
                          >
                            全部
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmClosePosition(pos.id)}
                          className="flex-1 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                        >
                          市价平仓
                        </button>
                        <button
                          onClick={() => setClosingPosition(null)}
                          className="flex-1 py-1 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 text-xs rounded"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 数据网格 */}
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">数量</span>
                      <div className="text-gray-900 dark:text-white font-mono">{pos.size}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">开仓均价</span>
                      <div className="text-gray-900 dark:text-white font-mono">{pos.entryPrice.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">标记价格</span>
                      <div className="text-gray-900 dark:text-white font-mono">{pos.markPrice.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">强平价格</span>
                      <div className="text-orange-500 font-mono">{pos.liquidationPrice.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">保证金</span>
                      <div className="text-gray-900 dark:text-white font-mono">{pos.margin.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">保证金率</span>
                      <div className={`font-mono ${pos.marginRatio > 80 ? 'text-red-500' : pos.marginRatio > 50 ? 'text-yellow-500' : 'text-green-500'}`}>
                        {pos.marginRatio.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* 盈亏和持仓时间 */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-slate-700/50">
                    <div>
                      <span className="text-[10px] text-gray-500 dark:text-slate-500">未实现盈亏</span>
                      <div className={`text-sm font-mono font-semibold ${pos.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)} ({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%)
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 dark:text-slate-500">持仓时长</span>
                      <div className="text-xs text-gray-600 dark:text-slate-400">{formatDuration(pos.openTime)}</div>
                    </div>
                  </div>

                  {/* 止盈止损显示 */}
                  {(pos.stopLoss || pos.takeProfit) && editingPosition !== pos.id && (
                    <div className="flex gap-3 mt-2 pt-2 border-t border-gray-200 dark:border-slate-700/50">
                      {pos.stopLoss && (
                        <div className="flex items-center gap-1 text-[10px]">
                          <Shield className="w-3 h-3 text-red-400" />
                          <span className="text-gray-500 dark:text-slate-500">止损:</span>
                          <span className="text-red-500 font-mono">{pos.stopLoss.toLocaleString()}</span>
                        </div>
                      )}
                      {pos.takeProfit && (
                        <div className="flex items-center gap-1 text-[10px]">
                          <Target className="w-3 h-3 text-green-400" />
                          <span className="text-gray-500 dark:text-slate-500">止盈:</span>
                          <span className="text-green-500 font-mono">{pos.takeProfit.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* 当前委托 */}
      {activeTab === 'orders' && (
        <div className="p-3">
          {orders.filter(o => o.status === 'OPEN' || o.status === 'PARTIAL').length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-slate-500 text-sm">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              暂无委托
              <p className="text-xs mt-1 text-gray-400 dark:text-slate-600">下单后将在此显示</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.filter(o => o.status === 'OPEN' || o.status === 'PARTIAL').map((order) => (
                <div key={order.id} className="bg-gray-50 dark:bg-slate-900/30 rounded-lg p-3 border border-gray-200 dark:border-slate-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {order.side === 'BUY' ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{order.symbol}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        order.side === 'BUY' ? 'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-600/20 text-red-600 dark:text-red-400'
                      }`}>
                        {order.side === 'BUY' ? '买入' : '卖出'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-slate-700 rounded text-gray-600 dark:text-slate-400">
                        {order.type.replace('_', ' ')}
                      </span>
                      {order.reduceOnly && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-600/20 rounded text-yellow-600 dark:text-yellow-400">
                          只减仓
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onCancelOrder?.(order.id)}
                      className="p-1 text-gray-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">委托价格</span>
                      <div className="text-gray-900 dark:text-white font-mono">{order.price.toLocaleString()}</div>
                    </div>
                    {order.triggerPrice && (
                      <div>
                        <span className="text-gray-500 dark:text-slate-500">触发价格</span>
                        <div className="text-orange-500 font-mono">{order.triggerPrice.toLocaleString()}</div>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">数量</span>
                      <div className="text-gray-900 dark:text-white font-mono">{order.amount}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">已成交</span>
                      <div className="text-gray-900 dark:text-white font-mono">
                        {order.filled} ({((order.filled / order.amount) * 100).toFixed(0)}%)
                      </div>
                    </div>
                  </div>

                  {/* 进度条 */}
                  {order.status === 'PARTIAL' && (
                    <div className="mt-2">
                      <div className="h-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(order.filled / order.amount) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-slate-700/50 text-[10px] text-gray-500 dark:text-slate-500">
                    <span>{formatTime(order.timestamp)}</span>
                    <span>ID: {order.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 成交历史 */}
      {activeTab === 'history' && (
        <div className="p-3">
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-slate-500 text-sm">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              暂无成交记录
              <p className="text-xs mt-1 text-gray-400 dark:text-slate-600">成交后将在此显示</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((trade) => (
                <div key={trade.id} className="bg-gray-50 dark:bg-slate-900/30 rounded-lg p-3 border border-gray-200 dark:border-slate-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{trade.symbol}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        trade.side === 'BUY' ? 'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-600/20 text-red-600 dark:text-red-400'
                      }`}>
                        {trade.type}
                      </span>
                    </div>
                    <div className={`text-sm font-mono font-semibold ${trade.realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {trade.realizedPnl >= 0 ? '+' : ''}{trade.realizedPnl.toFixed(2)} USDT
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">成交价</span>
                      <div className="text-gray-900 dark:text-white font-mono">{trade.price.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">数量</span>
                      <div className="text-gray-900 dark:text-white font-mono">{trade.amount}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">手续费</span>
                      <div className="text-gray-900 dark:text-white font-mono">{trade.fee.toFixed(4)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">时间</span>
                      <div className="text-gray-600 dark:text-slate-400">{formatTime(trade.timestamp)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
