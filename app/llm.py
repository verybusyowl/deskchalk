"""Pluggable LLM provider layer.

The DeskChalk coaching code is written against the Anthropic Messages API
(content blocks, adaptive thinking, prompt caching). This module lets a
self-hoster point the app at Claude, a local Ollama model, or any
OpenAI-compatible API (OpenAI, Google Gemini, Mistral, Groq, xAI, or a
self-hosted endpoint) via environment variables — bring your own AI.

Config (env):
  LLM_PROVIDER   "anthropic" (default) | "ollama" | "openai" | "gemini"
                 | "mistral" | "groq" | "xai" | "openai_compatible"
  LLM_MODEL      model id. Default per provider (override freely).
  LLM_EFFORT     anthropic thinking effort: low|medium|high (default CLAUDE_EFFORT or "medium")
  LLM_BASE_URL   base url. Required for "ollama" / "openai_compatible";
                 optional override for the named cloud providers.
  LLM_API_KEY    api key for the OpenAI-compatible providers (or use the
                 provider-specific var, e.g. OPENAI_API_KEY).
  ANTHROPIC_API_KEY   required when LLM_PROVIDER=anthropic

Chinese AI providers (DeepSeek, Qwen/DashScope, Zhipu/GLM, Moonshot/Kimi,
Baidu/Ernie, 01.ai/Yi, MiniMax, Hunyuan, etc.) are intentionally NOT
supported and are actively refused — see CHINESE_PROVIDERS below.

Call sites use `llm.create(...)` with the same kwargs they would pass to
`client.messages.create(...)`. The returned object always exposes
`.content` (list of blocks with `.type`/`.text`) and `.usage`
(`.input_tokens`/`.output_tokens`/`.cache_read_input_tokens`/`.cache_creation_input_tokens`),
so existing response-handling code works unchanged on every provider.
"""
import json
import os
import urllib.request
import urllib.error

PROVIDER  = os.environ.get("LLM_PROVIDER", "anthropic").strip().lower()
EFFORT    = os.environ.get("LLM_EFFORT") or os.environ.get("CLAUDE_EFFORT", "medium")
BASE_URL  = os.environ.get("LLM_BASE_URL", "").rstrip("/")

# OpenAI-compatible providers: base URL, default model, and the conventional
# provider-specific key env var. All speak the /chat/completions schema.
OPENAI_COMPATIBLE = {
    "openai":  {"base": "https://api.openai.com/v1",                          "model": "gpt-4o",                    "key_env": "OPENAI_API_KEY"},
    "gemini":  {"base": "https://generativelanguage.googleapis.com/v1beta/openai", "model": "gemini-2.0-flash",     "key_env": "GEMINI_API_KEY"},
    "mistral": {"base": "https://api.mistral.ai/v1",                          "model": "mistral-large-latest",      "key_env": "MISTRAL_API_KEY"},
    "groq":    {"base": "https://api.groq.com/openai/v1",                     "model": "llama-3.3-70b-versatile",   "key_env": "GROQ_API_KEY"},
    "xai":     {"base": "https://api.x.ai/v1",                                "model": "grok-2-latest",             "key_env": "XAI_API_KEY"},
    # Fully custom OpenAI-compatible endpoint (vLLM, LM Studio, LocalAI, …):
    # set LLM_BASE_URL + LLM_MODEL (+ LLM_API_KEY if the server needs one).
    "openai_compatible": {"base": None, "model": None, "key_env": "LLM_API_KEY"},
}

# Intentionally unsupported. Selecting any of these is refused at runtime.
CHINESE_PROVIDERS = {
    "deepseek", "qwen", "dashscope", "alibaba", "tongyi",
    "zhipu", "zhipuai", "glm", "chatglm", "bigmodel",
    "moonshot", "kimi", "baidu", "ernie", "wenxin", "qianfan",
    "yi", "01ai", "01-ai", "lingyiwanwu",
    "minimax", "hunyuan", "tencent", "spark", "iflytek",
    "sensetime", "sensenova", "stepfun", "baichuan", "doubao", "volcengine",
}

BLOCKED = PROVIDER in CHINESE_PROVIDERS

# Resolve model / base url / api key for the active provider.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
if PROVIDER == "anthropic":
    MODEL   = os.environ.get("LLM_MODEL") or os.environ.get("CLAUDE_MODEL", "claude-opus-4-8")
    API_KEY = ANTHROPIC_API_KEY
elif PROVIDER == "ollama":
    MODEL   = os.environ.get("LLM_MODEL", "llama3.1")
    API_KEY = ""
    BASE_URL = BASE_URL or "http://localhost:11434"
elif PROVIDER in OPENAI_COMPATIBLE:
    _spec   = OPENAI_COMPATIBLE[PROVIDER]
    MODEL   = os.environ.get("LLM_MODEL") or _spec["model"] or "gpt-4o"
    BASE_URL = BASE_URL or (_spec["base"] or "")
    API_KEY = os.environ.get("LLM_API_KEY") or os.environ.get(_spec["key_env"], "")
else:
    MODEL   = os.environ.get("LLM_MODEL", "")
    API_KEY = os.environ.get("LLM_API_KEY", "")


class LLMError(Exception):
    """Provider-agnostic LLM failure. Catch this at call sites."""


class _Block:
    def __init__(self, text):
        self.type = "text"
        self.text = text


class _Usage:
    def __init__(self, input_tokens=0, output_tokens=0,
                 cache_read_input_tokens=0, cache_creation_input_tokens=0):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.cache_read_input_tokens = cache_read_input_tokens
        self.cache_creation_input_tokens = cache_creation_input_tokens


class _Response:
    def __init__(self, text, usage=None):
        self.content = [_Block(text)]
        self.usage = usage or _Usage()


