/**
 * 订单面板组件 - 专业交易所风格下单界面
 */

import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  DollarSign, 
  Target, 
  Info,
  Settings,
  ChevronDown,
  Shield,
  Zap
} from 'lucide-react';

interface OrderPanelProps {
  symbol: string;
  currentPrice: number;
  balance?: number;
  onPlaceOrder?: (order: OrderParams) => void;
}

interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_LIMIT' | 'TAKE_PROFIT_MARKET' | 'TRAILING_STOP';
  amount: number;
  price?: number;
  triggerPrice?: number;
  trailingDelta?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  marginMode: 'cross' | 'isolated';
  reduceOnly: boolean;
  postOnly: boolean;
  timeInForce: 'GTC' | 'IOC' | 'FOK';
}

type OrderTypeKey = 'MARKET' | 'LIMIT' | 'STOP_LIMIT' | 'STOP_MARKET' | 'TP_LIMIT' | 'TP_MARKET' | 'TRAILING';

export default function OrderPanel({ 
  symbol, 
  currentPrice, 
  balance = 10000,
  onPlaceOrder 
}: OrderPanelProps) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<OrderTypeKey>('LIMIT');
  const [amount, setAmount] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [triggerPrice, setTriggerPrice] = useState<string>('');
  const [trailingDelta, setTrailingDelta] = useState<string>('1');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(5);
  const [marginMode, setMarginMode] = useState<'cross' | 'isolated'>('cross');
  const [reduceOnly, setReduceOnly] = useState(false);
  const [postOnly, setPostOnly] = useState(false);
  const [timeInForce, setTimeInForce] = useState<'GTC' | 'IOC' | 'FOK'>('GTC');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOrderTypes, setShowOrderTypes] = useState(false);

  // 订单类型配置
  const orderTypes = [
    { key: 'LIMIT', label: '限价单', desc: '指定价格挂单' },
    { key: 'MARKET', label: '市价单', desc: '立即成交' },
    { key: 'STOP_LIMIT', label: '止损限价', desc: '触发后限价单' },
    { key: 'STOP_MARKET', label: '止损市价', desc: '触发后市价单' },
    { key: 'TP_LIMIT', label: '止盈限价', desc: '触发后限价单' },
    { key: 'TP_MARKET', label: '止盈市价', desc: '触发后市价单' },
    { key: 'TRAILING', label: '追踪止损', desc: '跟随价格移动' },
  ];

  // 计算预估值
  const amountNum = parseFloat(amount) || 0;
  const priceNum = useMemo(() => {
    if (orderType === 'MARKET' || orderType === 'STOP_MARKET' || orderType === 'TP_MARKET') {
      return currentPrice;
    }
    return parseFloat(price) || currentPrice;
  }, [orderType, price, currentPrice]);

  const totalValue = amountNum * priceNum;
  const marginRequired = totalValue / leverage;
  const fee = totalValue * 0.0004; // 0.04% 手续费

  // 计算预估盈亏
  const estimatePnL = useMemo(() => {
    if (!stopLoss && !takeProfit) return { sl: 0, tp: 0 };
    const slPrice = parseFloat(stopLoss) || 0;
    const tpPrice = parseFloat(takeProfit) || 0;
    
    if (side === 'BUY') {
      return {
        sl: slPrice ? (slPrice - priceNum) * amountNum : 0,
        tp: tpPrice ? (tpPrice - priceNum) * amountNum : 0,
      };
    } else {
      return {
        sl: slPrice ? (priceNum - slPrice) * amountNum : 0,
        tp: tpPrice ? (priceNum - tpPrice) * amountNum : 0,
      };
    }
  }, [side, stopLoss, takeProfit, priceNum, amountNum]);

  // 快捷金额百分比
  const setAmountPercent = (percent: number) => {
    const maxAmount = (balance * percent / 100) / priceNum * leverage;
    setAmount(maxAmount.toFixed(6));
  };

  // 设置快捷杠杆
  const quickLeverages = [1, 5, 10, 20, 50, 100];

  const handleSubmit = () => {
    if (!amountNum || amountNum <= 0) return;
    
    const typeMap: Record<OrderTypeKey, OrderParams['type']> = {
      'LIMIT': 'LIMIT',
      'MARKET': 'MARKET',
      'STOP_LIMIT': 'STOP_LIMIT',
      'STOP_MARKET': 'STOP_MARKET',
      'TP_LIMIT': 'TAKE_PROFIT_LIMIT',
      'TP_MARKET': 'TAKE_PROFIT_MARKET',
      'TRAILING': 'TRAILING_STOP',
    };

    const order: OrderParams = {
      symbol,
      side,
      type: typeMap[orderType],
      amount: amountNum,
      price: ['LIMIT', 'STOP_LIMIT', 'TP_LIMIT'].includes(orderType) ? parseFloat(price) : undefined,
      triggerPrice: ['STOP_LIMIT', 'STOP_MARKET', 'TP_LIMIT', 'TP_MARKET'].includes(orderType) ? parseFloat(triggerPrice) : undefined,
      trailingDelta: orderType === 'TRAILING' ? parseFloat(trailingDelta) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      leverage,
      marginMode,
      reduceOnly,
      postOnly,
      timeInForce,
    };
    
    onPlaceOrder?.(order);
  };

  const needsPrice = ['LIMIT', 'STOP_LIMIT', 'TP_LIMIT'].includes(orderType);
  const needsTrigger = ['STOP_LIMIT', 'STOP_MARKET', 'TP_LIMIT', 'TP_MARKET'].includes(orderType);
  const isTrailing = orderType === 'TRAILING';

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-blue-400" />
          <span className="font-medium text-gray-900 dark:text-white text-sm">现货/合约交易</span>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`p-1.5 rounded transition-colors ${showAdvanced ? 'text-blue-400 bg-blue-600/10' : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-white'}`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 保证金模式和杠杆 */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setMarginMode('cross')}
                className={`flex-1 py-1.5 text-xs font-medium transition-all ${
                  marginMode === 'cross' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                }`}
              >
                全仓
              </button>
              <button
                onClick={() => setMarginMode('isolated')}
                className={`flex-1 py-1.5 text-xs font-medium transition-all ${
                  marginMode === 'isolated' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                }`}
              >
                逐仓
              </button>
            </div>
          </div>
          <div className="flex-1">
            <button
              className="w-full py-1.5 text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center gap-1"
            >
              <Zap className="w-3 h-3 text-yellow-500" />
              {leverage}x 杠杆
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 杠杆快选 */}
        <div className="flex gap-1">
          {quickLeverages.map((lv) => (
            <button
              key={lv}
              onClick={() => setLeverage(lv)}
              className={`flex-1 py-1 text-[10px] rounded transition-all ${
                leverage === lv
                  ? 'bg-yellow-500 text-black font-semibold'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {lv}x
            </button>
          ))}
        </div>

        {/* 买卖切换 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSide('BUY')}
            className={`py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              side === 'BUY'
                ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            买入/做多
          </button>
          <button
            onClick={() => setSide('SELL')}
            className={`py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              side === 'SELL'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            卖出/做空
          </button>
        </div>

        {/* 订单类型选择器 */}
        <div className="relative">
          <button
            onClick={() => setShowOrderTypes(!showOrderTypes)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white"
          >
            <span>{orderTypes.find(t => t.key === orderType)?.label}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showOrderTypes ? 'rotate-180' : ''}`} />
          </button>
          
          {showOrderTypes && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-10 overflow-hidden">
              {orderTypes.map((type) => (
                <button
                  key={type.key}
                  onClick={() => {
                    setOrderType(type.key as OrderTypeKey);
                    setShowOrderTypes(false);
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
                    orderType === type.key ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  }`}
                >
                  <div className="text-sm text-gray-900 dark:text-white">{type.label}</div>
                  <div className="text-[10px] text-gray-500 dark:text-slate-500">{type.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 价格输入 */}
        {needsPrice && (
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">价格</label>
            <div className="relative">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={currentPrice.toFixed(2)}
                className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-xs">USDT</span>
            </div>
          </div>
        )}

        {/* 触发价格 */}
        {needsTrigger && (
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">触发价格</label>
            <div className="relative">
              <input
                type="number"
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                placeholder="触发后执行订单"
                className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-orange-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-xs">USDT</span>
            </div>
          </div>
        )}

        {/* 追踪止损偏差 */}
        {isTrailing && (
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">回调比例 (%)</label>
            <div className="relative">
              <input
                type="number"
                value={trailingDelta}
                onChange={(e) => setTrailingDelta(e.target.value)}
                placeholder="1.0"
                step="0.1"
                min="0.1"
                max="10"
                className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-xs">%</span>
            </div>
          </div>
        )}

        {/* 数量输入 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">数量</label>
            <span className="text-[10px] text-gray-400 dark:text-slate-500">
              可用: {balance.toFixed(2)} USDT
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-xs">
              {symbol.replace('USDT', '')}
            </span>
          </div>
        </div>

        {/* 快捷百分比 */}
        <div className="flex gap-1">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              onClick={() => setAmountPercent(p)}
              className="flex-1 py-1.5 text-xs bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400 rounded transition-all"
            >
              {p}%
            </button>
          ))}
        </div>

        {/* 止损止盈 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block flex items-center gap-1">
              <Shield className="w-3 h-3 text-red-400" />
              止损价格
            </label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="可选"
              className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-2 text-gray-900 dark:text-white text-xs focus:outline-none focus:border-red-500"
            />
            {stopLoss && (
              <div className={`text-[10px] mt-0.5 ${estimatePnL.sl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                预估: {estimatePnL.sl >= 0 ? '+' : ''}{estimatePnL.sl.toFixed(2)} USDT
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block flex items-center gap-1">
              <Target className="w-3 h-3 text-green-400" />
              止盈价格
            </label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="可选"
              className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-2 text-gray-900 dark:text-white text-xs focus:outline-none focus:border-green-500"
            />
            {takeProfit && (
              <div className={`text-[10px] mt-0.5 ${estimatePnL.tp >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                预估: {estimatePnL.tp >= 0 ? '+' : ''}{estimatePnL.tp.toFixed(2)} USDT
              </div>
            )}
          </div>
        </div>

        {/* 高级选项 */}
        {showAdvanced && (
          <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg space-y-3 border border-gray-200 dark:border-slate-700">
            <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">高级选项</div>
            
            {/* 有效期 */}
            <div>
              <label className="text-[10px] text-gray-500 dark:text-slate-500 mb-1 block">有效期</label>
              <div className="flex gap-1">
                {[
                  { key: 'GTC', label: 'GTC', desc: '一直有效' },
                  { key: 'IOC', label: 'IOC', desc: '立即成交剩余取消' },
                  { key: 'FOK', label: 'FOK', desc: '全部成交或取消' },
                ].map((tif) => (
                  <button
                    key={tif.key}
                    onClick={() => setTimeInForce(tif.key as 'GTC' | 'IOC' | 'FOK')}
                    className={`flex-1 py-1 text-[10px] rounded transition-all ${
                      timeInForce === tif.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
                    }`}
                    title={tif.desc}
                  >
                    {tif.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 开关选项 */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reduceOnly}
                  onChange={(e) => setReduceOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[10px] text-gray-600 dark:text-slate-400">只减仓</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={postOnly}
                  onChange={(e) => setPostOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[10px] text-gray-600 dark:text-slate-400">只做Maker</span>
              </label>
            </div>
          </div>
        )}

        {/* 预估信息 */}
        <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 text-xs border border-gray-200 dark:border-slate-700">
          <div className="flex justify-between text-gray-500 dark:text-slate-400 mb-1.5">
            <span>订单价值</span>
            <span className="text-gray-900 dark:text-white font-mono">{totalValue.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-slate-400 mb-1.5">
            <span>所需保证金</span>
            <span className="text-gray-900 dark:text-white font-mono">{marginRequired.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-slate-400 mb-1.5">
            <span>预估手续费</span>
            <span className="text-gray-900 dark:text-white font-mono">{fee.toFixed(4)} USDT</span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-slate-400">
            <span>强平价格(预估)</span>
            <span className="text-orange-500 font-mono">
              {side === 'BUY' 
                ? (priceNum * (1 - 1/leverage * 0.9)).toFixed(2)
                : (priceNum * (1 + 1/leverage * 0.9)).toFixed(2)
              } USDT
            </span>
          </div>
        </div>

        {/* 提示信息 */}
        {marginRequired > balance && (
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>保证金不足，请减少数量或降低杠杆</span>
          </div>
        )}
      </div>

      {/* 下单按钮 */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700/50">
        <button
          onClick={handleSubmit}
          disabled={!amountNum || marginRequired > balance}
          className={`w-full py-3.5 rounded-lg font-semibold text-sm transition-all ${
            side === 'BUY'
              ? 'bg-green-600 hover:bg-green-500 disabled:bg-green-900 text-white shadow-lg shadow-green-600/20'
              : 'bg-red-600 hover:bg-red-500 disabled:bg-red-900 text-white shadow-lg shadow-red-600/20'
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
        >
          {side === 'BUY' ? '买入做多' : '卖出做空'} {symbol}
        </button>
        <div className="text-center mt-2 text-[10px] text-gray-400 dark:text-slate-500 flex items-center justify-center gap-1">
          <Info className="w-3 h-3" />
          {marginMode === 'cross' ? '全仓模式' : '逐仓模式'} · {leverage}x杠杆 · {orderTypes.find(t => t.key === orderType)?.label}
        </div>
      </div>
    </div>
  );
}
