/**
 * 进化历史组件
 */

import { RefreshCw, Lightbulb, AlertCircle, CheckCircle } from 'lucide-react';
import type { EvolutionRecord } from '../types';

interface EvolutionPanelProps {
  records: EvolutionRecord[];
}

export default function EvolutionPanel({ records }: EvolutionPanelProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-pink-400" />
          AI进化历史
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          XTMC AI自我反思与进化的记录
        </p>
      </div>

      {/* 进化流程说明 */}
      <div className="mb-6 p-4 bg-gradient-to-r from-purple-100 dark:from-purple-900/30 to-pink-100 dark:to-pink-900/30 rounded-lg border border-purple-300 dark:border-purple-500/30">
        <div className="text-sm font-medium text-purple-600 dark:text-purple-300 mb-3">自我进化循环</div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              <span className="text-purple-500 dark:text-purple-400">1</span>
            </div>
            <span className="text-gray-500 dark:text-slate-400">反思</span>
          </div>
          <div className="flex-1 h-px bg-purple-300 dark:bg-purple-500/30 mx-2" />
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              <span className="text-purple-500 dark:text-purple-400">2</span>
            </div>
            <span className="text-gray-500 dark:text-slate-400">规划</span>
          </div>
          <div className="flex-1 h-px bg-purple-300 dark:bg-purple-500/30 mx-2" />
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              <span className="text-purple-500 dark:text-purple-400">3</span>
            </div>
            <span className="text-gray-500 dark:text-slate-400">生成</span>
          </div>
          <div className="flex-1 h-px bg-purple-300 dark:bg-purple-500/30 mx-2" />
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              <span className="text-purple-500 dark:text-purple-400">4</span>
            </div>
            <span className="text-gray-500 dark:text-slate-400">测试</span>
          </div>
          <div className="flex-1 h-px bg-purple-300 dark:bg-purple-500/30 mx-2" />
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              <span className="text-purple-500 dark:text-purple-400">5</span>
            </div>
            <span className="text-gray-500 dark:text-slate-400">保存</span>
          </div>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12">
          <Lightbulb className="w-12 h-12 text-gray-400 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-slate-400">暂无进化记录</p>
          <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">
            AI每6小时执行一次进化周期
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record, index) => (
            <div
              key={index}
              className="p-4 bg-gray-100 dark:bg-slate-700/30 rounded-lg border border-gray-200 dark:border-slate-600/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">进化周期 #{records.length - index}</div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">{formatTime(record.timestamp)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600/30">
                <div className="text-sm text-gray-700 dark:text-slate-300">{record.summary}</div>
              </div>

              <div className="mt-3 flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-yellow-500" />
                  <span className="text-gray-500 dark:text-slate-400">发现缺口: {record.gaps}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Lightbulb className="w-3 h-3 text-blue-500" />
                  <span className="text-gray-500 dark:text-slate-400">建议改进: {record.recommendations}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
