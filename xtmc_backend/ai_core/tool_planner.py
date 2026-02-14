"""
工具规划模块 - LLM驱动的智能工具规划
"""

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ToolPlanner:
    """
    LLM驱动的工具规划系统
    优先用LLM分析反思结果并决定新工具，回退到模板匹配。
    """

    SYSTEM_PROMPT = """你是一个量化交易系统的工具规划专家。根据系统的反思分析结果，规划需要开发的新分析工具。

可选的工具类型（你也可以创造新的）：
- 技术指标分析器（RSI、MACD、EMA、布林带、ADX、KDJ等）
- 趋势检测器
- 成交量分析器
- 支撑阻力检测器
- 波动率分析器
- 多时间框架分析器
- 风险管理工具

请以JSON格式输出规划结果：
```json
{
  "planned_tools": [
    {
      "name": "工具英文名_snake_case",
      "description": "工具功能描述",
      "indicators": ["使用的指标"],
      "reason": "为什么需要这个工具"
    }
  ]
}
```
只输出JSON，不要输出其他内容。最多规划3个工具。"""

    # 回退用的预定义模板
    TOOL_TEMPLATES = {
        "adx_analyzer": {"name": "ADX趋势强度分析器", "indicators": ["ADX", "DI+", "DI-"]},
        "trend_detector": {"name": "趋势检测器", "indicators": ["EMA", "SMA", "MACD"]},
        "stochastic_analyzer": {"name": "随机指标分析器", "indicators": ["K", "D", "J"]},
        "cci_calculator": {"name": "CCI商品通道指数", "indicators": ["CCI"]},
        "atr_calculator": {"name": "ATR波动率计算器", "indicators": ["ATR"]},
        "bollinger_analyzer": {"name": "布林带分析器", "indicators": ["BB_UPPER", "BB_MIDDLE", "BB_LOWER"]},
        "volume_analyzer": {"name": "成交量分析器", "indicators": ["VOLUME", "OBV"]},
        "multi_timeframe_analyzer": {"name": "多时间框架分析器", "indicators": ["MULTI_TF"]},
    }

    def __init__(self, data_dir: str, llm=None):
        self.data_dir = data_dir
        self.llm = llm
        self.planner_dir = os.path.join(data_dir, "planner")
        os.makedirs(self.planner_dir, exist_ok=True)
        self.plan_history: List[Dict] = []
        self._load_history()

    def set_llm(self, llm):
        self.llm = llm

    def _load_history(self):
        history_file = os.path.join(self.planner_dir, "history.json")
        if os.path.exists(history_file):
            try:
                with open(history_file, "r", encoding="utf-8") as f:
                    self.plan_history = json.load(f)
            except Exception:
                pass

    def _save_history(self):
        history_file = os.path.join(self.planner_dir, "history.json")
        try:
            with open(history_file, "w", encoding="utf-8") as f:
                json.dump(self.plan_history[-100:], f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    async def plan_tools(self, reflection: Dict) -> List[str]:
        """规划新工具：优先LLM，回退模板"""
        result = await self._llm_plan(reflection)
        if result is None:
            result = self._rule_based_plan(reflection)

        planned_names = [t["name"] for t in result if not self._tool_exists(t["name"])]

        self.plan_history.append({
            "timestamp": time.time(),
            "planned_tools": planned_names,
            "details": result,
        })
        self._save_history()
        logger.info("工具规划完成，计划开发 %d 个工具", len(planned_names))
        return planned_names

    async def _llm_plan(self, reflection: Dict) -> Optional[List[Dict]]:
        if not self.llm:
            return None
        try:
            user_msg = (
                f"## 反思分析结果\n"
                f"摘要: {reflection.get('summary', 'N/A')}\n\n"
                f"## 识别的缺口\n"
                + "\n".join(
                    f"- [{g.get('priority','?')}] {g.get('description','')}"
                    for g in reflection.get("gaps", [])
                )
                + "\n\n## 改进建议\n"
                + "\n".join(
                    f"- {r.get('description','')} (需要: {r.get('tools_needed',[])})"
                    for r in reflection.get("recommendations", [])
                )
            )
            data = self.llm.chat_json([
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ])
            if data and "planned_tools" in data:
                return data["planned_tools"]
            return None
        except Exception as e:
            logger.error("LLM工具规划失败: %s", e)
            return None

    def _rule_based_plan(self, reflection: Dict) -> List[Dict]:
        """回退：从建议中提取模板工具"""
        result = []
        for rec in reflection.get("recommendations", []):
            for tool_name in rec.get("tools_needed", []):
                if tool_name in self.TOOL_TEMPLATES and not self._tool_exists(tool_name):
                    tmpl = self.TOOL_TEMPLATES[tool_name]
                    result.append({
                        "name": tool_name,
                        "description": tmpl["name"],
                        "indicators": tmpl["indicators"],
                        "reason": rec.get("description", ""),
                    })
        return result

    def _tool_exists(self, tool_name: str) -> bool:
        tool_file = os.path.join(self.data_dir, "..", "tools_library", f"{tool_name}.json")
        return os.path.exists(tool_file)

    def get_tool_template(self, tool_name: str) -> Dict:
        return self.TOOL_TEMPLATES.get(tool_name, {})

    def get_plan_history(self, limit: int = 10) -> List[Dict]:
        return self.plan_history[-limit:]
