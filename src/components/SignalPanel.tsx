/**
 * XTMC信号面板组件
 */

import { TrendingUp, TrendingDown, Minus, Clock, Target } from 'lucide-react';
import type { TradeSignal } from '../types';

interface SignalPanelProps {
  signals: TradeSignal[];
}

export default function SignalPanel({ signals }: SignalPanelProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'BUY':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'SELL':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      default:
        return <Minus className="w-5 h-5 text-slate-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'SELL':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-slate-400';
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-400" />
          AI交易信号
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          XTMC AI综合分析生成的交易信号
        </p>
      </div>

      <div className="space-y-3">
        {signals.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">暂无交易信号</p>
            <p className="text-slate-500 text-sm mt-1">
              AI正在监控市场，发现机会时会自动通知
            </p>
          </div>
        ) : (
          signals.map((signal, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getActionColor(signal.action)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getActionIcon(signal.action)}
                  <div>
                    <div className="font-semibold">
                      {signal.action === 'BUY' ? '买入信号' : 
                       signal.action === 'SELL' ? '卖出信号' : '观望'}
                    </div>
                    <div className="text-sm opacity-80">{signal.symbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${getConfidenceColor(signal.confidence)}`}>
                    {(signal.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs opacity-60">置信度</div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                <div className="flex items-center justify-between text-sm">
                  <span>价格: ${signal.price.toLocaleString()}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(signal.timestamp)}
                  </span>
                </div>
                {signal.reason && (
                  <div className="mt-2 text-sm opacity-80">
                    {signal.reason}
                  </div>
                )}
              </div>

              {signal.details && signal.details.length > 0 && (
                <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                  <div className="text-xs text-slate-500 mb-2">各工具分析:</div>
                  <div className="space-y-1">
                    {signal.details.slice(0, 3).map((detail, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{detail.tool}</span>
                        <span className={detail.signal === 'BUY' ? 'text-green-400' : detail.signal === 'SELL' ? 'text-red-400' : 'text-slate-400'}>
                          {detail.signal}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
