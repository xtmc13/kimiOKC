"""
工具规划模块 - 规划需要开发的新工具/策略
"""

import json
import logging
import os
import time
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


class ToolPlanner:
    """
    工具规划系统
    
    根据反思结果，规划需要开发的新工具
    """
    
    # 预定义的工具模板
    TOOL_TEMPLATES = {
        'adx_analyzer': {
            'name': 'ADX趋势强度分析器',
            'description': '使用ADX指标判断趋势强度',
            'indicators': ['ADX', 'DI+', 'DI-'],
            'signals': ['STRONG_TREND', 'WEAK_TREND', 'NO_TREND'],
            'complexity': 'medium'
        },
        'trend_detector': {
            'name': '趋势检测器',
            'description': '多指标综合判断趋势方向',
            'indicators': ['EMA', 'SMA', 'MACD'],
            'signals': ['UPTREND', 'DOWNTREND', 'SIDEWAYS'],
            'complexity': 'medium'
        },
        'stochastic_analyzer': {
            'name': '随机指标分析器',
            'description': '使用KDJ/Stochastic判断超买超卖',
            'indicators': ['K', 'D', 'J'],
            'signals': ['OVERBOUGHT', 'OVERSOLD', 'NEUTRAL'],
            'complexity': 'low'
        },
        'cci_calculator': {
            'name': 'CCI商品通道指数',
            'description': '使用CCI判断价格偏离程度',
            'indicators': ['CCI'],
            'signals': ['OVERBOUGHT', 'OVERSOLD', 'NORMAL'],
            'complexity': 'low'
        },
        'atr_calculator': {
            'name': 'ATR波动率计算器',
            'description': '计算真实波幅，用于止损设置',
            'indicators': ['ATR'],
            'signals': ['HIGH_VOLATILITY', 'LOW_VOLATILITY'],
            'complexity': 'low'
        },
        'bollinger_analyzer': {
            'name': '布林带分析器',
            'description': '使用布林带判断价格通道',
            'indicators': ['BB_UPPER', 'BB_MIDDLE', 'BB_LOWER'],
            'signals': ['TOUCH_UPPER', 'TOUCH_LOWER', 'INSIDE_BANDS'],
            'complexity': 'medium'
        },
        'dynamic_stoploss': {
            'name': '动态止损计算器',
            'description': '根据ATR和市场波动动态调整止损',
            'indicators': ['ATR', 'PRICE'],
            'signals': ['STOP_HIT', 'TRAIL_ADJUST'],
            'complexity': 'high'
        },
        'position_sizing': {
            'name': '仓位管理器',
            'description': '根据风险比例和账户资金计算仓位',
            'indicators': ['ACCOUNT_BALANCE', 'RISK_PERCENT'],
            'signals': ['POSITION_SIZE'],
            'complexity': 'medium'
        },
        'multi_timeframe_analyzer': {
            'name': '多时间框架分析器',
            'description': '综合分析多个时间框架的信号',
            'indicators': ['MULTI_TF_SIGNALS'],
            'signals': ['CONFLUENCE_BUY', 'CONFLUENCE_SELL', 'MIXED'],
            'complexity': 'high'
        },
        'volume_analyzer': {
            'name': '成交量分析器',
            'description': '分析成交量变化确认趋势',
            'indicators': ['VOLUME', 'VWMA', 'OBV'],
            'signals': ['VOLUME_CONFIRM', 'VOLUME_DIVERGENCE'],
            'complexity': 'medium'
        },
        'support_resistance': {
            'name': '支撑阻力检测器',
            'description': '自动识别关键支撑和阻力位',
            'indicators': ['PIVOT_POINTS', 'SWING_HIGHS', 'SWING_LOWS'],
            'signals': ['SUPPORT_HIT', 'RESISTANCE_HIT', 'BREAKOUT'],
            'complexity': 'high'
        },
        'pattern_recognizer': {
            'name': '形态识别器',
            'description': '识别常见K线形态',
            'indicators': ['CANDLE_PATTERNS'],
            'signals': ['BULLISH_PATTERN', 'BEARISH_PATTERN'],
            'complexity': 'high'
        }
    }
    
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.planner_dir = os.path.join(data_dir, "planner")
        os.makedirs(self.planner_dir, exist_ok=True)
        
        # 规划历史
        self.plan_history: List[Dict] = []
        self._load_history()
    
    def _load_history(self):
        """加载规划历史"""
        history_file = os.path.join(self.planner_dir, "history.json")
        if os.path.exists(history_file):
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    self.plan_history = json.load(f)
            except Exception as e:
                logger.error(f"加载规划历史失败: {e}")
    
    def _save_history(self):
        """保存规划历史"""
        history_file = os.path.join(self.planner_dir, "history.json")
        try:
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(self.plan_history[-100:], f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"保存规划历史失败: {e}")
    
    async def plan_tools(self, reflection: Dict) -> List[str]:
        """
        根据反思结果规划需要开发的工具
        
        Args:
            reflection: 反思结果
        
        Returns:
            需要开发的工具名称列表
        """
        planned_tools = []
        
        # 获取建议
        recommendations = reflection.get('recommendations', [])
        
        for rec in recommendations:
            tools_needed = rec.get('tools_needed', [])
            
            for tool_name in tools_needed:
                if tool_name in self.TOOL_TEMPLATES:
                    # 检查是否已存在
                    if not self._tool_exists(tool_name):
                        planned_tools.append(tool_name)
                        logger.info(f"规划新工具: {tool_name}")
        
        # 保存规划结果
        plan_record = {
            'timestamp': time.time(),
            'based_on_reflection': reflection.get('timestamp'),
            'planned_tools': planned_tools,
            'recommendations_count': len(recommendations)
        }
        self.plan_history.append(plan_record)
        self._save_history()
        
        logger.info(f"工具规划完成，计划开发 {len(planned_tools)} 个工具")
        
        return planned_tools
    
    def _tool_exists(self, tool_name: str) -> bool:
        """检查工具是否已存在"""
        # 检查工具库中是否已有
        tool_file = os.path.join(self.data_dir, "..", "tools_library", f"{tool_name}.json")
        return os.path.exists(tool_file)
    
    def get_tool_template(self, tool_name: str) -> Dict:
        """获取工具模板"""
        return self.TOOL_TEMPLATES.get(tool_name, {})
    
    def get_all_templates(self) -> Dict:
        """获取所有可用模板"""
        return self.TOOL_TEMPLATES
    
    def get_plan_history(self, limit: int = 10) -> List[Dict]:
        """获取规划历史"""
        return self.plan_history[-limit:]
