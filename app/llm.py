"""Pluggable LLM provider layer.

The DeskChalk coaching code is written against the Anthropic Messages API
(content blocks, adaptive thinking, prompt caching). This module lets a
self-hoster point the app at either Anthropic (Claude) or a local Ollama
model via environment variables — bring your own AI.

Config (env):
  LLM_PROVIDER   "anthropic" (default) | "ollama"
  LLM_MODEL      model id. Default per provider:
                   anthropic → CLAUDE_MODEL or "claude-opus-4-8"
                   ollama    → "llama3.1"
  LLM_EFFORT     anthropic thinking effort: low|medium|high (default CLAUDE_EFFORT or "medium")
  LLM_BASE_URL   ollama base url (default "http://localhost:11434")
  ANTHROPIC_API_KEY   required when LLM_PROVIDER=anthropic

Call sites use `llm.create(...)` with the same kwargs they would pass to
`client.messages.create(...)`. The returned object always exposes
`.content` (list of blocks with `.type`/`.text`) and `.usage`
(`.input_tokens`/`.output_tokens`/`.cache_read_input_tokens`/`.cache_creation_input_tokens`),
so existing response-handling code works unchanged on both providers.
"""
import json
import os
import urllib.request
import urllib.error

PROVIDER  = os.environ.get("LLM_PROVIDER", "anthropic").strip().lower()
API_KEY   = os.environ.get("ANTHROPIC_API_KEY", "")
EFFORT    = os.environ.get("LLM_EFFORT") or os.environ.get("CLAUDE_EFFORT", "medium")
BASE_URL  = os.environ.get("LLM_BASE_URL", "http://localhost:11434").rstrip("/")

if PROVIDER == "ollama":
    MODEL = os.environ.get("LLM_MODEL", "llama3.1")
else:
    MODEL = os.environ.get("LLM_MODEL") or os.environ.get("CLAUDE_MODEL", "claude-opus-4-8")


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
    if PROVIDER == "ollama":
        return True
    return bool(API_KEY)


def not_configured_message() -> str:
    if PROVIDER == "ollama":
        return (f"Ollama provider selected but unreachable at {BASE_URL} — "
                "start Ollama and pull a model, or set LLM_PROVIDER=anthropic.")
    return "ANTHROPIC_API_KEY not set — add it to .env and restart the app container."


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


# ── Ollama ───────────────────────────────────────────────────────────────────
def _flatten_text(content):
    """Anthropic content (str or list of blocks) → plain text for Ollama."""
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


def _ollama_create(model, max_tokens, messages, system=None,
                   thinking=None, output_config=None):
    chat = []
    if system is not None:
        sys_text = _flatten_text(system)
        if sys_text:
            chat.append({"role": "system", "content": sys_text})
    for m in messages:
        chat.append({"role": m.get("role", "user"),
                     "content": _flatten_text(m.get("content", ""))})
    payload = {
        "model": MODEL,
        "messages": chat,
        "stream": False,
        "options": {"num_predict": max_tokens},
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise LLMError(f"Ollama request failed: {e}") from e
    text = (data.get("message") or {}).get("content", "")
    usage = _Usage(
        input_tokens=data.get("prompt_eval_count", 0) or 0,
        output_tokens=data.get("eval_count", 0) or 0,
    )
    return _Response(text, usage)


# ── Public entry point ─────────────────────────────────────────────────────────
def create(*, model=None, max_tokens=1024, messages, system=None,
           thinking=None, output_config=None):
    """Provider-agnostic chat completion. Returns an object with .content / .usage.

    Raises LLMError on provider failure (catch this at call sites instead of
    anthropic.APIError, so both providers are handled uniformly).
    """
    if PROVIDER == "ollama":
        return _ollama_create(model, max_tokens, messages, system, thinking, output_config)
    return _anthropic_create(model, max_tokens, messages, system, thinking, output_config)
