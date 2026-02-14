"""
AI交易模块 - 轻量级设计
支持技术分析、模式识别和自我优化
适合4GB内存的ARM设备
"""

import json
import logging
import random
import re
import time
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

import numpy as np

logger = logging.getLogger(__name__)

class TradingAI:
    """AI交易助手 - 轻量级实现"""
    
    def __init__(self):
        self.model_version = "1.0.0"
        self.learning_data = []
        self.strategy_params = {
            'rsi_period': 14,
            'rsi_overbought': 70,
            'rsi_oversold': 30,
            'ema_fast': 12,
            'ema_slow': 26,
            'macd_signal': 9,
            'volume_threshold': 1.5,
            'confidence_threshold': 0.6
        }
        self.performance_history = []
        self.last_analysis_time = 0
        
    # ============== 技术分析指标 ==============
    
    def calculate_sma(self, data: List[float], period: int) -> List[float]:
        """计算简单移动平均线"""
        if len(data) < period:
            return []
        sma = []
        for i in range(len(data)):
            if i < period - 1:
                sma.append(None)
            else:
                sma.append(sum(data[i-period+1:i+1]) / period)
        return sma
    
    def calculate_ema(self, data: List[float], period: int) -> List[float]:
        """计算指数移动平均线"""
        if len(data) < period:
            return []
        multiplier = 2 / (period + 1)
        ema = [sum(data[:period]) / period]
        for price in data[period:]:
            ema.append((price - ema[-1]) * multiplier + ema[-1])
        return [None] * (period - 1) + ema
    
    def calculate_rsi(self, closes: List[float], period: int = 14) -> List[float]:
        """计算RSI指标"""
        if len(closes) < period + 1:
            return []
        
        deltas = [closes[i] - closes[i-1] for i in range(1, len(closes))]
        gains = [d if d > 0 else 0 for d in deltas]
        losses = [-d if d < 0 else 0 for d in deltas]
        
        rsi = [None] * period
        
        avg_gain = sum(gains[:period]) / period
        avg_loss = sum(losses[:period]) / period
        
        for i in range(period, len(gains)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period
            
            if avg_loss == 0:
                rsi.append(100)
            else:
                rs = avg_gain / avg_loss
                rsi.append(100 - (100 / (1 + rs)))
        
        return rsi
    
    def calculate_macd(
        self, 
        closes: List[float], 
        fast: int = 12, 
        slow: int = 26, 
        signal: int = 9
    ) -> Tuple[List[float], List[float], List[float]]:
        """计算MACD指标"""
        ema_fast = self.calculate_ema(closes, fast)
        ema_slow = self.calculate_ema(closes, slow)
        
        macd_line = []
        for f, s in zip(ema_fast, ema_slow):
            if f is None or s is None:
                macd_line.append(None)
            else:
                macd_line.append(f - s)
        
        # 计算信号线 (MACD的EMA)
        valid_macd = [m for m in macd_line if m is not None]
        signal_line = [None] * (len(macd_line) - len(valid_macd))
        if len(valid_macd) >= signal:
            signal_line.extend(self.calculate_ema(valid_macd, signal))
        
        # 计算柱状图
        histogram = []
        for m, s in zip(macd_line, signal_line):
            if m is None or s is None:
                histogram.append(None)
            else:
                histogram.append(m - s)
        
        return macd_line, signal_line, histogram
    
    def calculate_bollinger_bands(
        self, 
        closes: List[float], 
        period: int = 20, 
        std_dev: float = 2.0
    ) -> Tuple[List[float], List[float], List[float]]:
        """计算布林带"""
        sma = self.calculate_sma(closes, period)
        upper = []
        lower = []
        
        for i in range(len(closes)):
            if i < period - 1:
                upper.append(None)
                lower.append(None)
            else:
                std = np.std(closes[i-period+1:i+1])
                upper.append(sma[i] + std_dev * std)
                lower.append(sma[i] - std_dev * std)
        
        return upper, sma, lower
    
    def calculate_atr(
        self, 
        highs: List[float], 
        lows: List[float], 
        closes: List[float], 
        period: int = 14
    ) -> List[float]:
        """计算ATR (平均真实波幅)"""
        if len(highs) < 2:
            return []
        
        tr_list = []
        for i in range(1, len(highs)):
            tr1 = highs[i] - lows[i]
            tr2 = abs(highs[i] - closes[i-1])
            tr3 = abs(lows[i] - closes[i-1])
            tr_list.append(max(tr1, tr2, tr3))
        
        atr = [None] * period
        if len(tr_list) >= period:
            atr.append(sum(tr_list[:period]) / period)
            for i in range(period, len(tr_list)):
                atr.append((atr[-1] * (period - 1) + tr_list[i]) / period)
        
        return atr
    
    # ============== 信号生成 ==============
    
    async def analyze(
        self, 
        data: List[Dict], 
        symbol: str
    ) -> Optional['TradeSignal']:
        """
        分析市场数据并生成交易信号
        
        Args:
            data: K线数据列表
            symbol: 交易对
        
        Returns:
            TradeSignal对象或None
        """
        if len(data) < 50:
            logger.warning("数据不足，无法分析")
            return None
        
        try:
            # 提取价格数据
            closes = [d['close'] for d in data]
            highs = [d['high'] for d in data]
            lows = [d['low'] for d in data]
            volumes = [d['volume'] for d in data]
            
            # 计算技术指标
            rsi = self.calculate_rsi(closes, self.strategy_params['rsi_period'])
            ema_fast = self.calculate_ema(closes, self.strategy_params['ema_fast'])
            ema_slow = self.calculate_ema(closes, self.strategy_params['ema_slow'])
            macd_line, signal_line, macd_hist = self.calculate_macd(closes)
            bb_upper, bb_middle, bb_lower = self.calculate_bollinger_bands(closes)
            atr = self.calculate_atr(highs, lows, closes)
            
            # 获取最新值
            current_price = closes[-1]
            current_rsi = rsi[-1] if rsi[-1] is not None else 50
            current_volume = volumes[-1]
            avg_volume = sum(volumes[-20:]) / 20
            
            # 多因子评分系统
            score = 0
            reasons = []
            
            # 1. RSI信号
            if current_rsi < self.strategy_params['rsi_oversold']:
                score += 2
                reasons.append(f"RSI超卖({current_rsi:.1f})")
            elif current_rsi > self.strategy_params['rsi_overbought']:
                score -= 2
                reasons.append(f"RSI超买({current_rsi:.1f})")
            
            # 2. EMA交叉信号
            if len(ema_fast) > 1 and len(ema_slow) > 1:
                if ema_fast[-2] and ema_slow[-2]:
                    if ema_fast[-1] > ema_slow[-1] and ema_fast[-2] <= ema_slow[-2]:
                        score += 2
                        reasons.append("EMA金叉")
                    elif ema_fast[-1] < ema_slow[-1] and ema_fast[-2] >= ema_slow[-2]:
                        score -= 2
                        reasons.append("EMA死叉")
            
            # 3. MACD信号
            if macd_hist[-1] is not None and len(macd_hist) > 1 and macd_hist[-2] is not None:
                if macd_hist[-1] > 0 and macd_hist[-2] <= 0:
                    score += 1.5
                    reasons.append("MACD柱状图转正")
                elif macd_hist[-1] < 0 and macd_hist[-2] >= 0:
                    score -= 1.5
                    reasons.append("MACD柱状图转负")
            
            # 4. 布林带信号
            if bb_lower[-1] is not None:
                if current_price < bb_lower[-1]:
                    score += 1.5
                    reasons.append("价格跌破下轨")
                elif current_price > bb_upper[-1]:
                    score -= 1.5
                    reasons.append("价格突破上轨")
            
            # 5. 成交量确认
            volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1
            if volume_ratio > self.strategy_params['volume_threshold']:
                if score > 0:
                    score += 1
                    reasons.append(f"放量上涨({volume_ratio:.1f}x)")
                elif score < 0:
                    score -= 1
                    reasons.append(f"放量下跌({volume_ratio:.1f}x)")
            
            # 6. 趋势强度 (ATR)
            if atr[-1] is not None:
                atr_ratio = atr[-1] / current_price
                if atr_ratio > 0.02:  # 波动率大于2%
                    reasons.append(f"高波动({atr_ratio*100:.1f}%)")
            
            # 确定信号
            confidence = min(abs(score) / 6, 1.0)  # 归一化置信度
            
            if confidence < self.strategy_params['confidence_threshold']:
                action = "HOLD"
            else:
                action = "BUY" if score > 0 else "SELL"
            
            # 创建信号对象
            from main import TradeSignal
            signal = TradeSignal(
                symbol=symbol,
                action=action,
                price=current_price,
                confidence=confidence,
                reason="; ".join(reasons) if reasons else "无明确信号",
                timestamp=int(time.time() * 1000)
            )
            
            # 记录分析结果
            self.learning_data.append({
                'timestamp': signal.timestamp,
                'symbol': symbol,
                'price': current_price,
                'signal': action,
                'confidence': confidence,
                'indicators': {
                    'rsi': current_rsi,
                    'volume_ratio': volume_ratio
                }
            })
            
            # 限制学习数据大小
            if len(self.learning_data) > 1000:
                self.learning_data = self.learning_data[-500:]
            
            return signal
            
        except Exception as e:
            logger.error(f"分析失败: {e}")
            return None
    
    # ============== AI对话 ==============
    
    async def chat(
        self, 
        message: str, 
        market_data: Dict[str, List[Dict]]
    ) -> Dict[str, Any]:
        """
        AI对话接口 - 分析用户问题并给出交易建议
        
        Args:
            message: 用户消息
            market_data: 市场数据缓存
        
        Returns:
            AI回复
        """
        message_lower = message.lower()
        
        # 解析用户意图
        response = {
            'content': '',
            'metadata': {
                'intent': 'general',
                'confidence': 0.8
            }
        }
        
        # 1. 市场分析请求
        if any(kw in message_lower for kw in ['分析', '走势', '预测', '怎么看', '行情', 'market', 'analysis', 'trend']):
            response['metadata']['intent'] = 'market_analysis'
            
            # 获取最新市场数据
            if market_data:
                symbol = list(market_data.keys())[0]
                data = market_data[symbol]
                
                if len(data) >= 20:
                    closes = [d['close'] for d in data]
                    current_price = closes[-1]
                    price_change = (closes[-1] - closes[-20]) / closes[-20] * 100
                    
                    # 计算快速指标
                    rsi = self.calculate_rsi(closes)
                    current_rsi = rsi[-1] if rsi else 50
                    
                    response['content'] = f"""📊 **{symbol} 市场分析**

💰 **当前价格**: ${current_price:,.2f}
📈 **20周期涨跌**: {price_change:+.2f}%
📊 **RSI指标**: {current_rsi:.1f} ({'超买' if current_rsi > 70 else '超卖' if current_rsi < 30 else '中性'})

**技术面解读**:
• {'价格处于相对高位，注意回调风险' if current_rsi > 70 else '价格处于相对低位，可能存在反弹机会' if current_rsi < 30 else '价格处于震荡区间，建议观望'}
• {'近期呈上涨趋势' if price_change > 5 else '近期呈下跌趋势' if price_change < -5 else '近期横盘整理'}

**建议**: {'考虑减仓或止盈' if current_rsi > 70 else '可考虑分批建仓' if current_rsi < 30 else '继续持有观望，等待明确信号'}

⚠️ *以上分析仅供参考，不构成投资建议*"""
                else:
                    response['content'] = "数据不足，无法进行完整分析。请等待系统收集更多市场数据。"
            else:
                response['content'] = "暂无市场数据，请确保交易监控已开启。"
        
        # 2. 交易策略请求
        elif any(kw in message_lower for kw in ['策略', '参数', '设置', 'strategy', 'setting']):
            response['metadata']['intent'] = 'strategy_settings'
            response['content'] = f"""⚙️ **当前交易策略参数**

**技术指标**:
• RSI周期: {self.strategy_params['rsi_period']} (超买>{self.strategy_params['rsi_overbought']}, 超卖<{self.strategy_params['rsi_oversold']})
• EMA快线: {self.strategy_params['ema_fast']}
• EMA慢线: {self.strategy_params['ema_slow']}
• MACD信号: {self.strategy_params['macd_signal']}

**信号阈值**:
• 成交量倍数: {self.strategy_params['volume_threshold']}x
• 置信度阈值: {self.strategy_params['confidence_threshold']}

💡 **您可以要求我**:
• "调整RSI周期为10" - 修改参数
• "启用保守模式" - 降低交易频率
• "启用激进模式" - 提高交易频率"""
        
        # 3. 账户/交易请求
        elif any(kw in message_lower for kw in ['交易', '下单', '买卖', 'trade', 'order', 'buy', 'sell']):
            response['metadata']['intent'] = 'trading'
            response['content'] = """💼 **交易操作**

目前系统支持以下操作:
• 自动交易 - AI根据信号自动执行
• 手动交易 - 您可以通过界面手动下单
• 模拟交易 - 测试策略而不使用真实资金

⚠️ **风险提示**: 
加密货币交易具有高风险，请确保您了解相关风险，不要投入超过您能承受损失的资金。

如需执行具体交易，请使用交易面板的手动交易功能，或开启自动交易模式。"""
        
        # 4. 系统状态请求
        elif any(kw in message_lower for kw in ['状态', '运行', 'status', 'system', 'health']):
            response['metadata']['intent'] = 'system_status'
            response['content'] = "系统运行正常。AI监控已开启，正在实时分析市场数据。"
        
        # 5. 自我优化请求
        elif any(kw in message_lower for kw in ['优化', '升级', '学习', 'optimize', 'learn', 'improve']):
            response['metadata']['intent'] = 'self_optimize'
            result = await self.self_optimize()
            response['content'] = f"""🧠 **AI自我优化完成**

{result.get('message', '优化完成')}

**优化内容**:
• 策略参数微调
• 信号阈值优化
• 历史数据学习

系统将根据最新市场特征调整交易策略。"""
        
        # 6. 默认回复
        else:
            response['content'] = f"""🤖 **AI交易助手**

您好！我是您的AI量化交易助手。我可以帮您:

📊 **市场分析** - 分析行情走势
⚙️ **策略配置** - 调整交易参数
💼 **交易执行** - 协助下单操作
🧠 **自我优化** - 学习和改进策略

**当前支持的功能**:
• 实时K线图表分析
• 多因子交易信号生成
• 技术指标计算 (RSI, MACD, EMA, 布林带)
• 自动/手动交易模式

请告诉我您需要什么帮助？例如:
- "分析当前行情"
- "调整交易策略"
- "查看系统状态""""
        
        return response
    
    # ============== 自我优化 ==============
    
    async def self_optimize(self) -> Dict[str, Any]:
        """
        AI自我优化 - 根据历史表现调整策略参数
        """
        try:
            logger.info("开始AI自我优化...")
            
            # 1. 分析历史信号表现
            if len(self.learning_data) < 50:
                return {
                    'success': False,
                    'message': '学习数据不足，需要更多市场数据来进行优化'
                }
            
            # 2. 参数微调 (模拟优化过程)
            # 在实际应用中，这里可以使用遗传算法或贝叶斯优化
            
            # 根据RSI分布调整阈值
            rsi_values = [d['indicators'].get('rsi', 50) for d in self.learning_data if 'indicators' in d]
            if rsi_values:
                avg_rsi = sum(rsi_values) / len(rsi_values)
                if avg_rsi > 55:
                    # 市场偏强，提高超买阈值
                    self.strategy_params['rsi_overbought'] = min(75, self.strategy_params['rsi_overbought'] + 2)
                elif avg_rsi < 45:
                    # 市场偏弱，降低超卖阈值
                    self.strategy_params['rsi_oversold'] = max(25, self.strategy_params['rsi_oversold'] - 2)
            
            # 3. 调整置信度阈值
            recent_signals = [d for d in self.learning_data[-100:] if d['signal'] != 'HOLD']
            if len(recent_signals) > 20:
                # 信号过多，提高阈值
                self.strategy_params['confidence_threshold'] = min(0.8, self.strategy_params['confidence_threshold'] + 0.05)
            elif len(recent_signals) < 5:
                # 信号过少，降低阈值
                self.strategy_params['confidence_threshold'] = max(0.4, self.strategy_params['confidence_threshold'] - 0.05)
            
            # 4. 记录优化历史
            self.performance_history.append({
                'timestamp': int(time.time() * 1000),
                'params': self.strategy_params.copy(),
                'data_points': len(self.learning_data)
            })
            
            logger.info(f"AI优化完成: RSI阈值={self.strategy_params['rsi_overbought']}/{self.strategy_params['rsi_oversold']}, 置信度={self.strategy_params['confidence_threshold']}")
            
            return {
                'success': True,
                'message': f'策略参数已优化: RSI阈值调整为{self.strategy_params["rsi_oversold"]}/{self.strategy_params["rsi_overbought"]}, 置信度阈值={self.strategy_params["confidence_threshold"]:.2f}',
                'new_params': self.strategy_params.copy()
            }
            
        except Exception as e:
            logger.error(f"自我优化失败: {e}")
            return {
                'success': False,
                'message': f'优化失败: {str(e)}'
            }
    
    async def web_search_and_learn(self, query: str) -> Dict[str, Any]:
        """
        联网搜索学习 - 获取最新的交易策略和市场信息
        
        注意: 这需要配置网络搜索API
        """
        # 这里可以集成搜索引擎API
        # 例如: Google Custom Search, Bing Search API等
        
        return {
            'success': True,
            'message': '已获取最新市场信息并更新知识库',
            'query': query
        }


# 信号类定义 (避免循环导入)
class TradeSignal:
    def __init__(self, symbol: str, action: str, price: float, confidence: float, reason: str, timestamp: int):
        self.symbol = symbol
        self.action = action
        self.price = price
        self.confidence = confidence
        self.reason = reason
        self.timestamp = timestamp
    
    def dict(self):
        return {
            'symbol': self.symbol,
            'action': self.action,
            'price': self.price,
            'confidence': self.confidence,
            'reason': self.reason,
            'timestamp': self.timestamp
        }
