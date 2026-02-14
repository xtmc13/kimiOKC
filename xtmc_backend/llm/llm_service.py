"""
LLM推理服务 - 基于llama-cpp-python的本地大语言模型
支持懒加载、空闲卸载、多种调用模式
"""

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).parent / "config.json"


def _load_config() -> Dict[str, Any]:
    if _CONFIG_PATH.exists():
        with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


class LLMService:
    """本地LLM推理服务，懒加载+空闲自动卸载"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = _load_config()
        if config:
            cfg.update(config)

        base_dir = Path(__file__).parent.parent.resolve()
        raw_path = cfg.get("model_path", "./models/qwen2.5-1.5b-instruct-q4_k_m.gguf")
        self.model_path = str((base_dir / raw_path).resolve())

        self.n_ctx: int = cfg.get("n_ctx", 4096)
        self.n_gpu_layers: int = cfg.get("n_gpu_layers", 0)
        self.temperature: float = cfg.get("temperature", 0.7)
        self.top_p: float = cfg.get("top_p", 0.9)
        self.max_tokens: int = cfg.get("max_tokens", 1024)
        self.chat_format: str = cfg.get("chat_format", "chatml")
        self.idle_timeout: int = cfg.get("idle_timeout_minutes", 30) * 60

        self._model = None
        self._lock = threading.Lock()
        self._last_used: float = 0
        self._idle_timer: Optional[threading.Timer] = None
        self._loaded = False

        logger.info(
            "LLMService 初始化: model=%s, n_ctx=%d, idle_timeout=%dmin",
            os.path.basename(self.model_path),
            self.n_ctx,
            self.idle_timeout // 60,
        )

    # ------------------------------------------------------------------
    # 模型生命周期
    # ------------------------------------------------------------------

    def _ensure_loaded(self):
        """确保模型已加载（懒加载）"""
        if self._loaded and self._model is not None:
            self._last_used = time.time()
            self._reset_idle_timer()
            return

        with self._lock:
            if self._loaded and self._model is not None:
                self._last_used = time.time()
                self._reset_idle_timer()
                return

            if not os.path.isfile(self.model_path):
                raise FileNotFoundError(
                    f"模型文件不存在: {self.model_path}\n"
                    "请下载GGUF模型放到 xtmc_backend/models/ 目录。\n"
                    "推荐: Qwen2.5-1.5B-Instruct-GGUF (Q4_K_M)"
                )

            logger.info("正在加载LLM模型: %s ...", os.path.basename(self.model_path))
            t0 = time.time()

            try:
                from llama_cpp import Llama

                self._model = Llama(
                    model_path=self.model_path,
                    n_ctx=self.n_ctx,
                    n_gpu_layers=self.n_gpu_layers,
                    chat_format=self.chat_format,
                    verbose=False,
                )
                self._loaded = True
                self._last_used = time.time()
                self._reset_idle_timer()
                logger.info("LLM模型加载完成，耗时 %.1f 秒", time.time() - t0)
            except ImportError:
                raise ImportError(
                    "llama-cpp-python 未安装。请执行:\n"
                    "  pip install llama-cpp-python"
                )
            except Exception as e:
                logger.error("LLM模型加载失败: %s", e)
                raise

    def unload(self):
        """手动卸载模型释放内存"""
        with self._lock:
            if self._idle_timer:
                self._idle_timer.cancel()
                self._idle_timer = None
            if self._model is not None:
                del self._model
                self._model = None
                self._loaded = False
                logger.info("LLM模型已卸载")

    def _reset_idle_timer(self):
        if self._idle_timer:
            self._idle_timer.cancel()
        if self.idle_timeout > 0:
            self._idle_timer = threading.Timer(self.idle_timeout, self._idle_unload)
            self._idle_timer.daemon = True
            self._idle_timer.start()

    def _idle_unload(self):
        elapsed = time.time() - self._last_used
        if elapsed >= self.idle_timeout:
            logger.info("LLM空闲 %d 分钟，自动卸载", int(elapsed // 60))
            self.unload()

    # ------------------------------------------------------------------
    # 推理接口
    # ------------------------------------------------------------------

    def generate(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        stop: Optional[List[str]] = None,
    ) -> str:
        """纯文本补全"""
        self._ensure_loaded()
        result = self._model(
            prompt,
            max_tokens=max_tokens or self.max_tokens,
            temperature=temperature or self.temperature,
            top_p=self.top_p,
            stop=stop,
        )
        text = result["choices"][0]["text"].strip()
        self._last_used = time.time()
        return text

    def chat(
        self,
        messages: List[Dict[str, str]],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        """聊天模式推理

        messages 格式: [{"role": "system"|"user"|"assistant", "content": "..."}]
        """
        self._ensure_loaded()
        result = self._model.create_chat_completion(
            messages=messages,
            max_tokens=max_tokens or self.max_tokens,
            temperature=temperature or self.temperature,
            top_p=self.top_p,
        )
        text = result["choices"][0]["message"]["content"].strip()
        self._last_used = time.time()
        return text

    def chat_json(
        self,
        messages: List[Dict[str, str]],
        max_tokens: Optional[int] = None,
    ) -> Optional[Dict]:
        """聊天并尝试解析JSON输出，失败返回None"""
        raw = self.chat(messages, max_tokens=max_tokens, temperature=0.3)
        # 提取JSON块
        if "```json" in raw:
            start = raw.index("```json") + 7
            end = raw.index("```", start) if "```" in raw[start:] else len(raw)
            raw = raw[start:end].strip()
        elif "```" in raw:
            start = raw.index("```") + 3
            end = raw.index("```", start) if "```" in raw[start:] else len(raw)
            raw = raw[start:end].strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("LLM JSON解析失败，原始输出: %s", raw[:500])
            return None

    # ------------------------------------------------------------------
    # 状态查询
    # ------------------------------------------------------------------

    @property
    def is_loaded(self) -> bool:
        return self._loaded and self._model is not None

    @property
    def model_name(self) -> str:
        return os.path.basename(self.model_path)

    def get_status(self) -> Dict[str, Any]:
        return {
            "loaded": self.is_loaded,
            "model": self.model_name,
            "model_exists": os.path.isfile(self.model_path),
            "n_ctx": self.n_ctx,
            "n_gpu_layers": self.n_gpu_layers,
            "last_used": self._last_used if self._last_used else None,
            "idle_timeout_min": self.idle_timeout // 60,
        }
