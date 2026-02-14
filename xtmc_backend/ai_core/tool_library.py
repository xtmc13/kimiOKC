"""
工具库模块 - 管理和执行AI生成的交易工具
"""

import importlib.util
import json
import logging
import os
import sys
import time
from typing import Dict, List, Any, Callable, Optional

logger = logging.getLogger(__name__)


class ToolLibrary:
    """
    工具库系统
    
    管理所有AI生成的交易工具，提供统一的执行接口
    """
    
    def __init__(self, library_dir: str):
        self.library_dir = library_dir
        os.makedirs(library_dir, exist_ok=True)
        
        # 工具缓存
        self.tools: Dict[str, Dict] = {}
        self.tool_instances: Dict[str, Any] = {}
        
        # 加载现有工具
        self._load_all_tools()
    
    def _load_all_tools(self):
        """加载工具库中的所有工具"""
        if not os.path.exists(self.library_dir):
            return
        
        for filename in os.listdir(self.library_dir):
            if filename.endswith('.json'):
                tool_name = filename[:-5]
                try:
                    tool_file = os.path.join(self.library_dir, filename)
                    with open(tool_file, 'r', encoding='utf-8') as f:
                        tool_def = json.load(f)
                        self.tools[tool_name] = tool_def
                        
                        # 尝试实例化工具
                        self._instantiate_tool(tool_name, tool_def)
                        
                        logger.info(f"加载工具: {tool_name}")
                except Exception as e:
                    logger.error(f"加载工具 {tool_name} 失败: {e}")
    
    def _instantiate_tool(self, tool_name: str, tool_def: Dict):
        """实例化工具类"""
        try:
            code = tool_def.get('code', '')
            if not code:
                return
            
            # 创建临时模块
            module_name = f"xtmc_tool_{tool_name}"
            spec = importlib.util.spec_from_loader(module_name, loader=None)
            module = importlib.util.module_from_spec(spec)
            
            # 执行代码
            exec(code, module.__dict__)
            
            # 查找类并实例化
            class_name = ''.join(word.capitalize() for word in tool_name.split('_'))
            if hasattr(module, class_name):
                tool_class = getattr(module, class_name)
                self.tool_instances[tool_name] = tool_class()
                
                # 添加分析方法
                self.tools[tool_name]['analyze_func'] = self._create_analyze_wrapper(tool_name)
                
        except Exception as e:
            logger.error(f"实例化工具 {tool_name} 失败: {e}")
    
    def _create_analyze_wrapper(self, tool_name: str) -> Callable:
        """创建分析函数的包装器"""
        async def wrapper(market_data: Dict, symbol: str) -> Dict:
            instance = self.tool_instances.get(tool_name)
            if instance and hasattr(instance, 'analyze'):
                try:
                    return instance.analyze(market_data, symbol)
                except Exception as e:
                    logger.error(f"工具 {tool_name} 分析失败: {e}")
            return {'signal': 'HOLD', 'confidence': 0, 'reason': '工具执行失败'}
        return wrapper
    
    def add_tool(self, tool_name: str, tool_def: Dict):
        """添加新工具到库中"""
        # 保存到文件
        tool_file = os.path.join(self.library_dir, f"{tool_name}.json")
        try:
            with open(tool_file, 'w', encoding='utf-8') as f:
                json.dump(tool_def, f, indent=2, ensure_ascii=False)
            
            # 添加到内存
            self.tools[tool_name] = tool_def
            
            # 实例化工具
            self._instantiate_tool(tool_name, tool_def)
            
            logger.info(f"工具已添加到库: {tool_name}")
            
        except Exception as e:
            logger.error(f"添加工具失败: {e}")
    
    def get_tool(self, tool_name: str) -> Optional[Dict]:
        """获取工具定义"""
        return self.tools.get(tool_name)
    
    def get_all_tools(self) -> Dict[str, Dict]:
        """获取所有工具"""
        return self.tools.copy()
    
    def remove_tool(self, tool_name: str):
        """从库中移除工具"""
        if tool_name in self.tools:
            del self.tools[tool_name]
        if tool_name in self.tool_instances:
            del self.tool_instances[tool_name]
        
        # 删除文件
        tool_file = os.path.join(self.library_dir, f"{tool_name}.json")
        if os.path.exists(tool_file):
            os.remove(tool_file)
        
        logger.info(f"工具已移除: {tool_name}")
    
    def get_tool_stats(self) -> Dict:
        """获取工具库统计信息"""
        return {
            'total_tools': len(self.tools),
            'tool_list': list(self.tools.keys()),
            'instantiated': list(self.tool_instances.keys()),
            'library_dir': self.library_dir
        }
