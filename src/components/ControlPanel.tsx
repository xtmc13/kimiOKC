/**
 * XTMC控制面板组件
 */

import { 
  Play, 
  Pause, 
  Brain, 
  Settings,
  Zap
} from 'lucide-react';
import type { TradeConfig, SystemStatus } from '../types';

interface ControlPanelProps {
  tradeConfig: TradeConfig;
  systemStatus: SystemStatus;
  onUpdateTradeConfig: (config: TradeConfig) => void;
}

export default function ControlPanel({
  tradeConfig,
  systemStatus,
  onUpdateTradeConfig,
}: ControlPanelProps) {
  const handleToggleTrading = () => {
    onUpdateTradeConfig({
      ...tradeConfig,
      enable_trading: !tradeConfig.enable_trading,
    });
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          控制面板
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 交易开关 */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-300">自动交易</span>
            <div className={`w-2 h-2 rounded-full ${tradeConfig.enable_trading ? 'bg-green-500' : 'bg-slate-500'}`} />
          </div>
          <button
            onClick={handleToggleTrading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${
              tradeConfig.enable_trading
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50'
            }`}
          >
            {tradeConfig.enable_trading ? (
              <>
                <Pause className="w-4 h-4" />
                停止交易
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                开始交易
              </>
            )}
          </button>
        </div>

        {/* AI状态 */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-300">AI进化</span>
            <div className={`w-2 h-2 rounded-full ${systemStatus.ai?.is_running ? 'bg-purple-500 animate-pulse' : 'bg-slate-500'}`} />
          </div>
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/50">
            <Brain className="w-4 h-4" />
            {systemStatus.ai?.is_running ? '进化中' : '已暂停'}
          </div>
        </div>

        {/* 系统状态 */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-300">系统状态</span>
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-center py-2">
            <div className="text-sm text-slate-300">
              进化次数: <span className="text-white font-semibold">{systemStatus.ai?.evolution_count || 0}</span>
            </div>
            <div className="text-sm text-slate-300 mt-1">
              总收益: <span className={`font-semibold ${(systemStatus.ai?.total_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(systemStatus.ai?.total_profit || 0).toFixed(2)} USDT
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 当前配置摘要 */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">交易所:</span>
            <span className="text-white capitalize">{tradeConfig.exchange}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">交易对:</span>
            <span className="text-white">{tradeConfig.symbol}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">周期:</span>
            <span className="text-white">{tradeConfig.timeframe}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">最大持仓:</span>
            <span className="text-white">${tradeConfig.max_position}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">风险比例:</span>
            <span className="text-white">{tradeConfig.risk_percent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
