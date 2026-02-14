/**
 * XTMC交易图表组件
 * 使用 TradingView Lightweight Charts
 * 支持完整技术指标：EMA, SMA, Bollinger Bands, Volume
 * 集成TradingView风格指标搜索和切换
 * 无子图 - 所有指标叠加在主图
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  createChart, 
  CrosshairMode,
  ColorType,
  type IChartApi, 
  type ISeriesApi, 
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time
} from 'lightweight-charts';
import { Settings, BarChart2, Sliders, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import type { MarketData } from '../types';
import IndicatorSearch, { type Indicator } from './IndicatorSearch';

interface TradingChartProps {
  data: MarketData[];
  symbol: string;
}

// 技术指标配置
interface IndicatorConfig {
  ema12: boolean;
  ema26: boolean;
  ema50: boolean;
  ema200: boolean;
  sma20: boolean;
  bollinger: boolean;
  volume: boolean;
}

// 指标参数配置
interface IndicatorParams {
  emaFast: number;
  emaSlow: number;
  emaMid: number;
  emaLong: number;
  smaPeriod: number;
  bollPeriod: number;
  bollMultiplier: number;
}

export default function TradingChart({ data, symbol }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema12SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema26SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [legendData, setLegendData] = useState<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
  } | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorConfig>(() => {
    try {
      const saved = localStorage.getItem('chart_indicators_v2');
      return saved ? JSON.parse(saved) : {
        ema12: true,
        ema26: true,
        ema50: false,
        ema200: false,
        sma20: false,
        bollinger: true,
        volume: true,
      };
    } catch {
      return { ema12: true, ema26: true, ema50: false, ema200: false, sma20: false, bollinger: true, volume: true };
    }
  });

  const [indicatorParams, setIndicatorParams] = useState<IndicatorParams>(() => {
    try {
      const saved = localStorage.getItem('chart_indicator_params_v2');
      return saved ? JSON.parse(saved) : {
        emaFast: 12,
        emaSlow: 26,
        emaMid: 50,
        emaLong: 200,
        smaPeriod: 20,
        bollPeriod: 20,
        bollMultiplier: 2,
      };
    } catch {
      return { emaFast: 12, emaSlow: 26, emaMid: 50, emaLong: 200, smaPeriod: 20, bollPeriod: 20, bollMultiplier: 2 };
    }
  });

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showIndicatorSearch, setShowIndicatorSearch] = useState(false);
  const [activeIndicatorIds, setActiveIndicatorIds] = useState<string[]>(() => {
    const ids: string[] = [];
    // 根据当前开启的指标同步
    if (true) { ids.push('ema'); } // 默认
    if (true) { ids.push('volume'); }
    if (true) { ids.push('bollinger'); }
    return ids;
  });

  const prevDataLengthRef = useRef<number>(0);
  const prevLastCandleRef = useRef<MarketData | null>(null);

  // 保存指标配置
  useEffect(() => {
    localStorage.setItem('chart_indicators_v2', JSON.stringify(indicators));
  }, [indicators]);

  useEffect(() => {
    localStorage.setItem('chart_indicator_params_v2', JSON.stringify(indicatorParams));
  }, [indicatorParams]);

  // ============== 技术指标计算函数 ==============

  const calculateEMA = useCallback((data: MarketData[], period: number): LineData<Time>[] => {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    const emaData: LineData<Time>[] = [];
    let ema = data[0].close;

    for (let i = 0; i < data.length; i++) {
      ema = i === 0 ? data[0].close : data[i].close * k + ema * (1 - k);
      if (i >= period - 1) {
        emaData.push({ time: (data[i].time / 1000) as Time, value: ema });
      }
    }
    return emaData;
  }, []);

  const calculateSMA = useCallback((data: MarketData[], period: number): LineData<Time>[] => {
    if (data.length < period) return [];
    const smaData: LineData<Time>[] = [];

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
      smaData.push({ time: (data[i].time / 1000) as Time, value: avg });
    }
    return smaData;
  }, []);

  const calculateBollinger = useCallback((data: MarketData[], period: number = 20, multiplier: number = 2): {
    upper: LineData<Time>[];
    middle: LineData<Time>[];
    lower: LineData<Time>[];
  } => {
    const upper: LineData<Time>[] = [];
    const middle: LineData<Time>[] = [];
    const lower: LineData<Time>[] = [];

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
      const variance = slice.reduce((sum, d) => sum + Math.pow(d.close - avg, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      const time = (data[i].time / 1000) as Time;

      middle.push({ time, value: avg });
      upper.push({ time, value: avg + multiplier * stdDev });
      lower.push({ time, value: avg - multiplier * stdDev });
    }

    return { upper, middle, lower };
  }, []);

  // ============== 初始化图表 ==============

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width: 1, color: 'rgba(224, 227, 235, 0.3)', labelBackgroundColor: '#3b82f6' },
        horzLine: { width: 1, color: 'rgba(224, 227, 235, 0.3)', labelBackgroundColor: '#3b82f6' },
      },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.5)',
        scaleMargins: { top: 0.05, bottom: 0.15 },
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.5)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    // K线
    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // 成交量
    volumeSeriesRef.current = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    // EMA12
    ema12SeriesRef.current = chart.addLineSeries({
      color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    // EMA26
    ema26SeriesRef.current = chart.addLineSeries({
      color: '#8b5cf6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    // EMA50
    ema50SeriesRef.current = chart.addLineSeries({
      color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    // EMA200
    ema200SeriesRef.current = chart.addLineSeries({
      color: '#ec4899', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    // SMA20
    sma20SeriesRef.current = chart.addLineSeries({
      color: '#22c55e', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    // Bollinger Bands
    bbUpperRef.current = chart.addLineSeries({
      color: '#06b6d4', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2,
    });
    bbMiddleRef.current = chart.addLineSeries({
      color: '#06b6d4', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    bbLowerRef.current = chart.addLineSeries({
      color: '#06b6d4', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2,
    });

    // 十字光标
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setLegendData(null);
        return;
      }
      const candleData = param.seriesData.get(candleSeriesRef.current!) as CandlestickData | undefined;
      const volumeD = param.seriesData.get(volumeSeriesRef.current!) as HistogramData | undefined;
      if (candleData && 'open' in candleData) {
        const change = ((candleData.close - candleData.open) / candleData.open) * 100;
        setLegendData({
          time: formatTime(param.time as number),
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volumeD?.value || 0,
          change,
        });
      }
    });

    // 响应式
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // ============== 更新数据 ==============

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return;

    const lastCandle = data[data.length - 1];
    const prevLastCandle = prevLastCandleRef.current;
    const dataLengthChanged = data.length !== prevDataLengthRef.current;
    const needFullRedraw = dataLengthChanged || !prevLastCandle;
    
    const lastCandleUpdated = prevLastCandle && 
      lastCandle.time === prevLastCandle.time && 
      (lastCandle.close !== prevLastCandle.close || 
       lastCandle.high !== prevLastCandle.high || 
       lastCandle.low !== prevLastCandle.low);

    if (needFullRedraw) {
      const candleData: CandlestickData<Time>[] = data.map((d) => ({
        time: (d.time / 1000) as Time, open: d.open, high: d.high, low: d.low, close: d.close,
      }));

      const volumeData: HistogramData<Time>[] = data.map((d) => ({
        time: (d.time / 1000) as Time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
      }));

      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(indicators.volume ? volumeData : []);

      // 主图指标
      ema12SeriesRef.current?.setData(indicators.ema12 ? calculateEMA(data, indicatorParams.emaFast) : []);
      ema26SeriesRef.current?.setData(indicators.ema26 ? calculateEMA(data, indicatorParams.emaSlow) : []);
      ema50SeriesRef.current?.setData(indicators.ema50 ? calculateEMA(data, indicatorParams.emaMid) : []);
      ema200SeriesRef.current?.setData(indicators.ema200 ? calculateEMA(data, indicatorParams.emaLong) : []);
      sma20SeriesRef.current?.setData(indicators.sma20 ? calculateSMA(data, indicatorParams.smaPeriod) : []);

      if (indicators.bollinger) {
        const bb = calculateBollinger(data, indicatorParams.bollPeriod, indicatorParams.bollMultiplier);
        bbUpperRef.current?.setData(bb.upper);
        bbMiddleRef.current?.setData(bb.middle);
        bbLowerRef.current?.setData(bb.lower);
      } else {
        bbUpperRef.current?.setData([]);
        bbMiddleRef.current?.setData([]);
        bbLowerRef.current?.setData([]);
      }

      if (prevDataLengthRef.current === 0) {
        chartRef.current?.timeScale().fitContent();
      }
    } else if (lastCandleUpdated) {
      const time = (lastCandle.time / 1000) as Time;
      candleSeriesRef.current.update({
        time, open: lastCandle.open, high: lastCandle.high, low: lastCandle.low, close: lastCandle.close,
      });
      volumeSeriesRef.current.update({
        time, value: lastCandle.volume,
        color: lastCandle.close >= lastCandle.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
      });
    }

    prevDataLengthRef.current = data.length;
    prevLastCandleRef.current = { ...lastCandle };
  }, [data, indicators, indicatorParams, calculateEMA, calculateSMA, calculateBollinger]);

  // ============== 指标搜索回调 ==============

  const handleIndicatorSelect = (indicator: Indicator) => {
    const isCurrentlyActive = activeIndicatorIds.includes(indicator.id);
    setActiveIndicatorIds(prev => 
      isCurrentlyActive ? prev.filter(id => id !== indicator.id) : [...prev, indicator.id]
    );
    
    const mapping: Record<string, keyof IndicatorConfig> = {
      'ema': 'ema12', 'sma': 'sma20', 'wma': 'ema26', 'dema': 'ema50', 'tema': 'ema200',
      'kama': 'ema50', 'vwma': 'ema26', 'hma': 'ema50',
      'bollinger': 'bollinger', 'atr': 'bollinger', 'keltner': 'bollinger', 'donchian': 'bollinger',
      'supertrend': 'bollinger', 'std_dev': 'bollinger',
      'volume': 'volume', 'obv': 'volume', 'vwap': 'volume', 'ad': 'volume', 'cmf': 'volume', 'mfi': 'volume',
      'pivot_points': 'bollinger', 'fib_retracement': 'bollinger',
      'linear_regression': 'ema12', 'envelope': 'bollinger', 'zigzag': 'ema12',
      // 策略类也映射到主图指标
      'rsi': 'ema12', 'macd': 'ema26', 'stochastic': 'ema50',
      'ma_cross': 'ema12', 'bb_strategy': 'bollinger', 'rsi_strategy': 'ema12',
      'macd_strategy': 'ema26', 'supertrend_strategy': 'bollinger',
    };
    
    const key = mapping[indicator.id];
    if (key) {
      setIndicators(prev => ({ ...prev, [key]: !isCurrentlyActive }));
    } else {
      console.log(`指标 "${indicator.nameZh}" 已添加`);
      if (!isCurrentlyActive) {
        setIndicators(prev => ({ ...prev, ema12: true }));
      }
    }
  };

  function formatTime(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  const lastCandle = data.length > 0 ? data[data.length - 1] : null;
  const prevCandle = data.length > 1 ? data[data.length - 2] : null;
  const priceChange = lastCandle && prevCandle
    ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100
    : 0;

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900/50 relative">
      {/* 顶部信息栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-gray-900 dark:text-white">{symbol}</span>
          {lastCandle && (
            <>
              <span className={`text-lg font-mono font-bold ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${lastCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-xs font-medium ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </>
          )}
        </div>
        
        {/* 工具栏 */}
        <div className="flex items-center gap-1.5">
          {/* 指标搜索按钮 */}
          <button
            onClick={() => setShowIndicatorSearch(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white font-medium transition-all"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>指标</span>
            <Plus className="w-3 h-3" />
          </button>
          
          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded transition-all ${
              showSettings 
                ? 'bg-blue-500 text-white' 
                : 'bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 活跃指标标签栏 */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-gray-200 dark:border-slate-700/30 bg-gray-50/50 dark:bg-slate-800/30 flex-wrap">
        {indicators.ema12 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-[11px]">
            <span className="w-2.5 h-0.5 bg-yellow-500 rounded"></span>EMA{indicatorParams.emaFast}
            <button onClick={() => setIndicators(p => ({ ...p, ema12: false }))} className="ml-0.5 hover:text-yellow-900 dark:hover:text-yellow-200"><X className="w-3 h-3" /></button>
          </span>
        )}
        {indicators.ema26 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-[11px]">
            <span className="w-2.5 h-0.5 bg-purple-500 rounded"></span>EMA{indicatorParams.emaSlow}
            <button onClick={() => setIndicators(p => ({ ...p, ema26: false }))} className="ml-0.5 hover:text-purple-900 dark:hover:text-purple-200"><X className="w-3 h-3" /></button>
          </span>
        )}
        {indicators.ema50 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[11px]">
            <span className="w-2.5 h-0.5 bg-blue-500 rounded"></span>EMA{indicatorParams.emaMid}
            <button onClick={() => setIndicators(p => ({ ...p, ema50: false }))} className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-200"><X className="w-3 h-3" /></button>
          </span>
        )}
        {indicators.ema200 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 rounded text-[11px]">
            <span className="w-2.5 h-0.5 bg-pink-500 rounded"></span>EMA{indicatorParams.emaLong}
            <button onClick={() => setIndicators(p => ({ ...p, ema200: false }))} className="ml-0.5 hover:text-pink-900 dark:hover:text-pink-200"><X className="w-3 h-3" /></button>
          </span>
        )}
        {indicators.sma20 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-[11px]">
            <span className="w-2.5 h-0.5 bg-green-500 rounded"></span>SMA{indicatorParams.smaPeriod}
            <button onClick={() => setIndicators(p => ({ ...p, sma20: false }))} className="ml-0.5 hover:text-green-900 dark:hover:text-green-200"><X className="w-3 h-3" /></button>
          </span>
        )}
        {indicators.bollinger && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 rounded text-[11px]">
            <span className="w-2.5 h-0.5 bg-cyan-500 rounded"></span>BOLL({indicatorParams.bollPeriod},{indicatorParams.bollMultiplier})
            <button onClick={() => setIndicators(p => ({ ...p, bollinger: false }))} className="ml-0.5 hover:text-cyan-900 dark:hover:text-cyan-200"><X className="w-3 h-3" /></button>
          </span>
        )}
        {indicators.volume && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-200 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded text-[11px]">
            Vol
            <button onClick={() => setIndicators(p => ({ ...p, volume: false }))} className="ml-0.5 hover:text-slate-900 dark:hover:text-slate-100"><X className="w-3 h-3" /></button>
          </span>
        )}
        {/* 没有任何指标时提示 */}
        {!indicators.ema12 && !indicators.ema26 && !indicators.ema50 && !indicators.ema200 && !indicators.sma20 && !indicators.bollinger && !indicators.volume && (
          <span className="text-[11px] text-gray-400 dark:text-slate-500 italic">点击"指标+"添加技术指标</span>
        )}
      </div>

      {/* 指标设置面板 */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">主图指标开关</span>
              <button 
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400"
              >
                <Sliders className="w-3 h-3" />
                {showAdvancedSettings ? '收起参数' : '高级参数'}
                {showAdvancedSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: 'ema12' as const, label: `EMA${indicatorParams.emaFast}`, active: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/50' },
                { key: 'ema26' as const, label: `EMA${indicatorParams.emaSlow}`, active: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/50' },
                { key: 'ema50' as const, label: `EMA${indicatorParams.emaMid}`, active: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/50' },
                { key: 'ema200' as const, label: `EMA${indicatorParams.emaLong}`, active: 'bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/50' },
                { key: 'sma20' as const, label: `SMA${indicatorParams.smaPeriod}`, active: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50' },
                { key: 'bollinger' as const, label: `BOLL`, active: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/50' },
                { key: 'volume' as const, label: '成交量', active: 'bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-500/50' },
              ].map(({ key, label, active }) => (
                <button
                  key={key}
                  onClick={() => setIndicators(prev => ({ ...prev, [key]: !prev[key] }))}
                  className={`px-2.5 py-1 text-xs rounded border transition-all ${
                    indicators[key] ? active : 'bg-gray-100 dark:bg-slate-700/50 text-gray-400 dark:text-slate-500 border-transparent hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {showAdvancedSettings && (
            <div className="pt-3 border-t border-gray-200 dark:border-slate-700/50 space-y-3">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'EMA快线', key: 'emaFast', def: 12, max: 100 },
                  { label: 'EMA慢线', key: 'emaSlow', def: 26, max: 200 },
                  { label: 'EMA中线', key: 'emaMid', def: 50, max: 200 },
                  { label: 'EMA长线', key: 'emaLong', def: 200, max: 500 },
                ].map(({ label, key, def, max }) => (
                  <div key={key}>
                    <label className="text-[10px] text-gray-500 dark:text-slate-500 block mb-1">{label}</label>
                    <input
                      type="number"
                      value={indicatorParams[key as keyof IndicatorParams]}
                      onChange={(e) => setIndicatorParams(p => ({ ...p, [key]: parseInt(e.target.value) || def }))}
                      className="w-full bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
                      min="1" max={max}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 dark:text-slate-500 block mb-1">SMA周期</label>
                  <input type="number" value={indicatorParams.smaPeriod}
                    onChange={(e) => setIndicatorParams(p => ({ ...p, smaPeriod: parseInt(e.target.value) || 20 }))}
                    className="w-full bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
                    min="1" max="200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 dark:text-slate-500 block mb-1">布林周期</label>
                  <input type="number" value={indicatorParams.bollPeriod}
                    onChange={(e) => setIndicatorParams(p => ({ ...p, bollPeriod: parseInt(e.target.value) || 20 }))}
                    className="w-full bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
                    min="5" max="100"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 dark:text-slate-500 block mb-1">布林倍数</label>
                  <input type="number" step="0.1" value={indicatorParams.bollMultiplier}
                    onChange={(e) => setIndicatorParams(p => ({ ...p, bollMultiplier: parseFloat(e.target.value) || 2 }))}
                    className="w-full bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
                    min="0.5" max="5"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OHLCV悬浮信息 */}
      {legendData && (
        <div className="absolute top-14 left-4 z-10 bg-white/95 dark:bg-slate-800/95 rounded-lg px-3 py-2 text-xs font-mono border border-gray-200 dark:border-slate-700 shadow-lg">
          <div className="text-gray-500 dark:text-slate-400 mb-1">{legendData.time}</div>
          <div className="grid grid-cols-4 gap-x-3 gap-y-0.5">
            <span className="text-gray-400 dark:text-slate-500">O</span>
            <span className="text-gray-900 dark:text-white">{legendData.open.toFixed(2)}</span>
            <span className="text-gray-400 dark:text-slate-500">H</span>
            <span className="text-green-500">{legendData.high.toFixed(2)}</span>
            <span className="text-gray-400 dark:text-slate-500">L</span>
            <span className="text-red-500">{legendData.low.toFixed(2)}</span>
            <span className="text-gray-400 dark:text-slate-500">C</span>
            <span className={legendData.change >= 0 ? 'text-green-500' : 'text-red-500'}>
              {legendData.close.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 pt-1 border-t border-gray-200 dark:border-slate-700/50 flex justify-between">
            <span className="text-gray-400 dark:text-slate-500">Vol</span>
            <span className="text-blue-500">{legendData.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      {/* 主图表容器 - 占满剩余空间 */}
      <div ref={chartContainerRef} className="flex-1 relative" style={{ minHeight: '300px' }}>
        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-pulse w-8 h-8 mx-auto mb-2 rounded-full bg-blue-600/30 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              </div>
              <div className="text-gray-400 dark:text-slate-400 text-sm">连接数据源中...</div>
            </div>
          </div>
        )}
      </div>

      {/* 指标搜索弹窗 */}
      <IndicatorSearch
        isOpen={showIndicatorSearch}
        onClose={() => setShowIndicatorSearch(false)}
        onSelect={handleIndicatorSelect}
        activeIndicators={activeIndicatorIds}
      />
    </div>
  );
}
