/**
 * TradingView风格指标搜索组件
 * 提供丰富的技术指标和策略搜索功能
 */

import { useState, useMemo } from 'react';
import { 
  Search, 
  X, 
  Star, 
  StarOff,
  TrendingUp,
  BarChart2,
  Activity,
  Waves,
  Target,
  Layers,
  Zap,
  Clock
} from 'lucide-react';

export interface Indicator {
  id: string;
  name: string;
  nameZh: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume' | 'oscillator' | 'overlay' | 'strategy';
  description: string;
  params?: { name: string; default: number; min?: number; max?: number }[];
  isNew?: boolean;
  isPopular?: boolean;
}

interface IndicatorSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (indicator: Indicator) => void;
  activeIndicators: string[];
}

// 完整的TradingView指标库
const INDICATORS: Indicator[] = [
  // 趋势指标
  { id: 'ema', name: 'Exponential Moving Average', nameZh: 'EMA 指数移动平均', category: 'trend', description: '对近期价格赋予更高权重的移动平均线', params: [{ name: 'period', default: 20, min: 1, max: 500 }], isPopular: true },
  { id: 'sma', name: 'Simple Moving Average', nameZh: 'SMA 简单移动平均', category: 'trend', description: '计算指定周期内的平均价格', params: [{ name: 'period', default: 20, min: 1, max: 500 }], isPopular: true },
  { id: 'wma', name: 'Weighted Moving Average', nameZh: 'WMA 加权移动平均', category: 'trend', description: '线性加权的移动平均线', params: [{ name: 'period', default: 20, min: 1, max: 500 }] },
  { id: 'dema', name: 'Double EMA', nameZh: 'DEMA 双重EMA', category: 'trend', description: '减少滞后的双重指数移动平均', params: [{ name: 'period', default: 20, min: 1, max: 500 }] },
  { id: 'tema', name: 'Triple EMA', nameZh: 'TEMA 三重EMA', category: 'trend', description: '进一步减少滞后的三重指数移动平均', params: [{ name: 'period', default: 20, min: 1, max: 500 }] },
  { id: 'kama', name: "Kaufman's Adaptive Moving Average", nameZh: 'KAMA 自适应移动平均', category: 'trend', description: '根据市场波动自动调整平滑度', params: [{ name: 'period', default: 10, min: 1, max: 200 }], isNew: true },
  { id: 'vwma', name: 'Volume Weighted Moving Average', nameZh: 'VWMA 成交量加权MA', category: 'trend', description: '按成交量加权的移动平均', params: [{ name: 'period', default: 20, min: 1, max: 500 }] },
  { id: 'hma', name: 'Hull Moving Average', nameZh: 'HMA Hull移动平均', category: 'trend', description: '响应快速且平滑的移动平均', params: [{ name: 'period', default: 20, min: 1, max: 500 }] },
  { id: 'supertrend', name: 'Supertrend', nameZh: '超级趋势', category: 'trend', description: '基于ATR的趋势跟踪指标', params: [{ name: 'period', default: 10 }, { name: 'multiplier', default: 3 }], isPopular: true },
  { id: 'ichimoku', name: 'Ichimoku Cloud', nameZh: '一目均衡图', category: 'trend', description: '日本蜡烛图技术指标系统', isPopular: true },
  { id: 'parabolic_sar', name: 'Parabolic SAR', nameZh: '抛物线SAR', category: 'trend', description: '趋势反转和止损点指标', params: [{ name: 'step', default: 0.02 }, { name: 'max', default: 0.2 }] },
  
  // 动量指标
  { id: 'rsi', name: 'Relative Strength Index', nameZh: 'RSI 相对强弱指标', category: 'momentum', description: '衡量价格变动速度和幅度', params: [{ name: 'period', default: 14, min: 1, max: 100 }], isPopular: true },
  { id: 'macd', name: 'MACD', nameZh: 'MACD 指数平滑异同', category: 'momentum', description: '显示两条移动平均线之间的关系', params: [{ name: 'fast', default: 12 }, { name: 'slow', default: 26 }, { name: 'signal', default: 9 }], isPopular: true },
  { id: 'stochastic', name: 'Stochastic', nameZh: 'KDJ 随机指标', category: 'momentum', description: '比较收盘价与价格范围的关系', params: [{ name: 'k', default: 14 }, { name: 'd', default: 3 }], isPopular: true },
  { id: 'stoch_rsi', name: 'Stochastic RSI', nameZh: '随机RSI', category: 'momentum', description: 'RSI的随机振荡器', params: [{ name: 'period', default: 14 }] },
  { id: 'cci', name: 'Commodity Channel Index', nameZh: 'CCI 商品通道指标', category: 'momentum', description: '识别周期性趋势', params: [{ name: 'period', default: 20, min: 1, max: 100 }] },
  { id: 'williams_r', name: 'Williams %R', nameZh: '威廉指标', category: 'momentum', description: '动量指标显示超买超卖', params: [{ name: 'period', default: 14, min: 1, max: 100 }] },
  { id: 'momentum', name: 'Momentum', nameZh: '动量指标', category: 'momentum', description: '价格变化的速度', params: [{ name: 'period', default: 10, min: 1, max: 100 }] },
  { id: 'roc', name: 'Rate of Change', nameZh: 'ROC 变动率', category: 'momentum', description: '价格变化的百分比', params: [{ name: 'period', default: 12, min: 1, max: 100 }] },
  { id: 'tsi', name: 'True Strength Index', nameZh: 'TSI 真实强度指数', category: 'momentum', description: '动量振荡器显示趋势方向', params: [{ name: 'long', default: 25 }, { name: 'short', default: 13 }] },
  { id: 'awesome', name: 'Awesome Oscillator', nameZh: 'AO 动量振荡器', category: 'momentum', description: 'Bill Williams的动量指标' },
  { id: 'ppo', name: 'Percentage Price Oscillator', nameZh: 'PPO 价格震荡百分比', category: 'momentum', description: 'MACD的百分比版本', isNew: true },
  
  // 波动率指标
  { id: 'bollinger', name: 'Bollinger Bands', nameZh: '布林带', category: 'volatility', description: '基于标准差的价格通道', params: [{ name: 'period', default: 20 }, { name: 'stdDev', default: 2 }], isPopular: true },
  { id: 'atr', name: 'Average True Range', nameZh: 'ATR 平均真实波幅', category: 'volatility', description: '衡量市场波动性', params: [{ name: 'period', default: 14, min: 1, max: 100 }], isPopular: true },
  { id: 'keltner', name: 'Keltner Channels', nameZh: '肯特纳通道', category: 'volatility', description: '基于ATR的价格通道', params: [{ name: 'period', default: 20 }, { name: 'multiplier', default: 2 }] },
  { id: 'donchian', name: 'Donchian Channels', nameZh: '唐奇安通道', category: 'volatility', description: '显示最高最低价格通道', params: [{ name: 'period', default: 20, min: 1, max: 100 }] },
  { id: 'std_dev', name: 'Standard Deviation', nameZh: '标准差', category: 'volatility', description: '价格离散程度', params: [{ name: 'period', default: 20, min: 1, max: 100 }] },
  { id: 'chaikin_vol', name: 'Chaikin Volatility', nameZh: 'Chaikin波动率', category: 'volatility', description: '高低价差的变化率', params: [{ name: 'period', default: 10 }] },
  { id: 'historical_vol', name: 'Historical Volatility', nameZh: '历史波动率', category: 'volatility', description: '基于对数收益的波动率', params: [{ name: 'period', default: 20 }] },
  
  // 成交量指标
  { id: 'volume', name: 'Volume', nameZh: '成交量', category: 'volume', description: '显示交易量', isPopular: true },
  { id: 'obv', name: 'On Balance Volume', nameZh: 'OBV 能量潮', category: 'volume', description: '累积成交量指标', isPopular: true },
  { id: 'vwap', name: 'VWAP', nameZh: '成交量加权平均价', category: 'volume', description: '当日成交量加权平均价格', isPopular: true },
  { id: 'ad', name: 'Accumulation/Distribution', nameZh: 'A/D 累积/派发', category: 'volume', description: '资金流向指标' },
  { id: 'cmf', name: 'Chaikin Money Flow', nameZh: 'CMF 资金流量', category: 'volume', description: '衡量买卖压力', params: [{ name: 'period', default: 20, min: 1, max: 100 }] },
  { id: 'mfi', name: 'Money Flow Index', nameZh: 'MFI 资金流量指标', category: 'volume', description: '成交量加权的RSI', params: [{ name: 'period', default: 14, min: 1, max: 100 }] },
  { id: 'pvt', name: 'Price Volume Trend', nameZh: 'PVT 价量趋势', category: 'volume', description: '累积价格变化与成交量' },
  { id: 'nvi', name: 'Negative Volume Index', nameZh: 'NVI 负成交量指数', category: 'volume', description: '低成交量日的价格变化' },
  { id: 'volume_profile', name: 'Volume Profile', nameZh: '成交量分布', category: 'volume', description: '显示不同价位的成交量分布', isNew: true },
  { id: 'vpt', name: 'Volume Price Trend', nameZh: 'VPT 量价趋势', category: 'volume', description: '累积成交量和价格变化' },
  
  // 振荡器
  { id: 'adx', name: 'Average Directional Index', nameZh: 'ADX 平均趋向指标', category: 'oscillator', description: '衡量趋势强度', params: [{ name: 'period', default: 14, min: 1, max: 100 }], isPopular: true },
  { id: 'dmi', name: 'Directional Movement Index', nameZh: 'DMI 趋向指标', category: 'oscillator', description: '显示趋势方向', params: [{ name: 'period', default: 14, min: 1, max: 100 }] },
  { id: 'aroon', name: 'Aroon', nameZh: 'Aroon指标', category: 'oscillator', description: '识别趋势开始和强度', params: [{ name: 'period', default: 25, min: 1, max: 100 }] },
  { id: 'aroon_osc', name: 'Aroon Oscillator', nameZh: 'Aroon振荡器', category: 'oscillator', description: 'Aroon Up和Down的差值', params: [{ name: 'period', default: 25, min: 1, max: 100 }], isNew: true },
  { id: 'ultimate', name: 'Ultimate Oscillator', nameZh: '终极振荡器', category: 'oscillator', description: '多周期动量指标' },
  { id: 'dpo', name: 'Detrended Price Oscillator', nameZh: 'DPO 去趋势价格', category: 'oscillator', description: '消除长期趋势的影响', params: [{ name: 'period', default: 20, min: 1, max: 100 }] },
  { id: 'chande', name: 'Chande Momentum Oscillator', nameZh: 'CMO 钱德动量', category: 'oscillator', description: '修正版RSI', params: [{ name: 'period', default: 9, min: 1, max: 100 }] },
  { id: 'fisher', name: 'Fisher Transform', nameZh: 'Fisher变换', category: 'oscillator', description: '将价格转换为高斯分布' },
  
  // 叠加指标
  { id: 'pivot_points', name: 'Pivot Points', nameZh: '枢轴点', category: 'overlay', description: '支撑阻力位计算', isPopular: true },
  { id: 'fib_retracement', name: 'Fibonacci Retracement', nameZh: '斐波那契回撤', category: 'overlay', description: '黄金分割回撤位' },
  { id: 'fib_extension', name: 'Fibonacci Extension', nameZh: '斐波那契扩展', category: 'overlay', description: '目标价位预测' },
  { id: 'linear_regression', name: 'Linear Regression', nameZh: '线性回归', category: 'overlay', description: '趋势线拟合' },
  { id: 'price_channel', name: 'Price Channel', nameZh: '价格通道', category: 'overlay', description: '高低价格通道' },
  { id: 'envelope', name: 'Moving Average Envelope', nameZh: 'MA包络线', category: 'overlay', description: '均线上下的百分比通道', params: [{ name: 'period', default: 20 }, { name: 'percent', default: 2.5 }] },
  { id: 'zigzag', name: 'ZigZag', nameZh: 'ZigZag指标', category: 'overlay', description: '过滤小幅波动显示趋势', params: [{ name: 'deviation', default: 5 }] },
  
  // 策略
  { id: 'bb_strategy', name: 'Bollinger Bands Strategy', nameZh: '布林带策略', category: 'strategy', description: '基于布林带突破的交易策略' },
  { id: 'ma_cross', name: 'MA Crossover Strategy', nameZh: '均线交叉策略', category: 'strategy', description: '快慢均线交叉信号', isPopular: true },
  { id: 'rsi_strategy', name: 'RSI Strategy', nameZh: 'RSI策略', category: 'strategy', description: '超买超卖反转策略' },
  { id: 'macd_strategy', name: 'MACD Strategy', nameZh: 'MACD策略', category: 'strategy', description: 'MACD金叉死叉策略' },
  { id: 'supertrend_strategy', name: 'Supertrend Strategy', nameZh: '超级趋势策略', category: 'strategy', description: '基于超级趋势的入场出场' },
  { id: 'ichimoku_strategy', name: 'Ichimoku Strategy', nameZh: '一目均衡策略', category: 'strategy', description: '基于云图的交易系统' },
  { id: 'breakout', name: 'Breakout Strategy', nameZh: '突破策略', category: 'strategy', description: '价格突破关键位交易' },
  { id: 'mean_reversion', name: 'Mean Reversion', nameZh: '均值回归策略', category: 'strategy', description: '价格偏离均值后回归', isNew: true },
  { id: 'turtle', name: 'Turtle Trading', nameZh: '海龟交易法', category: 'strategy', description: '经典趋势跟踪系统' },
  { id: 'swing', name: 'Swing Trading', nameZh: '波段交易策略', category: 'strategy', description: '中短期波段交易' },
];

