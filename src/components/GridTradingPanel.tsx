/**
 * 网格交易策略面板
 * 支持等差/等比网格、自动挂单、实时监控
 */

import { useState, useEffect } from 'react';
import { 
  Grid3X3,
  Play,
  Pause,
  Settings,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Trash2
} from 'lucide-react';

interface GridConfig {
  symbol: string;
  upperPrice: number;
  lowerPrice: number;
  gridCount: number;
  gridType: 'arithmetic' | 'geometric';
  totalInvestment: number;
  stopLoss: number;
  takeProfit: number;
  autoRestart: boolean;
}

interface GridOrder {
  id: string;
  price: number;
  type: 'buy' | 'sell';
  status: 'pending' | 'filled' | 'cancelled';
  quantity: number;
  filledAt?: number;
  pnl?: number;
}

interface GridStats {
  totalProfit: number;
  totalTrades: number;
  gridProfit: number;
  floatingPnl: number;
  currentPosition: number;
  avgCost: number;
}

interface GridTradingPanelProps {
  symbol: string;
  currentPrice: number;
}

export default function GridTradingPanel({ symbol, currentPrice }: GridTradingPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'orders' | 'stats'>('config');
  const [config, setConfig] = useState<GridConfig>({
    symbol,
    upperPrice: currentPrice * 1.1,
    lowerPrice: currentPrice * 0.9,
    gridCount: 10,
    gridType: 'arithmetic',
    totalInvestment: 1000,
    stopLoss: 15,
    takeProfit: 30,
    autoRestart: true,
  });

  const [orders, setOrders] = useState<GridOrder[]>([]);
  const [stats, setStats] = useState<GridStats>({
    totalProfit: 0,
    totalTrades: 0,
    gridProfit: 0,
    floatingPnl: 0,
    currentPosition: 0,
    avgCost: 0,
  });

  // 根据当前价格更新配置
  useEffect(() => {
    if (!isRunning && currentPrice > 0) {
      setConfig(prev => ({
        ...prev,
        upperPrice: Math.round(currentPrice * 1.1 * 100) / 100,
        lowerPrice: Math.round(currentPrice * 0.9 * 100) / 100,
      }));
    }
  }, [currentPrice, isRunning]);

  // 计算网格价格
  const calculateGridPrices = (): number[] => {
    const prices: number[] = [];
    const { upperPrice, lowerPrice, gridCount, gridType } = config;
    
    if (gridType === 'arithmetic') {
      const step = (upperPrice - lowerPrice) / gridCount;
      for (let i = 0; i <= gridCount; i++) {
        prices.push(lowerPrice + step * i);
      }
    } else {
      const ratio = Math.pow(upperPrice / lowerPrice, 1 / gridCount);
      for (let i = 0; i <= gridCount; i++) {
        prices.push(lowerPrice * Math.pow(ratio, i));
      }
    }
    
    return prices;
  };

  // 启动网格
  const startGrid = () => {
    const gridPrices = calculateGridPrices();
    const quantityPerGrid = config.totalInvestment / config.gridCount / currentPrice;
    
    const newOrders: GridOrder[] = gridPrices.map((price, index) => ({
      id: `grid-${Date.now()}-${index}`,
      price: Math.round(price * 100) / 100,
      type: price < currentPrice ? 'buy' : 'sell',
      status: 'pending',
      quantity: Math.round(quantityPerGrid * 10000) / 10000,
    }));
    
    setOrders(newOrders);
    setIsRunning(true);
    
    // 模拟订单成交
    simulateOrderFills(newOrders);
  };

  // 模拟订单成交
  const simulateOrderFills = (_gridOrders: GridOrder[]) => {
    let filledCount = 0;
    
    const interval = setInterval(() => {
      setOrders(prev => {
        const updated = [...prev];
        const pendingOrders = updated.filter(o => o.status === 'pending');
        
        if (pendingOrders.length === 0 || filledCount > 5) {
          clearInterval(interval);
          return updated;
        }
        
        // 随机成交一个订单
        const randomIndex = Math.floor(Math.random() * pendingOrders.length);
        const orderToFill = pendingOrders[randomIndex];
        const orderIndex = updated.findIndex(o => o.id === orderToFill.id);
        
        if (orderIndex !== -1) {
          updated[orderIndex] = {
            ...updated[orderIndex],
            status: 'filled',
            filledAt: Date.now(),
            pnl: (Math.random() - 0.3) * 50,
          };
          filledCount++;
          
          // 更新统计
          setStats(s => ({
            ...s,
            totalTrades: s.totalTrades + 1,
            gridProfit: s.gridProfit + (updated[orderIndex].pnl || 0),
            totalProfit: s.totalProfit + (updated[orderIndex].pnl || 0),
          }));
        }
        
        return updated;
      });
    }, 3000 + Math.random() * 2000);
  };

  // 停止网格
  const stopGrid = () => {
    setIsRunning(false);
    setOrders(prev => prev.map(o => 
      o.status === 'pending' ? { ...o, status: 'cancelled' } : o
    ));
  };

  // 计算网格间距
  const gridSpacing = config.gridCount > 0 
    ? ((config.upperPrice - config.lowerPrice) / config.gridCount).toFixed(2)
    : '0';

  // 计算预期收益
  const expectedProfit = config.gridCount > 0
    ? (((config.upperPrice - config.lowerPrice) / config.gridCount / config.lowerPrice) * 100).toFixed(2)
    : '0';

  return (
    <div className="h-full flex flex-col">
      {/* 头部状态 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <span className="font-medium text-gray-900 dark:text-white">网格交易</span>
          {isRunning && (
            <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 dark:bg-green-400 rounded-full animate-pulse" />
              运行中
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={startGrid}
              disabled={currentPrice === 0}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-all disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              启动
            </button>
          ) : (
            <button
              onClick={stopGrid}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-all"
            >
              <Pause className="w-3.5 h-3.5" />
              停止
            </button>
          )}
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-gray-200 dark:border-slate-700/50">
        {[
          { key: 'config', label: '配置', icon: Settings },
          { key: 'orders', label: '订单', icon: Grid3X3 },
          { key: 'stats', label: '统计', icon: TrendingUp },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${
              activeTab === key
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-600/10 border-b-2 border-blue-500 dark:border-blue-400'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* 配置面板 */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            {/* 当前价格 */}
            <div className="p-3 bg-blue-50 dark:bg-blue-600/10 rounded-lg border border-blue-200 dark:border-blue-600/30">
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">当前价格</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* 价格区间 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                  <TrendingUp className="w-3 h-3 inline mr-1 text-green-400" />上限价格
                </label>
                <input
                  type="number"
                  value={config.upperPrice}
                  onChange={(e) => setConfig({ ...config, upperPrice: Number(e.target.value) })}
                  disabled={isRunning}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                  <TrendingDown className="w-3 h-3 inline mr-1 text-red-400" />下限价格
                </label>
                <input
                  type="number"
                  value={config.lowerPrice}
                  onChange={(e) => setConfig({ ...config, lowerPrice: Number(e.target.value) })}
                  disabled={isRunning}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* 网格数量和类型 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">网格数量</label>
                <input
                  type="number"
                  value={config.gridCount}
                  onChange={(e) => setConfig({ ...config, gridCount: Number(e.target.value) })}
                  min={2}
                  max={100}
                  disabled={isRunning}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">网格类型</label>
                <select
                  value={config.gridType}
                  onChange={(e) => setConfig({ ...config, gridType: e.target.value as 'arithmetic' | 'geometric' })}
                  disabled={isRunning}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="arithmetic">等差网格</option>
                  <option value="geometric">等比网格</option>
                </select>
              </div>
            </div>

            {/* 投资金额 */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                <DollarSign className="w-3 h-3 inline mr-1" />投资金额 (USDT)
              </label>
              <input
                type="number"
                value={config.totalInvestment}
                onChange={(e) => setConfig({ ...config, totalInvestment: Number(e.target.value) })}
                disabled={isRunning}
                className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>

            {/* 止盈止损 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                  <AlertCircle className="w-3 h-3 inline mr-1 text-red-400" />止损 (%)
                </label>
                <input
                  type="number"
                  value={config.stopLoss}
                  onChange={(e) => setConfig({ ...config, stopLoss: Number(e.target.value) })}
                  disabled={isRunning}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                  <CheckCircle className="w-3 h-3 inline mr-1 text-green-400" />止盈 (%)
                </label>
                <input
                  type="number"
                  value={config.takeProfit}
                  onChange={(e) => setConfig({ ...config, takeProfit: Number(e.target.value) })}
                  disabled={isRunning}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* 自动重启 */}
            <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
              <div>
                <div className="text-sm text-gray-900 dark:text-white">自动重启</div>
                <div className="text-xs text-gray-500 dark:text-slate-400">止盈后自动开启新网格</div>
              </div>
              <button
                onClick={() => setConfig({ ...config, autoRestart: !config.autoRestart })}
                disabled={isRunning}
                className={`w-12 h-6 rounded-full transition-all ${
                  config.autoRestart ? 'bg-blue-600' : 'bg-slate-700'
                } disabled:opacity-50`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  config.autoRestart ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* 预估信息 */}
            <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg space-y-2">
              <div className="text-sm text-slate-300 font-medium">网格预估</div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">网格间距</span>
                <span className="text-white">${gridSpacing}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">单格收益率</span>
                <span className="text-green-400">{expectedProfit}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">每格投资</span>
                <span className="text-white">${(config.totalInvestment / config.gridCount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">价格波动区间</span>
                <span className="text-white">
                  {(((config.upperPrice - config.lowerPrice) / config.lowerPrice) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 订单面板 */}
        {activeTab === 'orders' && (
          <div className="space-y-2">
            {orders.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <div>启动网格后显示订单</div>
              </div>
            ) : (
              <>
                {/* 网格可视化 */}
                <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg mb-4">
                  <div className="text-xs text-gray-500 dark:text-slate-400 mb-2">网格分布</div>
                  <div className="relative h-32 flex items-end">
                    {orders.slice(0, 20).map((order) => {
                      const heightPercent = ((order.price - config.lowerPrice) / (config.upperPrice - config.lowerPrice)) * 100;
                      return (
                        <div
                          key={order.id}
                          className="flex-1 mx-0.5 relative group"
                          style={{ height: `${heightPercent}%` }}
                        >
                          <div className={`absolute bottom-0 left-0 right-0 h-full rounded-t ${
                            order.status === 'filled' 
                              ? order.type === 'buy' ? 'bg-green-500/60' : 'bg-red-500/60'
                              : order.status === 'pending'
                                ? 'bg-blue-500/40'
                                : 'bg-slate-600/40'
                          }`} />
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-xs text-white bg-slate-900 px-1 py-0.5 rounded whitespace-nowrap z-10">
                            ${order.price.toFixed(0)}
                          </div>
                        </div>
                      );
                    })}
                    {/* 当前价格线 */}
                    <div 
                      className="absolute left-0 right-0 h-0.5 bg-yellow-500"
                      style={{ 
                        bottom: `${((currentPrice - config.lowerPrice) / (config.upperPrice - config.lowerPrice)) * 100}%` 
                      }}
                    >
                      <span className="absolute right-0 -top-4 text-xs text-yellow-400">${currentPrice.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                {/* 订单列表 */}
                {orders.map((order) => (
                  <div key={order.id} className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        order.type === 'buy' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                      }`}>
                        {order.type === 'buy' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white font-medium">
                          {order.type === 'buy' ? '买入' : '卖出'} @ ${order.price.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          数量: {order.quantity.toFixed(4)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        order.status === 'filled' 
                          ? 'bg-green-600/20 text-green-400'
                          : order.status === 'pending'
                            ? 'bg-yellow-600/20 text-yellow-400'
                            : 'bg-slate-600/20 text-slate-400'
                      }`}>
                        {order.status === 'filled' ? '已成交' : order.status === 'pending' ? '等待中' : '已取消'}
                      </span>
                      {order.pnl !== undefined && (
                        <div className={`text-xs mt-1 ${order.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {order.pnl >= 0 ? '+' : ''}{order.pnl.toFixed(2)} USDT
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* 统计面板 */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {/* 总收益 */}
            <div className={`p-4 rounded-xl ${stats.totalProfit >= 0 ? 'bg-green-900/20 border border-green-600/30' : 'bg-red-900/20 border border-red-600/30'}`}>
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">网格总收益</div>
              <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(2)} USDT
              </div>
            </div>

            {/* 统计数据 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">成交次数</div>
                <div className="text-lg font-bold text-white">{stats.totalTrades}</div>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">网格利润</div>
                <div className={`text-lg font-bold ${stats.gridProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.gridProfit >= 0 ? '+' : ''}{stats.gridProfit.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">浮动盈亏</div>
                <div className={`text-lg font-bold ${stats.floatingPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.floatingPnl >= 0 ? '+' : ''}{stats.floatingPnl.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">持仓数量</div>
                <div className="text-lg font-bold text-white">{stats.currentPosition.toFixed(4)}</div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={() => setStats({ totalProfit: 0, totalTrades: 0, gridProfit: 0, floatingPnl: 0, currentPosition: 0, avgCost: 0 })}
                className="flex-1 flex items-center justify-center gap-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重置统计
              </button>
              <button
                onClick={() => { setOrders([]); stopGrid(); }}
                className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded-lg transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清除订单
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
