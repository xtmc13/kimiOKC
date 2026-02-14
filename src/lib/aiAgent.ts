/**
 * XTMC AI智能体系统 v2.0
 * 真正的AI智能体：LLM驱动 + 工具调用 + 系统控制
 * 
 * 架构:
 * 1. LLM层: 接入真实大模型(DeepSeek/GLM/OpenAI/Ollama)进行推理
 * 2. 工具层: 15+系统工具，可控制交易系统的各个方面
 * 3. 回退层: 无LLM时使用本地模式匹配
 */

import type { SystemStatus, TradeConfig, MarketData, TradeSignal } from '../types';
import { LLMClient, type LLMConfig, type LLMMessage } from './llmClient';

// AI上下文接口
export interface AIContext {
  systemStatus: SystemStatus;
  tradeConfig: TradeConfig;
  marketData: MarketData[];
  signals: TradeSignal[];
  currentSymbol: string;
  currentPrice: number;
  onUpdateConfig: (config: Partial<TradeConfig>) => void;
  onSwitchSymbol: (symbol: string) => void;
  onExecuteSignal: (signal: TradeSignal) => void;
  onAddIndicator: (indicatorId: string) => void;
  onChangeTimeframe: (timeframe: string) => void;
  onToggleTrading: (enabled: boolean) => void;
}

// 工具定义
interface ToolDef {
  id: string;
  name: string;
  category: string;
  description: string;
  parameters: Record<string, string>;
  execute: (ctx: AIContext, params: Record<string, string>) => Promise<string>;
}

// ============== 系统提示词 ==============

function buildSystemPrompt(ctx: AIContext): string {
  const data = ctx.marketData;
  const latest = data.length > 0 ? data[data.length - 1] : null;
  const price = latest ? latest.close.toFixed(2) : '未知';
  
  return `你是XTMC量化交易系统的AI智能体，拥有对整个交易系统的完全控制权限。

## 你的身份
- 你是一个专业的量化交易AI助手，具有独立思考和决策能力
- 你可以分析市场、执行交易、管理策略、控制系统配置
- 你的回答应该简洁、专业，使用中文

## 当前系统状态
- 交易对: ${ctx.currentSymbol}
- 当前价格: $${price}
- 交易状态: ${ctx.tradeConfig.enable_trading ? '已启用' : '已暂停'}
- 交易所: ${ctx.tradeConfig.exchange}
- 时间周期: ${ctx.tradeConfig.timeframe}
- 最大持仓: $${ctx.tradeConfig.max_position}
- 风险比例: ${ctx.tradeConfig.risk_percent}%
- AI状态: ${ctx.systemStatus.ai?.is_running ? '运行中' : '暂停'}
- 数据源: ${ctx.systemStatus.data_source?.active || '未知'}
- 信号数量: ${ctx.signals.length}条

## 可用工具
当你需要执行操作时，在回复中包含工具调用指令，格式：
<<TOOL:工具ID(参数1=值1, 参数2=值2)>>

可用工具列表：
1. get_status() - 获取完整系统状态报告
2. toggle_trading(enabled=true/false) - 开启/关闭自动交易
3. switch_symbol(symbol=BTCUSDT) - 切换交易对
4. change_timeframe(timeframe=1h) - 切换K线周期 (1m/5m/15m/1h/4h/1d)
5. update_risk(max_position=100, risk_percent=2) - 更新风控参数
6. analyze_market() - 深度分析当前行情（趋势、支撑阻力、指标）
7. get_signals() - 获取最近交易信号
8. generate_signal() - 基于当前数据即时生成交易信号
9. suggest_strategy() - 根据行情推荐交易策略
10. place_order(side=buy/sell, type=limit/market, price=0, amount=0) - 模拟下单
11. get_positions() - 查看当前持仓
12. get_balance() - 查看账户余额
13. set_stop_loss(price=0) - 设置止损价格
14. set_take_profit(price=0) - 设置止盈价格
15. backtest_strategy(strategy=ema_cross, period=30d) - 回测策略

## 行为准则
- 对于交易操作，始终附带风险提示
- 主动分析数据并给出建议，不要只是被动回答
- 可以主动建议优化策略和风控参数
- 如果发现潜在风险，主动预警`;
}

