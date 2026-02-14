"""
代码生成模块 - 自动生成交易工具的代码实现
"""

import json
import logging
import os
import time
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


class CodeGenerator:
    """
    代码生成系统
    
    根据工具规划，自动生成Python代码实现
    """
    
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.generator_dir = os.path.join(data_dir, "generated")
        os.makedirs(self.generator_dir, exist_ok=True)
        
        # 代码模板库
        self.code_templates = self._init_code_templates()
    
    def _init_code_templates(self) -> Dict[str, str]:
        """初始化代码模板"""
        return {
            'adx_analyzer': '''
import numpy as np
from typing import Dict, List, Any

class ADXAnalyzer:
    """ADX趋势强度分析器"""
    
    def __init__(self, period: int = 14):
        self.period = period
    
    def calculate(self, highs: List[float], lows: List[float], closes: List[float]) -> Dict:
        """计算ADX指标"""
        if len(closes) < self.period + 1:
            return {'adx': 50, 'di_plus': 25, 'di_minus': 25}
        
        # 计算+DM和-DM
        plus_dm = []
        minus_dm = []
        tr_list = []
        
        for i in range(1, len(closes)):
            high_diff = highs[i] - highs[i-1]
            low_diff = lows[i-1] - lows[i]
            
            plus_dm.append(max(high_diff, 0) if high_diff > low_diff else 0)
            minus_dm.append(max(low_diff, 0) if low_diff > high_diff else 0)
            
            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i-1]),
                abs(lows[i] - closes[i-1])
            )
            tr_list.append(tr)
        
        # 平滑
        atr = self._smooth(tr_list, self.period)
        plus_di = 100 * np.array(self._smooth(plus_dm, self.period)) / np.array(atr)
        minus_di = 100 * np.array(self._smooth(minus_dm, self.period)) / np.array(atr)
        
        # 计算DX和ADX
        dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di + 1e-10)
        adx = self._smooth(dx.tolist(), self.period)
        
        return {
            'adx': adx[-1] if adx else 50,
            'di_plus': plus_di[-1] if len(plus_di) > 0 else 25,
            'di_minus': minus_di[-1] if len(minus_di) > 0 else 25
        }
    
    def _smooth(self, data: List[float], period: int) -> List[float]:
        """平滑计算"""
        if len(data) < period:
            return data
        smoothed = [sum(data[:period]) / period]
        for i in range(period, len(data)):
            smoothed.append((smoothed[-1] * (period - 1) + data[i]) / period)
        return smoothed
    
    def analyze(self, market_data: Dict, symbol: str) -> Dict:
        """分析并返回信号"""
        highs = [d['high'] for d in market_data.get('data', [])]
        lows = [d['low'] for d in market_data.get('data', [])]
        closes = [d['close'] for d in market_data.get('data', [])]
        
        if len(closes) < self.period:
            return {'signal': 'HOLD', 'confidence': 0, 'reason': '数据不足'}
        
        result = self.calculate(highs, lows, closes)
        adx = result['adx']
        di_plus = result['di_plus']
        di_minus = result['di_minus']
        
        # 生成信号
        if adx > 25:
            if di_plus > di_minus:
                signal = 'BUY'
                confidence = min(adx / 50, 1.0)
                reason = f'强势上涨 (ADX={adx:.1f})'
            else:
                signal = 'SELL'
                confidence = min(adx / 50, 1.0)
                reason = f'强势下跌 (ADX={adx:.1f})'
        else:
            signal = 'HOLD'
            confidence = 0.3
            reason = f'趋势不明 (ADX={adx:.1f})'
        
        return {'signal': signal, 'confidence': confidence, 'reason': reason}
''',
            'stochastic_analyzer': '''
import numpy as np
from typing import Dict, List, Any

class StochasticAnalyzer:
    """随机指标(KDJ)分析器"""
    
    def __init__(self, k_period: int = 9, d_period: int = 3, j_period: int = 3):
        self.k_period = k_period
        self.d_period = d_period
        self.j_period = j_period
    
    def calculate(self, highs: List[float], lows: List[float], closes: List[float]) -> Dict:
        """计算KDJ指标"""
        if len(closes) < self.k_period:
            return {'k': 50, 'd': 50, 'j': 50}
        
        k_values = []
        
        for i in range(self.k_period - 1, len(closes)):
            high_n = max(highs[i - self.k_period + 1:i + 1])
            low_n = min(lows[i - self.k_period + 1:i + 1])
            
            if high_n == low_n:
                rsv = 50
            else:
                rsv = 100 * (closes[i] - low_n) / (high_n - low_n)
            
            if i == self.k_period - 1:
                k = rsv
            else:
                k = 2/3 * k_values[-1] + 1/3 * rsv
            
            k_values.append(k)
        
        # 计算D值
        d_values = []
        for i, k in enumerate(k_values):
            if i == 0:
                d = k
            else:
                d = 2/3 * d_values[-1] + 1/3 * k
            d_values.append(d)
        
        # 计算J值
        k = k_values[-1]
        d = d_values[-1]
        j = 3 * k - 2 * d
        
        return {'k': k, 'd': d, 'j': j}
    
    def analyze(self, market_data: Dict, symbol: str) -> Dict:
        """分析并返回信号"""
        highs = [d['high'] for d in market_data.get('data', [])]
        lows = [d['low'] for d in market_data.get('data', [])]
        closes = [d['close'] for d in market_data.get('data', [])]
        
        if len(closes) < self.k_period:
            return {'signal': 'HOLD', 'confidence': 0, 'reason': '数据不足'}
        
        result = self.calculate(highs, lows, closes)
        k, d, j = result['k'], result['d'], result['j']
        
        # 生成信号
        if j < 20 and k < 20:
            signal = 'BUY'
            confidence = (20 - j) / 20 * 0.8
            reason = f'超卖区域 (K={k:.1f}, J={j:.1f})'
        elif j > 80 and k > 80:
            signal = 'SELL'
            confidence = (j - 80) / 20 * 0.8
            reason = f'超买区域 (K={k:.1f}, J={j:.1f})'
        elif k > d and j > k:
            signal = 'BUY'
            confidence = 0.5
            reason = f'金叉向上 (K={k:.1f}, D={d:.1f})'
        elif k < d and j < k:
            signal = 'SELL'
            confidence = 0.5
            reason = f'死叉向下 (K={k:.1f}, D={d:.1f})'
        else:
            signal = 'HOLD'
            confidence = 0.3
            reason = f'中性 (K={k:.1f}, D={d:.1f})'
        
        return {'signal': signal, 'confidence': confidence, 'reason': reason}
''',
            'atr_calculator': '''
import numpy as np
from typing import Dict, List, Any

class ATRCalculator:
    """ATR波动率计算器"""
    
    def __init__(self, period: int = 14):
        self.period = period
    
    def calculate(self, highs: List[float], lows: List[float], closes: List[float]) -> Dict:
        """计算ATR指标"""
        if len(closes) < 2:
            return {'atr': 0, 'atr_percent': 0}
        
        tr_list = []
        for i in range(1, len(closes)):
            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i-1]),
                abs(lows[i] - closes[i-1])
            )
            tr_list.append(tr)
        
        # 计算ATR
        if len(tr_list) >= self.period:
            atr = sum(tr_list[-self.period:]) / self.period
        else:
            atr = sum(tr_list) / len(tr_list) if tr_list else 0
        
        atr_percent = (atr / closes[-1] * 100) if closes[-1] > 0 else 0
        
        return {'atr': atr, 'atr_percent': atr_percent}
    
    def analyze(self, market_data: Dict, symbol: str) -> Dict:
        """分析波动率"""
        highs = [d['high'] for d in market_data.get('data', [])]
        lows = [d['low'] for d in market_data.get('data', [])]
        closes = [d['close'] for d in market_data.get('data', [])]
        
        if len(closes) < 2:
            return {'signal': 'HOLD', 'confidence': 0, 'reason': '数据不足'}
        
        result = self.calculate(highs, lows, closes)
        atr_percent = result['atr_percent']
        
        # 高波动率时建议观望
        if atr_percent > 5:
            signal = 'HOLD'
            confidence = 0.7
            reason = f'高波动率 (ATR={atr_percent:.2f}%)，建议观望'
        elif atr_percent > 3:
            signal = 'HOLD'
            confidence = 0.5
            reason = f'中等波动率 (ATR={atr_percent:.2f}%)'
        else:
            signal = 'HOLD'
            confidence = 0.3
            reason = f'低波动率 (ATR={atr_percent:.2f}%)'
        
        return {'signal': signal, 'confidence': confidence, 'reason': reason}
''',
            'dynamic_stoploss': '''
from typing import Dict, List, Any

class DynamicStopLoss:
    """动态止损计算器"""
    
    def __init__(self, atr_multiplier: float = 2.0):
        self.atr_multiplier = atr_multiplier
    
    def calculate(self, entry_price: float, atr: float, position: str) -> Dict:
        """计算动态止损价格"""
        stop_distance = atr * self.atr_multiplier
        
        if position == 'LONG':
            stop_price = entry_price - stop_distance
        else:
            stop_price = entry_price + stop_distance
        
        return {
            'stop_price': stop_price,
            'stop_distance': stop_distance,
            'stop_percent': (stop_distance / entry_price) * 100
        }
    
    def update_trailing(self, current_price: float, highest_price: float, 
                        atr: float, position: str) -> Dict:
        """更新追踪止损"""
        stop_distance = atr * self.atr_multiplier
        
        if position == 'LONG':
            new_stop = highest_price - stop_distance
        else:
            new_stop = highest_price + stop_distance
        
        return {
            'trailing_stop': new_stop,
            'should_update': True
        }
    
    def analyze(self, market_data: Dict, symbol: str) -> Dict:
        """风险管理分析"""
        return {
            'signal': 'HOLD',
            'confidence': 0,
            'reason': '止损工具，不直接产生交易信号'
        }
'''
        }
    
    async def generate(self, tool_name: str, reflection: Dict) -> Dict:
        """
        生成工具的代码实现
        
        Args:
            tool_name: 工具名称
            reflection: 反思结果
        
        Returns:
            生成的代码和元数据
        """
        logger.info(f"生成工具代码: {tool_name}")
        
        # 获取代码模板
        code = self.code_templates.get(tool_name, '')
        
        if not code:
            # 如果没有模板，生成基础框架
            code = self._generate_basic_framework(tool_name)
        
        # 创建工具定义
        tool_def = {
            'name': tool_name,
            'code': code,
            'generated_at': time.time(),
            'based_on_reflection': reflection.get('timestamp'),
            'version': '1.0.0'
        }
        
        # 保存生成的代码
        self._save_generated_code(tool_name, tool_def)
        
        logger.info(f"代码生成完成: {tool_name}")
        
        return tool_def
    
    def _generate_basic_framework(self, tool_name: str) -> str:
        """生成基础代码框架"""
        class_name = ''.join(word.capitalize() for word in tool_name.split('_'))
        
        return f'''
from typing import Dict, List, Any

class {class_name}:
    """{tool_name} 分析器"""
    
    def __init__(self):
        pass
    
    def analyze(self, market_data: Dict, symbol: str) -> Dict:
        """分析并返回信号"""
        # TODO: 实现分析逻辑
        return {{
            'signal': 'HOLD',
            'confidence': 0,
            'reason': '待实现'
        }}
'''
    
    def _save_generated_code(self, tool_name: str, tool_def: Dict):
        """保存生成的代码"""
        code_file = os.path.join(self.generator_dir, f"{tool_name}.json")
        try:
            with open(code_file, 'w', encoding='utf-8') as f:
                json.dump(tool_def, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"保存生成代码失败: {e}")
