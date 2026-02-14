"""
自我反思模块 - LLM驱动的AI能力评估与改进分析
"""

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class SelfReflection:
    """
    LLM驱动的自我反思系统

    1. 收集真实交易数据和工具表现
    2. 构造分析提示词
    3. 调用LLM生成结构化反思结果
    4. 解析失败时回退到基础规则
    """

    SYSTEM_PROMPT = """你是一个专业的量化交易策略分析师。你的任务是分析交易系统的表现，识别问题和改进方向。

请根据提供的数据，以JSON格式输出分析结果：
```json
{
  "performance_assessment": "对当前表现的一句话评估",
  "issues": ["问题1", "问题2"],
  "gaps": [
    {"type": "capability|performance", "description": "缺口描述", "priority": "high|medium|low"}
  ],
  "recommendations": [
    {"action": "动作名称", "description": "具体建议", "tools_needed": ["工具名1"], "priority": "high|medium|low"}
  ],
  "summary": "一句话总结"
}
```
只输出JSON，不要输出其他内容。"""

    def __init__(self, data_dir: str, llm=None):
        self.data_dir = data_dir
        self.llm = llm
        self.reflection_dir = os.path.join(data_dir, "reflections")
        os.makedirs(self.reflection_dir, exist_ok=True)
        self.reflection_history: List[Dict] = []
        self._load_history()

    def set_llm(self, llm):
        self.llm = llm

    def _load_history(self):
        history_file = os.path.join(self.reflection_dir, "history.json")
        if os.path.exists(history_file):
            try:
                with open(history_file, "r", encoding="utf-8") as f:
                    self.reflection_history = json.load(f)
            except Exception as e:
                logger.error("加载反思历史失败: %s", e)

    def _save_history(self):
        history_file = os.path.join(self.reflection_dir, "history.json")
        try:
            with open(history_file, "w", encoding="utf-8") as f:
                json.dump(self.reflection_history[-100:], f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error("保存反思历史失败: %s", e)

    async def analyze(self, performance: Any, tools: Dict[str, Any]) -> Dict[str, Any]:
        """执行自我反思：优先用LLM，失败时回退到规则"""
        perf_data = {
            "win_rate": getattr(performance, "win_rate", 0),
            "total_trades": getattr(performance, "total_trades", 0),
            "total_profit": getattr(performance, "total_profit", 0),
            "avg_profit": getattr(performance, "avg_profit_per_trade", 0),
            "max_drawdown": getattr(performance, "max_drawdown", 0),
        }
        tool_list = list(tools.keys()) if tools else []

        reflection = await self._llm_analyze(perf_data, tool_list)
        if reflection is None:
            reflection = self._rule_based_analyze(perf_data, tool_list)

        reflection["timestamp"] = time.time()
        self.reflection_history.append(reflection)
        self._save_history()
        self._save_reflection_report(reflection)
        logger.info("自我反思完成: %s", reflection.get("summary", ""))
        return reflection

    async def _llm_analyze(self, perf: Dict, tool_list: List[str]) -> Optional[Dict]:
        """调用LLM进行反思分析"""
        if not self.llm:
            return None
        try:
            user_msg = (
                f"## 交易系统表现\n"
                f"- 胜率: {perf['win_rate']*100:.1f}%\n"
                f"- 总交易: {perf['total_trades']}\n"
                f"- 总收益: {perf['total_profit']:.2f} USDT\n"
                f"- 平均收益: {perf['avg_profit']:.4f} USDT\n"
                f"- 最大回撤: {perf['max_drawdown']:.2f}%\n\n"
                f"## 当前工具 ({len(tool_list)}个)\n"
                + ("\n".join(f"- {t}" for t in tool_list) if tool_list else "- 暂无工具")
            )
            result = self.llm.chat_json([
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ])
            if result and "gaps" in result and "recommendations" in result:
                return result
            logger.warning("LLM反思输出格式不符，回退规则")
            return None
        except Exception as e:
            logger.error("LLM反思调用失败: %s", e)
            return None

    def _rule_based_analyze(self, perf: Dict, tool_list: List[str]) -> Dict:
        """回退：基于规则的反思"""
        gaps = []
        recommendations = []
        issues = []

        if perf["total_trades"] < 10:
            issues.append("交易数据不足")
        if perf["win_rate"] < 0.4:
            issues.append("胜率偏低")
            gaps.append({"type": "performance", "description": "胜率偏低，需要更好的入场信号", "priority": "high"})
            recommendations.append({
                "action": "add_trend_tools",
                "description": "添加趋势确认指标",
                "tools_needed": ["adx_analyzer", "trend_detector"],
                "priority": "high",
            })
        if perf["avg_profit"] < 0:
            issues.append("平均收益为负")
            gaps.append({"type": "performance", "description": "平均收益为负", "priority": "high"})

        indicator_categories = {
            "trend": ["ema", "sma", "macd", "adx", "trend"],
            "momentum": ["rsi", "stochastic", "cci", "kdj"],
            "volatility": ["bollinger", "atr", "keltner"],
            "volume": ["obv", "vwma", "mfi", "volume"],
        }
        for cat, keywords in indicator_categories.items():
            if not any(any(kw in t.lower() for kw in keywords) for t in tool_list):
                gaps.append({"type": "capability", "description": f"缺少{cat}类分析工具", "priority": "medium"})

        parts = [f"胜率: {perf['win_rate']*100:.1f}%", f"总交易: {perf['total_trades']}"]
        high = sum(1 for g in gaps if g.get("priority") == "high")
        if high:
            parts.append(f"高优先级缺口: {high}个")
        parts.append(f"建议改进: {len(recommendations)}项")

        return {
            "performance_assessment": "; ".join(issues) if issues else "数据不足",
            "issues": issues,
            "gaps": gaps,
            "recommendations": recommendations,
            "summary": " | ".join(parts),
        }

    def _save_reflection_report(self, reflection: Dict):
        report_file = os.path.join(
            self.reflection_dir, f"reflection_{int(reflection.get('timestamp', time.time()))}.json"
        )
        try:
            with open(report_file, "w", encoding="utf-8") as f:
                json.dump(reflection, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error("保存反思报告失败: %s", e)

    def get_reflection_history(self, limit: int = 10) -> List[Dict]:
        return self.reflection_history[-limit:]
