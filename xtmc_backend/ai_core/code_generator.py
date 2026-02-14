"""
代码生成模块 - LLM驱动的交易工具代码生成 + 沙箱测试
"""

import json
import logging
import os
import subprocess
import sys
import tempfile
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# 用于沙箱测试的模拟市场数据
_MOCK_MARKET_DATA = {
    "data": [
        {"time": 1700000000000 + i * 3600000, "open": 40000 + i * 10,
         "high": 40100 + i * 10, "low": 39900 + i * 10,
         "close": 40050 + i * 10, "volume": 100 + i}
        for i in range(60)
    ]
}


class CodeGenerator:
    """
    LLM驱动的代码生成系统
    1. 用LLM生成Python分析工具代码
    2. 沙箱测试验证代码正确性
    3. 版本管理与回滚
    回退：使用内置代码模板
    """

    SYSTEM_PROMPT = """你是一个Python量化交易工具开发专家。根据需求生成一个完整的分析工具类。

严格要求：
1. 类名必须是工具名的PascalCase形式（如 adx_analyzer → AdxAnalyzer）
2. 必须有 `analyze(self, market_data: Dict, symbol: str) -> Dict` 方法
3. analyze 返回: {"signal": "BUY"|"SELL"|"HOLD", "confidence": 0.0-1.0, "reason": "说明"}
4. market_data 格式: {"data": [{"time":int, "open":float, "high":float, "low":float, "close":float, "volume":float}, ...]}
5. 只使用标准库和numpy（import numpy as np）
6. 不要使用任何外部API调用
7. 代码必须能直接执行

只输出Python代码，不要有markdown标记或其他说明文字。"""

    # 内置模板作为回退
    BUILTIN_TEMPLATES = {
        "adx_analyzer": '''
import numpy as np
from typing import Dict, List

class AdxAnalyzer:
    def __init__(self, period: int = 14):
        self.period = period

    def analyze(self, market_data: Dict, symbol: str) -> Dict:
        data = market_data.get("data", [])
        if len(data) < self.period + 1:
            return {"signal": "HOLD", "confidence": 0, "reason": "数据不足"}
        highs = [d["high"] for d in data]
        lows = [d["low"] for d in data]
        closes = [d["close"] for d in data]
        plus_dm, minus_dm, tr_list = [], [], []
        for i in range(1, len(data)):
            hd = highs[i] - highs[i-1]
            ld = lows[i-1] - lows[i]
            plus_dm.append(max(hd, 0) if hd > ld else 0)
            minus_dm.append(max(ld, 0) if ld > hd else 0)
            tr_list.append(max(highs[i]-lows[i], abs(highs[i]-closes[i-1]), abs(lows[i]-closes[i-1])))
        def smooth(arr, p):
            if len(arr) < p: return arr
            r = [sum(arr[:p])/p]
            for v in arr[p:]: r.append((r[-1]*(p-1)+v)/p)
            return r
        atr = smooth(tr_list, self.period)
        if not atr or atr[-1] == 0:
            return {"signal": "HOLD", "confidence": 0, "reason": "ATR为0"}
        pdi = [100*a/b if b else 0 for a,b in zip(smooth(plus_dm, self.period), atr)]
        mdi = [100*a/b if b else 0 for a,b in zip(smooth(minus_dm, self.period), atr)]
        dx = [100*abs(p-m)/(p+m+1e-10) for p,m in zip(pdi, mdi)]
        adx_vals = smooth(dx, self.period)
        adx = adx_vals[-1] if adx_vals else 0
        if adx > 25:
            if pdi[-1] > mdi[-1]:
                return {"signal": "BUY", "confidence": min(adx/50,1.0), "reason": f"强势上涨(ADX={adx:.1f})"}
            return {"signal": "SELL", "confidence": min(adx/50,1.0), "reason": f"强势下跌(ADX={adx:.1f})"}
        return {"signal": "HOLD", "confidence": 0.3, "reason": f"趋势不明(ADX={adx:.1f})"}
''',
        "stochastic_analyzer": '''
from typing import Dict, List

class StochasticAnalyzer:
    def __init__(self, k_period: int = 9):
        self.k_period = k_period

    def analyze(self, market_data: Dict, symbol: str) -> Dict:
        data = market_data.get("data", [])
        if len(data) < self.k_period:
            return {"signal": "HOLD", "confidence": 0, "reason": "数据不足"}
        highs = [d["high"] for d in data]
        lows = [d["low"] for d in data]
        closes = [d["close"] for d in data]
        k_values = []
        for i in range(self.k_period-1, len(data)):
            h = max(highs[i-self.k_period+1:i+1])
            l = min(lows[i-self.k_period+1:i+1])
            rsv = 100*(closes[i]-l)/(h-l) if h != l else 50
            k = rsv if not k_values else 2/3*k_values[-1]+1/3*rsv
            k_values.append(k)
        d_values = []
        for k in k_values:
            d = k if not d_values else 2/3*d_values[-1]+1/3*k
            d_values.append(d)
        k, d = k_values[-1], d_values[-1]
        j = 3*k - 2*d
        if j < 20 and k < 20:
            return {"signal": "BUY", "confidence": 0.7, "reason": f"超卖(K={k:.1f},J={j:.1f})"}
        if j > 80 and k > 80:
            return {"signal": "SELL", "confidence": 0.7, "reason": f"超买(K={k:.1f},J={j:.1f})"}
        return {"signal": "HOLD", "confidence": 0.3, "reason": f"中性(K={k:.1f})"}
''',
    }

    def __init__(self, data_dir: str, llm=None):
        self.data_dir = data_dir
        self.llm = llm
        self.generator_dir = os.path.join(data_dir, "generated")
        os.makedirs(self.generator_dir, exist_ok=True)

    def set_llm(self, llm):
        self.llm = llm

    async def generate(self, tool_name: str, reflection: Dict) -> Optional[Dict]:
        """生成工具代码：LLM → 沙箱测试 → 回退模板"""
        logger.info("生成工具代码: %s", tool_name)

        code = await self._llm_generate(tool_name, reflection)
        if code:
            if self._sandbox_test(tool_name, code):
                logger.info("LLM生成代码通过沙箱测试: %s", tool_name)
            else:
                logger.warning("LLM生成代码未通过测试，尝试回退模板: %s", tool_name)
                code = None

        if not code:
            code = self.BUILTIN_TEMPLATES.get(tool_name)
            if code:
                logger.info("使用内置模板: %s", tool_name)
            else:
                code = self._generate_basic_framework(tool_name)
                logger.info("使用基础框架: %s", tool_name)

        tool_def = {
            "name": tool_name,
            "code": code,
            "generated_at": time.time(),
            "source": "llm" if self.llm else "template",
            "version": "1.0.0",
        }
        self._save_generated_code(tool_name, tool_def)
        return tool_def

    async def _llm_generate(self, tool_name: str, reflection: Dict) -> Optional[str]:
        if not self.llm:
            return None
        try:
            class_name = "".join(w.capitalize() for w in tool_name.split("_"))
            user_msg = (
                f"请为量化交易系统生成一个名为 {tool_name} 的分析工具。\n"
                f"类名: {class_name}\n"
                f"功能: 基于技术指标分析市场数据并输出买卖信号。\n"
                f"背景: {reflection.get('summary', '需要更多分析工具')}"
            )
            raw = self.llm.chat([
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ], max_tokens=2048)
            # 清理markdown包裹
            code = raw.strip()
            if code.startswith("```python"):
                code = code[9:]
            elif code.startswith("```"):
                code = code[3:]
            if code.endswith("```"):
                code = code[:-3]
            return code.strip()
        except Exception as e:
            logger.error("LLM代码生成失败: %s", e)
            return None

    def _sandbox_test(self, tool_name: str, code: str) -> bool:
        """在子进程中测试代码是否能执行并返回正确格式"""
        class_name = "".join(w.capitalize() for w in tool_name.split("_"))
        test_script = (
            code
            + f"\n\nimport json\n"
            f"mock = {json.dumps(_MOCK_MARKET_DATA)}\n"
            f"obj = {class_name}()\n"
            f"result = obj.analyze(mock, 'BTCUSDT')\n"
            f"assert isinstance(result, dict), 'result must be dict'\n"
            f"assert 'signal' in result, 'missing signal'\n"
            f"assert result['signal'] in ('BUY','SELL','HOLD'), 'invalid signal'\n"
            f"assert 'confidence' in result, 'missing confidence'\n"
            f"print(json.dumps(result))\n"
        )
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
                f.write(test_script)
                tmp_path = f.name
            proc = subprocess.run(
                [sys.executable, tmp_path],
                capture_output=True, text=True, timeout=10,
            )
            os.unlink(tmp_path)
            if proc.returncode == 0:
                logger.info("沙箱测试通过: %s -> %s", tool_name, proc.stdout.strip()[:100])
                return True
            else:
                logger.warning("沙箱测试失败: %s\nstderr: %s", tool_name, proc.stderr[:300])
                return False
        except subprocess.TimeoutExpired:
            logger.warning("沙箱测试超时: %s", tool_name)
            return False
        except Exception as e:
            logger.error("沙箱测试异常: %s", e)
            return False

    def _generate_basic_framework(self, tool_name: str) -> str:
        class_name = "".join(w.capitalize() for w in tool_name.split("_"))
        return f'''from typing import Dict

class {class_name}:
    def analyze(self, market_data: Dict, symbol: str) -> Dict:
        return {{"signal": "HOLD", "confidence": 0, "reason": "基础框架，待LLM升级"}}
'''

    def _save_generated_code(self, tool_name: str, tool_def: Dict):
        code_file = os.path.join(self.generator_dir, f"{tool_name}.json")
        try:
            with open(code_file, "w", encoding="utf-8") as f:
                json.dump(tool_def, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error("保存生成代码失败: %s", e)
