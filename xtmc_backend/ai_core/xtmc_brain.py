"""
XTMC Brain - AI交易大脑
核心控制器，协调各个模块实现自我进化
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
    status: str = "running"  # running, completed, failed
    
    def __post_init__(self):
        if self.planned_tools is None:
            self.planned_tools = []
        if self.generated_code is None:
            self.generated_code = []


class XTMCBrain:
    """
    XTMC AI交易大脑
    
    核心功能:
    1. 持续监控交易表现
    2. 定期自我反思
    3. 规划并生成新工具
    4. 测试验证新策略
    5. 管理工具库
    6. 执行交易决策
    """
    
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.brain_dir = os.path.join(data_dir, "brain")
        os.makedirs(self.brain_dir, exist_ok=True)
        
        # 初始化各个模块
        self.reflection = SelfReflection(self.brain_dir)
        self.planner = ToolPlanner(self.brain_dir)
        self.code_gen = CodeGenerator(self.brain_dir)
        self.tool_lib = ToolLibrary(os.path.join(data_dir, "tools_library"))
        
        # 状态管理
        self.is_running = False
        self.current_cycle: Optional[EvolutionCycle] = None
        self.evolution_history: List[EvolutionCycle] = []
        self.performance = PerformanceMetrics()
        
        # 加载历史
        self._load_state()
        
        logger.info("XTMC Brain 初始化完成")
    
    def _load_state(self):
        """加载历史状态"""
        state_file = os.path.join(self.brain_dir, "brain_state.json")
        if os.path.exists(state_file):
            try:
                with open(state_file, 'r', encoding='utf-8') as f:
                    state = json.load(f)
                    self.performance = PerformanceMetrics(**state.get('performance', {}))
                    logger.info("已加载历史状态")
            except Exception as e:
                logger.error(f"加载状态失败: {e}")
    
    def _save_state(self):
        """保存当前状态"""
        state_file = os.path.join(self.brain_dir, "brain_state.json")
        try:
            with open(state_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'performance': self.performance.to_dict(),
                    'last_update': time.time()
                }, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"保存状态失败: {e}")
    
    async def start_evolution_loop(self):
        """启动进化循环"""
        self.is_running = True
        logger.info("XTMC进化循环已启动")
        
        while self.is_running:
            try:
                # 执行一个进化周期
                await self._run_evolution_cycle()
                
                # 等待下一个周期 (每6小时执行一次)
                await asyncio.sleep(6 * 3600)
                
            except Exception as e:
                logger.error(f"进化循环错误: {e}")
                await asyncio.sleep(3600)  # 出错后1小时重试
    
    async def _run_evolution_cycle(self):
        """执行一个完整的进化周期"""
        cycle_id = f"cycle_{int(time.time())}"
        self.current_cycle = EvolutionCycle(
            cycle_id=cycle_id,
            start_time=time.time()
        )
        
        logger.info(f"=" * 60)
        logger.info(f"开始进化周期: {cycle_id}")
        logger.info(f"=" * 60)
        
        try:
            # 步骤1: 自我反思
            logger.info("[1/5] 执行自我反思...")
            reflection = await self.reflection.analyze(
                self.performance,
                self.tool_lib.get_all_tools()
            )
            self.current_cycle.reflection_result = reflection
            logger.info(f"反思结果: {reflection.get('summary', 'N/A')}")
            
            # 步骤2: 规划新工具
            logger.info("[2/5] 规划新工具...")
            planned_tools = await self.planner.plan_tools(reflection)
            self.current_cycle.planned_tools = planned_tools
            logger.info(f"规划了 {len(planned_tools)} 个新工具")
            
            # 步骤3: 生成代码
            if planned_tools:
                logger.info("[3/5] 生成代码实现...")
                generated = []
                for tool_name in planned_tools:
                    code = await self.code_gen.generate(tool_name, reflection)
                    if code:
                        generated.append(tool_name)
                        # 保存到工具库
                        self.tool_lib.add_tool(tool_name, code)
                self.current_cycle.generated_code = generated
                logger.info(f"成功生成 {len(generated)} 个工具")
            
            # 步骤4: 测试验证
            if self.current_cycle.generated_code:
                logger.info("[4/5] 测试验证新工具...")
                test_results = await self._test_new_tools(
                    self.current_cycle.generated_code
                )
                self.current_cycle.test_results = test_results
                logger.info(f"测试结果: {test_results.get('summary', 'N/A')}")
            
            # 步骤5: 更新性能基准
            logger.info("[5/5] 更新性能基准...")
            await self._update_performance_baseline()
            
            # 完成周期
            self.current_cycle.end_time = time.time()
            self.current_cycle.status = "completed"
            self.evolution_history.append(self.current_cycle)
            
            # 保存状态
            self._save_state()
            
            duration = self.current_cycle.end_time - self.current_cycle.start_time
            logger.info(f"进化周期完成，耗时: {duration:.1f}秒")
            
        except Exception as e:
            logger.error(f"进化周期失败: {e}")
            self.current_cycle.status = "failed"
            self.current_cycle.end_time = time.time()
            self.evolution_history.append(self.current_cycle)
    
    async def _test_new_tools(self, tool_names: List[str]) -> Dict:
        """测试新工具"""
        results = {
            'tested': [],
            'passed': [],
            'failed': [],
            'summary': ''
        }
        
        for tool_name in tool_names:
            try:
                tool = self.tool_lib.get_tool(tool_name)
                if tool and tool.get('test_func'):
                    # 执行测试
                    test_result = await tool['test_func']()
                    results['tested'].append(tool_name)
                    if test_result:
                        results['passed'].append(tool_name)
                    else:
                        results['failed'].append(tool_name)
            except Exception as e:
                logger.error(f"测试工具 {tool_name} 失败: {e}")
                results['failed'].append(tool_name)
        
        results['summary'] = f"测试: {len(results['tested'])}, 通过: {len(results['passed'])}, 失败: {len(results['failed'])}"
        return results
    
    async def _update_performance_baseline(self):
        """更新性能基准"""
        # 这里可以加载历史交易数据来更新性能指标
        pass
    
    async def make_trading_decision(
        self,
        market_data: Dict[str, Any],
        symbol: str
    ) -> Dict:
        """
        做出交易决策
        
        使用工具库中的所有可用工具进行综合分析
        """
        decisions = []
        
        # 获取所有可用工具
        tools = self.tool_lib.get_all_tools()
        
        # 使用每个工具进行分析
        for tool_name, tool in tools.items():
            try:
                if tool.get('analyze_func'):
                    result = await tool['analyze_func'](market_data, symbol)
                    decisions.append({
                        'tool': tool_name,
                        'signal': result.get('signal', 'HOLD'),
                        'confidence': result.get('confidence', 0),
                        'reason': result.get('reason', '')
                    })
            except Exception as e:
                logger.error(f"工具 {tool_name} 分析失败: {e}")
        
        # 综合决策 (简单多数投票)
        if decisions:
            buy_votes = sum(1 for d in decisions if d['signal'] == 'BUY')
            sell_votes = sum(1 for d in decisions if d['signal'] == 'SELL')
            hold_votes = sum(1 for d in decisions if d['signal'] == 'HOLD')
            
            total = len(decisions)
            avg_confidence = sum(d['confidence'] for d in decisions) / total
            
            if buy_votes > sell_votes and buy_votes > hold_votes:
                final_signal = 'BUY'
            elif sell_votes > buy_votes and sell_votes > hold_votes:
                final_signal = 'SELL'
            else:
                final_signal = 'HOLD'
            
            return {
                'signal': final_signal,
                'confidence': avg_confidence,
                'details': decisions,
                'timestamp': time.time()
            }
        
        return {
            'signal': 'HOLD',
            'confidence': 0,
            'details': [],
            'timestamp': time.time()
        }
    
    def update_performance(self, trade_result: Dict):
        """更新交易表现"""
        self.performance.total_trades += 1
        
        profit = trade_result.get('profit', 0)
        self.performance.total_profit += profit
        
        if profit > 0:
            self.performance.winning_trades += 1
        else:
            self.performance.losing_trades += 1
        
        # 更新胜率
        if self.performance.total_trades > 0:
            self.performance.win_rate = (
                self.performance.winning_trades / self.performance.total_trades
            )
            self.performance.avg_profit_per_trade = (
                self.performance.total_profit / self.performance.total_trades
            )
        
        self._save_state()
    
    def get_status(self) -> Dict:
        """获取AI状态"""
        return {
            'is_running': self.is_running,
            'current_cycle': self.current_cycle.cycle_id if self.current_cycle else None,
            'performance': self.performance.to_dict(),
            'tool_count': len(self.tool_lib.get_all_tools()),
            'evolution_count': len(self.evolution_history),
            'last_update': time.time()
        }
    
    def stop(self):
        """停止进化循环"""
        self.is_running = False
        logger.info("XTMC Brain 已停止")
