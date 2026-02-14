/**
 * XTMC交易图表组件
 * 基于TradingView lightweight-charts的专业K线图表
 * 支持: 蜡烛图 + EMA12/EMA26 + 布林带 + RSI副图 + 买卖信号标记
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Time,
  ColorType,
  LineStyle,
  CrosshairMode,
} from 'lightweight-charts';
import type { MarketData, TradeSignal } from '../types';

interface TradingChartProps {
  data: MarketData[];
  symbol: string;
  signals?: TradeSignal[];
}

// ---------- 技术指标计算 ----------

function calcEMA(closes: number[], period: number): (number | null)[] {
  if (closes.length < period) return closes.map(() => null);
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(period - 1).fill(null);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcBollingerBands(
  closes: number[],
  period = 20,
  stdMul = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / period;
      const std = Math.sqrt(slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period);
      middle.push(avg);
      upper.push(avg + stdMul * std);
      lower.push(avg - stdMul * std);
    }
  }
  return { upper, middle, lower };
}

function calcRSI(closes: number[], period = 14): (number | null)[] {
  if (closes.length < period + 1) return closes.map(() => null);
  const result: (number | null)[] = new Array(period).fill(null);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

// ---------- 时间转换 ----------

function toChartTime(ms: number): Time {
  return (ms / 1000) as Time;
}

// ---------- 组件 ----------

export default function TradingChart({ data, symbol, signals = [] }: TradingChartProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const mainChart = useRef<IChartApi | null>(null);
  const rsiChart = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema12Series = useRef<ISeriesApi<'Line'> | null>(null);
  const ema26Series = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeries = useRef<ISeriesApi<'Line'> | null>(null);

  // 创建图表（只执行一次）
  const initCharts = useCallback(() => {
    if (!mainRef.current || !rsiRef.current) return;
    if (mainChart.current) return; // 已创建

    const chartOpts = {
      layout: {
        background: { type: ColorType.Solid as const, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.08)' },
        horzLines: { color: 'rgba(148,163,184,0.08)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: 'rgba(148,163,184,0.2)',
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: 'rgba(148,163,184,0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
    };

    // --- 主图 ---
    const mc = createChart(mainRef.current, {
      ...chartOpts,
      height: 320,
    });
    mainChart.current = mc;

    candleSeries.current = mc.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    ema12Series.current = mc.addLineSeries({
      color: '#3b82f6',
      lineWidth: 1,
      title: 'EMA12',
    });

    ema26Series.current = mc.addLineSeries({
      color: '#f59e0b',
      lineWidth: 1,
      title: 'EMA26',
    });

    bbUpperSeries.current = mc.addLineSeries({
      color: 'rgba(168,85,247,0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'BB Upper',
    });

    bbLowerSeries.current = mc.addLineSeries({
      color: 'rgba(168,85,247,0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'BB Lower',
    });

    // --- RSI 副图 ---
    const rc = createChart(rsiRef.current, {
      ...chartOpts,
      height: 80,
      rightPriceScale: {
        borderColor: 'rgba(148,163,184,0.2)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
    });
    rsiChart.current = rc;

    rsiSeries.current = rc.addLineSeries({
      color: '#a855f7',
      lineWidth: 1,
      title: 'RSI',
    });

    // 同步时间轴滚动
    mc.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) rc.timeScale().setVisibleLogicalRange(range);
    });
    rc.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) mc.timeScale().setVisibleLogicalRange(range);
    });

    // 响应式
    const ro = new ResizeObserver(() => {
      if (mainRef.current) {
        const w = mainRef.current.clientWidth;
        mc.applyOptions({ width: w });
        rc.applyOptions({ width: w });
      }
    });
    ro.observe(mainRef.current);

    return () => {
      ro.disconnect();
      mc.remove();
      rc.remove();
      mainChart.current = null;
      rsiChart.current = null;
    };
  }, []);

  useEffect(() => {
    const cleanup = initCharts();
    return () => cleanup?.();
  }, [initCharts]);

  // 数据更新
  useEffect(() => {
    if (!candleSeries.current || data.length === 0) return;

    const closes = data.map((d) => d.close);

    // K线
    const candles: CandlestickData[] = data.map((d) => ({
      time: toChartTime(d.time),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeries.current.setData(candles);

    // EMA
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    ema12Series.current?.setData(
      data.reduce<LineData[]>((acc, d, i) => {
        if (ema12[i] != null) acc.push({ time: toChartTime(d.time), value: ema12[i]! });
        return acc;
      }, [])
    );
    ema26Series.current?.setData(
      data.reduce<LineData[]>((acc, d, i) => {
        if (ema26[i] != null) acc.push({ time: toChartTime(d.time), value: ema26[i]! });
        return acc;
      }, [])
    );

    // 布林带
    const bb = calcBollingerBands(closes, 20, 2);
    bbUpperSeries.current?.setData(
      data.reduce<LineData[]>((acc, d, i) => {
        if (bb.upper[i] != null) acc.push({ time: toChartTime(d.time), value: bb.upper[i]! });
        return acc;
      }, [])
    );
    bbLowerSeries.current?.setData(
      data.reduce<LineData[]>((acc, d, i) => {
        if (bb.lower[i] != null) acc.push({ time: toChartTime(d.time), value: bb.lower[i]! });
        return acc;
      }, [])
    );

    // RSI
    const rsi = calcRSI(closes, 14);
    rsiSeries.current?.setData(
      data.reduce<LineData[]>((acc, d, i) => {
        if (rsi[i] != null) acc.push({ time: toChartTime(d.time), value: rsi[i]! });
        return acc;
      }, [])
    );

    // 信号标记
    const markers = signals
      .filter((s) => s.action === 'BUY' || s.action === 'SELL')
      .map((s) => {
        const t = s.timestamp > 1e12 ? s.timestamp / 1000 : s.timestamp;
        return {
          time: t as Time,
          position: s.action === 'BUY' ? ('belowBar' as const) : ('aboveBar' as const),
          color: s.action === 'BUY' ? '#22c55e' : '#ef4444',
          shape: s.action === 'BUY' ? ('arrowUp' as const) : ('arrowDown' as const),
          text: `${s.action} ${(s.confidence * 100).toFixed(0)}%`,
        };
      })
      .sort((a, b) => (a.time as number) - (b.time as number));

    if (markers.length) {
      candleSeries.current.setMarkers(markers);
    }

    mainChart.current?.timeScale().fitContent();
    rsiChart.current?.timeScale().fitContent();
  }, [data, signals]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* 图例 */}
      <div className="flex items-center gap-4 px-3 py-1 text-xs text-slate-400">
        <span className="font-medium text-white">{symbol}</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-blue-500 inline-block" /> EMA12
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-amber-500 inline-block" /> EMA26
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-purple-400 inline-block opacity-60" style={{ borderTop: '1px dashed' }} /> BB
        </span>
      </div>
      {/* 主图 */}
      <div ref={mainRef} className="flex-1 min-h-0" />
      {/* RSI 副图 */}
      <div className="px-3 text-xs text-slate-500">RSI(14)</div>
      <div ref={rsiRef} style={{ height: 80 }} />
    </div>
  );
}
