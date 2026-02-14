/**
 * XTMC状态栏组件
 */

import { Wifi, WifiOff, Server, Activity, Brain } from 'lucide-react';
import type { SystemStatus } from '../types';

interface StatusBarProps {
  systemStatus: SystemStatus;
  isConnected: boolean;
}

export default function StatusBar({ systemStatus, isConnected }: StatusBarProps) {
  const formatMemory = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${mb}MB`;
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-md border-t border-slate-700/50">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            {/* 连接状态 */}
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-green-400">已连接</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-red-400">未连接</span>
                </>
              )}
            </div>

            {/* 服务器状态 */}
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400">
                {systemStatus.status === 'running' ? '运行中' : '已停止'}
              </span>
            </div>

            {/* AI状态 */}
            <div className="flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400">
                AI: {systemStatus.ai?.is_running ? '进化中' : '暂停'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* CPU使用率 */}
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">
                CPU: {systemStatus.system?.cpu_percent?.toFixed(1) || 0}%
              </span>
            </div>

            {/* 内存使用 */}
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    (systemStatus.system?.memory_percent || 0) > 80 
                      ? 'bg-red-500' 
                      : (systemStatus.system?.memory_percent || 0) > 60 
                        ? 'bg-yellow-500' 
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${systemStatus.system?.memory_percent || 0}%` }}
                />
              </div>
              <span className="text-slate-400">
                {formatMemory(systemStatus.system?.memory_used || 0)} / 
                {formatMemory(systemStatus.system?.memory_total || 4096)}
              </span>
            </div>

            {/* 时间戳 */}
            <div className="text-slate-500">
              {systemStatus.timestamp 
                ? new Date(systemStatus.timestamp).toLocaleTimeString('zh-CN')
                : '--:--:--'
              }
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
