/**
 * XTMC AI智能体核心系统
 * 具备完整的系统控制、数据分析、策略执行能力
 */

import type { SystemStatus, TradeConfig, MarketData, TradeSignal } from '../types';

// AI工具定义
export interface AITool {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  category: 'analysis' | 'trading' | 'strategy' | 'system' | 'data';
  execute: (params: Record<string, any>, context: AIContext) => Promise<AIToolResult>;
}

// AI执行上下文
export interface AIContext {
  systemStatus: SystemStatus;
  tradeConfig: TradeConfig;
  marketData: MarketData[];
  signals: TradeSignal[];
  currentSymbol: string;
  currentPrice: number;
  // 系统控制回调
  onUpdateConfig: (config: Partial<TradeConfig>) => void;
  onSwitchSymbol: (symbol: string) => void;
  onExecuteSignal: (signal: TradeSignal) => void;
  onAddIndicator: (indicatorId: string) => void;
  onChangeTimeframe: (timeframe: string) => void;
  onToggleTrading: (enabled: boolean) => void;
}

// 工具执行结果
export interface AIToolResult {
  success: boolean;
  message: string;
  data?: any;
  action?: {
    type: string;
    payload: any;
  };
}

// 意图识别结果
export interface IntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  suggestedTool?: string;
}

// AI智能体类
export class AIAgent {
  private tools: Map<string, AITool> = new Map();
  private context: AIContext | null = null;

  constructor() {
    this.registerDefaultTools();
  }

  // 设置执行上下文
  setContext(context: AIContext) {
    this.context = context;
  }

