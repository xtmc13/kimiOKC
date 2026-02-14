/**
 * XTMC 账户余额面板
 * 显示账户资产概览、持仓价值、盈亏统计
 */

import { Wallet, TrendingUp, TrendingDown, DollarSign, PieChart, Shield } from 'lucide-react';

interface AccountBalancePanelProps {
  isApiConfigured: boolean;
  onOpenSettings?: () => void;
  theme?: string;
}

// 模拟账户数据 (API配置后替换为真实数据)
const MOCK_BALANCE = {
  totalEquity: 27261.03,
  availableBalance: 10000.0,
  unrealizedPnl: 1523.47,
  marginUsed: 15737.56,
  todayPnl: 342.18,
  todayPnlPercent: 1.27,
  positions: [
    { symbol: 'BTCUSDT', size: 0.15, entryPrice: 41200, pnl: 1280.5, pnlPercent: 2.07 },
    { symbol: 'ETHUSDT', size: 2.5, entryPrice: 2450, pnl: 242.97, pnlPercent: 3.96 },
  ],
};

export default function AccountBalancePanel({ isApiConfigured, onOpenSettings, theme }: AccountBalancePanelProps) {
  const isDark = theme !== 'light';

  if (!isApiConfigured) {
    return (
      <div className={`rounded-xl border p-6 text-center ${
        isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-gray-200'
      }`}>
        <Wallet className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-gray-300'}`} />
        <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>未配置交易所API</h3>
        <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          配置交易所API密钥后可查看账户资产
        </p>
        <button
          onClick={onOpenSettings}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          前往配置
        </button>
      </div>
    );
  }

  const data = MOCK_BALANCE;

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-gray-200'
    }`}>
      {/* 总资产 */}
      <div className={`p-4 border-b ${
        isDark ? 'border-slate-700/50 bg-gradient-to-r from-blue-900/20 to-purple-900/20' : 'border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>账户总资产</span>
          <Shield className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
        </div>
        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          ${data.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="flex items-center gap-1 mt-1">
          {data.todayPnl >= 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          )}
          <span className={`text-sm font-medium ${data.todayPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {data.todayPnl >= 0 ? '+' : ''}${data.todayPnl.toFixed(2)} ({data.todayPnlPercent >= 0 ? '+' : ''}{data.todayPnlPercent.toFixed(2)}%)
          </span>
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>今日</span>
        </div>
      </div>

      {/* 资金明细 */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className={`w-3.5 h-3.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>可用余额</span>
            </div>
            <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              ${data.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <PieChart className={`w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
              <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>占用保证金</span>
            </div>
            <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              ${data.marginUsed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* 未实现盈亏 */}
        <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>未实现盈亏</span>
            <span className={`text-sm font-semibold ${data.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {data.unrealizedPnl >= 0 ? '+' : ''}${data.unrealizedPnl.toFixed(2)}
            </span>
          </div>
        </div>

        {/* 持仓概览 */}
        {data.positions.length > 0 && (
          <div>
            <div className={`text-[11px] font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              当前持仓
            </div>
            <div className="space-y-2">
              {data.positions.map((pos) => (
                <div key={pos.symbol} className={`flex items-center justify-between p-2 rounded-lg ${
                  isDark ? 'bg-slate-700/20' : 'bg-gray-50'
                }`}>
                  <div>
                    <div className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {pos.symbol}
                    </div>
                    <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      {pos.size} @ ${pos.entryPrice.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-semibold ${pos.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                    </div>
                    <div className={`text-[10px] ${pos.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
