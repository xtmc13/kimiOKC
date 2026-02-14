/**
 * XTMC状态栏组件
 * 底部固定状态栏，显示连接、数据源、AI状态
 */

import { Wifi, WifiOff, Server, Brain, Database, Settings } from 'lucide-react';
import type { SystemStatus } from '../types';

interface StatusBarProps {
  systemStatus: SystemStatus;
  isConnected: boolean;
  onOpenSettings?: () => void;
}

export default function StatusBar({ systemStatus, isConnected, onOpenSettings }: StatusBarProps) {
  const dataSourceActive = systemStatus.data_source?.active || 'none';
  const isLive = dataSourceActive !== 'none' && dataSourceActive !== 'demo';

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-200 dark:border-slate-700/50 z-40">
      <div className="container mx-auto px-4 py-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            {/* 连接状态 */}
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">已连接</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-red-500 dark:text-red-400">未连接</span>
                </>
              )}
            </div>

            {/* 服务器状态 */}
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span className="text-gray-600 dark:text-slate-400">
                {systemStatus.status === 'running' ? '运行中' : '已停止'}
              </span>
            </div>

            {/* AI状态 */}
            <div className="flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
              <span className="text-gray-600 dark:text-slate-400">
                AI: {systemStatus.ai?.is_running ? '进化中' : '暂停'}
              </span>
            </div>

            {/* 数据源 */}
            <div className="flex items-center gap-1.5">
              <Database className={`w-3.5 h-3.5 ${isLive ? 'text-green-500' : 'text-yellow-500'}`} />
              <span className={isLive ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                {dataSourceActive === 'demo' ? '模拟数据' :
                 dataSourceActive === 'none' ? '无数据' :
                 `实时: ${dataSourceActive}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* 时间戳 */}
            <div className="text-gray-400 dark:text-slate-500">
              {new Date().toLocaleTimeString('zh-CN')}
            </div>
            
            {/* 设置 */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
