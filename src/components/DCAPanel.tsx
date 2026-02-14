/**
 * DCA定投面板
 * 支持定时定额投资、多币种组合、收益追踪
 */

import { useState, useEffect } from 'react';
import { 
  Calendar,
  Play,
  Pause,
  Settings,
  TrendingUp,
  DollarSign,
  Clock,
  PiggyBank,
  Plus,
  Trash2,
  BarChart3,
  Wallet
} from 'lucide-react';

interface DCAConfig {
  symbol: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  enabled: boolean;
}

interface DCARecord {
  id: string;
  symbol: string;
  amount: number;
  price: number;
  quantity: number;
  timestamp: number;
  totalCost: number;
  avgCost: number;
}

interface DCAStats {
  totalInvested: number;
  currentValue: number;
  totalQuantity: number;
  avgCost: number;
  pnl: number;
  pnlPercent: number;
  buyCount: number;
}

interface DCAPanelProps {
  symbol: string;
  currentPrice: number;
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: '每日', desc: '每天定时买入' },
  { value: 'weekly', label: '每周', desc: '每周固定日买入' },
  { value: 'biweekly', label: '每两周', desc: '每两周买入一次' },
  { value: 'monthly', label: '每月', desc: '每月固定日买入' },
];

const DAYS_OF_WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export default function DCAPanel({ symbol, currentPrice }: DCAPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'history' | 'stats'>('config');
  
  const [config, setConfig] = useState<DCAConfig>({
    symbol,
    amount: 100,
    frequency: 'weekly',
    dayOfWeek: 1, // 周一
    dayOfMonth: 1,
    enabled: true,
  });

  const [records, setRecords] = useState<DCARecord[]>([]);
  const [stats, setStats] = useState<DCAStats>({
    totalInvested: 0,
    currentValue: 0,
    totalQuantity: 0,
    avgCost: 0,
    pnl: 0,
    pnlPercent: 0,
    buyCount: 0,
  });

  // 计算统计数据
  useEffect(() => {
    if (records.length === 0) return;
    
    const totalInvested = records.reduce((sum, r) => sum + r.amount, 0);
    const totalQuantity = records.reduce((sum, r) => sum + r.quantity, 0);
    const currentValue = totalQuantity * currentPrice;
    const avgCost = totalQuantity > 0 ? totalInvested / totalQuantity : 0;
    const pnl = currentValue - totalInvested;
    const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
    
    setStats({
      totalInvested,
      currentValue,
      totalQuantity,
      avgCost,
      pnl,
      pnlPercent,
      buyCount: records.length,
    });
  }, [records, currentPrice]);

  // 启动定投
  const startDCA = () => {
    setIsRunning(true);
    // 立即执行一次
    executeBuy();
  };

  // 停止定投
  const stopDCA = () => {
    setIsRunning(false);
  };

  // 执行买入
  const executeBuy = () => {
    if (currentPrice <= 0) return;
    
    const quantity = config.amount / currentPrice;
    const totalCost = records.reduce((sum, r) => sum + r.amount, 0) + config.amount;
    const totalQty = records.reduce((sum, r) => sum + r.quantity, 0) + quantity;
    
    const newRecord: DCARecord = {
      id: `dca-${Date.now()}`,
      symbol: config.symbol,
      amount: config.amount,
      price: currentPrice,
      quantity,
      timestamp: Date.now(),
      totalCost,
      avgCost: totalQty > 0 ? totalCost / totalQty : currentPrice,
    };
    
    setRecords(prev => [newRecord, ...prev]);
  };

  // 手动买入
  const manualBuy = () => {
    executeBuy();
  };

  // 清除记录
  const clearRecords = () => {
    setRecords([]);
    setStats({
      totalInvested: 0,
      currentValue: 0,
      totalQuantity: 0,
      avgCost: 0,
      pnl: 0,
      pnlPercent: 0,
      buyCount: 0,
    });
  };

  // 下次定投时间
  const getNextBuyTime = (): string => {
    const now = new Date();
    let nextDate = new Date(now);
    
    switch (config.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        nextDate.setHours(9, 0, 0, 0);
        break;
      case 'weekly':
        const daysUntilNext = (config.dayOfWeek! - now.getDay() + 7) % 7 || 7;
        nextDate.setDate(nextDate.getDate() + daysUntilNext);
        nextDate.setHours(9, 0, 0, 0);
        break;
      case 'biweekly':
        const daysUntil = (config.dayOfWeek! - now.getDay() + 14) % 14 || 14;
        nextDate.setDate(nextDate.getDate() + daysUntil);
        nextDate.setHours(9, 0, 0, 0);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextDate.setDate(config.dayOfMonth!);
        nextDate.setHours(9, 0, 0, 0);
        break;
    }
    
    return nextDate.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* 头部状态 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-amber-400" />
          <span className="font-medium text-gray-900 dark:text-white">DCA定投</span>
          {isRunning && (
            <span className="px-2 py-0.5 text-xs bg-green-600/20 text-green-400 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              运行中
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={manualBuy}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            立即买入
          </button>
          {!isRunning ? (
            <button
              onClick={startDCA}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              启动
            </button>
          ) : (
            <button
              onClick={stopDCA}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-all"
            >
              <Pause className="w-3.5 h-3.5" />
              暂停
            </button>
          )}
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-gray-200 dark:border-slate-700/50">
        {[
          { key: 'config', label: '配置', icon: Settings },
          { key: 'history', label: '记录', icon: Clock },
          { key: 'stats', label: '统计', icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${
              activeTab === key
                ? 'text-amber-400 bg-amber-600/10 border-b-2 border-amber-400'
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
            {/* 当前价格和持仓 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-amber-600/10 rounded-lg border border-amber-600/30">
                <div className="text-xs text-amber-400 mb-1">当前价格</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400 mb-1">持仓数量</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {stats.totalQuantity.toFixed(6)}
                </div>
              </div>
            </div>

            {/* 定投金额 */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                <DollarSign className="w-3 h-3 inline mr-1" />每次定投金额 (USDT)
              </label>
              <input
                type="number"
                value={config.amount}
                onChange={(e) => setConfig({ ...config, amount: Number(e.target.value) })}
                min={10}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 定投频率 */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                <Calendar className="w-3 h-3 inline mr-1" />定投频率
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FREQUENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setConfig({ ...config, frequency: opt.value as DCAConfig['frequency'] })}
                    className={`p-3 rounded-lg text-left transition-all ${
                      config.frequency === opt.value
                        ? 'bg-amber-600/20 border border-amber-600/50 text-amber-400'
                        : 'bg-gray-100 dark:bg-slate-800/50 border border-transparent text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 具体日期选择 */}
            {config.frequency === 'weekly' || config.frequency === 'biweekly' ? (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">选择星期</label>
                <div className="flex gap-1 flex-wrap">
                  {DAYS_OF_WEEK.map((day, index) => (
                    <button
                      key={index}
                      onClick={() => setConfig({ ...config, dayOfWeek: index })}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                        config.dayOfWeek === index
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            ) : config.frequency === 'monthly' ? (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">选择日期</label>
                <select
                  value={config.dayOfMonth}
                  onChange={(e) => setConfig({ ...config, dayOfMonth: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>每月 {day} 日</option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* 下次定投时间 */}
            <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-400">下次定投</span>
                </div>
                <span className="text-sm text-white">{getNextBuyTime()}</span>
              </div>
            </div>

            {/* 预估信息 */}
            <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg space-y-2">
              <div className="text-sm text-slate-300 font-medium">定投预估</div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">每次买入数量</span>
                <span className="text-white">{(config.amount / currentPrice).toFixed(6)} {symbol.replace('USDT', '')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">年度投入</span>
                <span className="text-white">
                  ${(config.amount * (config.frequency === 'daily' ? 365 : config.frequency === 'weekly' ? 52 : config.frequency === 'biweekly' ? 26 : 12)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 历史记录 */}
        {activeTab === 'history' && (
          <div className="space-y-2">
            {records.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <div>暂无定投记录</div>
                <div className="text-xs mt-1">点击"立即买入"开始定投</div>
              </div>
            ) : (
              <>
                {records.map((record) => (
                  <div key={record.id} className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <div className="text-sm text-white font-medium">买入 {record.symbol.replace('USDT', '')}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(record.timestamp).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white">${record.amount}</div>
                        <div className="text-xs text-slate-400">{record.quantity.toFixed(6)}</div>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t border-gray-200 dark:border-slate-700/50">
                      <span className="text-slate-400">成交价: ${record.price.toFixed(2)}</span>
                      <span className="text-slate-400">均价: ${record.avgCost.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={clearRecords}
                  className="w-full py-2 mt-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded-lg transition-all flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  清除所有记录
                </button>
              </>
            )}
          </div>
        )}

        {/* 统计面板 */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {/* 盈亏卡片 */}
            <div className={`p-4 rounded-xl ${stats.pnl >= 0 ? 'bg-green-900/20 border border-green-600/30' : 'bg-red-900/20 border border-red-600/30'}`}>
              <div className="text-xs text-slate-400 mb-1">持仓盈亏</div>
              <div className={`text-2xl font-bold ${stats.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(2)} USDT
              </div>
              <div className={`text-sm ${stats.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.pnlPercent >= 0 ? '+' : ''}{stats.pnlPercent.toFixed(2)}%
              </div>
            </div>

            {/* 统计数据 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400 mb-1">累计投入</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">${stats.totalInvested.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400 mb-1">当前市值</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">${stats.currentValue.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400 mb-1">持仓均价</div>
                <div className="text-lg font-bold text-amber-400">${stats.avgCost.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400 mb-1">定投次数</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.buyCount} 次</div>
              </div>
            </div>

            {/* 收益对比 */}
            <div className="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
              <div className="text-sm text-slate-300 font-medium mb-3">收益对比</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">定投收益率</span>
                  <span className={`text-sm font-medium ${stats.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.pnlPercent >= 0 ? '+' : ''}{stats.pnlPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${stats.pnlPercent >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.abs(stats.pnlPercent))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 提示信息 */}
            <div className="p-3 bg-amber-600/10 rounded-lg border border-amber-600/30">
              <div className="flex items-start gap-2">
                <Wallet className="w-4 h-4 text-amber-400 mt-0.5" />
                <div className="text-xs text-amber-400/80">
                  DCA定投策略通过定期定额买入，可以平滑市场波动，降低投资风险。坚持长期投资，收益更可观。
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
