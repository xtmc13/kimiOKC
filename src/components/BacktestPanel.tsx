/**
 * XTMC 回测面板组件
 */

import { useState } from 'react';
import { Play, BarChart3, TrendingUp, Clock, AlertTriangle } from 'lucide-react';

interface BacktestPanelProps {
  symbol: string;
}

export default function BacktestPanel({ symbol }: BacktestPanelProps) {
  const [strategy, setStrategy] = useState('ema_cross');
  const [timeframe, setTimeframe] = useState('1h');
  const [period, setPeriod] = useState('30d');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const strategies = [
    { id: 'ema_cross', name: 'EMA交叉策略' },
    { id: 'rsi_reversal', name: 'RSI反转策略' },
    { id: 'bb_breakout', name: '布林带突破策略' },
    { id: 'macd_divergence', name: 'MACD背离策略' },
    { id: 'grid_trading', name: '网格交易策略' },
    { id: 'dca', name: '定投策略' },
  ];

  const handleRun = async () => {
    setIsRunning(true);
    // 模拟回测
    await new Promise(r => setTimeout(r, 2000));
    setResult({
      totalReturn: 12.5,
      winRate: 62.3,
      maxDrawdown: -8.2,
      totalTrades: 47,
      profitTrades: 29,
      lossTrades: 18,
      sharpeRatio: 1.85,
      profitFactor: 2.1,
      avgProfit: 1.2,
      avgLoss: -0.8,
    });
    setIsRunning(false);
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      {/* 配置 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">策略</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
          >
            {strategies.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">周期</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
          >
            {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">时段</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
          >
            <option value="7d">7天</option>
            <option value="30d">30天</option>
            <option value="90d">90天</option>
            <option value="180d">180天</option>
            <option value="365d">1年</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={isRunning}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors mb-4"
      >
        {isRunning ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            回测中...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            运行回测 ({symbol})
          </>
        )}
      </button>

      {/* 结果 */}
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <StatCard icon={TrendingUp} label="总收益率" value={`${result.totalReturn}%`} color="green" />
            <StatCard icon={BarChart3} label="胜率" value={`${result.winRate}%`} color="blue" />
            <StatCard icon={AlertTriangle} label="最大回撤" value={`${result.maxDrawdown}%`} color="red" />
            <StatCard icon={Clock} label="总交易" value={result.totalTrades} color="purple" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-2">交易统计</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">盈利交易</span><span className="text-green-500">{result.profitTrades}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">亏损交易</span><span className="text-red-500">{result.lossTrades}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">平均盈利</span><span className="text-green-500">+{result.avgProfit}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">平均亏损</span><span className="text-red-500">{result.avgLoss}%</span></div>
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-2">风险指标</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">夏普比率</span><span className="text-gray-900 dark:text-white">{result.sharpeRatio}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">盈亏比</span><span className="text-gray-900 dark:text-white">{result.profitFactor}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">最大回撤</span><span className="text-red-500">{result.maxDrawdown}%</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!result && !isRunning && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500">
          <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">选择策略并运行回测</p>
          <p className="text-xs mt-1">使用历史数据验证策略表现</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    green: 'text-green-500 bg-green-50 dark:bg-green-900/20',
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
    red: 'text-red-500 bg-red-50 dark:bg-red-900/20',
    purple: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
  };

  return (
    <div className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg text-center">
      <div className={`w-8 h-8 mx-auto mb-1.5 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xs text-gray-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{value}</div>
    </div>
  );
}
