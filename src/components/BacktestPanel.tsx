/**
 * 策略回测面板
 * 支持历史数据回测、绩效统计、收益曲线
 */

import { useState, useCallback } from 'react';
import { 
  Play, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
  AlertTriangle
} from 'lucide-react';

interface BacktestResult {
  // 基础统计
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // 收益统计
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  
  // 风险指标
  sharpeRatio: number;
  sortinoRatio: number;
  profitFactor: number;
  
  // 交易统计
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgHoldingPeriod: number;
  
  // 时间序列
  equityCurve: { time: number; value: number }[];
  trades: {
    time: number;
    type: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    pnl: number;
    reason: string;
  }[];
}

interface BacktestConfig {
  symbol: string;
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  useTrailingStop: boolean;
  trailingStopPercent: number;
}

const STRATEGIES = [
  { value: 'ema_cross', label: 'EMA交叉策略', desc: 'EMA12/EMA26金叉死叉' },
  { value: 'rsi_oversold', label: 'RSI超买超卖', desc: 'RSI<30买入, RSI>70卖出' },
  { value: 'macd_signal', label: 'MACD信号', desc: 'MACD金叉死叉信号' },
  { value: 'bollinger_bounce', label: '布林带突破', desc: '价格触及上下轨反弹' },
  { value: 'kdj_cross', label: 'KDJ交叉', desc: 'KDJ金叉死叉信号' },
  { value: 'combined', label: '多指标组合', desc: '综合多个指标信号' },
];

interface BacktestPanelProps {
  symbol: string;
  onRunBacktest?: (config: BacktestConfig) => Promise<BacktestResult | null>;
}

