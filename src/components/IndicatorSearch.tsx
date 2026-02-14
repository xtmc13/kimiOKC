/**
 * XTMC TradingView风格指标搜索组件
 * 70+指标，7大分类
 */

import { useState, useMemo } from 'react';
import { Search, Star, X, TrendingUp, BarChart3, Activity, Volume2, Waves, Layers, Lightbulb } from 'lucide-react';

export interface Indicator {
  id: string;
  name: string;
  nameZh: string;
  category: string;
  description: string;
}

interface IndicatorSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (indicator: Indicator) => void;
}

const CATEGORIES = [
  { key: 'all', label: '全部', icon: Layers },
  { key: 'trend', label: '趋势', icon: TrendingUp },
  { key: 'momentum', label: '动量', icon: Activity },
  { key: 'volatility', label: '波动率', icon: Waves },
  { key: 'volume', label: '成交量', icon: Volume2 },
  { key: 'oscillator', label: '震荡指标', icon: BarChart3 },
  { key: 'overlay', label: '叠加指标', icon: Layers },
  { key: 'strategy', label: '策略', icon: Lightbulb },
];

const INDICATORS: Indicator[] = [
  // 趋势指标
  { id: 'ema', name: 'EMA', nameZh: '指数移动平均', category: 'trend', description: '指数加权移动平均线' },
  { id: 'sma', name: 'SMA', nameZh: '简单移动平均', category: 'trend', description: '简单算术移动平均' },
  { id: 'wma', name: 'WMA', nameZh: '加权移动平均', category: 'trend', description: '线性加权移动平均' },
  { id: 'dema', name: 'DEMA', nameZh: '双重EMA', category: 'trend', description: '双重指数移动平均' },
  { id: 'tema', name: 'TEMA', nameZh: '三重EMA', category: 'trend', description: '三重指数移动平均' },
  { id: 'vwma', name: 'VWMA', nameZh: '成交量加权MA', category: 'trend', description: '成交量加权移动平均' },
  { id: 'hull_ma', name: 'Hull MA', nameZh: 'Hull移动平均', category: 'trend', description: 'Hull移动平均线' },
  { id: 'ichimoku', name: 'Ichimoku Cloud', nameZh: '一目均衡表', category: 'trend', description: '一目均衡表云图' },
  { id: 'supertrend', name: 'Supertrend', nameZh: '超级趋势', category: 'trend', description: '超级趋势指标' },
  { id: 'parabolic_sar', name: 'Parabolic SAR', nameZh: '抛物线SAR', category: 'trend', description: '抛物线停损和反转指标' },
  { id: 'adx', name: 'ADX', nameZh: '平均趋向指数', category: 'trend', description: '平均方向运动指标' },
  { id: 'aroon', name: 'Aroon', nameZh: 'Aroon指标', category: 'trend', description: 'Aroon上下线' },
  // 动量指标
  { id: 'macd', name: 'MACD', nameZh: 'MACD', category: 'momentum', description: '移动平均收敛散度' },
  { id: 'rsi', name: 'RSI', nameZh: '相对强弱指标', category: 'momentum', description: '相对强弱指数' },
  { id: 'stoch_rsi', name: 'Stochastic RSI', nameZh: '随机RSI', category: 'momentum', description: '随机相对强弱指标' },
  { id: 'cci', name: 'CCI', nameZh: '顺势指标', category: 'momentum', description: '商品通道指数' },
  { id: 'williams_r', name: 'Williams %R', nameZh: '威廉指标', category: 'momentum', description: '威廉姆斯百分比范围' },
  { id: 'momentum', name: 'Momentum', nameZh: '动量指标', category: 'momentum', description: '动量震荡指标' },
  { id: 'roc', name: 'ROC', nameZh: '变化率', category: 'momentum', description: '价格变化率' },
  { id: 'tsi', name: 'TSI', nameZh: '真实强度指数', category: 'momentum', description: '真实强度指标' },
  { id: 'ultimate_osc', name: 'Ultimate Oscillator', nameZh: '终极振荡器', category: 'momentum', description: '多周期加权振荡器' },
  { id: 'awesome_osc', name: 'Awesome Oscillator', nameZh: 'AO振荡器', category: 'momentum', description: 'Bill Williams AO' },
  // 波动率
  { id: 'bb', name: 'Bollinger Bands', nameZh: '布林带', category: 'volatility', description: '布林带通道' },
  { id: 'keltner', name: 'Keltner Channel', nameZh: '肯特纳通道', category: 'volatility', description: '肯特纳通道' },
  { id: 'donchian', name: 'Donchian Channel', nameZh: '唐奇安通道', category: 'volatility', description: '唐奇安通道' },
  { id: 'atr', name: 'ATR', nameZh: '平均真实波幅', category: 'volatility', description: '平均真实波动范围' },
  { id: 'std_dev', name: 'Standard Deviation', nameZh: '标准差', category: 'volatility', description: '价格标准差' },
  { id: 'historical_vol', name: 'Historical Volatility', nameZh: '历史波动率', category: 'volatility', description: '历史波动率' },
  { id: 'bb_width', name: 'BB Width', nameZh: '布林带宽', category: 'volatility', description: '布林带宽度指标' },
  { id: 'bb_pct', name: 'BB %B', nameZh: '布林带%B', category: 'volatility', description: '布林带百分比B' },
  // 成交量
  { id: 'volume', name: 'Volume', nameZh: '成交量', category: 'volume', description: '基础成交量柱状图' },
  { id: 'obv', name: 'OBV', nameZh: '能量潮', category: 'volume', description: '能量潮指标' },
  { id: 'vwap', name: 'VWAP', nameZh: '量价平均价', category: 'volume', description: '成交量加权平均价' },
  { id: 'ad', name: 'A/D', nameZh: '累积/派发线', category: 'volume', description: '累积/分配线' },
  { id: 'cmf', name: 'CMF', nameZh: '钱德动量流', category: 'volume', description: 'Chaikin资金流' },
  { id: 'mfi', name: 'MFI', nameZh: '资金流指数', category: 'volume', description: '资金流量指数' },
  { id: 'efi', name: 'EFI', nameZh: '力量指数', category: 'volume', description: 'Elder力量指数' },
  { id: 'volume_profile', name: 'Volume Profile', nameZh: '成交量分布', category: 'volume', description: '价格区间成交量分布' },
  { id: 'klinger', name: 'Klinger Oscillator', nameZh: 'Klinger振荡器', category: 'volume', description: 'Klinger成交量振荡器' },
  // 震荡指标
  { id: 'kdj', name: 'KDJ', nameZh: 'KDJ随机指标', category: 'oscillator', description: 'KDJ随机振荡指标' },
  { id: 'stochastic', name: 'Stochastic', nameZh: '随机振荡器', category: 'oscillator', description: 'KD随机振荡指标' },
  { id: 'dmi', name: 'DMI', nameZh: '趋向指标', category: 'oscillator', description: '趋向运动指数' },
  { id: 'ao', name: 'AO', nameZh: 'AO指标', category: 'oscillator', description: 'Awesome Oscillator' },
  { id: 'ac', name: 'AC', nameZh: 'AC指标', category: 'oscillator', description: 'Accelerator Oscillator' },
  { id: 'ppo', name: 'PPO', nameZh: '百分比价格振荡器', category: 'oscillator', description: '百分比价格振荡器' },
  { id: 'dpo', name: 'DPO', nameZh: '去趋势价格振荡器', category: 'oscillator', description: '去趋势价格振荡器' },
  { id: 'coppock', name: 'Coppock Curve', nameZh: 'Coppock曲线', category: 'oscillator', description: 'Coppock指标' },
  // 叠加指标
  { id: 'pivot', name: 'Pivot Points', nameZh: '枢轴点', category: 'overlay', description: '标准枢轴点' },
  { id: 'fibonacci', name: 'Fibonacci Retracement', nameZh: '斐波那契回撤', category: 'overlay', description: '斐波那契回撤水平' },
  { id: 'envelope', name: 'Moving Average Envelope', nameZh: 'MA包络线', category: 'overlay', description: '移动平均包络线' },
  { id: 'chandelier', name: 'Chandelier Exit', nameZh: '吊灯止损', category: 'overlay', description: '吊灯退出指标' },
  { id: 'zigzag', name: 'ZigZag', nameZh: 'ZigZag', category: 'overlay', description: 'ZigZag趋势线' },
  { id: 'linear_reg', name: 'Linear Regression', nameZh: '线性回归', category: 'overlay', description: '线性回归通道' },
  { id: 'price_channel', name: 'Price Channel', nameZh: '价格通道', category: 'overlay', description: '价格通道指标' },
  // 策略
  { id: 'ema_cross', name: 'EMA Crossover', nameZh: 'EMA交叉策略', category: 'strategy', description: 'EMA金叉死叉策略' },
  { id: 'rsi_strategy', name: 'RSI Strategy', nameZh: 'RSI策略', category: 'strategy', description: 'RSI超买超卖策略' },
  { id: 'bb_strategy', name: 'BB Strategy', nameZh: '布林带策略', category: 'strategy', description: '布林带突破策略' },
  { id: 'macd_strategy', name: 'MACD Strategy', nameZh: 'MACD策略', category: 'strategy', description: 'MACD信号策略' },
  { id: 'supertrend_strategy', name: 'Supertrend Strategy', nameZh: '超级趋势策略', category: 'strategy', description: '超级趋势跟踪策略' },
  { id: 'ichimoku_strategy', name: 'Ichimoku Strategy', nameZh: '一目均衡策略', category: 'strategy', description: '一目均衡表交易策略' },
  { id: 'multi_ma', name: 'Multi MA Strategy', nameZh: '多均线策略', category: 'strategy', description: '多重均线组合策略' },
  { id: 'volume_breakout', name: 'Volume Breakout', nameZh: '量价突破策略', category: 'strategy', description: '放量突破策略' },
  { id: 'mean_reversion', name: 'Mean Reversion', nameZh: '均值回归策略', category: 'strategy', description: '偏离均值回归策略' },
  { id: 'trend_following', name: 'Trend Following', nameZh: '趋势跟踪策略', category: 'strategy', description: '多指标趋势跟踪' },
];

