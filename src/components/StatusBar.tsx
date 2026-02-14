/**
 * XTMC状态栏组件
 * 显示系统连接状态、数据源、AI状态、CPU/内存/存储实时监控
 */

import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Server, Activity, Brain, Database, HardDrive, Cpu, MemoryStick } from 'lucide-react';
import type { SystemStatus } from '../types';

interface StatusBarProps {
  systemStatus: SystemStatus;
  isConnected: boolean;
}

interface BrowserMetrics {
  cpuPercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryPercent: number;
  storageUsedGB: number;
  storageTotalGB: number;
  storagePercent: number;
}

export default function StatusBar({ systemStatus, isConnected }: StatusBarProps) {
  const [metrics, setMetrics] = useState<BrowserMetrics>({
    cpuPercent: 0,
    memoryUsedMB: 0,
    memoryTotalMB: 0,
    memoryPercent: 0,
    storageUsedGB: 0,
    storageTotalGB: 0,
    storagePercent: 0,
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const cpuSamplesRef = useRef<number[]>([]);

  // 时钟更新
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 浏览器端性能监控
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();
    let busyTime = 0;
    let sampleCount = 0;

    // CPU估算：通过测量主线程繁忙程度
    const measureCPU = () => {
      const now = performance.now();
      const elapsed = now - lastTime;
      lastTime = now;

      // 如果帧间隔超过正常值(~16ms)，说明CPU较忙
      if (elapsed > 0) {
        const idealFrame = 16.67;
        const load = Math.min(elapsed / idealFrame, 10); // cap at 10x
        busyTime += load;
        sampleCount++;
      }
      rafId = requestAnimationFrame(measureCPU);
    };
    rafId = requestAnimationFrame(measureCPU);

    // 定期采集指标
    const interval = setInterval(async () => {
      const newMetrics: Partial<BrowserMetrics> = {};

      // CPU估算
      if (sampleCount > 0) {
        const avgLoad = busyTime / sampleCount;
        // 归一化到0-100%范围，1.0=正常空闲，越高越忙
        const cpuPercent = Math.min(Math.max((avgLoad - 1) * 20, 0), 100);
        cpuSamplesRef.current.push(cpuPercent);
        if (cpuSamplesRef.current.length > 10) cpuSamplesRef.current.shift();
        // 平滑值
        const smoothed = cpuSamplesRef.current.reduce((a, b) => a + b, 0) / cpuSamplesRef.current.length;
        newMetrics.cpuPercent = smoothed;
        busyTime = 0;
        sampleCount = 0;
      }

      // 内存 (Chrome performance.memory API)
      const perfMemory = (performance as any).memory;
      if (perfMemory) {
        const usedMB = Math.round(perfMemory.usedJSHeapSize / 1024 / 1024);
        const totalMB = Math.round(perfMemory.jsHeapSizeLimit / 1024 / 1024);
        newMetrics.memoryUsedMB = usedMB;
        newMetrics.memoryTotalMB = totalMB;
        newMetrics.memoryPercent = totalMB > 0 ? (usedMB / totalMB) * 100 : 0;
      }

      // 存储 (Storage API)
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          const usedGB = (estimate.usage || 0) / (1024 * 1024 * 1024);
          const totalGB = (estimate.quota || 0) / (1024 * 1024 * 1024);
          newMetrics.storageUsedGB = usedGB;
          newMetrics.storageTotalGB = totalGB;
          newMetrics.storagePercent = totalGB > 0 ? (usedGB / totalGB) * 100 : 0;
        } catch {
          // Storage API not available
        }
      }

      setMetrics(prev => ({ ...prev, ...newMetrics }));
    }, 3000);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(interval);
    };
  }, []);

  const formatMemory = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
    return `${Math.round(mb)}MB`;
  };

  const formatStorage = (gb: number) => {
    if (gb >= 1) return `${gb.toFixed(1)}GB`;
    return `${(gb * 1024).toFixed(0)}MB`;
  };

  // 优先使用后端数据，没有则用浏览器端数据
  const cpuPercent = systemStatus.system?.cpu_percent || metrics.cpuPercent;
  const memUsed = systemStatus.system?.memory_used || metrics.memoryUsedMB;
  const memTotal = systemStatus.system?.memory_total || metrics.memoryTotalMB;
  const memPercent = systemStatus.system?.memory_percent || metrics.memoryPercent;

  const dataSource = systemStatus.data_source?.active || 'none';
  const isRealData = dataSource !== 'none' && dataSource !== 'demo';

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-200 dark:border-slate-700/50 z-40">
      <div className="container mx-auto px-4 py-1.5">
        <div className="flex items-center justify-between text-xs">
          {/* 左侧：连接 & 数据源 & 服务器 & AI */}
          <div className="flex items-center gap-3">
            {/* 连接状态 */}
            <div className="flex items-center gap-1">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">已连接</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-500" />
                  <span className="text-red-600 dark:text-red-400">未连接</span>
                </>
              )}
            </div>

            <span className="text-gray-300 dark:text-slate-600">|</span>

            {/* 数据源状态 */}
            <div className="flex items-center gap-1">
              <Database className={`w-3 h-3 ${isRealData ? 'text-green-400' : 'text-yellow-500'}`} />
              <span className={isRealData ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                {isRealData ? `实时: ${dataSource}` : '模拟数据'}
              </span>
            </div>

            <span className="text-gray-300 dark:text-slate-600">|</span>

            {/* 服务器状态 */}
            <div className="flex items-center gap-1">
              <Server className="w-3 h-3 text-blue-400" />
              <span className="text-gray-600 dark:text-slate-400">
                {systemStatus.status === 'running' ? '运行中' : '已停止'}
              </span>
            </div>

            <span className="text-gray-300 dark:text-slate-600">|</span>

            {/* AI状态 */}
            <div className="flex items-center gap-1">
              <Brain className="w-3 h-3 text-purple-400" />
              <span className="text-gray-600 dark:text-slate-400">
                AI: {systemStatus.ai?.is_running ? '进化中' : '暂停'}
              </span>
            </div>
          </div>

          {/* 右侧：CPU / 内存 / 存储 / 时间 */}
          <div className="flex items-center gap-3">
            {/* CPU使用率 */}
            <div className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-400" />
              <span className="text-gray-600 dark:text-slate-400">CPU</span>
              <span className={`font-mono ${
                cpuPercent > 80 ? 'text-red-400' : cpuPercent > 50 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {cpuPercent.toFixed(1)}%
              </span>
            </div>

            <span className="text-gray-300 dark:text-slate-600">|</span>

            {/* 内存使用 */}
            <div className="flex items-center gap-1.5">
              <MemoryStick className="w-3 h-3 text-blue-400" />
              <div className="w-14 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    memPercent > 80 ? 'bg-red-500' : memPercent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(memPercent, 100)}%` }}
                />
              </div>
              <span className="text-gray-600 dark:text-slate-400 font-mono">
                {formatMemory(memUsed)}/{formatMemory(memTotal || 4096)}
              </span>
            </div>

            <span className="text-gray-300 dark:text-slate-600">|</span>

            {/* 存储使用 */}
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3 h-3 text-orange-400" />
              <div className="w-14 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    metrics.storagePercent > 80 ? 'bg-red-500' : metrics.storagePercent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(metrics.storagePercent, 100)}%` }}
                />
              </div>
              <span className="text-gray-600 dark:text-slate-400 font-mono">
                {formatStorage(metrics.storageUsedGB)}/{formatStorage(metrics.storageTotalGB)}
              </span>
            </div>

            <span className="text-gray-300 dark:text-slate-600">|</span>

            {/* 时间 */}
            <div className="text-gray-500 dark:text-slate-500 font-mono">
              {currentTime.toLocaleTimeString('zh-CN')}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