def available() -> bool:
    """True if the configured provider is usable (key present / local provider)."""
    if BLOCKED:
        return False
    if PROVIDER == "ollama":
        return True
    if PROVIDER == "openai_compatible":
        return bool(BASE_URL)  # self-hosted endpoints may not require a key
    if PROVIDER in OPENAI_COMPATIBLE:
        return bool(API_KEY)
    if PROVIDER == "anthropic":
        return bool(API_KEY)
    return False


def not_configured_message() -> str:
    if BLOCKED:
        return ("Chinese AI providers are intentionally unsupported in DeskChalk. "
                "Set LLM_PROVIDER to one of: anthropic, openai, gemini, mistral, "
                "groq, xai, ollama, or openai_compatible.")
    if PROVIDER == "ollama":
        return (f"Ollama provider selected but unreachable at {BASE_URL} — "
                "start Ollama and pull a model, or set LLM_PROVIDER=anthropic.")
    if PROVIDER == "openai_compatible":
        return ("openai_compatible selected but LLM_BASE_URL is not set — point it "
                "at your endpoint's /v1 base url (and LLM_MODEL / LLM_API_KEY).")
    if PROVIDER in OPENAI_COMPATIBLE:
        env = OPENAI_COMPATIBLE[PROVIDER]["key_env"]
        return f"{env} (or LLM_API_KEY) not set — add it to .env and restart the app container."
    if PROVIDER == "anthropic":
        return "ANTHROPIC_API_KEY not set — add it to .env and restart the app container."
    return (f"Unknown LLM_PROVIDER '{PROVIDER}'. Use anthropic, openai, gemini, "
            "mistral, groq, xai, ollama, or openai_compatible.")


# ── Anthropic ──────────────────────────────────────────────────────────────────
def _anthropic_create(model, max_tokens, messages, system=None,
                      thinking=None, output_config=None):
    import anthropic
    kwargs = {"model": model or MODEL, "max_tokens": max_tokens, "messages": messages}
    if system is not None:
        kwargs["system"] = system
    if thinking is not None:
        kwargs["thinking"] = thinking
    if output_config is not None:
        kwargs["output_config"] = output_config
    try:
        return anthropic.Anthropic(api_key=API_KEY).messages.create(**kwargs)
    except anthropic.APIError as e:
        raise LLMError(str(e)) from e


# ── Shared helpers ─────────────────────────────────────────────────────────────
def _flatten_text(content):
    """Anthropic content (str or list of blocks) → plain text for chat APIs."""
    if isinstance(content, str):
        return content
    parts = []
    for block in content or []:
        if isinstance(block, dict):
            if block.get("type", "text") == "text":
                parts.append(block.get("text", ""))
        elif isinstance(block, str):
            parts.append(block)
    return "\n".join(p for p in parts if p)


def _chat_messages(messages, system=None):
    """Build an OpenAI/Ollama-style message list from Anthropic-shaped inputs."""
    chat = []
    if system is not None:
        sys_text = _flatten_text(system)
        if sys_text:
            chat.append({"role": "system", "content": sys_text})
    for m in messages:
        chat.append({"role": m.get("role", "user"),
                     "content": _flatten_text(m.get("content", ""))})
    return chat


def _post_json(url, payload, headers, label):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        raise LLMError(f"{label} request failed ({e.code}): {body[:300]}") from e
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise LLMError(f"{label} request failed: {e}") from e


# ── Ollama ───────────────────────────────────────────────────────────────────
def _ollama_create(model, max_tokens, messages, system=None,
                   thinking=None, output_config=None):
    payload = {
        "model": MODEL,
        "messages": _chat_messages(messages, system),
        "stream": False,
        "options": {"num_predict": max_tokens},
    }
    data = _post_json(f"{BASE_URL}/api/chat", payload,
                      {"Content-Type": "application/json"}, "Ollama")
    text = (data.get("message") or {}).get("content", "")
    usage = _Usage(
        input_tokens=data.get("prompt_eval_count", 0) or 0,
        output_tokens=data.get("eval_count", 0) or 0,
    )
    return _Response(text, usage)


# ── OpenAI-compatible (OpenAI / Gemini / Mistral / Groq / xAI / custom) ─────────
def _openai_create(model, max_tokens, messages, system=None,
                   thinking=None, output_config=None):
    if not BASE_URL:
        raise LLMError(not_configured_message())
    payload = {
        "model": model or MODEL,
        "messages": _chat_messages(messages, system),
        "max_tokens": max_tokens,
    }
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"
    data = _post_json(f"{BASE_URL}/chat/completions", payload, headers, PROVIDER)
    try:
        text = data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError):
        raise LLMError(f"{PROVIDER} returned an unexpected response: {str(data)[:300]}")
    u = data.get("usage") or {}
    usage = _Usage(
        input_tokens=u.get("prompt_tokens", 0) or 0,
        output_tokens=u.get("completion_tokens", 0) or 0,
    )
    return _Response(text, usage)


# ── Public entry point ─────────────────────────────────────────────────────────
def create(*, model=None, max_tokens=1024, messages, system=None,
           thinking=None, output_config=None):
    """Provider-agnostic chat completion. Returns an object with .content / .usage.

    Raises LLMError on provider failure (catch this at call sites instead of
    anthropic.APIError, so every provider is handled uniformly).
    """
    if BLOCKED:
        raise LLMError(not_configured_message())
    if PROVIDER == "ollama":
        return _ollama_create(model, max_tokens, messages, system, thinking, output_config)
    if PROVIDER in OPENAI_COMPATIBLE:
        return _openai_create(model, max_tokens, messages, system, thinking, output_config)
    if PROVIDER == "anthropic":
        return _anthropic_create(model, max_tokens, messages, system, thinking, output_config)
    raise LLMError(not_configured_message())
