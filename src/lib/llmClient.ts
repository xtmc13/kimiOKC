/**
 * XTMC LLM客户端模块
 * 支持: DeepSeek / 智谱GLM / OpenAI / Claude / Ollama / Kimi / Qwen
 * 自动选择可用的模型提供者
 */

export interface LLMConfig {
  provider: 'auto' | 'ollama' | 'deepseek' | 'glm' | 'openai' | 'claude' | 'kimi' | 'qwen' | 'gemini';
  ollamaUrl?: string;
  ollamaModel?: string;
  deepseekKey?: string;
  glmKey?: string;
  openaiKey?: string;
  claudeKey?: string;
  kimiKey?: string;
  qwenKey?: string;
  geminiKey?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed?: number;
}

// 提供者接口
interface LLMProvider {
  id: string;
  name: string;
  isConfigured: (config: LLMConfig) => boolean;
  chat: (messages: LLMMessage[], config: LLMConfig) => Promise<LLMResponse>;
}

// ============== DeepSeek ==============
const deepseekProvider: LLMProvider = {
  id: 'deepseek',
  name: 'DeepSeek',
  isConfigured: (config) => Boolean(config.deepseekKey),
  chat: async (messages, config) => {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
    const json = await res.json();
    return {
      content: json.choices?.[0]?.message?.content || '',
      provider: 'deepseek',
      model: 'deepseek-chat',
      tokensUsed: json.usage?.total_tokens,
    };
  },
};

// ============== 智谱GLM ==============
const glmProvider: LLMProvider = {
  id: 'glm',
  name: '智谱GLM',
  isConfigured: (config) => Boolean(config.glmKey),
  chat: async (messages, config) => {
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.glmKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });
    if (!res.ok) throw new Error(`GLM HTTP ${res.status}`);
    const json = await res.json();
    return {
      content: json.choices?.[0]?.message?.content || '',
      provider: 'glm',
      model: 'glm-4-flash',
      tokensUsed: json.usage?.total_tokens,
    };
  },
};

// ============== OpenAI ==============
const openaiProvider: LLMProvider = {
  id: 'openai',
  name: 'OpenAI',
  isConfigured: (config) => Boolean(config.openaiKey),
  chat: async (messages, config) => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const json = await res.json();
    return {
      content: json.choices?.[0]?.message?.content || '',
      provider: 'openai',
      model: 'gpt-4o-mini',
      tokensUsed: json.usage?.total_tokens,
    };
  },
};

// ============== Ollama (本地) ==============
const ollamaProvider: LLMProvider = {
  id: 'ollama',
  name: 'Ollama',
  isConfigured: () => true, // 总是可用(本地)
  chat: async (messages, config) => {
    const baseUrl = config.ollamaUrl || 'http://localhost:11434';
    const model = config.ollamaModel || 'qwen2.5:7b';
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const json = await res.json();
    return {
      content: json.message?.content || '',
      provider: 'ollama',
      model,
    };
  },
};

// ============== LLM客户端 ==============

export class LLMClient {
  private providers: LLMProvider[] = [
    deepseekProvider,
    glmProvider,
    openaiProvider,
    ollamaProvider,
  ];
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<LLMConfig>) {
    this.config = { ...this.config, ...config };
  }

  getAvailableProviders(): Array<{ id: string; name: string; configured: boolean }> {
    return this.providers.map(p => ({
      id: p.id,
      name: p.name,
      configured: p.isConfigured(this.config),
    }));
  }

  async chat(messages: LLMMessage[], systemPrompt?: string): Promise<LLMResponse> {
    const allMessages: LLMMessage[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    // 如果指定了provider且不是auto
    if (this.config.provider !== 'auto') {
      const provider = this.providers.find(p => p.id === this.config.provider);
      if (provider && provider.isConfigured(this.config)) {
        return provider.chat(allMessages, this.config);
      }
    }

    // auto模式: 按优先级尝试
    const configuredProviders = this.providers.filter(p => p.isConfigured(this.config));
    
    for (const provider of configuredProviders) {
      try {
        return await provider.chat(allMessages, this.config);
      } catch (err) {
        console.warn(`[LLM] ${provider.name} failed:`, err);
      }
    }

    // 所有provider都失败
    return {
      content: '所有AI模型暂不可用，请检查配置或网络连接。当前系统仍可使用内置AI代理功能。',
      provider: 'fallback',
      model: 'none',
    };
  }
}

// 默认系统提示词
export const TRADING_SYSTEM_PROMPT = `你是XTMC量化交易系统的AI助手。你的职责是:
1. 分析市场行情和交易信号
2. 提供交易策略建议
3. 管理交易系统配置
4. 帮助用户理解技术指标
5. 风险提示和管理建议

回答要简洁、专业，使用中文。对于交易建议，始终附带风险提示。`;
