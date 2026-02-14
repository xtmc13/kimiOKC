/**
 * XTMC头部组件
 * 包含Logo、AI状态指标、设置入口
 */

import { Cpu, Brain, TrendingUp, Settings } from 'lucide-react';
import type { SystemStatus } from '../types';

interface HeaderProps {
  systemStatus: SystemStatus;
  isConnected: boolean;
  onOpenSettings?: () => void;
  theme?: string;
}

export default function Header({ systemStatus, isConnected, onOpenSettings }: HeaderProps) {
  const getStatusColor = () => {
    if (!isConnected) return 'bg-red-500';
    if (systemStatus.trading?.enabled) return 'bg-green-500';
    return 'bg-blue-500';
  };

  return (
    <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                XTMC量化交易
              </h1>
              <p className="text-xs text-slate-400">自我进化型AI交易系统</p>
            </div>
          </div>

          {/* AI状态指标 + 设置 */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-sm text-slate-300">
                胜率 {(systemStatus.ai?.win_rate * 100 || 0).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-slate-300">
                {systemStatus.ai?.tool_count || 0} 个工具
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-slate-300">
                CPU {systemStatus.system?.cpu_percent?.toFixed(1) || 0}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`} />
              <span className="text-sm text-slate-300">
                {isConnected ? 'AI运行中' : '离线'}
              </span>
            </div>
            {/* 设置按钮 */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
              title="系统设置"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
