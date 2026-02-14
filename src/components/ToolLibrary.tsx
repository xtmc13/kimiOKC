/**
 * AI工具库组件
 */

import { Wrench, Code, CheckCircle } from 'lucide-react';
import type { AITool } from '../types';

interface ToolLibraryProps {
  tools: AITool[];
}

export default function ToolLibrary({ tools }: ToolLibraryProps) {
  const getComplexityColor = (complexity?: string) => {
    switch (complexity) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Wrench className="w-5 h-5 text-purple-400" />
          AI工具库
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          XTMC AI自动生成的交易分析工具
        </p>
      </div>

      {tools.length === 0 ? (
        <div className="text-center py-12">
          <Code className="w-12 h-12 text-gray-400 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-slate-400">暂无AI工具</p>
          <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">
            AI会在进化周期中自动生成工具
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tools.map((tool, index) => (
            <div
              key={index}
              className="p-4 bg-gray-100 dark:bg-slate-700/30 rounded-lg border border-gray-200 dark:border-slate-600/30 hover:border-purple-500/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{tool.name}</div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">
                      {tool.description || 'AI生成的交易分析工具'}
                    </div>
                  </div>
                </div>
                {tool.complexity && (
                  <span className={`text-xs ${getComplexityColor(tool.complexity)}`}>
                    {tool.complexity === 'low' ? '简单' : 
                     tool.complexity === 'medium' ? '中等' : '复杂'}
                  </span>
                )}
              </div>

              {tool.indicators && tool.indicators.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600/30">
                  <div className="text-xs text-gray-500 dark:text-slate-500 mb-2">使用指标:</div>
                  <div className="flex flex-wrap gap-2">
                    {tool.indicators.map((ind, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600/50 text-gray-600 dark:text-slate-300 rounded"
                      >
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
