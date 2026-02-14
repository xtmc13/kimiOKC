/**
 * XTMC TradingView 完整图表组件
 * 使用 TradingView Widget 嵌入完整图表
 * 支持全部 100+ TradingView 内置指标、绘图工具、策略
 */

import { useEffect, useRef, useCallback } from 'react';

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}

interface TradingChartProps {
  symbol: string;
  timeframe?: string;
  theme?: string;
  // 保留data/signals用于兼容，但图表使用TradingView数据
  data?: unknown[];
  signals?: unknown[];
}

const TV_SCRIPT_URL = 'https://s.tradingview.com/tv.js';

const INTERVAL_MAP: Record<string, string> = {
  '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D',
};

// 加载TradingView脚本（只加载一次）
function loadTVScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TradingView) { resolve(); return; }
    const existing = document.querySelector(`script[src="${TV_SCRIPT_URL}"]`) as HTMLScriptElement;
    if (existing) {
      if (window.TradingView) { resolve(); return; }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('TradingView script error')));
      return;
    }
    const script = document.createElement('script');
    script.src = TV_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load TradingView'));
    document.head.appendChild(script);
  });
}

export default function TradingChart({ symbol, timeframe = '1h', theme = 'dark' }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetCreated = useRef(false);
  const lastConfig = useRef('');

  const createWidget = useCallback(async () => {
    if (!containerRef.current) return;

    // 避免重复创建相同配置的widget
    const configKey = `${symbol}-${timeframe}-${theme}`;
    if (configKey === lastConfig.current && widgetCreated.current) return;
    lastConfig.current = configKey;

    try {
      await loadTVScript();
    } catch {
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;">
            <div style="text-align:center;">
              <div style="font-size:40px;margin-bottom:12px;">📊</div>
              <div style="font-size:14px;">TradingView 加载中...</div>
              <div style="font-size:11px;margin-top:6px;opacity:0.5;">请检查网络连接</div>
            </div>
          </div>`;
      }
      return;
    }

    if (!window.TradingView || !containerRef.current) return;

    // 清空容器
    containerRef.current.innerHTML = '';

    const tvSymbol = `BINANCE:${symbol}`;
    const interval = INTERVAL_MAP[timeframe] || '60';
    const containerId = 'xtmc-tv-chart';

    // 创建子div给widget用
    const widgetDiv = document.createElement('div');
    widgetDiv.id = containerId;
    widgetDiv.style.width = '100%';
    widgetDiv.style.height = '100%';
    containerRef.current.appendChild(widgetDiv);

    new window.TradingView.widget({
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: 'Asia/Shanghai',
      theme: theme === 'light' ? 'light' : 'dark',
      style: '1',
      locale: 'zh_CN',
      enable_publishing: false,
      allow_symbol_change: true,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      save_image: true,
      withdateranges: true,
      details: false,
      hotlist: false,
      calendar: false,
      container_id: containerId,
      // 默认添加常用指标
      studies: [
        'MAExp@tv-basicstudies',
        'BB@tv-basicstudies',
      ],
      overrides: {
        'mainSeriesProperties.candleStyle.upColor': '#22c55e',
        'mainSeriesProperties.candleStyle.downColor': '#ef4444',
        'mainSeriesProperties.candleStyle.borderUpColor': '#22c55e',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
        'mainSeriesProperties.candleStyle.wickUpColor': '#22c55e',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
        'paneProperties.background': theme === 'light' ? '#ffffff' : '#0f172a',
        'paneProperties.backgroundType': 'solid',
      },
    });

    widgetCreated.current = true;
  }, [symbol, timeframe, theme]);

  useEffect(() => {
    // 小延迟确保DOM ready
    const timer = setTimeout(() => createWidget(), 100);
    return () => clearTimeout(timer);
  }, [createWidget]);

  return (
    <div className="w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
