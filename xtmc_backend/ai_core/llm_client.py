"""
LLM客户端 - 支持本地Ollama和多个在线AI服务
优先使用本地Ollama，自动降级到在线服务或规则引擎
"""

import asyncio
import logging
import random
from typing import Optional, Dict, List

import aiohttp

logger = logging.getLogger(__name__)


class LLMClient:
    """
    多源LLM客户端
    
    优先级:
    1. Ollama (本地，无需API Key)
    2. DeepSeek (在线，需要Key)
    3. 智谱GLM (在线，需要Key)
    4. 本地规则引擎 (兜底)
    """
    
    # Ollama 配置
    OLLAMA_URL = "http://localhost:11434"
    OLLAMA_MODELS = ["qwen2.5:1.5b", "qwen2.5:0.5b", "llama3.2:1b", "gemma2:2b", "phi3:mini"]
    
    # 在线服务配置
    ONLINE_SERVICES = [
        {
            "name": "deepseek",
            "base_url": "https://api.deepseek.com/v1",
            "model": "deepseek-chat",
        },
        {
            "name": "zhipu",
            "base_url": "https://open.bigmodel.cn/api/paas/v4",
            "model": "glm-4-flash",
        },
    ]
    
    def __init__(self, api_keys: Optional[Dict[str, str]] = None, ollama_model: Optional[str] = None):
        """
        初始化LLM客户端
        
        Args:
            api_keys: 在线服务API密钥 {"deepseek": "sk-xxx", "zhipu": "xxx"}
            ollama_model: 指定Ollama模型，不指定则自动检测
        """
        self.api_keys = api_keys or {}
        self.ollama_model = ollama_model
        self.session: Optional[aiohttp.ClientSession] = None
        self._ollama_available: Optional[bool] = None
        self._ollama_checked_model: Optional[str] = None
        self._service_failures: Dict[str, int] = {}
        
        # 交易分析系统提示
        self.trading_system_prompt = """你是XTMC量化交易系统的AI助手。你的职责是:
1. 分析加密货币市场行情，解读K线形态和技术指标
2. 提供交易建议和风险提示
3. 回答用户关于量化交易的问题

回答要求:
- 简洁专业，避免啰嗦
- 所有交易建议都附带风险提示
- 使用markdown格式让回答更清晰"""

    async def _get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=60, connect=10),
            )
        return self.session

    async def _check_ollama(self) -> bool:
        """检查Ollama是否可用"""
        if self._ollama_available is not None:
            return self._ollama_available
        
        try:
            session = await self._get_session()
            
            # 检查Ollama服务
            async with session.get(f"{self.OLLAMA_URL}/api/tags", timeout=aiohttp.ClientTimeout(total=3)) as resp:
                if resp.status != 200:
                    self._ollama_available = False
                    return False
                
                data = await resp.json()
                models = [m.get("name", "").split(":")[0] + ":" + m.get("name", "").split(":")[-1] 
                         for m in data.get("models", [])]
                
                if not models:
                    self._ollama_available = False
                    logger.info("Ollama服务运行中，但没有可用模型")
                    return False
                
                # 选择模型
                if self.ollama_model and any(self.ollama_model in m for m in models):
                    self._ollama_checked_model = self.ollama_model
                else:
                    # 按优先级选择模型
                    for preferred in self.OLLAMA_MODELS:
                        for m in models:
                            if preferred.split(":")[0] in m:
                                self._ollama_checked_model = m
                                break
                        if self._ollama_checked_model:
                            break
                    
                    if not self._ollama_checked_model:
                        self._ollama_checked_model = models[0]
                
                self._ollama_available = True
                logger.info(f"Ollama可用，使用模型: {self._ollama_checked_model}")
                return True
                
        except Exception as e:
            logger.debug(f"Ollama不可用: {e}")
            self._ollama_available = False
            return False

    async def chat(
        self,
        message: str,
        context: Optional[List[Dict]] = None,
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        发送聊天请求
        
        优先级: Ollama -> 在线服务 -> 规则引擎
        """
        # 构建消息列表
        sys_prompt = system_prompt or self.trading_system_prompt
        messages = [{"role": "system", "content": sys_prompt}]
        
        if context:
            messages.extend(context[-10:])
        
        messages.append({"role": "user", "content": message})
        
        # 1. 尝试Ollama
        if await self._check_ollama():
            try:
                response = await self._call_ollama(messages)
                if response:
                    logger.debug("使用Ollama生成回复")
                    return response
            except Exception as e:
                logger.warning(f"Ollama调用失败: {e}")
                self._ollama_available = None  # 重置以便下次重新检查
        
        # 2. 尝试在线服务
        for service in self.ONLINE_SERVICES:
            name = service["name"]
            api_key = self.api_keys.get(name)
            if not api_key:
                continue
            
            try:
                response = await self._call_online_service(service, api_key, messages)
                if response:
                    self._mark_success(name)
                    logger.debug(f"使用{name}生成回复")
                    return response
            except Exception as e:
                self._mark_failure(name)
                logger.warning(f"[{name}] 调用失败: {e}")
        
        # 3. 使用规则引擎
        logger.debug("使用规则引擎生成回复")
        return self._local_rule_response(message)

    async def _call_ollama(self, messages: List[Dict]) -> Optional[str]:
        """调用本地Ollama"""
        session = await self._get_session()
        url = f"{self.OLLAMA_URL}/api/chat"
        
        payload = {
            "model": self._ollama_checked_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 500,
            }
        }
        
        async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=60)) as resp:
            if resp.status != 200:
                error = await resp.text()
                raise Exception(f"Ollama HTTP {resp.status}: {error[:100]}")
            
            result = await resp.json()
            content = result.get("message", {}).get("content", "")
            return content if content else None

    async def _call_online_service(
        self, service: dict, api_key: str, messages: List[Dict]
    ) -> Optional[str]:
        """调用在线LLM服务"""
        session = await self._get_session()
        url = f"{service['base_url']}/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": service["model"],
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 500,
        }
        
        async with session.post(url, headers=headers, json=payload) as resp:
            if resp.status != 200:
                error = await resp.text()
                raise Exception(f"HTTP {resp.status}: {error[:100]}")
            
            result = await resp.json()
            choices = result.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
        
        return None

    def _local_rule_response(self, message: str) -> str:
        """本地规则引擎 - 智能模板回复"""
        msg = message.lower().strip()
        
        # 行情分析
        if any(kw in msg for kw in ['分析', '行情', '趋势', '走势', '看法']):
            return self._analysis_response()
        
        # 交易建议
        if any(kw in msg for kw in ['建议', '买', '卖', '操作', '信号', '做多', '做空']):
            return self._trading_advice()
        
        # 风险相关
        if any(kw in msg for kw in ['风险', '止损', '仓位', '爆仓', '亏损']):
            return self._risk_response()
        
        # 系统相关
        if any(kw in msg for kw in ['系统', '状态', '运行', 'ai', '模型']):
            return self._system_response()
        
        # 指标相关
        if any(kw in msg for kw in ['macd', 'rsi', 'ema', 'ma', '均线', '指标', 'kdj', 'bollinger']):
            return self._indicator_response()
        
        # 帮助
        if any(kw in msg for kw in ['帮助', 'help', '功能', '什么', '怎么']):
            return self._help_response()
        
        # 问候
        if any(kw in msg for kw in ['你好', 'hello', 'hi', '嗨', '早', '晚']):
            return self._greeting_response()
        
        # 默认
        return self._default_response(message)

    def _analysis_response(self) -> str:
        templates = [
            """📊 **当前市场分析**

根据技术指标综合分析:
- **趋势**: 短期震荡，中期偏多
- **支撑位**: 关注前低位置
- **阻力位**: 关注前高位置
- **成交量**: 需配合放量确认突破

**建议**: 等待明确方向信号，不急于追涨杀跌。

⚠️ 以上分析仅供参考，不构成投资建议。""",
            """📈 **技术面解读**

当前市场处于关键位置:
1. 价格在EMA12和EMA26之间震荡
2. RSI处于中性区域(40-60)
3. MACD柱状图收敛中

**操作建议**: 观望为主，等待突破方向确认后再入场。

⚠️ 请结合自身风险承受能力做决策。""",
        ]
        return random.choice(templates)

    def _trading_advice(self) -> str:
        templates = [
            """📋 **交易建议**

基于当前AI分析系统的综合判断:

**短期**: 观望 ⚪
**中期**: 偏多 🟢

**入场策略**:
- 等待回调至支撑位附近
- 确认放量突破后追入
- 严格设置止损(建议2-3%)

⚠️ 交易有风险，请勿盲目跟单。""",
            """🎯 **操作参考**

当前信号置信度: 中等

**如果做多**:
- 入场: 等待回调
- 止损: 设置在前低下方
- 止盈: 分批止盈，锁定利润

**如果做空**:
- 需要等待更明确的下跌信号

⚠️ 仅供参考，请做好风险管理。""",
        ]
        return random.choice(templates)

    def _risk_response(self) -> str:
        return """🛡️ **风险管理指南**

**仓位管理**:
- 单笔交易风险 ≤ 总资金的 2%
- 总持仓风险 ≤ 总资金的 10%
- 预留足够保证金防止爆仓

**止损策略**:
- 技术止损: 根据支撑位设置
- ATR止损: 通常为 ATR × 2-3
- 时间止损: 超过预期时间未盈利则离场

**心态管理**:
- 严格执行交易计划
- 不要报复性交易
- 亏损后暂停，复盘后再继续

⚠️ 加密货币波动剧烈，风控是生存之本。"""

    def _indicator_response(self) -> str:
        return """📉 **技术指标说明**

**趋势指标**:
- EMA12/26: 短期趋势判断
- MA20/60: 中期趋势参考
- ADX: 趋势强度指标

**动量指标**:
- RSI: >70超买, <30超卖
- MACD: 金叉看多, 死叉看空
- KDJ: 超买超卖+交叉信号

**波动指标**:
- Bollinger: 价格突破上下轨
- ATR: 判断市场波动程度

本系统已内置7个AI分析工具，自动综合多指标给出信号。"""

    def _system_response(self) -> str:
        ollama_status = "✅ 运行中" if self._ollama_available else "❌ 未连接"
        model_info = self._ollama_checked_model or "未检测"
        
        return f"""🤖 **XTMC系统状态**

**AI引擎**: 
- Ollama本地模型: {ollama_status}
- 当前模型: {model_info}

**核心功能**:
- 多数据源实时行情 (Bybit/OKX/Binance)
- 7个AI分析工具自动决策
- 自我进化机制 (每6小时)
- 风险管理模块

**启用本地AI**:
1. 安装 Ollama: https://ollama.com
2. 运行: `ollama run qwen2.5:1.5b`
3. 重启系统即可自动连接"""

    def _help_response(self) -> str:
        return """💡 **XTMC AI助手**

**可以问我**:
- "分析一下当前行情"
- "给个交易建议"
- "如何设置止损"
- "RSI指标怎么看"
- "系统状态"

**功能区域**:
- **交易**: 下单、设置杠杆、止盈止损
- **策略**: 配置AI策略参数
- **K线图**: 查看实时行情和信号

有任何问题都可以直接问我！"""

    def _greeting_response(self) -> str:
        return """👋 你好！我是XTMC量化交易AI助手。

我可以帮你:
- 分析市场行情
- 提供交易建议
- 解读技术指标
- 风险管理指导

有什么可以帮你的？"""

    def _default_response(self, message: str) -> str:
        return f"""收到你的问题。

我理解你在问关于: "{message[:30]}..."

目前我可以回答以下类型的问题:
- 📊 行情分析 (试试说 "分析行情")
- 💹 交易建议 (试试说 "给个建议")
- 🛡️ 风险管理 (试试说 "如何止损")
- 📉 技术指标 (试试说 "RSI怎么看")

如需更智能的对话，请启用本地Ollama或配置在线API。"""

    def _mark_success(self, name: str):
        self._service_failures[name] = 0

    def _mark_failure(self, name: str):
        self._service_failures[name] = self._service_failures.get(name, 0) + 1

    async def get_status(self) -> Dict:
        """获取AI状态"""
        await self._check_ollama()
        return {
            "ollama_available": self._ollama_available or False,
            "ollama_model": self._ollama_checked_model,
            "online_services": list(self.api_keys.keys()),
            "service_failures": self._service_failures.copy(),
        }

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()


# 全局实例
_llm_client: Optional[LLMClient] = None


def get_llm_client(api_keys: Optional[Dict[str, str]] = None) -> LLMClient:
    """获取LLM客户端单例"""
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient(api_keys)
    return _llm_client
