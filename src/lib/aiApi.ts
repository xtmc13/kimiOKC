/**
 * XTMC AI API 客户端
 * 支持多个AI提供商：Kimi、DeepSeek、OpenAI、Claude等
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIProviderConfig {
  provider: 'kimi' | 'deepseek' | 'openai' | 'claude' | 'gemini' | 'qwen' | 'glm' | 'ollama' | 'auto';
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

// AI提供商配置
const PROVIDER_CONFIGS: Record<string, { baseUrl: string; defaultModel: string; headerKey?: string }> = {
  kimi: {
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  claude: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-haiku-20240307',
    headerKey: 'x-api-key',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-pro',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo',
  },
  glm: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
  },
};

// 交易助手系统提示词 - 专业量化交易AI
const TRADING_SYSTEM_PROMPT = `你是XTMC量化交易系统的专业AI智能助手，拥有丰富的加密货币交易和技术分析经验。

## 你的核心能力：

### 1. 市场分析
- 深入分析价格走势、趋势形态、成交量变化
- 识别头肩顶/底、双顶/底、三角形等经典形态
- 判断趋势强度和持续性
- 分析市场情绪和资金流向

### 2. 技术指标精通
- **趋势指标**：EMA、SMA、MACD、布林带、Supertrend
- **动量指标**：RSI、Stochastic、CCI、Williams %R
- **成交量指标**：OBV、VWAP、Volume Profile
- **波动率指标**：ATR、标准差、布林带宽度
- 能够解读多指标组合信号，避免假信号

### 3. 交易策略
- **趋势跟踪策略**：适用于单边行情，使用EMA交叉、Supertrend
- **均值回归策略**：适用于震荡行情，使用RSI超买超卖
- **网格交易策略**：在区间内自动高抛低吸
- **DCA定投策略**：长期投资的最佳选择
- **动量突破策略**：捕捉价格突破后的快速行情

### 4. 风险管理
- 计算合理的仓位大小（推荐单笔不超过总资金2%）
- 设置止损止盈位置（根据ATR或关键支撑阻力）
- 评估风险回报比（建议至少1:2）
- 控制最大回撤

### 5. 交易时机
- 识别最佳入场点和出场点
- 判断行情是否适合交易
- 建议是否应该观望

## 回答规范：
1. 使用中文回复，保持专业简洁
2. 分析时给出具体数据支撑
3. 给出交易建议时必须提示风险
4. 如果数据不足，明确告知无法分析
5. 不做100%确定的预测，给出概率判断

## 当前你可以获取的实时信息：
- 当前交易对和价格
- K线数据和技术指标计算结果
- 最近的交易信号
- 系统配置和状态

请根据用户提供的市场上下文进行专业分析。`;

/**
 * 调用Kimi/Moonshot API
 */
async function callKimiAPI(
  messages: AIMessage[],
  apiKey: string,
  model?: string
): Promise<AIResponse> {
  const config = PROVIDER_CONFIGS.kimi;
  
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || config.defaultModel,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Kimi API错误: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    model: data.model,
    usage: data.usage,
  };
}

/**
 * 调用DeepSeek API
 */
async function callDeepSeekAPI(
  messages: AIMessage[],
  apiKey: string,
  model?: string
): Promise<AIResponse> {
  const config = PROVIDER_CONFIGS.deepseek;
  
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || config.defaultModel,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`DeepSeek API错误: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    model: data.model,
    usage: data.usage,
  };
}

/**
 * 调用OpenAI兼容API (适用于大多数API)
 */
async function callOpenAICompatibleAPI(
  messages: AIMessage[],
  apiKey: string,
  baseUrl: string,
  model: string,
  headerKey: string = 'Authorization'
): Promise<AIResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (headerKey === 'Authorization') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    headers[headerKey] = apiKey;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`API错误: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    model: data.model,
    usage: data.usage,
  };
}

/**
 * 调用Ollama本地API
 */
