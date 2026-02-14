"""
XTMC Brain - AI交易大脑
核心控制器，协调各个模块实现自我进化
集成LLM驱动的真实AI能力
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict

from .self_reflection import SelfReflection
from .tool_planner import ToolPlanner
from .code_generator import CodeGenerator
from .tool_library import ToolLibrary

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """性能指标"""
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    total_profit: float = 0.0
    max_drawdown: float = 0.0
    sharpe_ratio: float = 0.0
    win_rate: float = 0.0
    avg_profit_per_trade: float = 0.0

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class EvolutionCycle:
    """进化周期记录"""
    cycle_id: str
    start_time: float
    end_time: Optional[float] = None
    reflection_result: Optional[Dict] = None
    planned_tools: List[str] = None
    generated_code: List[str] = None
    test_results: Optional[Dict] = None
    status: str = "running"

    def __post_init__(self):
        if self.planned_tools is None:
            self.planned_tools = []
        if self.generated_code is None:
            self.generated_code = []


class XTMCBrain:
    """
    XTMC AI交易大脑 - LLM增强版

    核心功能:
    1. 持续监控交易表现
    2. LLM驱动的自我反思
    3. LLM驱动的工具规划与代码生成
    4. 沙箱测试验证新策略
    5. 管理工具库
    6. 多工具综合投票决策
    """

    def __init__(self, data_dir: str = "./data", llm=None):
        self.data_dir = data_dir
        self.brain_dir = os.path.join(data_dir, "brain")
        os.makedirs(self.brain_dir, exist_ok=True)

        # 初始化各个模块（注入LLM）
        self.reflection = SelfReflection(self.brain_dir, llm=llm)
        self.planner = ToolPlanner(self.brain_dir, llm=llm)
        self.code_gen = CodeGenerator(self.brain_dir, llm=llm)
        self.tool_lib = ToolLibrary(os.path.join(data_dir, "tools_library"))

        # 保存LLM引用
        self._llm = llm

        # 状态管理
        self.is_running = False
        self.current_cycle: Optional[EvolutionCycle] = None
        self.evolution_history: List[EvolutionCycle] = []
        self.performance = PerformanceMetrics()

        self._load_state()
        logger.info("XTMC Brain 初始化完成 (LLM: %s)", "可用" if llm else "不可用")

    def set_llm(self, llm):
        """热更新LLM实例到所有子模块"""
        self._llm = llm
        self.reflection.set_llm(llm)
        self.planner.set_llm(llm)
        self.code_gen.set_llm(llm)
        logger.info("LLM实例已注入所有子模块")

    def _load_state(self):
        state_file = os.path.join(self.brain_dir, "brain_state.json")
        if os.path.exists(state_file):
            try:
                with open(state_file, "r", encoding="utf-8") as f:
                    state = json.load(f)
                    self.performance = PerformanceMetrics(**state.get("performance", {}))
                    logger.info("已加载历史状态")
            except Exception as e:
                logger.error("加载状态失败: %s", e)

    def _save_state(self):
        state_file = os.path.join(self.brain_dir, "brain_state.json")
        try:
            with open(state_file, "w", encoding="utf-8") as f:
                json.dump(
                    {"performance": self.performance.to_dict(), "last_update": time.time()},
                    f, indent=2, ensure_ascii=False,
                )
        except Exception as e:
            logger.error("保存状态失败: %s", e)

    async def start_evolution_loop(self):
        """启动进化循环"""
        self.is_running = True
        logger.info("XTMC进化循环已启动")

        # 首次立即执行一个周期
        await self._run_evolution_cycle()

        while self.is_running:
            try:
                # 每6小时执行一次
                await asyncio.sleep(6 * 3600)
                await self._run_evolution_cycle()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("进化循环错误: %s", e)
                await asyncio.sleep(3600)

    async def _run_evolution_cycle(self):
        """执行一个完整的进化周期"""
        cycle_id = f"cycle_{int(time.time())}"
        self.current_cycle = EvolutionCycle(cycle_id=cycle_id, start_time=time.time())

        logger.info("=" * 60)
        logger.info("开始进化周期: %s", cycle_id)
        logger.info("=" * 60)

        try:
            # 1. 自我反思
            logger.info("[1/5] 执行自我反思...")
            reflection = await self.reflection.analyze(
                self.performance, self.tool_lib.get_all_tools()
            )
            self.current_cycle.reflection_result = reflection
            logger.info("反思结果: %s", reflection.get("summary", "N/A"))

            # 2. 规划新工具
            logger.info("[2/5] 规划新工具...")
            planned_tools = await self.planner.plan_tools(reflection)
            self.current_cycle.planned_tools = planned_tools
            logger.info("规划了 %d 个新工具", len(planned_tools))

            # 3. 生成代码
            if planned_tools:
                logger.info("[3/5] 生成代码实现...")
                generated = []
                for tool_name in planned_tools:
                    code = await self.code_gen.generate(tool_name, reflection)
                    if code:
                        generated.append(tool_name)
                        self.tool_lib.add_tool(tool_name, code)
                self.current_cycle.generated_code = generated
                logger.info("成功生成 %d 个工具", len(generated))
            else:
                logger.info("[3/5] 无需生成新工具")

            # 4. 测试验证
            if self.current_cycle.generated_code:
                logger.info("[4/5] 测试验证新工具...")
                test_results = await self._test_new_tools(self.current_cycle.generated_code)
                self.current_cycle.test_results = test_results
                logger.info("测试结果: %s", test_results.get("summary", "N/A"))
            else:
                logger.info("[4/5] 无新工具需要测试")

            # 5. 更新性能基准
            logger.info("[5/5] 更新性能基准...")
            self._save_state()

            # 完成
            self.current_cycle.end_time = time.time()
            self.current_cycle.status = "completed"
            self.evolution_history.append(self.current_cycle)

            duration = self.current_cycle.end_time - self.current_cycle.start_time
            logger.info("进化周期完成，耗时: %.1f秒", duration)

        except Exception as e:
            logger.error("进化周期失败: %s", e)
            self.current_cycle.status = "failed"
            self.current_cycle.end_time = time.time()
            self.evolution_history.append(self.current_cycle)

    async def _test_new_tools(self, tool_names: List[str]) -> Dict:
        """使用模拟数据测试新工具"""
        results = {"tested": [], "passed": [], "failed": [], "summary": ""}
        mock_data = {
            "data": [
                {"time": 1700000000000 + i * 3600000, "open": 40000 + i * 10,
                 "high": 40100 + i * 10, "low": 39900 + i * 10,
                 "close": 40050 + i * 10, "volume": 100 + i}
                for i in range(60)
            ]
        }
        for tool_name in tool_names:
            try:
                tool = self.tool_lib.get_tool(tool_name)
                if tool and tool.get("analyze_func"):
                    result = await tool["analyze_func"](mock_data, "BTCUSDT")
                    results["tested"].append(tool_name)
                    if isinstance(result, dict) and "signal" in result:
                        results["passed"].append(tool_name)
                    else:
                        results["failed"].append(tool_name)
                else:
                    results["failed"].append(tool_name)
            except Exception as e:
                logger.error("测试工具 %s 失败: %s", tool_name, e)
                results["failed"].append(tool_name)

        results["summary"] = (
            f"测试: {len(results['tested'])}, "
            f"通过: {len(results['passed'])}, "
            f"失败: {len(results['failed'])}"
        )
        return results

    async def make_trading_decision(self, market_data: Dict[str, Any], symbol: str) -> Dict:
        """多工具综合投票交易决策"""
        decisions = []
        tools = self.tool_lib.get_all_tools()

        for tool_name, tool in tools.items():
            try:
                if tool.get("analyze_func"):
                    result = await tool["analyze_func"](market_data, symbol)
                    decisions.append({
                        "tool": tool_name,
                        "signal": result.get("signal", "HOLD"),
                        "confidence": result.get("confidence", 0),
                        "reason": result.get("reason", ""),
                    })
            except Exception as e:
                logger.error("工具 %s 分析失败: %s", tool_name, e)

        if decisions:
            buy_votes = sum(1 for d in decisions if d["signal"] == "BUY")
            sell_votes = sum(1 for d in decisions if d["signal"] == "SELL")
            total = len(decisions)
            avg_confidence = sum(d["confidence"] for d in decisions) / total

            if buy_votes > sell_votes and buy_votes > total / 2:
                final_signal = "BUY"
            elif sell_votes > buy_votes and sell_votes > total / 2:
                final_signal = "SELL"
            else:
                final_signal = "HOLD"

            return {
                "signal": final_signal,
                "confidence": avg_confidence,
                "details": decisions,
                "timestamp": time.time(),
            }

        return {"signal": "HOLD", "confidence": 0, "details": [], "timestamp": time.time()}

    def update_performance(self, trade_result: Dict):
        """更新交易表现"""
        self.performance.total_trades += 1
        profit = trade_result.get("profit", 0)
        self.performance.total_profit += profit
        if profit > 0:
            self.performance.winning_trades += 1
        else:
            self.performance.losing_trades += 1
        if self.performance.total_trades > 0:
            self.performance.win_rate = self.performance.winning_trades / self.performance.total_trades
            self.performance.avg_profit_per_trade = self.performance.total_profit / self.performance.total_trades
        self._save_state()

    def get_status(self) -> Dict:
        return {
            "is_running": self.is_running,
            "llm_available": self._llm is not None,
            "current_cycle": self.current_cycle.cycle_id if self.current_cycle else None,
            "performance": self.performance.to_dict(),
            "tool_count": len(self.tool_lib.get_all_tools()),
            "evolution_count": len(self.evolution_history),
            "win_rate": self.performance.win_rate,
            "total_profit": self.performance.total_profit,
            "last_update": time.time(),
        }

    def stop(self):
        self.is_running = False
        logger.info("XTMC Brain 已停止")
