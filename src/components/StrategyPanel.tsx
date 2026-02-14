/**
 * 策略配置面板
 */

import { useState } from 'react';
import { 
  Settings, 
  Play, 
  Pause, 
  Zap, 
  Shield,
  BarChart3
} from 'lucide-react';

interface StrategyConfig {
  name: string;
  enabled: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  maxPositionSize: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  indicators: string[];
  timeframes: string[];
}

interface StrategyPanelProps {
  aiTools?: { name: string; signals?: number; accuracy?: number }[];
  onConfigChange?: (config: StrategyConfig) => void;
}

const defaultConfig: StrategyConfig = {
  name: 'AI智能策略',
  enabled: false,
  riskLevel: 'medium',
  maxPositionSize: 10,
  stopLossPercent: 2,
  takeProfitPercent: 4,
  indicators: ['EMA', 'RSI', 'MACD', 'Bollinger'],
  timeframes: ['1h', '4h'],
};

export default function StrategyPanel({ aiTools = [], onConfigChange }: StrategyPanelProps) {
  const [config, setConfig] = useState<StrategyConfig>(defaultConfig);
  const [activeSection, setActiveSection] = useState<'strategy' | 'indicators' | 'risk'>('strategy');

  const updateConfig = (updates: Partial<StrategyConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const riskColors = {
    low: 'text-green-400 bg-green-600/20',
    medium: 'text-yellow-400 bg-yellow-600/20',
    high: 'text-red-400 bg-red-600/20',
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          AI策略控制
        </h3>
        <button
          onClick={() => updateConfig({ enabled: !config.enabled })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            config.enabled
              ? 'bg-green-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          {config.enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {config.enabled ? '运行中' : '已暂停'}
        </button>
      </div>

      {/* 导航 */}
      <div className="flex border-b border-slate-700/50">
        {[
          { key: 'strategy', label: '策略', icon: Settings },
          { key: 'indicators', label: '指标', icon: BarChart3 },
          { key: 'risk', label: '风控', icon: Shield },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key as typeof activeSection)}
            className={`flex-1 py-2 text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeSection === key
                ? 'text-blue-400 bg-blue-600/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* 策略设置 */}
        {activeSection === 'strategy' && (
          <div className="space-y-4">
            {/* 策略名称 */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">策略名称</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => updateConfig({ name: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* 时间周期 */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">交易周期</label>
              <div className="flex flex-wrap gap-2">
                {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      const timeframes = config.timeframes.includes(tf)
                        ? config.timeframes.filter((t) => t !== tf)
                        : [...config.timeframes, tf];
                      updateConfig({ timeframes });
                    }}
                    className={`px-2.5 py-1 text-xs rounded transition-all ${
                      config.timeframes.includes(tf)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* AI工具状态 */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block flex items-center justify-between">
                <span>AI分析工具</span>
                <span className="text-blue-400">{aiTools.length} 个活跃</span>
              </label>
              <div className="bg-slate-900/50 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                {aiTools.length === 0 ? (
                  <div className="text-center text-slate-500 text-xs py-2">
                    AI工具加载中...
                  </div>
                ) : (
                  aiTools.map((tool, i) => (
                    <div key={i} className="flex items-center justify-between text-xs px-2 py-1 bg-slate-800/50 rounded">
                      <span className="text-slate-300">{tool.name}</span>
                      {tool.accuracy !== undefined && (
                        <span className="text-green-400">{(tool.accuracy * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 指标设置 */}
        {activeSection === 'indicators' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">启用指标</label>
              <div className="grid grid-cols-2 gap-2">
                {['EMA', 'SMA', 'RSI', 'MACD', 'Bollinger', 'ATR', 'Stochastic', 'ADX'].map((ind) => (
                  <button
                    key={ind}
                    onClick={() => {
                      const indicators = config.indicators.includes(ind)
                        ? config.indicators.filter((i) => i !== ind)
                        : [...config.indicators, ind];
                      updateConfig({ indicators });
                    }}
                    className={`px-3 py-2 text-xs rounded-lg transition-all flex items-center gap-2 ${
                      config.indicators.includes(ind)
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-600/50'
                        : 'bg-slate-700 text-slate-400 border border-transparent hover:border-slate-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      config.indicators.includes(ind) ? 'bg-blue-400' : 'bg-slate-600'
                    }`} />
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* 信号阈值 */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">信号置信度阈值</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="50"
                  max="95"
                  defaultValue="70"
                  className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs text-blue-400 font-mono w-10">70%</span>
              </div>
            </div>
          </div>
        )}

        {/* 风控设置 */}
        {activeSection === 'risk' && (
          <div className="space-y-4">
            {/* 风险等级 */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">风险等级</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => updateConfig({ riskLevel: level })}
                    className={`flex-1 py-2 text-xs rounded-lg transition-all ${
                      config.riskLevel === level
                        ? riskColors[level]
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {level === 'low' ? '保守' : level === 'medium' ? '平衡' : '激进'}
                  </button>
                ))}
              </div>
            </div>

            {/* 最大仓位 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400">最大仓位 (%)</label>
                <span className="text-xs text-blue-400 font-mono">{config.maxPositionSize}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={config.maxPositionSize}
                onChange={(e) => updateConfig({ maxPositionSize: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* 止损 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400">止损比例 (%)</label>
                <span className="text-xs text-red-400 font-mono">{config.stopLossPercent}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={config.stopLossPercent}
                onChange={(e) => updateConfig({ stopLossPercent: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>

            {/* 止盈 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400">止盈比例 (%)</label>
                <span className="text-xs text-green-400 font-mono">{config.takeProfitPercent}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={config.takeProfitPercent}
                onChange={(e) => updateConfig({ takeProfitPercent: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
