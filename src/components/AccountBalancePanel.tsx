/**
 * 账户余额面板
 * 显示交易所账户余额和持仓信息
 */

import { useState, useEffect } from 'react';
import { 
  Wallet, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  Settings
} from 'lucide-react';

interface AssetBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdtValue: number;
}

interface AccountBalancePanelProps {
  isConfigured: boolean;
  onOpenSettings: () => void;
}

export default function AccountBalancePanel({ isConfigured, onOpenSettings }: AccountBalancePanelProps) {
  const [balances, setBalances] = useState<AssetBalance[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [pnl24h, setPnl24h] = useState({ value: 0, percent: 0 });

  // 模拟获取余额数据
  const fetchBalances = async () => {
    if (!isConfigured) return;
    
    setLoading(true);
    
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 模拟数据
    const mockBalances: AssetBalance[] = [
      { asset: 'USDT', free: 5234.56, locked: 500, total: 5734.56, usdtValue: 5734.56 },
      { asset: 'BTC', free: 0.1523, locked: 0.05, total: 0.2023, usdtValue: 8523.45 },
      { asset: 'ETH', free: 2.345, locked: 0.5, total: 2.845, usdtValue: 5234.23 },
      { asset: 'BNB', free: 15.234, locked: 2, total: 17.234, usdtValue: 4523.12 },
      { asset: 'SOL', free: 45.23, locked: 10, total: 55.23, usdtValue: 3245.67 },
    ];
    
    setBalances(mockBalances);
    setTotalValue(mockBalances.reduce((sum, b) => sum + b.usdtValue, 0));
    setLastUpdate(new Date());
    setPnl24h({ value: 234.56, percent: 2.34 });
    setLoading(false);
  };

  useEffect(() => {
    if (isConfigured) {
      fetchBalances();
    }
  }, [isConfigured]);

  if (!isConfigured) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-gray-200 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
          <Wallet className="w-8 h-8 text-gray-400 dark:text-slate-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">未配置交易所</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          请先配置交易所API以查看账户余额
        </p>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
        >
          <Settings className="w-4 h-4" />
          配置交易所
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-blue-400" />
          <span className="font-medium text-gray-900 dark:text-white">账户余额</span>
        </div>
        <button
          onClick={fetchBalances}
          disabled={loading}
          className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 总资产 */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-b border-gray-200 dark:border-slate-700/50">
        <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">总资产估值 (USDT)</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`flex items-center gap-1 text-sm ${pnl24h.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {pnl24h.value >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {pnl24h.value >= 0 ? '+' : ''}{pnl24h.value.toFixed(2)} ({pnl24h.percent >= 0 ? '+' : ''}{pnl24h.percent.toFixed(2)}%) 24h
        </div>
      </div>

      {/* 资产列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-slate-700/50">
            {balances.map((balance) => (
              <div key={balance.asset} className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-slate-700/30 transition-all">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-400 dark:from-slate-600 to-gray-500 dark:to-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-white">
                      {balance.asset.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{balance.asset}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        可用: {balance.free.toFixed(balance.asset === 'USDT' ? 2 : 6)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {balance.total.toFixed(balance.asset === 'USDT' ? 2 : 6)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      ≈ ${balance.usdtValue.toFixed(2)}
                    </div>
                  </div>
                </div>
                {balance.locked > 0 && (
                  <div className="flex items-center gap-1 text-xs text-amber-500 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    冻结: {balance.locked.toFixed(balance.asset === 'USDT' ? 2 : 6)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部信息 */}
      {lastUpdate && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-slate-700/50 text-xs text-gray-500 dark:text-slate-500 text-center">
          最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}
        </div>
      )}
    </div>
  );
}
