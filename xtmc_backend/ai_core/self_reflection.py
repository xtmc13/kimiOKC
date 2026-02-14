"""
自我反思模块 - AI能力评估与改进需求分析
"""

import json
import logging
import os
import time
from typing import Dict, List, Any

import numpy as np

logger = logging.getLogger(__name__)


class SelfReflection:
    """
    自我反思系统
    
    功能:
    1. 分析当前交易表现
    2. 评估现有工具的有效性
    3. 识别能力缺口
    4. 提出改进建议
    """
    
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.reflection_dir = os.path.join(data_dir, "reflections")
        os.makedirs(self.reflection_dir, exist_ok=True)
        
        # 反思历史
        self.reflection_history: List[Dict] = []
        self._load_history()
    
    def _load_history(self):
        """加载反思历史"""
        history_file = os.path.join(self.reflection_dir, "history.json")
        if os.path.exists(history_file):
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    self.reflection_history = json.load(f)
            except Exception as e:
                logger.error(f"加载反思历史失败: {e}")
    
    def _save_history(self):
        """保存反思历史"""
        history_file = os.path.join(self.reflection_dir, "history.json")
        try:
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(self.reflection_history[-100:], f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"保存反思历史失败: {e}")
    
    async def analyze(
        self,
        performance: Any,
        tools: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        执行自我反思分析
        
        Args:
            performance: 当前性能指标
            tools: 当前可用的工具
        
        Returns:
            反思结果，包含改进建议
        """
        reflection = {
            'timestamp': time.time(),
            'performance_analysis': {},
            'tool_evaluation': {},
            'gaps': [],
            'recommendations': [],
            'summary': ''
        }
        
        # 1. 分析交易表现
        reflection['performance_analysis'] = self._analyze_performance(performance)
        
        # 2. 评估现有工具
        reflection['tool_evaluation'] = self._evaluate_tools(tools)
        
        # 3. 识别能力缺口
        reflection['gaps'] = self._identify_gaps(
            reflection['performance_analysis'],
            reflection['tool_evaluation']
        )
        
        # 4. 生成改进建议
        reflection['recommendations'] = self._generate_recommendations(
            reflection['gaps'],
            reflection['performance_analysis']
        )
        
        # 5. 生成总结
        reflection['summary'] = self._generate_summary(reflection)
        
        # 保存反思结果
        self.reflection_history.append(reflection)
        self._save_history()
        
        # 保存详细报告
        self._save_reflection_report(reflection)
        
        logger.info(f"自我反思完成: {reflection['summary']}")
        
        return reflection
    
    def _analyze_performance(self, performance: Any) -> Dict:
        """分析交易表现"""
        analysis = {
            'win_rate': getattr(performance, 'win_rate', 0),
            'total_trades': getattr(performance, 'total_trades', 0),
            'total_profit': getattr(performance, 'total_profit', 0),
            'avg_profit': getattr(performance, 'avg_profit_per_trade', 0),
            'assessment': '',
            'issues': []
        }
        
        # 评估表现
        if analysis['total_trades'] < 10:
            analysis['assessment'] = '数据不足，需要更多交易数据'
        elif analysis['win_rate'] < 0.4:
            analysis['assessment'] = '胜率偏低，策略需要改进'
            analysis['issues'].append('low_win_rate')
        elif analysis['win_rate'] > 0.6:
            analysis['assessment'] = '胜率良好，策略有效'
        else:
            analysis['assessment'] = '胜率一般，有改进空间'
        
        if analysis['avg_profit'] < 0:
            analysis['issues'].append('negative_avg_profit')
        
        return analysis
    
    def _evaluate_tools(self, tools: Dict[str, Any]) -> Dict:
        """评估现有工具"""
        evaluation = {
            'total_tools': len(tools),
            'tool_list': list(tools.keys()),
            'coverage': {},
            'redundancy': [],
            'missing_areas': []
        }
        
        # 分析工具覆盖的技术指标类型
        indicator_types = {
            'trend': ['ema', 'sma', 'macd', 'adx'],
            'momentum': ['rsi', 'stochastic', 'cci', 'williams'],
            'volatility': ['bollinger', 'atr', 'keltner'],
            'volume': ['obv', 'vwma', 'mfi'],
            'pattern': ['support', 'resistance', 'fibonacci']
        }
        
        for category, indicators in indicator_types.items():
            covered = sum(1 for tool in tools.keys() 
                         if any(ind in tool.lower() for ind in indicators))
            evaluation['coverage'][category] = {
                'covered': covered,
                'total': len(indicators),
                'percentage': covered / len(indicators) if indicators else 0
            }
            
            if covered == 0:
                evaluation['missing_areas'].append(category)
        
        return evaluation
    
    def _identify_gaps(
        self,
        performance_analysis: Dict,
        tool_evaluation: Dict
    ) -> List[Dict]:
        """识别能力缺口"""
        gaps = []
        
        # 基于表现的缺口
        if 'low_win_rate' in performance_analysis.get('issues', []):
            gaps.append({
                'type': 'performance',
                'description': '胜率偏低，需要更好的入场/出场信号',
                'priority': 'high'
            })
        
        if 'negative_avg_profit' in performance_analysis.get('issues', []):
            gaps.append({
                'type': 'performance',
                'description': '平均收益为负，需要改进风险管理',
                'priority': 'high'
            })
        
        # 基于工具覆盖的缺口
        for area in tool_evaluation.get('missing_areas', []):
            gaps.append({
                'type': 'capability',
                'description': f'缺少{area}类型的分析工具',
                'priority': 'medium'
            })
        
        # 检查是否有足够的多时间框架分析
        if tool_evaluation.get('total_tools', 0) < 5:
            gaps.append({
                'type': 'capability',
                'description': '工具数量不足，需要更多分析维度',
                'priority': 'medium'
            })
        
        return gaps
    
    def _generate_recommendations(
        self,
        gaps: List[Dict],
        performance_analysis: Dict
    ) -> List[Dict]:
        """生成改进建议"""
        recommendations = []
        
        for gap in gaps:
            if gap['type'] == 'performance':
                if '胜率' in gap['description']:
                    recommendations.append({
                        'action': 'add_confirmation_indicator',
                        'description': '添加趋势确认指标，过滤假信号',
                        'tools_needed': ['adx', 'trend_strength'],
                        'priority': gap['priority']
                    })
                elif '风险' in gap['description']:
                    recommendations.append({
                        'action': 'improve_risk_management',
                        'description': '实现动态止损和仓位管理',
                        'tools_needed': ['dynamic_stoploss', 'position_sizing'],
                        'priority': gap['priority']
                    })
            
            elif gap['type'] == 'capability':
                if 'trend' in gap['description'].lower():
                    recommendations.append({
                        'action': 'add_trend_tools',
                        'description': '添加趋势跟踪工具',
                        'tools_needed': ['adx_analyzer', 'trend_detector'],
                        'priority': gap['priority']
                    })
                elif 'momentum' in gap['description'].lower():
                    recommendations.append({
                        'action': 'add_momentum_tools',
                        'description': '添加动量指标工具',
                        'tools_needed': ['stochastic_analyzer', 'cci_calculator'],
                        'priority': gap['priority']
                    })
                elif 'volatility' in gap['description'].lower():
                    recommendations.append({
                        'action': 'add_volatility_tools',
                        'description': '添加波动率分析工具',
                        'tools_needed': ['atr_calculator', 'bollinger_analyzer'],
                        'priority': gap['priority']
                    })
        
        # 始终建议的改进
        recommendations.append({
            'action': 'add_multi_timeframe',
            'description': '添加多时间框架分析能力',
            'tools_needed': ['multi_timeframe_analyzer'],
            'priority': 'low'
        })
        
        return recommendations
    
    def _generate_summary(self, reflection: Dict) -> str:
        """生成反思总结"""
        parts = []
        
        # 表现总结
        perf = reflection['performance_analysis']
        parts.append(f"胜率: {perf.get('win_rate', 0)*100:.1f}%")
        parts.append(f"总交易: {perf.get('total_trades', 0)}")
        
        # 缺口总结
        gaps = reflection['gaps']
        if gaps:
            high_priority = sum(1 for g in gaps if g.get('priority') == 'high')
            parts.append(f"高优先级缺口: {high_priority}个")
        
        # 建议总结
        recs = reflection['recommendations']
        if recs:
            parts.append(f"建议改进: {len(recs)}项")
        
        return " | ".join(parts)
    
    def _save_reflection_report(self, reflection: Dict):
        """保存反思报告"""
        report_file = os.path.join(
            self.reflection_dir,
            f"reflection_{int(reflection['timestamp'])}.json"
        )
        try:
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump(reflection, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"保存反思报告失败: {e}")
    
    def get_reflection_history(self, limit: int = 10) -> List[Dict]:
        """获取反思历史"""
        return self.reflection_history[-limit:]
