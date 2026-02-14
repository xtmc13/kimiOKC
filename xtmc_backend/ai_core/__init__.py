"""
XTMC AI核心模块 - 自我进化型AI交易系统

核心理念:
1. 反思当前能力
2. 规划新工具/策略
3. 生成代码实现
4. 测试验证
5. 保存到工具库
6. 持续循环自我提升
"""

from .xtmc_brain import XTMCBrain
from .self_reflection import SelfReflection
from .tool_planner import ToolPlanner
from .code_generator import CodeGenerator
from .tool_library import ToolLibrary

__all__ = [
    'XTMCBrain',
    'SelfReflection',
    'ToolPlanner',
    'CodeGenerator',
    'ToolLibrary',
]