export default function IndicatorSearch({ isOpen, onClose, onSelect }: IndicatorSearchProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('xtmc_fav_indicators') || '[]'); }
    catch { return []; }
  });

  const filtered = useMemo(() => {
    return INDICATORS.filter(ind => {
      const matchesCategory = category === 'all' || ind.category === category;
      const matchesSearch = !search ||
        ind.name.toLowerCase().includes(search.toLowerCase()) ||
        ind.nameZh.includes(search) ||
        ind.id.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  const toggleFavorite = (id: string) => {
    const newFavs = favorites.includes(id)
      ? favorites.filter(f => f !== id)
      : [...favorites, id];
    setFavorites(newFavs);
    localStorage.setItem('xtmc_fav_indicators', JSON.stringify(newFavs));
  };

  if (!isOpen) return null;

  const favIndicators = filtered.filter(i => favorites.includes(i.id));
  const otherIndicators = filtered.filter(i => !favorites.includes(i.id));

  return (
    <div className="absolute top-0 left-0 right-0 bottom-0 bg-white dark:bg-slate-800 z-50 flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
      {/* 头部 */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-slate-700">
        <Search className="w-4 h-4 text-gray-400 dark:text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索指标或策略..."
          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none"
          autoFocus
        />
        <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 分类 */}
      <div className="flex gap-1 px-3 py-2 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
        {CATEGORIES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-all ${
              category === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {favIndicators.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase bg-gray-50 dark:bg-slate-900/30">收藏</div>
            {favIndicators.map(ind => (
              <IndicatorItem
                key={ind.id}
                indicator={ind}
                isFavorite={true}
                onSelect={() => { onSelect(ind); onClose(); }}
                onToggleFavorite={() => toggleFavorite(ind.id)}
              />
            ))}
          </>
        )}
        <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase bg-gray-50 dark:bg-slate-900/30">
          {category === 'all' ? '全部指标' : CATEGORIES.find(c => c.key === category)?.label}
          <span className="ml-1">({otherIndicators.length})</span>
        </div>
        {otherIndicators.map(ind => (
          <IndicatorItem
            key={ind.id}
            indicator={ind}
            isFavorite={false}
            onSelect={() => { onSelect(ind); onClose(); }}
            onToggleFavorite={() => toggleFavorite(ind.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-slate-500">
            <Search className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">未找到匹配的指标</p>
          </div>
        )}
      </div>
    </div>
  );
}

function IndicatorItem({ indicator, isFavorite, onSelect, onToggleFavorite }: {
  indicator: Indicator;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="text-gray-300 dark:text-slate-600 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors flex-shrink-0"
        >
          <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-900 dark:text-white">{indicator.name}</span>
            <span className="text-[10px] text-gray-400 dark:text-slate-500">{indicator.nameZh}</span>
          </div>
          <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{indicator.description}</div>
        </div>
      </div>
      <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
        indicator.category === 'trend' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
        indicator.category === 'momentum' ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
        indicator.category === 'volatility' ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' :
        indicator.category === 'volume' ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' :
        indicator.category === 'strategy' ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
        'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
      }`}>
        {CATEGORIES.find(c => c.key === indicator.category)?.label}
      </span>
    </div>
  );
}