  // 注册默认工具
  private registerDefaultTools() {
    // ============== 系统控制工具 ==============
    
    this.registerTool({
      id: 'get_system_status',
      name: 'Get System Status',
      nameZh: '获取系统状态',
      description: '获取当前系统运行状态、CPU、内存、交易状态等信息',
      category: 'system',
      execute: async (_, context) => {
        const { systemStatus } = context;
        return {
          success: true,
          message: `系统状态：${systemStatus.status}\nCPU使用率：${systemStatus.system.cpu_percent.toFixed(1)}%\n内存使用：${systemStatus.system.memory_percent.toFixed(1)}%\n交易状态：${systemStatus.trading.enabled ? '已启用' : '已停止'}\nAI运行：${systemStatus.ai.is_running ? '运行中' : '已停止'}\n工具数量：${systemStatus.ai.tool_count}\n胜率：${systemStatus.ai.win_rate.toFixed(1)}%`,
          data: systemStatus
        };
      }
    });

    this.registerTool({
      id: 'toggle_trading',
      name: 'Toggle Trading',
      nameZh: '开关交易',
      description: '启用或停止自动交易功能',
      category: 'system',
      execute: async (params, context) => {
        const enabled = params.enabled !== undefined ? params.enabled : !context.tradeConfig.enable_trading;
        context.onToggleTrading(enabled);
        return {
          success: true,
          message: `交易功能已${enabled ? '启用' : '停止'}`,
          action: { type: 'TOGGLE_TRADING', payload: enabled }
        };
      }
    });

    this.registerTool({
      id: 'update_risk_config',
      name: 'Update Risk Config',
      nameZh: '更新风控配置',
      description: '修改风险控制参数，如最大仓位、风险比例等',
      category: 'system',
      execute: async (params, context) => {
        const updates: Partial<TradeConfig> = {};
        if (params.maxPosition !== undefined) updates.max_position = params.maxPosition;
        if (params.riskPercent !== undefined) updates.risk_percent = params.riskPercent;
        
        context.onUpdateConfig(updates);
        return {
          success: true,
          message: `风控配置已更新：${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(', ')}`,
          action: { type: 'UPDATE_CONFIG', payload: updates }
        };
      }
    });

    // ============== 数据分析工具 ==============

    this.registerTool({
      id: 'analyze_market',
      name: 'Analyze Market',
      nameZh: '分析市场',
      description: '分析当前市场数据，包括趋势、支撑阻力、波动率等',
      category: 'analysis',
      execute: async (_, context) => {
        const { marketData, currentSymbol, currentPrice } = context;
        if (marketData.length < 20) {
          return { success: false, message: '数据不足，无法进行分析' };
        }

        // 计算基础指标
        const closes = marketData.slice(-50).map(d => d.close);
        const highs = marketData.slice(-50).map(d => d.high);
        const lows = marketData.slice(-50).map(d => d.low);
        
        // 趋势判断
        const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const sma50 = closes.reduce((a, b) => a + b, 0) / closes.length;
        const trend = currentPrice > sma20 && sma20 > sma50 ? '上升趋势' : 
                      currentPrice < sma20 && sma20 < sma50 ? '下降趋势' : '震荡';
        
        // 支撑阻力
        const recentHigh = Math.max(...highs.slice(-20));
        const recentLow = Math.min(...lows.slice(-20));
        
        // 波动率
        const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
        const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100;
        
        // RSI计算
        let gains = 0, losses = 0;
        for (let i = 1; i < Math.min(15, closes.length); i++) {
          const change = closes[i] - closes[i - 1];
          if (change > 0) gains += change;
          else losses -= change;
        }
        const rsi = gains / (gains + losses) * 100;

        const analysis = `
📊 ${currentSymbol} 市场分析报告

💰 当前价格：$${currentPrice.toFixed(2)}
📈 市场趋势：${trend}
📉 20日均线：$${sma20.toFixed(2)} (${currentPrice > sma20 ? '价格在均线上方' : '价格在均线下方'})

🔺 近期阻力：$${recentHigh.toFixed(2)} (${((recentHigh - currentPrice) / currentPrice * 100).toFixed(2)}%)
🔻 近期支撑：$${recentLow.toFixed(2)} (${((currentPrice - recentLow) / currentPrice * 100).toFixed(2)}%)

📊 技术指标：
  - RSI(14)：${rsi.toFixed(1)} (${rsi > 70 ? '超买' : rsi < 30 ? '超卖' : '中性'})
  - 波动率：${volatility.toFixed(2)}% (${volatility > 3 ? '高波动' : volatility < 1 ? '低波动' : '正常'})

💡 建议：${
  trend === '上升趋势' && rsi < 70 ? '趋势向上，可考虑逢低买入' :
  trend === '下降趋势' && rsi > 30 ? '趋势向下，建议观望或轻仓做空' :
  '市场震荡，建议观望或使用网格策略'
}`;

        return {
          success: true,
          message: analysis,
          data: { trend, sma20, sma50, recentHigh, recentLow, volatility, rsi }
        };
      }
    });

    this.registerTool({
      id: 'get_signals',
      name: 'Get Trading Signals',
      nameZh: '获取交易信号',
      description: '获取最近的交易信号列表',
      category: 'analysis',
      execute: async (params, context) => {
        const limit = params.limit || 5;
        const signals = context.signals.slice(0, limit);
        
        if (signals.length === 0) {
          return { success: true, message: '暂无交易信号' };
        }

        const signalList = signals.map((s, i) => 
          `${i + 1}. [${s.action}] ${s.symbol} @ $${s.price.toFixed(2)} | 置信度: ${s.confidence}% | ${s.reason}`
        ).join('\n');

        return {
          success: true,
          message: `📡 最近${signals.length}条交易信号：\n\n${signalList}`,
          data: signals
        };
      }
    });

    // ============== 交易执行工具 ==============

    this.registerTool({
      id: 'switch_symbol',
      name: 'Switch Symbol',
      nameZh: '切换交易对',
      description: '切换到指定的交易对',
      category: 'trading',
      execute: async (params, context) => {
        const symbol = params.symbol?.toUpperCase();
        if (!symbol) {
          return { success: false, message: '请指定交易对，如：BTCUSDT, ETHUSDT' };
        }
        
        context.onSwitchSymbol(symbol);
        return {
          success: true,
          message: `已切换到交易对：${symbol}`,
          action: { type: 'SWITCH_SYMBOL', payload: symbol }
        };
      }
    });

    this.registerTool({
      id: 'change_timeframe',
      name: 'Change Timeframe',
      nameZh: '切换时间周期',
      description: '切换K线时间周期',
      category: 'trading',
      execute: async (params, context) => {
        const tf = params.timeframe;
        const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
        
        if (!tf || !validTimeframes.includes(tf)) {
          return { success: false, message: `请指定有效的时间周期：${validTimeframes.join(', ')}` };
        }
        
        context.onChangeTimeframe(tf);
        return {
          success: true,
          message: `已切换到${tf}周期`,
          action: { type: 'CHANGE_TIMEFRAME', payload: tf }
        };
      }
    });

    this.registerTool({
      id: 'generate_signal',
      name: 'Generate Signal',
      nameZh: '生成交易信号',
      description: '根据当前市场状态生成交易信号',
      category: 'trading',
      execute: async (_params, context) => {
        const { marketData, currentSymbol, currentPrice } = context;
        if (marketData.length < 26) {
          return { success: false, message: '数据不足，无法生成信号' };
        }

        // 计算EMA
        const closes = marketData.map(d => d.close);
        const calcEMA = (data: number[], period: number) => {
          const k = 2 / (period + 1);
          let ema = data[0];
          for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
          }
          return ema;
        };

        const ema12 = calcEMA(closes, 12);
        const ema26 = calcEMA(closes, 26);
        
        // RSI
        let gains = 0, losses = 0;
        for (let i = Math.max(0, closes.length - 15); i < closes.length; i++) {
          const change = closes[i] - closes[i - 1];
          if (change > 0) gains += change;
          else losses -= change;
        }
        const rsi = gains / (gains + losses) * 100;

        // 生成信号
        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let confidence = 50;
        let reason = '';

        if (ema12 > ema26 && rsi < 70) {
          action = 'BUY';
          confidence = Math.min(90, 60 + (ema12 - ema26) / ema26 * 1000);
          reason = `EMA金叉 + RSI(${rsi.toFixed(0)})未超买`;
        } else if (ema12 < ema26 && rsi > 30) {
          action = 'SELL';
          confidence = Math.min(90, 60 + (ema26 - ema12) / ema26 * 1000);
          reason = `EMA死叉 + RSI(${rsi.toFixed(0)})未超卖`;
        } else {
          reason = '无明确信号，建议观望';
        }

        const signal: TradeSignal = {
          symbol: currentSymbol,
          action,
          price: currentPrice,
          confidence: Math.round(confidence),
          reason,
          timestamp: Date.now()
        };

        return {
          success: true,
          message: `🎯 信号生成结果：\n\n操作：${action === 'BUY' ? '买入' : action === 'SELL' ? '卖出' : '观望'}\n价格：$${currentPrice.toFixed(2)}\n置信度：${Math.round(confidence)}%\n原因：${reason}`,
          data: signal,
          action: { type: 'SIGNAL_GENERATED', payload: signal }
        };
      }
    });