const CATEGORY_INFO = {
  trend: { icon: TrendingUp, label: '趋势', color: 'text-blue-400' },
  momentum: { icon: Zap, label: '动量', color: 'text-yellow-400' },
  volatility: { icon: Waves, label: '波动率', color: 'text-purple-400' },
  volume: { icon: BarChart2, label: '成交量', color: 'text-green-400' },
  oscillator: { icon: Activity, label: '振荡器', color: 'text-cyan-400' },
  overlay: { icon: Layers, label: '叠加', color: 'text-orange-400' },
  strategy: { icon: Target, label: '策略', color: 'text-pink-400' },
};

export default function IndicatorSearch({ isOpen, onClose, onSelect, activeIndicators }: IndicatorSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'indicators' | 'strategies' | 'favorites' | 'recent'>('indicators');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('favorite_indicators') || '[]');
    } catch {
      return [];
    }
  });
  const [recentUsed, setRecentUsed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recent_indicators') || '[]');
    } catch {
      return [];
    }
  });

  const filteredIndicators = useMemo(() => {
    let result = INDICATORS;
    
    // Tab过滤
    if (activeTab === 'strategies') {
      result = result.filter(i => i.category === 'strategy');
    } else if (activeTab === 'favorites') {
      result = result.filter(i => favorites.includes(i.id));
    } else if (activeTab === 'recent') {
      result = recentUsed.map(id => INDICATORS.find(i => i.id === id)).filter(Boolean) as Indicator[];
    } else if (activeTab === 'indicators') {
      result = result.filter(i => i.category !== 'strategy');
    }
    
    // 分类过滤
    if (activeCategory && activeTab === 'indicators') {
      result = result.filter(i => i.category === activeCategory);
    }
    
    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(i => 
        i.name.toLowerCase().includes(term) || 
        i.nameZh.toLowerCase().includes(term) ||
        i.description.toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [searchTerm, activeCategory, activeTab, favorites, recentUsed]);

  const toggleFavorite = (id: string) => {
    const newFavorites = favorites.includes(id)
      ? favorites.filter(f => f !== id)
      : [...favorites, id];
    setFavorites(newFavorites);
    localStorage.setItem('favorite_indicators', JSON.stringify(newFavorites));
  };

  const handleSelect = (indicator: Indicator) => {
    // 添加到最近使用
    const newRecent = [indicator.id, ...recentUsed.filter(id => id !== indicator.id)].slice(0, 10);
    setRecentUsed(newRecent);
    localStorage.setItem('recent_indicators', JSON.stringify(newRecent));
    
    onSelect(indicator);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl w-[700px] max-w-[95%] max-h-[80vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">指标、衡量标准和策略</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索指标或策略..."
              autoFocus
              className="w-full bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex h-[450px]">
          {/* 左侧导航 */}
          <div className="w-48 border-r border-gray-200 dark:border-slate-700 p-4 space-y-1 overflow-y-auto">
            {/* Tab选项 */}
            <div className="mb-4">
              {[
                { key: 'indicators', label: '指标', icon: BarChart2 },
                { key: 'strategies', label: '策略', icon: Target },
                { key: 'favorites', label: '收藏', icon: Star },
                { key: 'recent', label: '最近使用', icon: Clock },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => { setActiveTab(key as typeof activeTab); setActiveCategory(null); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    activeTab === key
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* 分类过滤（仅指标tab显示） */}
            {activeTab === 'indicators' && (
              <>
                <div className="text-xs text-gray-500 dark:text-slate-500 font-medium px-3 py-2">分类</div>
                {Object.entries(CATEGORY_INFO)
                  .filter(([key]) => key !== 'strategy')
                  .map(([key, { icon: Icon, label, color }]) => (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(activeCategory === key ? null : key)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      activeCategory === key
                        ? 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white font-medium'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${color}`} />
                    {label}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* 右侧列表 */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredIndicators.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
                <Search className="w-12 h-12 mb-3 opacity-50" />
                <p>未找到匹配的指标</p>
                <p className="text-sm">尝试其他关键词</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredIndicators.map((indicator) => {
                  const CategoryIcon = CATEGORY_INFO[indicator.category]?.icon || BarChart2;
                  const isActive = activeIndicators.includes(indicator.id);
                  const isFavorite = favorites.includes(indicator.id);
                  
                  return (
                    <div
                      key={indicator.id}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all group ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-transparent'
                      }`}
                      onClick={() => handleSelect(indicator)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <CategoryIcon className={`w-5 h-5 flex-shrink-0 ${CATEGORY_INFO[indicator.category]?.color || 'text-gray-400'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {indicator.nameZh}
                            </span>
                            {indicator.isNew && (
                              <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] rounded font-medium">NEW</span>
                            )}
                            {indicator.isPopular && (
                              <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] rounded font-medium">热门</span>
                            )}
                            {isActive && (
                              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] rounded font-medium">已添加</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-500 truncate">{indicator.name}</div>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(indicator.id);
                        }}
                        className={`p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                          isFavorite
                            ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30'
                            : 'text-gray-400 dark:text-slate-500 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                        }`}
                      >
                        {isFavorite ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 底部统计 */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-500 flex justify-between">
          <span>共 {INDICATORS.length} 个指标和策略</span>
          <span>收藏 {favorites.length} · 最近使用 {recentUsed.length}</span>
        </div>
      </div>
    </div>
  );
}
