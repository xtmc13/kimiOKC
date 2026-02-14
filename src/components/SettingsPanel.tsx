/**
 * XTMC 设置面板组件
 * 支持交易所配置、AI配置、进化目标设置、主题设置
 */

import { useState } from 'react';
import { X, Eye, EyeOff, Save, Settings, Brain, Palette, Shield, Target } from 'lucide-react';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: any;
  onSave: (config: any) => void;
}

export default function SettingsPanel({ isOpen, onClose, config, onSave }: SettingsPanelProps) {
  const [localConfig, setLocalConfig] = useState(config);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [activeTab, setActiveTab] = useState('exchange');
  const [newGoal, setNewGoal] = useState('');

  if (!isOpen) return null;

  const update = (key: string, value: any) => {
    setLocalConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  const addGoal = () => {
    if (newGoal.trim()) {
      update('aiEvolutionGoals', [...(localConfig.aiEvolutionGoals || []), newGoal.trim()]);
      setNewGoal('');
    }
  };

  const removeGoal = (index: number) => {
    update('aiEvolutionGoals', localConfig.aiEvolutionGoals.filter((_: any, i: number) => i !== index));
  };

  const tabs = [
    { key: 'exchange', label: '交易所', icon: Settings },
    { key: 'ai', label: 'AI配置', icon: Brain },
    { key: 'evolution', label: 'AI进化', icon: Target },
    { key: 'risk', label: '风控', icon: Shield },
    { key: 'theme', label: '外观', icon: Palette },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">系统设置</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[calc(85vh-130px)]">
          {/* 侧边标签 */}
          <div className="w-40 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30 p-2">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all mb-1 ${
                  activeTab === key
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 hover:text-gray-700 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {activeTab === 'exchange' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">交易所</label>
                  <select
                    value={localConfig.exchange}
                    onChange={(e) => update('exchange', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="binance">Binance</option>
                    <option value="okx">OKX</option>
                    <option value="bybit">Bybit</option>
                    <option value="gate">Gate.io</option>
                    <option value="bitget">Bitget</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">API Key</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={localConfig.apiKey}
                      onChange={(e) => update('apiKey', e.target.value)}
                      placeholder="输入API Key"
                      className="w-full px-3 py-2 pr-10 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">API Secret</label>
                  <div className="relative">
                    <input
                      type={showApiSecret ? 'text' : 'password'}
                      value={localConfig.apiSecret}
                      onChange={(e) => update('apiSecret', e.target.value)}
                      placeholder="输入API Secret"
                      className="w-full px-3 py-2 pr-10 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button onClick={() => setShowApiSecret(!showApiSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
                      {showApiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">Passphrase (如需要)</label>
                  <input
                    type="password"
                    value={localConfig.passphrase}
                    onChange={(e) => update('passphrase', e.target.value)}
                    placeholder="OKX等交易所需要"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localConfig.testnet}
                    onChange={(e) => update('testnet', e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600 text-blue-500"
                  />
                  <span className="text-xs text-gray-600 dark:text-slate-300">使用测试网</span>
                </label>
              </>
            )}

            {activeTab === 'ai' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">AI提供商</label>
                  <select
                    value={localConfig.aiProvider}
                    onChange={(e) => update('aiProvider', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="auto">自动选择</option>
                    <option value="ollama">Ollama (本地)</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="openai">OpenAI</option>
                    <option value="claude">Claude</option>
                    <option value="gemini">Gemini</option>
                    <option value="kimi">Kimi</option>
                    <option value="qwen">通义千问</option>
                    <option value="glm">GLM</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">Ollama地址</label>
                  <input
                    type="text"
                    value={localConfig.ollamaUrl}
                    onChange={(e) => update('ollamaUrl', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">Ollama模型</label>
                  <input
                    type="text"
                    value={localConfig.ollamaModel}
                    onChange={(e) => update('ollamaModel', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                {['deepseekKey', 'openaiKey', 'claudeKey', 'geminiKey', 'kimiKey', 'qwenKey', 'glmKey'].map(key => (
                  <div key={key}>
                    <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">
                      {key.replace('Key', '').replace(/^\w/, c => c.toUpperCase())} API Key
                    </label>
                    <input
                      type="password"
                      value={localConfig[key] || ''}
                      onChange={(e) => update(key, e.target.value)}
                      placeholder="输入API Key"
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
              </>
            )}

            {activeTab === 'evolution' && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localConfig.aiEvolutionEnabled}
                    onChange={(e) => update('aiEvolutionEnabled', e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600 text-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">启用AI自我进化</span>
                </label>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">进化间隔 (小时)</label>
                  <input
                    type="number"
                    min={1}
                    max={48}
                    value={localConfig.aiEvolutionInterval}
                    onChange={(e) => update('aiEvolutionInterval', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-2 block">进化目标</label>
                  <div className="space-y-2 mb-3">
                    {(localConfig.aiEvolutionGoals || []).map((goal: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                        <Target className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className="flex-1 text-xs text-gray-700 dark:text-slate-300">{goal}</span>
                        <button onClick={() => removeGoal(i)} className="text-gray-400 dark:text-slate-500 hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGoal}
                      onChange={(e) => setNewGoal(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                      placeholder="添加新的进化目标..."
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button onClick={addGoal} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs">添加</button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'risk' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">风险偏好</label>
                  <select
                    value={localConfig.aiRiskTolerance}
                    onChange={(e) => update('aiRiskTolerance', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="conservative">保守</option>
                    <option value="balanced">均衡</option>
                    <option value="aggressive">激进</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">最大回撤 (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={localConfig.aiMaxDrawdown}
                    onChange={(e) => update('aiMaxDrawdown', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">目标胜率 (%)</label>
                  <input
                    type="number"
                    min={30}
                    max={90}
                    value={localConfig.aiTargetWinRate}
                    onChange={(e) => update('aiTargetWinRate', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {activeTab === 'theme' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-2 block">主题</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: 'dark', label: '深色' },
                      { key: 'light', label: '浅色' },
                      { key: 'system', label: '跟随系统' },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => update('theme', key)}
                        className={`py-2.5 rounded-lg text-xs font-medium transition-all ${
                          localConfig.theme === key
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-slate-700/50 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">语言</label>
                  <select
                    value={localConfig.language}
                    onChange={(e) => update('language', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="zh-CN">中文</option>
                    <option value="en-US">English</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localConfig.notifications}
                    onChange={(e) => update('notifications', e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600 text-blue-500"
                  />
                  <span className="text-xs text-gray-600 dark:text-slate-300">启用通知</span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors">
            取消
          </button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
            <Save className="w-4 h-4" />
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