    // ============== 策略管理工具 ==============

    this.registerTool({
      id: 'add_indicator',
      name: 'Add Indicator',
      nameZh: '添加指标',
      description: '添加技术指标到图表',
      category: 'strategy',
      execute: async (params, context) => {
        const indicator = params.indicator?.toLowerCase();
        const validIndicators = ['ema', 'sma', 'macd', 'rsi', 'bollinger', 'kdj', 'volume', 'atr'];
        
        if (!indicator) {
          return { success: false, message: `请指定要添加的指标：${validIndicators.join(', ')}` };
        }
        
        context.onAddIndicator(indicator);
        return {
          success: true,
          message: `已添加指标：${indicator.toUpperCase()}`,
          action: { type: 'ADD_INDICATOR', payload: indicator }
        };
      }
    });

    this.registerTool({
      id: 'suggest_strategy',
      name: 'Suggest Strategy',
      nameZh: '策略建议',
      description: '根据当前市场状况推荐交易策略',
      category: 'strategy',
      execute: async (_, context) => {
        const { marketData, currentPrice } = context;
        if (marketData.length < 50) {
          return { success: false, message: '数据不足，无法分析策略' };
        }

        const closes = marketData.slice(-50).map(d => d.close);
        const highs = marketData.slice(-50).map(d => d.high);
        const lows = marketData.slice(-50).map(d => d.low);
        
        // 计算波动率
        const returns = closes.slice(1).map((c, i) => Math.abs(c - closes[i]) / closes[i]);
        const avgVolatility = returns.reduce((a, b) => a + b, 0) / returns.length * 100;
        
        // 计算趋势强度
        const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const trendStrength = Math.abs(currentPrice - sma20) / sma20 * 100;
        
        // 计算价格区间
        const priceRange = (Math.max(...highs) - Math.min(...lows)) / currentPrice * 100;

        let strategy = '';
        let params = '';

        if (avgVolatility > 2 && trendStrength > 3) {
          strategy = '趋势跟踪策略';
          params = `建议使用EMA交叉(12/26)或Supertrend策略。\n止损：${(avgVolatility * 1.5).toFixed(1)}%\n止盈：${(avgVolatility * 3).toFixed(1)}%`;
        } else if (priceRange < 5 && avgVolatility < 1.5) {
          strategy = '网格交易策略';
          const gridLow = Math.min(...lows) * 0.98;
          const gridHigh = Math.max(...highs) * 1.02;
          params = `网格区间：$${gridLow.toFixed(2)} - $${gridHigh.toFixed(2)}\n建议网格数：10-15格\n每格利润：${(priceRange / 10).toFixed(2)}%`;
        } else if (avgVolatility > 1) {
          strategy = '波段交易策略';
          params = `使用RSI(14)超买超卖信号。\n超买阈值：70\n超卖阈值：30\n结合布林带判断入场点`;
        } else {
          strategy = 'DCA定投策略';
          params = `市场波动较小，建议定期定额买入。\n建议频率：每周\n建议金额：账户余额的2-5%`;
        }

        return {
          success: true,
          message: `📋 策略推荐报告\n\n🎯 推荐策略：${strategy}\n\n📊 市场特征：\n- 波动率：${avgVolatility.toFixed(2)}%\n- 趋势强度：${trendStrength.toFixed(2)}%\n- 价格区间：${priceRange.toFixed(2)}%\n\n⚙️ 参数建议：\n${params}`,
          data: { strategy, avgVolatility, trendStrength, priceRange }
        };
      }
    });

