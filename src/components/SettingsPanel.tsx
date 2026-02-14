/**
 * 设置面板组件
 * 包含API配置、交易所切换、AI配置、主题设置等
 */

import { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Globe, 
  Bot, 
  Palette,
  Server,
  Shield,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Target,
  Zap,
  TrendingUp,
  Plus,
  Trash2
} from 'lucide-react';

interface SettingsConfig {
  // 交易所配置
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  testnet: boolean;
  
  // AI配置
  ollamaUrl: string;
  ollamaModel: string;
  deepseekKey: string;
  glmKey: string;
  openaiKey: string;
  claudeKey: string;
  geminiKey: string;
  kimiKey: string;
  qwenKey: string;
  aiProvider: 'ollama' | 'deepseek' | 'glm' | 'openai' | 'claude' | 'gemini' | 'kimi' | 'qwen' | 'auto';
  
  // AI进化配置
  aiEvolutionEnabled: boolean;
  aiEvolutionInterval: number; // 进化周期(小时)
  aiEvolutionGoals: string[];  // 进化目标
  aiRiskTolerance: 'conservative' | 'balanced' | 'aggressive';
  aiMaxDrawdown: number;       // 最大回撤限制
  aiTargetWinRate: number;     // 目标胜率
  
  // 主题配置
  theme: 'dark' | 'light' | 'system';
  
  // 通用配置
  language: string;
  notifications: boolean;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: SettingsConfig;
  onSave: (config: SettingsConfig) => void;
}

const EXCHANGES = [
  { value: 'binance', label: 'Binance', icon: '₿' },
  { value: 'okx', label: 'OKX', icon: 'O' },
  { value: 'bybit', label: 'Bybit', icon: 'B' },
  { value: 'gate', label: 'Gate.io', icon: 'G' },
  { value: 'huobi', label: 'Huobi', icon: 'H' },
  { value: 'kucoin', label: 'KuCoin', icon: 'K' },
];

const OLLAMA_MODELS = [
  'qwen2.5:7b',
  'qwen2.5:1.5b',
  'llama3.2:3b',
  'llama3.2:1b',
  'gemma2:2b',
  'phi3:mini',
  'mistral:7b',
  'codellama:7b',
];

// 默认AI进化目标
const DEFAULT_EVOLUTION_GOALS = [
  '提高交易信号准确率',
  '优化入场时机判断',
  '降低假信号率',
  '提升趋势识别能力',
  '改进止损止盈策略',
];