// ============== 工具库 ==============

function createTools(): ToolDef[] {
  return [
    {
      id: 'get_status',
      name: '系统状态',
      category: '系统',
      description: '获取完整系统状态报告',
      parameters: {},
      execute: async (ctx) => {
        const s = ctx.systemStatus;
        const data = ctx.marketData;
        const latest = data.length > 0 ? data[data.length - 1] : null;
        return `📊 **XTMC系统状态报告**

🔌 系统: ${s.status === 'running' ? '✅ 运行中' : '⛔ 已停止'}
📈 交易: ${s.trading.enabled ? '✅ 已启用' : '⏸️ 已暂停'} | ${s.trading.symbol} | ${s.trading.exchange}
💰 当前价格: ${latest ? `$${latest.close.toFixed(2)}` : '未知'}

🤖 AI引擎: ${s.ai.is_running ? '🟢 在线' : '🔴 离线'}
📡 数据源: ${s.data_source?.active || '未知'}
🛠️ 工具数: ${s.ai.tool_count}
📊 进化次数: ${s.ai.evolution_count}
🎯 胜率: ${(s.ai.win_rate * 100).toFixed(1)}%
💵 总收益: ${s.ai.total_profit.toFixed(2)} USDT

💻 CPU: ${s.system.cpu_percent.toFixed(1)}% | 内存: ${(s.system.memory_used / 1024).toFixed(1)}GB/${(s.system.memory_total / 1024).toFixed(1)}GB`;
      },
    },
    {
      id: 'toggle_trading',
      name: '交易开关',
      category: '系统',
      description: '开启或关闭自动交易',
      parameters: { enabled: 'true/false' },
      execute: async (ctx, params) => {
        const enable = params.enabled !== 'false';
        ctx.onToggleTrading(enable);
        return enable
          ? '✅ 已开启自动交易。系统将根据AI信号自动执行交易。\n⚠️ 请确保已配置API密钥和风控参数。'
          : '⏸️ 已暂停自动交易。系统继续监控但不执行。';
      },
    },
    {
      id: 'switch_symbol',
      name: '切换交易对',
      category: '交易',
      description: '切换当前交易币种',
      parameters: { symbol: '交易对名称' },
      execute: async (ctx, params) => {
        let symbol = (params.symbol || '').toUpperCase();
        if (symbol && !symbol.endsWith('USDT')) symbol += 'USDT';
        if (!symbol) return '❓ 请指定交易对，如 BTCUSDT、ETHUSDT';
        ctx.onSwitchSymbol(symbol);
        return `✅ 已切换至 **${symbol}**，正在加载数据...`;
      },
    },
    {
      id: 'change_timeframe',
      name: '切换周期',
      category: '交易',
      description: '更改K线时间周期',
      parameters: { timeframe: '1m/5m/15m/1h/4h/1d' },
      execute: async (ctx, params) => {
        const tf = params.timeframe || '';
        if (!['1m', '5m', '15m', '1h', '4h', '1d'].includes(tf)) {
          return '❓ 有效周期: 1m, 5m, 15m, 1h, 4h, 1d';
        }
        ctx.onChangeTimeframe(tf);
        return `✅ 已切换时间周期为 **${tf}**`;
      },
    },
    {
      id: 'update_risk',
      name: '风控配置',
      category: '系统',
      description: '更新风险控制参数',
      parameters: { max_position: '最大持仓金额', risk_percent: '风险比例%' },
      execute: async (ctx, params) => {
        const updates: Partial<TradeConfig> = {};
        if (params.max_position) updates.max_position = parseFloat(params.max_position);
        if (params.risk_percent) updates.risk_percent = parseFloat(params.risk_percent);
        if (Object.keys(updates).length > 0) {
          ctx.onUpdateConfig(updates);
          return `✅ 风控已更新:\n${Object.entries(updates).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
        }
        return `📋 当前风控: 仓位$${ctx.tradeConfig.max_position}, 风险${ctx.tradeConfig.risk_percent}%\n💡 说"设置仓位500"或"风险3%"来修改`;
      },
    },
    {
      id: 'analyze_market',
      name: '行情分析',
      category: '分析',
      description: '深度分析当前市场行情',
      parameters: {},
      execute: async (ctx) => {
        const data = ctx.marketData;
        if (data.length < 20) return '⚠️ 数据不足，请等待加载。';
        const latest = data[data.length - 1];
        const prev = data[data.length - 2];
        const closes = data.map(d => d.close);
        const high24 = Math.max(...data.slice(-24).map(d => d.high));
        const low24 = Math.min(...data.slice(-24).map(d => d.low));
        const change = ((latest.close - prev.close) / prev.close * 100);
        const avgVol = data.slice(-20).reduce((s, d) => s + d.volume, 0) / 20;
        const volRatio = latest.volume / avgVol;
        const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
        const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const trend = sma10 > sma20 ? '📈 上涨趋势' : sma10 < sma20 ? '📉 下跌趋势' : '↔️ 横盘震荡';
        
        // RSI
        let avgGain = 0, avgLoss = 0;
        for (let i = closes.length - 14; i < closes.length; i++) {
          const d = closes[i] - closes[i - 1];
          if (d > 0) avgGain += d; else avgLoss -= d;
        }
        avgGain /= 14; avgLoss /= 14;
        const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

        return `📊 **${ctx.currentSymbol} 深度分析**

💰 价格: $${latest.close.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)
📊 24H区间: $${low24.toFixed(2)} ~ $${high24.toFixed(2)}
${trend}

📈 **技术指标**
- MA10: $${sma10.toFixed(2)} | MA20: $${sma20.toFixed(2)}
- RSI(14): ${rsi.toFixed(1)} ${rsi > 70 ? '⚠️超买' : rsi < 30 ? '⚠️超卖' : '正常'}
- 量比: ${volRatio.toFixed(2)}x ${volRatio > 1.5 ? '(放量)' : volRatio < 0.5 ? '(缩量)' : '(正常)'}

🎯 **关键价位**
- 阻力: $${high24.toFixed(2)}
- 支撑: $${low24.toFixed(2)}

💡 ${trend.includes('上涨') ? '趋势偏多，回调可做多' : trend.includes('下跌') ? '趋势偏空，反弹可做空' : '震荡行情，可考虑网格策略'}
⚠️ 以上分析仅供参考，请做好风险管理。`;
      },
    },
    {
      id: 'get_signals',
      name: '交易信号',
      category: '分析',
      description: '获取最近交易信号',
      parameters: {},
      execute: async (ctx) => {
        if (ctx.signals.length === 0) return '📭 暂无信号，系统正在分析中...';
        const recent = ctx.signals.slice(0, 5);
        const list = recent.map((s, i) => {
          const emoji = s.action === 'BUY' ? '🟢' : s.action === 'SELL' ? '🔴' : '⚪';
          return `${i + 1}. ${emoji} ${s.action} @ $${s.price.toFixed(2)} | 信度${(s.confidence * 100).toFixed(0)}%\n   ${s.reason}`;
        }).join('\n');
        return `📡 **最近信号** (共${ctx.signals.length}条)\n\n${list}`;
      },
    },
    {
      id: 'generate_signal',
      name: '生成信号',
      category: '分析',
      description: '即时生成交易信号',
      parameters: {},
      execute: async (ctx) => {
        const data = ctx.marketData;
        if (data.length < 26) return '⚠️ 数据不足';
        const closes = data.map(d => d.close);
        const latest = closes[closes.length - 1];
        let avgGain = 0, avgLoss = 0;
        for (let i = closes.length - 14; i < closes.length; i++) {
          const d = closes[i] - closes[i - 1];
          if (d > 0) avgGain += d; else avgLoss -= d;
        }
        avgGain /= 14; avgLoss /= 14;
        const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        const ema12 = closes.slice(-12).reduce((a, b) => a + b, 0) / 12;
        const ema26 = closes.slice(-26).reduce((a, b) => a + b, 0) / 26;
        
        let action = 'HOLD', reason = '', conf = 0.5;
        if (rsi < 30 && ema12 > ema26) { action = 'BUY'; reason = 'RSI超卖+EMA金叉'; conf = 0.78; }
        else if (rsi > 70 && ema12 < ema26) { action = 'SELL'; reason = 'RSI超买+EMA死叉'; conf = 0.75; }
        else if (rsi < 40 && ema12 > ema26) { action = 'BUY'; reason = 'RSI偏低+上升趋势'; conf = 0.62; }
        else if (rsi > 60 && ema12 < ema26) { action = 'SELL'; reason = 'RSI偏高+下降趋势'; conf = 0.60; }
        else { reason = '无明确信号'; conf = 0.4; }

        const emoji = action === 'BUY' ? '🟢' : action === 'SELL' ? '🔴' : '⚪';
        return `${emoji} **即时信号: ${action}**
价格: $${latest.toFixed(2)} | 信度: ${(conf * 100).toFixed(0)}%
RSI: ${rsi.toFixed(1)} | EMA12: $${ema12.toFixed(2)} | EMA26: $${ema26.toFixed(2)}
原因: ${reason}
⚠️ 仅供参考，需结合其他分析`;
      },
    },
    {
      id: 'suggest_strategy',
      name: '策略建议',
      category: '策略',
      description: '根据行情推荐策略',
      parameters: {},
      execute: async (ctx) => {
        const data = ctx.marketData;
        if (data.length < 20) return '⚠️ 数据不足';
        const closes = data.slice(-20).map(d => d.close);
        const max = Math.max(...closes), min = Math.min(...closes);
        const range = (max - min) / min * 100;
        const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
        const sma20 = closes.reduce((a, b) => a + b, 0) / 20;

        let strategy = '';
        if (range < 5) {
          strategy = `🔲 **网格交易** (波动率${range.toFixed(1)}%)\n区间: $${min.toFixed(2)}~$${max.toFixed(2)}, 建议10-15格`;
        } else if (sma10 > sma20) {
          strategy = `📈 **趋势跟踪** (MA10>MA20)\n回调MA10做多, 止损MA20下方`;
        } else {
          strategy = `📉 **均值回归/定投**\n等待超卖信号轻仓试多, 或DCA分批建仓`;
        }
        return `💡 **${ctx.currentSymbol}策略建议**\n\n${strategy}\n\n波动率: ${range.toFixed(1)}% | 趋势: ${sma10 > sma20 ? '偏多' : '偏空'}\n⚠️ 策略仅供参考`;
      },
    },
    {
      id: 'place_order',
      name: '模拟下单',
      category: '交易',
      description: '模拟下单(需配置API后真实执行)',
      parameters: { side: 'buy/sell', type: 'limit/market', price: '价格', amount: '数量' },
      execute: async (ctx, params) => {
        const side = params.side || 'buy';
        const type = params.type || 'market';
        const price = parseFloat(params.price || '0');
        const amount = parseFloat(params.amount || '0');
        if (!amount) return '❓ 请指定下单数量';
        const latest = ctx.marketData.length > 0 ? ctx.marketData[ctx.marketData.length - 1].close : 0;
        const execPrice = type === 'market' ? latest : price;
        return `📋 **模拟订单已创建**\n方向: ${side === 'buy' ? '🟢买入' : '🔴卖出'}\n类型: ${type === 'market' ? '市价' : '限价'}\n价格: $${execPrice.toFixed(2)}\n数量: ${amount}\n价值: $${(execPrice * amount).toFixed(2)}\n\n⚠️ 这是模拟订单。配置交易所API后可执行真实交易。`;
      },
    },
    {
      id: 'get_positions',
      name: '查看持仓',
      category: '交易',
      description: '查看当前持仓',
      parameters: {},
      execute: async () => {
        return `📊 **当前持仓**\n\n暂无持仓数据。\n💡 配置交易所API后可查看实时持仓。`;
      },
    },
    {
      id: 'get_balance',
      name: '账户余额',
      category: '交易',
      description: '查看账户余额',
      parameters: {},
      execute: async () => {
        return `💰 **账户余额**\n\n暂无余额数据。\n💡 配置交易所API后可查看实时余额。`;
      },
    },
    {
      id: 'set_stop_loss',
      name: '设置止损',
      category: '风控',
      description: '设置止损价格',
      parameters: { price: '止损价格' },
      execute: async (_ctx, params) => {
        const price = parseFloat(params.price || '0');
        if (!price) return '❓ 请指定止损价格';
        return `✅ 止损价格已设置为 $${price.toFixed(2)}\n⚠️ 配置API后实际生效`;
      },
    },
    {
      id: 'set_take_profit',
      name: '设置止盈',
      category: '风控',
      description: '设置止盈价格',
      parameters: { price: '止盈价格' },
      execute: async (_ctx, params) => {
        const price = parseFloat(params.price || '0');
        if (!price) return '❓ 请指定止盈价格';
        return `✅ 止盈价格已设置为 $${price.toFixed(2)}\n⚠️ 配置API后实际生效`;
      },
    },
    {
      id: 'backtest_strategy',
      name: '策略回测',
      category: '策略',
      description: '回测交易策略',
      parameters: { strategy: '策略名称', period: '回测周期' },
      execute: async (ctx) => {
        const data = ctx.marketData;
        if (data.length < 50) return '⚠️ 数据不足以回测';
        // 简单EMA交叉回测
        const closes = data.map(d => d.close);
        let trades = 0, wins = 0, position = false;
        let entryPrice = 0, totalReturn = 0;
        for (let i = 26; i < closes.length; i++) {
          const ema12 = closes.slice(i - 12, i).reduce((a, b) => a + b, 0) / 12;
          const ema26 = closes.slice(i - 26, i).reduce((a, b) => a + b, 0) / 26;
          if (!position && ema12 > ema26) {
            position = true; entryPrice = closes[i]; trades++;
          } else if (position && ema12 < ema26) {
            position = false;
            const ret = (closes[i] - entryPrice) / entryPrice;
            totalReturn += ret;
            if (ret > 0) wins++;
          }
        }
        const winRate = trades > 0 ? (wins / trades * 100) : 0;
        return `📊 **EMA交叉策略回测**\n\n交易次数: ${trades}\n胜率: ${winRate.toFixed(1)}%\n总收益率: ${(totalReturn * 100).toFixed(2)}%\n\n⚠️ 回测结果不代表未来表现`;
      },
    },
  ];
}

// ============== 意图识别 ==============

const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: string; toolId: string }> = [
  { pattern: /(?:系统|状态|运行|检查|查看).*(?:状态|情况|信息|怎么样)/i, intent: 'check_status', toolId: 'get_status' },
  { pattern: /(?:开启|启动|打开|开始).*(?:交易|自动)/i, intent: 'start_trading', toolId: 'toggle_trading' },
  { pattern: /(?:关闭|停止|暂停|关掉).*(?:交易|自动)/i, intent: 'stop_trading', toolId: 'toggle_trading' },
  { pattern: /(?:设置|修改|调整|更新).*(?:风险|仓位|止损|止盈|风控)/i, intent: 'update_risk', toolId: 'update_risk' },
  { pattern: /(?:分析|行情|走势|趋势|看看|预测).*(?:行情|市场|价格|走势|趋势)?/i, intent: 'analyze', toolId: 'analyze_market' },
  { pattern: /(?:信号|交易信号|买卖|建议)/i, intent: 'signals', toolId: 'get_signals' },
  { pattern: /(?:生成|产生|创建).*信号/i, intent: 'gen_signal', toolId: 'generate_signal' },
  { pattern: /(?:切换|换|改).*(?:到|为|成)\s*([A-Z]{2,10})/i, intent: 'switch', toolId: 'switch_symbol' },
  { pattern: /(?:切换|改|换).*(?:周期|时间).*(\d+[mhd])/i, intent: 'timeframe', toolId: 'change_timeframe' },
  { pattern: /(?:推荐|建议|什么).*(?:策略|方法)/i, intent: 'strategy', toolId: 'suggest_strategy' },
  { pattern: /(?:下单|买入|卖出|做多|做空)/i, intent: 'order', toolId: 'place_order' },
  { pattern: /(?:持仓|仓位|头寸)/i, intent: 'positions', toolId: 'get_positions' },
  { pattern: /(?:余额|资产|资金|账户)/i, intent: 'balance', toolId: 'get_balance' },
  { pattern: /(?:止损)/i, intent: 'stop_loss', toolId: 'set_stop_loss' },
  { pattern: /(?:止盈)/i, intent: 'take_profit', toolId: 'set_take_profit' },
  { pattern: /(?:回测|测试.*策略)/i, intent: 'backtest', toolId: 'backtest_strategy' },
  { pattern: /(?:工具|能力|功能|你能|可以做|帮助|help)/i, intent: 'help', toolId: 'list_tools' },
];

// ============== AI智能体 ==============

export class AIAgent {
  private tools: Map<string, ToolDef> = new Map();
  private context: AIContext | null = null;
  private llmClient: LLMClient | null = null;
  private conversationHistory: LLMMessage[] = [];
  private maxHistoryLength = 20;

  constructor() {
    createTools().forEach(tool => this.tools.set(tool.id, tool));
  }

  setContext(context: AIContext) {
    this.context = context;
  }

  setLLMConfig(config: LLMConfig) {
    this.llmClient = new LLMClient(config);
  }

  getToolList(): Array<{ id: string; name: string; category: string; description: string }> {
    return Array.from(this.tools.values()).map(t => ({
      id: t.id, name: t.name, category: t.category, description: t.description,
    }));
  }

  isLLMConfigured(): boolean {
    return this.llmClient !== null;
  }

  // 解析工具调用
  private parseToolCalls(text: string): Array<{ toolId: string; params: Record<string, string> }> {
    const calls: Array<{ toolId: string; params: Record<string, string> }> = [];
    const regex = /<<TOOL:(\w+)\(([^)]*)\)>>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const toolId = match[1];
      const paramStr = match[2];
      const params: Record<string, string> = {};
      if (paramStr.trim()) {
        paramStr.split(',').forEach(p => {
          const [key, val] = p.split('=').map(s => s.trim());
          if (key && val) params[key] = val;
        });
      }
      calls.push({ toolId, params });
    }
    return calls;
  }

  // 本地意图识别（回退模式）
  private recognizeLocal(input: string): { toolId: string | null; entities: Record<string, string> } {
    for (const { pattern, intent, toolId } of INTENT_PATTERNS) {
      if (pattern.test(input)) {
        const entities: Record<string, string> = {};
        if (intent === 'switch') {
          const m = input.match(/([A-Z]{2,10})(?:USDT)?/i);
          if (m) entities.symbol = m[1].toUpperCase();
        }
        if (intent === 'timeframe') {
          const m = input.match(/(1m|5m|15m|1h|4h|1d)/i);
          if (m) entities.timeframe = m[1];
        }
        if (intent === 'start_trading') entities.enabled = 'true';
        if (intent === 'stop_trading') entities.enabled = 'false';
        if (intent === 'order') {
          if (/买|做多/i.test(input)) entities.side = 'buy';
          if (/卖|做空/i.test(input)) entities.side = 'sell';
          entities.type = 'market';
          const amtMatch = input.match(/(\d+\.?\d*)/);
          if (amtMatch) entities.amount = amtMatch[1];
        }
        return { toolId, entities };
      }
    }
    return { toolId: null, entities: {} };
  }

  // 主处理函数
  async processInput(input: string): Promise<string> {
    if (!this.context) return '⚠️ 系统初始化中，请稍等...';

    // 帮助命令直接处理
    if (/(?:工具|能力|功能|你能|可以做|帮助|help)/i.test(input)) {
      return this.getHelpText();
    }

    // 尝试使用LLM
    if (this.llmClient) {
      try {
        return await this.processWithLLM(input);
      } catch (err) {
        console.warn('[AIAgent] LLM处理失败，回退到本地模式:', err);
      }
    }

    // 回退到本地模式匹配
    return this.processLocal(input);
  }

  // LLM驱动的处理
  private async processWithLLM(input: string): Promise<string> {
    if (!this.llmClient || !this.context) throw new Error('No LLM');

    const systemPrompt = buildSystemPrompt(this.context);
    this.conversationHistory.push({ role: 'user', content: input });

    // 保持历史长度
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }

    const response = await this.llmClient.chat(this.conversationHistory, systemPrompt);
    
    if (response.provider === 'fallback') {
      throw new Error('No LLM available');
    }

    let result = response.content;

    // 解析并执行工具调用
    const toolCalls = this.parseToolCalls(result);
    if (toolCalls.length > 0) {
      const toolResults: string[] = [];
      for (const call of toolCalls) {
        const tool = this.tools.get(call.toolId);
        if (tool) {
          try {
            const toolResult = await tool.execute(this.context, call.params);
            toolResults.push(toolResult);
          } catch (err) {
            toolResults.push(`❌ 工具${call.toolId}执行失败: ${err}`);
          }
        }
      }
      // 把工具调用标记替换为结果
      for (const call of toolCalls) {
        const regex = new RegExp(`<<TOOL:${call.toolId}\\([^)]*\\)>>`, 'g');
        result = result.replace(regex, '');
      }
      result = result.trim();
      if (toolResults.length > 0) {
        result = result ? `${result}\n\n${toolResults.join('\n\n')}` : toolResults.join('\n\n');
      }
    }

    this.conversationHistory.push({ role: 'assistant', content: result });
    return result;
  }

  // 本地模式处理
  private async processLocal(input: string): Promise<string> {
    if (!this.context) return '⚠️ 系统初始化中...';

    const { toolId, entities } = this.recognizeLocal(input);
    if (toolId) {
      const tool = this.tools.get(toolId);
      if (tool) {
        try {
          return await tool.execute(this.context, entities);
        } catch (err) {
          return `❌ 执行失败: ${err}`;
        }
      }
    }

    return `我理解了你的问题，但目前使用的是**本地AI模式**（模式匹配）。

💡 **要获得完整AI对话能力**，请在设置中配置AI模型：
- DeepSeek (推荐，国内快速)
- 智谱GLM (免费额度)
- OpenAI / Ollama (本地)

**当前可用指令：**
📊 "系统状态" | 📈 "分析行情" | 📡 "交易信号"
💹 "切换到ETH" | ⏱️ "切换4h" | 💡 "推荐策略"
🟢 "开启交易" | 🔴 "停止交易" | 📋 "查看持仓"`;
  }

  private getHelpText(): string {
    const categories = new Map<string, Array<{ name: string; description: string }>>();
    this.tools.forEach(tool => {
      if (!categories.has(tool.category)) categories.set(tool.category, []);
      categories.get(tool.category)!.push({ name: tool.name, description: tool.description });
    });

    let text = `🤖 **XTMC AI智能体 - ${this.tools.size}个工具**\n\n`;
    text += this.llmClient ? '🟢 **LLM模式** - 支持自然语言对话\n\n' : '🟡 **本地模式** - 使用指令交互\n\n';

    categories.forEach((tools, cat) => {
      text += `**${cat}**\n`;
      tools.forEach(t => { text += `- ${t.name}: ${t.description}\n`; });
      text += '\n';
    });

    if (!this.llmClient) {
      text += '💡 配置AI模型(设置→AI)后可使用自然语言与我交流';
    }
    return text;
  }
}

// 全局单例
export const aiAgent = new AIAgent();