    // ============== 帮助工具 ==============

    this.registerTool({
      id: 'list_tools',
      name: 'List Tools',
      nameZh: '列出工具',
      description: '列出所有可用的AI工具',
      category: 'system',
      execute: async () => {
        const tools = Array.from(this.tools.values());
        const categories: Record<string, AITool[]> = {};
        
        tools.forEach(tool => {
          if (!categories[tool.category]) categories[tool.category] = [];
          categories[tool.category].push(tool);
        });

        const categoryNames: Record<string, string> = {
          system: '🖥️ 系统控制',
          analysis: '📊 数据分析',
          trading: '💰 交易执行',
          strategy: '📋 策略管理',
          data: '📁 数据操作'
        };

        let message = '🛠️ 可用AI工具列表\n\n';
        
        Object.entries(categories).forEach(([cat, catTools]) => {
          message += `${categoryNames[cat] || cat}\n`;
          catTools.forEach(tool => {
            message += `  • ${tool.nameZh} - ${tool.description}\n`;
          });
          message += '\n';
        });

        message += '💡 提示：直接用自然语言告诉我你想做什么，我会自动选择合适的工具执行。';

        return { success: true, message };
      }
    });
  }

  // 注册工具
  registerTool(tool: AITool) {
    this.tools.set(tool.id, tool);
  }

  // 获取所有工具
  getTools(): AITool[] {
    return Array.from(this.tools.values());
  }

  // 意图识别
  recognizeIntent(input: string): IntentResult {
    const lowerInput = input.toLowerCase();
    
    // 意图关键词映射
    const intentPatterns: Array<{
      patterns: string[];
      intent: string;
      tool: string;
      extractEntities?: (input: string) => Record<string, any>;
    }> = [
      {
        patterns: ['系统状态', '运行状态', '服务器状态', '系统信息'],
        intent: 'check_status',
        tool: 'get_system_status'
      },
      {
        patterns: ['分析', '行情分析', '市场分析', '技术分析', '分析一下'],
        intent: 'analyze_market',
        tool: 'analyze_market'
      },
      {
        patterns: ['信号', '交易信号', '买卖信号'],
        intent: 'get_signals',
        tool: 'get_signals'
      },
      {
        patterns: ['生成信号', '给我信号', '分析信号'],
        intent: 'generate_signal',
        tool: 'generate_signal'
      },
      {
        patterns: ['切换', '换到', '看一下', '打开'],
        intent: 'switch_symbol',
        tool: 'switch_symbol',
        extractEntities: (input) => {
          const match = input.match(/(?:btc|eth|bnb|sol|xrp|ada|doge|dot|matic|link|avax)(?:usdt)?/i);
          return { symbol: match ? (match[0].toUpperCase().includes('USDT') ? match[0].toUpperCase() : match[0].toUpperCase() + 'USDT') : null };
        }
      },
      {
        patterns: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '分钟', '小时', '日线', '周线'],
        intent: 'change_timeframe',
        tool: 'change_timeframe',
        extractEntities: (input) => {
          const tfMap: Record<string, string> = {
            '1分钟': '1m', '5分钟': '5m', '15分钟': '15m', '30分钟': '30m',
            '1小时': '1h', '4小时': '4h', '日线': '1d', '周线': '1w'
          };
          let tf = null;
          Object.entries(tfMap).forEach(([k, v]) => {
            if (input.includes(k)) tf = v;
          });
          if (!tf) {
            const match = input.match(/\b(1m|5m|15m|30m|1h|4h|1d|1w)\b/i);
            tf = match ? match[1].toLowerCase() : null;
          }
          return { timeframe: tf };
        }
      },
      {
        patterns: ['开启交易', '启动交易', '开始交易', '打开交易'],
        intent: 'enable_trading',
        tool: 'toggle_trading',
        extractEntities: () => ({ enabled: true })
      },
      {
        patterns: ['停止交易', '关闭交易', '暂停交易', '停止'],
        intent: 'disable_trading',
        tool: 'toggle_trading',
        extractEntities: () => ({ enabled: false })
      },
      {
        patterns: ['添加指标', '加个', '显示'],
        intent: 'add_indicator',
        tool: 'add_indicator',
        extractEntities: (input) => {
          const indicators = ['ema', 'sma', 'macd', 'rsi', 'bollinger', 'boll', 'kdj', 'volume', 'atr'];
          const found = indicators.find(ind => input.toLowerCase().includes(ind));
          return { indicator: found === 'boll' ? 'bollinger' : found };
        }
      },
      {
        patterns: ['策略建议', '推荐策略', '什么策略', '用什么策略'],
        intent: 'suggest_strategy',
        tool: 'suggest_strategy'
      },
      {
        patterns: ['工具', '功能', '能做什么', '帮助', '怎么用'],
        intent: 'list_tools',
        tool: 'list_tools'
      },
      {
        patterns: ['风控', '仓位', '风险'],
        intent: 'update_risk',
        tool: 'update_risk_config',
        extractEntities: (input) => {
          const posMatch = input.match(/仓位[^\d]*(\d+)/);
          const riskMatch = input.match(/风险[^\d]*(\d+)/);
          return {
            maxPosition: posMatch ? parseInt(posMatch[1]) : undefined,
            riskPercent: riskMatch ? parseInt(riskMatch[1]) : undefined
          };
        }
      }
    ];

    // 匹配意图
    for (const pattern of intentPatterns) {
      if (pattern.patterns.some(p => lowerInput.includes(p))) {
        const entities = pattern.extractEntities ? pattern.extractEntities(input) : {};
        return {
          intent: pattern.intent,
          confidence: 0.9,
          entities,
          suggestedTool: pattern.tool
        };
      }
    }

    // 默认返回通用对话
    return {
      intent: 'general_chat',
      confidence: 0.5,
      entities: {}
    };
  }

  // 处理用户输入
  async processInput(input: string): Promise<string> {
    if (!this.context) {
      return '系统未初始化，请稍后再试。';
    }

    // 识别意图
    const intent = this.recognizeIntent(input);
    
    // 如果有明确的工具建议
    if (intent.suggestedTool && intent.confidence > 0.7) {
      const tool = this.tools.get(intent.suggestedTool);
      if (tool) {
        try {
          const result = await tool.execute(intent.entities, this.context);
          return result.message;
        } catch (error) {
          return `执行失败：${error instanceof Error ? error.message : '未知错误'}`;
        }
      }
    }

    // 通用对话响应
    return this.generateGeneralResponse(input);
  }

  // 生成通用响应
  private generateGeneralResponse(input: string): string {
    const greetings = ['你好', '嗨', 'hi', 'hello', '早上好', '下午好', '晚上好'];
    if (greetings.some(g => input.toLowerCase().includes(g))) {
      return `你好！我是XTMC AI智能体，我可以帮你：

🖥️ 查看系统状态
📊 分析市场行情
💰 生成交易信号
📋 推荐交易策略
⚙️ 调整系统配置

直接告诉我你想做什么，或者输入"帮助"查看所有功能。`;
    }

    if (input.includes('谢谢') || input.includes('感谢')) {
      return '不客气！有任何问题随时问我。';
    }

    return `我理解你说的是："${input}"\n\n我可以帮你：\n• 分析市场 - 输入"分析一下"\n• 查看信号 - 输入"交易信号"\n• 切换币种 - 输入"看一下ETH"\n• 查看功能 - 输入"帮助"`;
  }

  // 直接执行工具
  async executeTool(toolId: string, params: Record<string, any> = {}): Promise<AIToolResult> {
    if (!this.context) {
      return { success: false, message: '系统未初始化' };
    }

    const tool = this.tools.get(toolId);
    if (!tool) {
      return { success: false, message: `工具 ${toolId} 不存在` };
    }

    return tool.execute(params, this.context);
  }
}

// 导出单例
export const aiAgent = new AIAgent();