export default function BacktestPanel({ symbol, onRunBacktest }: BacktestPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'result' | 'trades'>('config');
  
  const [config, setConfig] = useState<BacktestConfig>({
    symbol,
    strategy: 'ema_cross',
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 10000,
    positionSize: 10,
    stopLoss: 2,
    takeProfit: 4,
    useTrailingStop: false,
    trailingStopPercent: 1.5,
  });

  const runBacktest = useCallback(async () => {
    setIsRunning(true);
    setActiveTab('result');
    
    try {
      // 模拟回测或调用后端API
      if (onRunBacktest) {
        const res = await onRunBacktest(config);
        setResult(res);
      } else {
        // 模拟回测结果
        await new Promise(resolve => setTimeout(resolve, 2000));
        setResult(generateMockResult());
      }
    } catch (error) {
      console.error('回测失败:', error);
    } finally {
      setIsRunning(false);
    }
  }, [config, onRunBacktest]);

  const generateMockResult = (): BacktestResult => {
    const totalTrades = Math.floor(Math.random() * 50) + 30;
    const winningTrades = Math.floor(totalTrades * (0.4 + Math.random() * 0.3));
    const losingTrades = totalTrades - winningTrades;
    const avgWin = 150 + Math.random() * 200;
    const avgLoss = 80 + Math.random() * 100;
    const totalReturn = winningTrades * avgWin - losingTrades * avgLoss;
    
    // 生成权益曲线
    const equityCurve: { time: number; value: number }[] = [];
    let equity = config.initialCapital;
    const startTime = new Date(config.startDate).getTime();
    const endTime = new Date(config.endDate).getTime();
    const step = (endTime - startTime) / 100;
    
    for (let i = 0; i <= 100; i++) {
      equityCurve.push({
        time: startTime + i * step,
        value: equity,
      });
      equity += (Math.random() - 0.45) * (equity * 0.02);
    }
    
    // 生成交易记录
    const trades: BacktestResult['trades'] = [];
    for (let i = 0; i < totalTrades; i++) {
      const isWin = i < winningTrades;
      trades.push({
        time: startTime + Math.random() * (endTime - startTime),
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        price: 40000 + Math.random() * 10000,
        quantity: 0.01 + Math.random() * 0.1,
        pnl: isWin ? avgWin * (0.5 + Math.random()) : -avgLoss * (0.5 + Math.random()),
        reason: STRATEGIES.find(s => s.value === config.strategy)?.label || '未知策略',
      });
    }
    trades.sort((a, b) => a.time - b.time);
    
    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: (winningTrades / totalTrades) * 100,
      totalReturn,
      totalReturnPercent: (totalReturn / config.initialCapital) * 100,
      maxDrawdown: Math.abs(totalReturn * 0.3),
      maxDrawdownPercent: Math.abs((totalReturn * 0.3) / config.initialCapital) * 100,
      sharpeRatio: 0.8 + Math.random() * 1.5,
      sortinoRatio: 1.0 + Math.random() * 2,
      profitFactor: winningTrades * avgWin / (losingTrades * avgLoss),
      avgWin,
      avgLoss,
      largestWin: avgWin * 2.5,
      largestLoss: avgLoss * 2,
      avgHoldingPeriod: 4 + Math.random() * 20,
      equityCurve,
      trades,
    };
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* 标签页 */}
      <div className="flex border-b border-slate-700/50">
        {[
          { key: 'config', label: '配置', icon: Target },
          { key: 'result', label: '结果', icon: BarChart2 },
          { key: 'trades', label: '交易记录', icon: Clock },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${
              activeTab === key
                ? 'text-blue-400 bg-blue-600/10 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
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
            {/* 策略选择 */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">交易策略</label>
              <select
                value={config.strategy}
                onChange={(e) => setConfig({ ...config, strategy: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {STRATEGIES.map(s => (
                  <option key={s.value} value={s.value}>{s.label} - {s.desc}</option>
                ))}
              </select>
            </div>

            {/* 时间范围 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  <Calendar className="w-3 h-3 inline mr-1" />开始日期
                </label>
                <input
                  type="date"
                  value={config.startDate}
                  onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  <Calendar className="w-3 h-3 inline mr-1" />结束日期
                </label>
                <input
                  type="date"
                  value={config.endDate}
                  onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* 资金配置 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">初始资金 (USDT)</label>
                <input
                  type="number"
                  value={config.initialCapital}
                  onChange={(e) => setConfig({ ...config, initialCapital: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">仓位比例 (%)</label>
                <input
                  type="number"
                  value={config.positionSize}
                  onChange={(e) => setConfig({ ...config, positionSize: Number(e.target.value) })}
                  min={1}
                  max={100}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* 风控参数 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  <AlertTriangle className="w-3 h-3 inline mr-1 text-red-400" />止损 (%)
                </label>
                <input
                  type="number"
                  value={config.stopLoss}
                  onChange={(e) => setConfig({ ...config, stopLoss: Number(e.target.value) })}
                  step={0.5}
                  min={0.5}
                  max={20}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  <Target className="w-3 h-3 inline mr-1 text-green-400" />止盈 (%)
                </label>
                <input
                  type="number"
                  value={config.takeProfit}
                  onChange={(e) => setConfig({ ...config, takeProfit: Number(e.target.value) })}
                  step={0.5}
                  min={1}
                  max={50}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* 追踪止损 */}
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <div>
                <div className="text-sm text-white">追踪止损</div>
                <div className="text-xs text-slate-400">利润锁定，动态调整止损位</div>
              </div>
              <button
                onClick={() => setConfig({ ...config, useTrailingStop: !config.useTrailingStop })}
                className={`w-12 h-6 rounded-full transition-all ${
                  config.useTrailingStop ? 'bg-blue-600' : 'bg-slate-700'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  config.useTrailingStop ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* 运行按钮 */}
            <button
              onClick={runBacktest}
              disabled={isRunning}
              className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                isRunning
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  回测运行中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  开始回测
                </>
              )}
            </button>
          </div>
        )}

        {/* 结果面板 */}
        {activeTab === 'result' && (
          <div className="space-y-4">
            {!result && !isRunning && (
              <div className="py-12 text-center text-slate-500">
                <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <div>请先配置并运行回测</div>
              </div>
            )}

            {isRunning && (
              <div className="py-12 text-center">
                <div className="w-12 h-12 mx-auto mb-3 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-slate-400">正在进行历史回测...</div>
                <div className="text-xs text-slate-500 mt-1">分析 {config.startDate} 至 {config.endDate} 的数据</div>
              </div>
            )}

            {result && !isRunning && (
              <>
                {/* 总收益卡片 */}
                <div className={`p-4 rounded-xl ${result.totalReturn >= 0 ? 'bg-green-900/20 border border-green-600/30' : 'bg-red-900/20 border border-red-600/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">总收益</span>
                    {result.totalReturn >= 0 ? (
                      <ArrowUpRight className="w-5 h-5 text-green-400" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className={`text-2xl font-bold ${result.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)} USDT
                  </div>
                  <div className={`text-sm ${result.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {result.totalReturnPercent >= 0 ? '+' : ''}{result.totalReturnPercent.toFixed(2)}%
                  </div>
                </div>

                {/* 关键指标 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-400 mb-1">胜率</div>
                    <div className="text-lg font-bold text-white">{result.winRate.toFixed(1)}%</div>
                    <div className="text-xs text-slate-500">{result.winningTrades}胜 / {result.losingTrades}负</div>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-400 mb-1">最大回撤</div>
                    <div className="text-lg font-bold text-red-400">-{result.maxDrawdownPercent.toFixed(1)}%</div>
                    <div className="text-xs text-slate-500">-{result.maxDrawdown.toFixed(2)} USDT</div>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-400 mb-1">夏普比率</div>
                    <div className={`text-lg font-bold ${result.sharpeRatio >= 1 ? 'text-green-400' : result.sharpeRatio >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {result.sharpeRatio.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">{result.sharpeRatio >= 1 ? '优秀' : result.sharpeRatio >= 0.5 ? '良好' : '较差'}</div>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-400 mb-1">盈亏比</div>
                    <div className={`text-lg font-bold ${result.profitFactor >= 1.5 ? 'text-green-400' : result.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {result.profitFactor.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">平均盈利/平均亏损</div>
                  </div>
                </div>

                {/* 详细统计 */}
                <div className="p-3 bg-slate-800/50 rounded-lg space-y-2">
                  <div className="text-sm text-slate-300 font-medium mb-2">交易统计</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">总交易次数</span>
                    <span className="text-white">{result.totalTrades}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">平均盈利</span>
                    <span className="text-green-400">+{result.avgWin.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">平均亏损</span>
                    <span className="text-red-400">-{result.avgLoss.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">最大单笔盈利</span>
                    <span className="text-green-400">+{result.largestWin.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">最大单笔亏损</span>
                    <span className="text-red-400">-{result.largestLoss.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">平均持仓时间</span>
                    <span className="text-white">{result.avgHoldingPeriod.toFixed(1)} 小时</span>
                  </div>
                </div>

                {/* 简易权益曲线 */}
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-sm text-slate-300 font-medium mb-2">权益曲线</div>
                  <div className="h-24 flex items-end gap-0.5">
                    {result.equityCurve.slice(0, 50).map((point, i) => {
                      const minVal = Math.min(...result.equityCurve.map(p => p.value));
                      const maxVal = Math.max(...result.equityCurve.map(p => p.value));
                      const height = ((point.value - minVal) / (maxVal - minVal)) * 100;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-t ${point.value >= config.initialCapital ? 'bg-green-500/60' : 'bg-red-500/60'}`}
                          style={{ height: `${Math.max(5, height)}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-slate-500">
                    <span>{config.startDate}</span>
                    <span>{config.endDate}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 交易记录面板 */}
        {activeTab === 'trades' && (
          <div className="space-y-2">
            {!result && (
              <div className="py-12 text-center text-slate-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <div>请先运行回测查看交易记录</div>
              </div>
            )}

            {result && result.trades.map((trade, i) => (
              <div key={i} className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    trade.type === 'BUY' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                  }`}>
                    {trade.type === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">
                      {trade.type === 'BUY' ? '买入' : '卖出'} {trade.quantity.toFixed(4)}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(trade.time).toLocaleDateString('zh-CN')} · ${trade.price.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className={`text-right ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  <div className="text-sm font-medium">
                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                  </div>
                  <div className="text-xs opacity-70">USDT</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