export default function SettingsPanel({ isOpen, onClose, config, onSave }: SettingsPanelProps) {
  const [localConfig, setLocalConfig] = useState<SettingsConfig>(config);
  const [activeTab, setActiveTab] = useState<'exchange' | 'ai' | 'evolution' | 'theme' | 'general'>('exchange');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [newGoal, setNewGoal] = useState('');

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    
    // 模拟测试连接
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 随机结果（实际应该调用后端API测试）
    setConnectionStatus(localConfig.apiKey && localConfig.apiSecret ? 'success' : 'error');
    setTestingConnection(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl w-[600px] max-w-[95%] max-h-[90vh] overflow-hidden shadow-2xl border border-slate-700">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">系统设置</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-slate-700">
          {[
            { key: 'exchange', label: '交易所', icon: Globe },
            { key: 'ai', label: 'AI配置', icon: Bot },
            { key: 'evolution', label: 'AI进化', icon: Zap },
            { key: 'theme', label: '主题', icon: Palette },
            { key: 'general', label: '通用', icon: Server },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
                activeTab === key
                  ? 'text-blue-400 bg-blue-600/10 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* 交易所配置 */}
          {activeTab === 'exchange' && (
            <div className="space-y-6">
              {/* 交易所选择 */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">选择交易所</label>
                <div className="grid grid-cols-3 gap-2">
                  {EXCHANGES.map(ex => (
                    <button
                      key={ex.value}
                      onClick={() => setLocalConfig({ ...localConfig, exchange: ex.value })}
                      className={`p-3 rounded-lg text-center transition-all ${
                        localConfig.exchange === ex.value
                          ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400'
                          : 'bg-slate-700/50 border-2 border-transparent text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <div className="text-xl mb-1">{ex.icon}</div>
                      <div className="text-xs">{ex.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  <Key className="w-4 h-4 inline mr-1" />
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={localConfig.apiKey}
                    onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                    placeholder="输入API Key"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* API Secret */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  <Shield className="w-4 h-4 inline mr-1" />
                  API Secret
                </label>
                <div className="relative">
                  <input
                    type={showApiSecret ? 'text' : 'password'}
                    value={localConfig.apiSecret}
                    onChange={(e) => setLocalConfig({ ...localConfig, apiSecret: e.target.value })}
                    placeholder="输入API Secret"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => setShowApiSecret(!showApiSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showApiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Passphrase (OKX等需要) */}
              {(localConfig.exchange === 'okx' || localConfig.exchange === 'kucoin') && (
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Passphrase</label>
                  <input
                    type="password"
                    value={localConfig.passphrase || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, passphrase: e.target.value })}
                    placeholder="输入Passphrase"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* 测试网络 */}
              <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div>
                  <div className="text-sm text-white">测试网络模式</div>
                  <div className="text-xs text-slate-400">使用交易所测试网进行模拟交易</div>
                </div>
                <button
                  onClick={() => setLocalConfig({ ...localConfig, testnet: !localConfig.testnet })}
                  className={`w-12 h-6 rounded-full transition-all ${
                    localConfig.testnet ? 'bg-blue-600' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    localConfig.testnet ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* 测试连接 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={testConnection}
                  disabled={testingConnection || !localConfig.apiKey || !localConfig.apiSecret}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                >
                  {testingConnection ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                  测试连接
                </button>
                {connectionStatus === 'success' && (
                  <div className="flex items-center gap-1 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    连接成功
                  </div>
                )}
                {connectionStatus === 'error' && (
                  <div className="flex items-center gap-1 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    连接失败
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI配置 */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              {/* AI提供者选择 */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">AI模型选择</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'auto', label: '自动选择', desc: '智能切换' },
                    { value: 'ollama', label: 'Ollama', desc: '本地部署' },
                    { value: 'deepseek', label: 'DeepSeek', desc: '深度求索' },
                    { value: 'openai', label: 'OpenAI', desc: 'GPT系列' },
                    { value: 'claude', label: 'Claude', desc: 'Anthropic' },
                    { value: 'gemini', label: 'Gemini', desc: 'Google' },
                    { value: 'kimi', label: 'Kimi', desc: '月之暗面' },
                    { value: 'qwen', label: '通义千问', desc: '阿里云' },
                    { value: 'glm', label: '智谱GLM', desc: '清华系' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setLocalConfig({ ...localConfig, aiProvider: opt.value as SettingsConfig['aiProvider'] })}
                      className={`p-2.5 rounded-lg text-left transition-all ${
                        localConfig.aiProvider === opt.value
                          ? 'bg-purple-600/20 border-2 border-purple-500 text-purple-400'
                          : 'bg-slate-700/50 border-2 border-transparent text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-[10px] opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ollama本地配置 */}
              <div className="p-4 bg-slate-700/30 rounded-lg space-y-4">
                <div className="text-sm text-white font-medium flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-400" />
                  Ollama 本地配置
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ollama地址</label>
                  <input
                    type="text"
                    value={localConfig.ollamaUrl}
                    onChange={(e) => setLocalConfig({ ...localConfig, ollamaUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">模型选择</label>
                  <select
                    value={localConfig.ollamaModel}
                    onChange={(e) => setLocalConfig({ ...localConfig, ollamaModel: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    {OLLAMA_MODELS.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* API Keys配置 */}
              <div className="space-y-3">
                <div className="text-sm text-slate-300 font-medium">在线API配置</div>
                
                {/* OpenAI */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">OpenAI API Key</label>
                  <input
                    type="password"
                    value={localConfig.openaiKey || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, openaiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Claude */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Claude API Key</label>
                  <input
                    type="password"
                    value={localConfig.claudeKey || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, claudeKey: e.target.value })}
                    placeholder="sk-ant-..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Gemini */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Gemini API Key</label>
                  <input
                    type="password"
                    value={localConfig.geminiKey || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, geminiKey: e.target.value })}
                    placeholder="AIza..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* DeepSeek */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">DeepSeek API Key</label>
                  <input
                    type="password"
                    value={localConfig.deepseekKey}
                    onChange={(e) => setLocalConfig({ ...localConfig, deepseekKey: e.target.value })}
                    placeholder="输入DeepSeek API Key"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Kimi */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Kimi (月之暗面) API Key</label>
                  <input
                    type="password"
                    value={localConfig.kimiKey || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, kimiKey: e.target.value })}
                    placeholder="输入Kimi API Key"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 通义千问 */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">通义千问 API Key</label>
                  <input
                    type="password"
                    value={localConfig.qwenKey || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, qwenKey: e.target.value })}
                    placeholder="输入通义千问 API Key"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 智谱GLM */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">智谱GLM API Key</label>
                  <input
                    type="password"
                    value={localConfig.glmKey}
                    onChange={(e) => setLocalConfig({ ...localConfig, glmKey: e.target.value })}
                    placeholder="输入智谱GLM API Key"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 提示信息 */}
              <div className="p-3 bg-blue-600/10 border border-blue-500/30 rounded-lg text-xs text-blue-300">
                <div className="font-medium mb-1">提示</div>
                <ul className="list-disc list-inside space-y-0.5 text-blue-300/80">
                  <li>自动选择模式会按照配置的优先级自动切换可用的AI服务</li>
                  <li>本地Ollama无需联网，推荐用于隐私敏感场景</li>
                  <li>在线服务需要有效的API Key才能使用</li>
                </ul>
              </div>
            </div>
          )}

          {/* AI进化设置 */}
          {activeTab === 'evolution' && (
            <div className="space-y-6">
              {/* 进化开关 */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl border border-purple-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600/30 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">AI自我进化</div>
                    <div className="text-xs text-slate-400">启用后AI将自动学习并改进策略</div>
                  </div>
                </div>
                <button
                  onClick={() => setLocalConfig({ ...localConfig, aiEvolutionEnabled: !localConfig.aiEvolutionEnabled })}
                  className={`w-14 h-7 rounded-full transition-all ${
                    localConfig.aiEvolutionEnabled ? 'bg-purple-600' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    localConfig.aiEvolutionEnabled ? 'translate-x-7' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* 进化周期 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-300">进化周期</label>
                  <span className="text-sm text-purple-400 font-mono">{localConfig.aiEvolutionInterval || 6} 小时</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={localConfig.aiEvolutionInterval || 6}
                  onChange={(e) => setLocalConfig({ ...localConfig, aiEvolutionInterval: parseInt(e.target.value) })}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>1小时</span>
                  <span>12小时</span>
                  <span>24小时</span>
                </div>
              </div>

              {/* 风险偏好 */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">风险偏好</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'conservative', label: '保守', desc: '低风险低收益', color: 'green' },
                    { value: 'balanced', label: '平衡', desc: '中等风险收益', color: 'yellow' },
                    { value: 'aggressive', label: '激进', desc: '高风险高收益', color: 'red' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setLocalConfig({ ...localConfig, aiRiskTolerance: opt.value as SettingsConfig['aiRiskTolerance'] })}
                      className={`p-3 rounded-lg text-center transition-all ${
                        localConfig.aiRiskTolerance === opt.value
                          ? `bg-${opt.color}-600/20 border-2 border-${opt.color}-500 text-${opt.color}-400`
                          : 'bg-slate-700/50 border-2 border-transparent text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-[10px] opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 目标参数 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-300">目标胜率</label>
                    <span className="text-sm text-green-400 font-mono">{localConfig.aiTargetWinRate || 60}%</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="90"
                    value={localConfig.aiTargetWinRate || 60}
                    onChange={(e) => setLocalConfig({ ...localConfig, aiTargetWinRate: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-300">最大回撤</label>
                    <span className="text-sm text-red-400 font-mono">{localConfig.aiMaxDrawdown || 10}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={localConfig.aiMaxDrawdown || 10}
                    onChange={(e) => setLocalConfig({ ...localConfig, aiMaxDrawdown: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                </div>
              </div>

              {/* 进化目标 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-300 flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-400" />
                    进化目标
                  </label>
                  <span className="text-xs text-slate-500">{(localConfig.aiEvolutionGoals || []).length} 个目标</span>
                </div>
                
                {/* 目标列表 */}
                <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                  {(localConfig.aiEvolutionGoals || DEFAULT_EVOLUTION_GOALS).map((goal, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="flex-1 text-sm text-slate-300">{goal}</span>
                      <button
                        onClick={() => {
                          const goals = [...(localConfig.aiEvolutionGoals || DEFAULT_EVOLUTION_GOALS)];
                          goals.splice(index, 1);
                          setLocalConfig({ ...localConfig, aiEvolutionGoals: goals });
                        }}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* 添加新目标 */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    placeholder="输入新的进化目标..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newGoal.trim()) {
                        const goals = [...(localConfig.aiEvolutionGoals || DEFAULT_EVOLUTION_GOALS), newGoal.trim()];
                        setLocalConfig({ ...localConfig, aiEvolutionGoals: goals });
                        setNewGoal('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newGoal.trim()) {
                        const goals = [...(localConfig.aiEvolutionGoals || DEFAULT_EVOLUTION_GOALS), newGoal.trim()];
                        setLocalConfig({ ...localConfig, aiEvolutionGoals: goals });
                        setNewGoal('');
                      }
                    }}
                    disabled={!newGoal.trim()}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 进化说明 */}
              <div className="p-3 bg-purple-600/10 border border-purple-500/30 rounded-lg text-xs text-purple-300">
                <div className="font-medium mb-1">AI进化机制说明</div>
                <ul className="list-disc list-inside space-y-0.5 text-purple-300/80">
                  <li>AI会根据历史交易记录自动优化策略参数</li>
                  <li>进化周期越短，适应市场变化越快，但可能过拟合</li>
                  <li>进化目标决定了AI优化的方向和重点</li>
                  <li>建议定期检查AI生成的策略并进行人工审核</li>
                </ul>
              </div>
            </div>
          )}

          {/* 主题配置 */}
          {activeTab === 'theme' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-slate-300 mb-3">界面主题</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'dark', label: '深色', icon: '🌙', desc: '深色背景' },
                    { value: 'light', label: '浅色', icon: '☀️', desc: '浅色背景' },
                    { value: 'system', label: '跟随系统', icon: '💻', desc: '自动切换' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setLocalConfig({ ...localConfig, theme: opt.value as SettingsConfig['theme'] })}
                      className={`p-4 rounded-xl text-center transition-all ${
                        localConfig.theme === opt.value
                          ? 'bg-blue-600/20 border-2 border-blue-500'
                          : 'bg-slate-700/50 border-2 border-transparent hover:bg-slate-700'
                      }`}
                    >
                      <div className="text-3xl mb-2">{opt.icon}</div>
                      <div className="text-sm text-white font-medium">{opt.label}</div>
                      <div className="text-xs text-slate-400">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 预览 */}
              <div className="p-4 rounded-xl border border-slate-700">
                <div className="text-sm text-slate-300 mb-3">主题预览</div>
                <div className={`p-4 rounded-lg ${
                  localConfig.theme === 'light' ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
                }`}>
                  <div className="text-lg font-bold mb-2">XTMC量化交易</div>
                  <div className={`text-sm ${localConfig.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    专业的加密货币量化交易系统
                  </div>
                  <div className="flex gap-2 mt-3">
                    <span className="px-2 py-1 bg-green-500/20 text-green-500 rounded text-xs">买入</span>
                    <span className="px-2 py-1 bg-red-500/20 text-red-500 rounded text-xs">卖出</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 通用设置 */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* 语言 */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">界面语言</label>
                <select
                  value={localConfig.language}
                  onChange={(e) => setLocalConfig({ ...localConfig, language: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                  <option value="ja-JP">日本語</option>
                  <option value="ko-KR">한국어</option>
                </select>
              </div>

              {/* 通知 */}
              <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div>
                  <div className="text-sm text-white">交易通知</div>
                  <div className="text-xs text-slate-400">收到交易信号时推送通知</div>
                </div>
                <button
                  onClick={() => setLocalConfig({ ...localConfig, notifications: !localConfig.notifications })}
                  className={`w-12 h-6 rounded-full transition-all ${
                    localConfig.notifications ? 'bg-blue-600' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    localConfig.notifications ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* 系统信息 */}
              <div className="p-4 bg-slate-700/30 rounded-lg space-y-2">
                <div className="text-sm text-white font-medium">系统信息</div>
                <div className="text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>版本</span>
                    <span>v2.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span>前端框架</span>
                    <span>React 19 + TypeScript</span>
                  </div>
                  <div className="flex justify-between">
                    <span>图表库</span>
                    <span>Lightweight Charts v4</span>
                  </div>
                  <div className="flex justify-between">
                    <span>后端框架</span>
                    <span>FastAPI + WebSocket</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-slate-400 hover:text-white transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
          >
            <Save className="w-4 h-4" />
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