async function callOllamaAPI(
  messages: AIMessage[],
  _baseUrl: string,  // 忽略传入的URL，强制使用服务器代理
  model: string
): Promise<AIResponse> {
  // 强制使用服务器代理路径，忽略传入的baseUrl
  const ollamaProxyUrl = '/api/ollama';
  
  // 创建AbortController用于超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分钟超时
  
  try {
    const url = `${ollamaProxyUrl}/api/chat`;
    console.log('Calling Ollama API:', url, 'model:', model);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API错误 (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    console.log('Ollama response:', data);
    
    return {
      content: data.message?.content || '',
      model: data.model,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Ollama API请求超时，请稍后重试');
    }
    throw error;
  }
}

/**
 * 调用智谱GLM API
 */
async function callGLMAPI(
  messages: AIMessage[],
  apiKey: string,
  model?: string
): Promise<AIResponse> {
  const config = PROVIDER_CONFIGS.glm;
  
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || config.defaultModel,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`GLM API错误: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    model: data.model,
    usage: data.usage,
  };
}

/**
 * AI客户端类
 */
export class AIClient {
  private settings: {
    kimiKey: string;
    deepseekKey: string;
    openaiKey: string;
    claudeKey: string;
    geminiKey: string;
    qwenKey: string;
    glmKey: string;
    ollamaUrl: string;
    ollamaModel: string;
    aiProvider: string;
  };

  constructor(settings: typeof AIClient.prototype.settings) {
    this.settings = settings;
  }

  /**
   * 更新设置
   */
  updateSettings(settings: typeof AIClient.prototype.settings) {
    this.settings = settings;
  }

  /**
   * 获取可用的AI提供商
   */
  getAvailableProviders(): string[] {
    const providers: string[] = [];
    
    if (this.settings.kimiKey) providers.push('kimi');
    if (this.settings.deepseekKey) providers.push('deepseek');
    if (this.settings.openaiKey) providers.push('openai');
    if (this.settings.claudeKey) providers.push('claude');
    if (this.settings.geminiKey) providers.push('gemini');
    if (this.settings.qwenKey) providers.push('qwen');
    if (this.settings.glmKey) providers.push('glm');
    if (this.settings.ollamaUrl) providers.push('ollama');
    
    return providers;
  }

  /**
   * 自动选择最佳提供商
   */
  private selectProvider(): string {
    const provider = this.settings.aiProvider;
    
    // 如果指定了提供商且有对应的key，使用指定的
    if (provider !== 'auto') {
      if (provider === 'ollama' && this.settings.ollamaUrl) return 'ollama';
      if (provider === 'kimi' && this.settings.kimiKey) return 'kimi';
      if (provider === 'deepseek' && this.settings.deepseekKey) return 'deepseek';
      if (provider === 'openai' && this.settings.openaiKey) return 'openai';
      if (provider === 'claude' && this.settings.claudeKey) return 'claude';
      if (provider === 'gemini' && this.settings.geminiKey) return 'gemini';
      if (provider === 'qwen' && this.settings.qwenKey) return 'qwen';
      if (provider === 'glm' && this.settings.glmKey) return 'glm';
    }
    
    // 自动选择：优先级 kimi > deepseek > glm > qwen > openai > ollama
    if (this.settings.kimiKey) return 'kimi';
    if (this.settings.deepseekKey) return 'deepseek';
    if (this.settings.glmKey) return 'glm';
    if (this.settings.qwenKey) return 'qwen';
    if (this.settings.openaiKey) return 'openai';
    if (this.settings.claudeKey) return 'claude';
    if (this.settings.geminiKey) return 'gemini';
    if (this.settings.ollamaUrl) return 'ollama';
    
    return 'none';
  }

  /**
   * 发送聊天消息
   */
  async chat(userMessage: string, context?: string): Promise<AIResponse> {
    const provider = this.selectProvider();
    
    if (provider === 'none') {
      throw new Error('未配置任何AI服务。请在设置中配置Kimi、DeepSeek或其他AI API密钥。');
    }

    // 构建消息
    const messages: AIMessage[] = [
      { role: 'system', content: context ? `${TRADING_SYSTEM_PROMPT}\n\n当前市场上下文：${context}` : TRADING_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];

    try {
      switch (provider) {
        case 'kimi':
          return await callKimiAPI(messages, this.settings.kimiKey);
        
        case 'deepseek':
          return await callDeepSeekAPI(messages, this.settings.deepseekKey);
        
        case 'glm':
          return await callGLMAPI(messages, this.settings.glmKey);
        
        case 'qwen':
          return await callOpenAICompatibleAPI(
            messages,
            this.settings.qwenKey,
            PROVIDER_CONFIGS.qwen.baseUrl,
            PROVIDER_CONFIGS.qwen.defaultModel
          );
        
        case 'openai':
          return await callOpenAICompatibleAPI(
            messages,
            this.settings.openaiKey,
            PROVIDER_CONFIGS.openai.baseUrl,
            PROVIDER_CONFIGS.openai.defaultModel
          );
        
        case 'claude':
          return await callOpenAICompatibleAPI(
            messages,
            this.settings.claudeKey,
            PROVIDER_CONFIGS.claude.baseUrl,
            PROVIDER_CONFIGS.claude.defaultModel,
            PROVIDER_CONFIGS.claude.headerKey
          );
        
        case 'gemini':
          return await callOpenAICompatibleAPI(
            messages,
            this.settings.geminiKey,
            PROVIDER_CONFIGS.gemini.baseUrl,
            PROVIDER_CONFIGS.gemini.defaultModel
          );
        
        case 'ollama':
          return await callOllamaAPI(
            messages,
            this.settings.ollamaUrl,
            this.settings.ollamaModel || 'qwen2.5:7b'
          );
        
        default:
          throw new Error(`不支持的AI提供商: ${provider}`);
      }
    } catch (error) {
      // 如果当前提供商失败，尝试备用
      const availableProviders = this.getAvailableProviders().filter(p => p !== provider);
      
      if (availableProviders.length > 0) {
        console.warn(`${provider} 调用失败，尝试备用提供商...`);
        // 可以在这里实现备用逻辑
      }
      
      throw error;
    }
  }

  /**
   * 检查AI是否可用
   */
  isAvailable(): boolean {
    return this.selectProvider() !== 'none';
  }

  /**
   * 获取当前使用的提供商名称
   */
  getCurrentProvider(): string {
    return this.selectProvider();
  }
}

// 导出单例创建函数
let aiClientInstance: AIClient | null = null;

export function getAIClient(settings: {
  kimiKey: string;
  deepseekKey: string;
  openaiKey: string;
  claudeKey: string;
  geminiKey: string;
  qwenKey: string;
  glmKey: string;
  ollamaUrl: string;
  ollamaModel: string;
  aiProvider: string;
}): AIClient {
  if (!aiClientInstance) {
    aiClientInstance = new AIClient(settings);
  } else {
    aiClientInstance.updateSettings(settings);
  }
  return aiClientInstance;
}
