"""Chat agent backing /api/chat — analyse screener results in natural language.

The frontend sends the conversation plus the screener rows currently on
screen; we forward both to Claude (official `anthropic` SDK) and stream the
reply back. Everything that shapes the request is a pure function so tests
can cover it without network access:

    compact_rows(rows)          strip sparklines/derivation blobs, drop Nones
    system_blocks(rows)         system prompt (static part + data part, both
                                with cache_control so multi-turn chats reuse
                                the prompt cache)
    sanitize_messages(raw)      untrusted wire messages -> API-safe history
    request_params(msgs, rows)  the full messages.stream(**kwargs) dict

`stream_reply` is the only function that talks to the API. Credentials come
from the ANTHROPIC_API_KEY environment variable — the zero-arg Anthropic()
constructor resolves it.
"""

import json
import os

MODEL = os.environ.get("STOCK_TERMINAL_CHAT_MODEL", "claude-opus-4-8")
MAX_TOKENS = 16000
MAX_ROWS = 100        # context cap: keeps a huge screener from costing dollars/turn
MAX_TURNS = 40        # history cap: oldest turns dropped beyond this
MAX_MSG_CHARS = 8000  # per-message cap

# Row keys that carry no analytical signal for the model (chart data and the
# per-pillar derivation blobs — the scores/verdicts/flags themselves stay).
_SKIP_KEYS = {
    "spark_6mo", "spark_1y", "spark_5y",
    "strategy_1_detail", "strategy_2_detail", "strategy_3_detail",
}

_STATIC_SYSTEM = """\
You are the built-in analyst of Stock Terminal, a personal stock-screening app.
The user is screening long-term investments. A machine-readable snapshot of the
rows on the tab the user is currently viewing follows in the next system block;
ground every claim in that data and say plainly when something you need is not
in it (never invent numbers). The user moves between tabs (Screener, Dashboard,
Watchlists) during one conversation, so the attached snapshot can change from
turn to turn — always answer against the snapshot in the latest system block.

Data conventions (source: Yahoo Finance via yfinance; missing values are
omitted from the snapshot):
- fractions (0.25 = 25%): profit_margin, gross_margin, operating_margin,
  ebitda_margin, roe, roa, payout_ratio, short_interest
- percentage points (25 = 25%): roic, roce, wacc, div_yield, debt_to_equity,
  div_growth_3y/5y, perf_* (cumulative price returns, dividends excluded)
- plain ratios: pe, pb, ps, peg, p_fcf, ev_ebitda, debt_ebitda, current_ratio,
  quick_ratio, fcf_coverage, ebitda_fcf
- absolute currency: market_cap, enterprise_value, income, fcf, ebitda,
  total_cash, total_debt, total_equity

Each row carries three strategy grades (0-100, graded server-side; the .md
docs live in the repo):
- strategy_1 "Triage" — is the business broken? Kill-switches then a quality
  score. >=65 Advance, 45-64 Watchlist, <45 Discard; null = quarantined for
  missing data. strategy_1_flags carries context warnings (priced for
  perfection, payout stress, crowded short, ...).
- strategy_2 "Quality Compounder" — can it compound for a decade? >=70
  Compounder, 50-69 Quality watch, <50 Pass.
- strategy_3 "Defensive Value" — Graham-style cheap-and-safe. >=70 Value
  candidate, 50-69 Fair, <50 Expensive/weak.
- strategy_min — the min of the three; the "good under every lens" rank.

How to answer:
- Lead with the conclusion, then the supporting numbers (cite ticker and
  metric values you actually used).
- Be willing to rank, compare and take positions — that is your job — but
  flag data-quality caveats (quarantined rows, ADR artifacts, missing fields).
- Use markdown sparingly: short paragraphs, **bold** tickers, small tables
  only when comparing several names.
- You are an analytical aid, not a licensed adviser; skip boilerplate
  disclaimers unless the user asks about suitability for their situation.
"""


def _compact_value(v):
    """Round floats so the snapshot doesn't waste tokens on 12-digit noise."""
    if isinstance(v, float):
        return round(v, 4)
    return v


def compact_rows(rows):
    """Screener rows -> compact list for the model: drop chart/derivation
    keys and missing values, round floats, cap at MAX_ROWS."""
    out = []
    for row in (rows or [])[:MAX_ROWS]:
        if not isinstance(row, dict):
            continue
        out.append({k: _compact_value(v) for k, v in row.items()
                    if k not in _SKIP_KEYS and v is not None and v != ""})
    return out


def system_blocks(rows, context_label=None):
    """System prompt as two cache-controlled blocks: the static instructions
    (byte-stable across every chat) and the row snapshot (stable while the user
    stays on one tab) — so follow-up turns hit the prompt cache. `context_label`
    names the tab the snapshot came from (e.g. "Screener", "Watchlist · Tech")."""
    label = (context_label or "Screener").strip() or "Screener"
    blocks = [{
        "type": "text",
        "text": _STATIC_SYSTEM,
        "cache_control": {"type": "ephemeral"},
    }]
    compact = compact_rows(rows)
    if compact:
        note = ""
        if rows and len(rows) > MAX_ROWS:
            note = (f"\n(Note: the tab has {len(rows)} rows; only the first "
                    f"{MAX_ROWS} are included here. Say so if asked about the rest.)")
        blocks.append({
            "type": "text",
            "text": f"Current tab: {label}. Snapshot (JSON, one object per "
                    "stock):\n" + json.dumps(compact, separators=(",", ":")) + note,
            "cache_control": {"type": "ephemeral"},
        })
    else:
        blocks.append({
            "type": "text",
            "text": f"The user's current tab ({label}) has no stock rows "
                    "attached. Answer from general knowledge, and remind the "
                    "user they can open the Screener/Dashboard/a watchlist and "
                    "re-ask to ground the answer in their data.",
        })
    return blocks


def sanitize_messages(raw):
    """Untrusted wire history -> API-safe messages: only user/assistant roles
    with non-empty string content, first message a user one, capped in count
    and per-message size."""
    msgs = []
    for m in (raw or []):
        if not isinstance(m, dict):
            continue
        role = m.get("role")
        content = m.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str):
            continue
        content = content.strip()
        if not content:
            continue
        msgs.append({"role": role, "content": content[:MAX_MSG_CHARS]})
    while msgs and msgs[0]["role"] != "user":
        msgs.pop(0)
    return msgs[-MAX_TURNS:]


def request_params(messages, rows, context_label=None):
    """The exact kwargs for client.messages.stream()."""
    return {
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "thinking": {"type": "adaptive"},
        "system": system_blocks(rows, context_label),
        "messages": messages,
    }


def stream_reply(raw_messages, rows, context_label=None):
    """Yield event dicts for the SSE endpoint: {"text": chunk} while the
    reply streams, then {"done": True, ...}; {"error": msg} on failure.
    Never raises — transport errors become error events."""
    try:
        import anthropic
    except ImportError:
        yield {"error": "The 'anthropic' package is not installed on the "
                        "server. Run: pip install anthropic"}
        return

    messages = sanitize_messages(raw_messages)
    if not messages:
        yield {"error": "Empty message."}
        return

    _no_creds = ("No Anthropic API credentials found. Set the "
                 "ANTHROPIC_API_KEY environment variable and restart "
                 "the server.")
    try:
        client = anthropic.Anthropic()
        with client.messages.stream(
                **request_params(messages, rows, context_label)) as stream:
            for text in stream.text_stream:
                if text:
                    yield {"text": text}
            final = stream.get_final_message()
        if final.stop_reason == "refusal":
            yield {"error": "The model declined to answer this request."}
            return
        usage = getattr(final, "usage", None)
        yield {"done": True,
               "stop_reason": final.stop_reason,
               "input_tokens": getattr(usage, "input_tokens", None),
               "output_tokens": getattr(usage, "output_tokens", None),
               "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", None)}
    except anthropic.AuthenticationError:
        yield {"error": "No valid Anthropic API credentials. Set the "
                        "ANTHROPIC_API_KEY environment variable and "
                        "restart the server."}
    except TypeError as e:
        # The SDK raises TypeError("Could not resolve authentication
        # method…") when no credential exists at all — depending on the SDK
        # version, at client construction or at first request.
        if "authentication" in str(e).lower():
            yield {"error": _no_creds}
        else:
            yield {"error": str(e)}
    except anthropic.RateLimitError:
        yield {"error": "Rate limited by the Anthropic API — wait a moment "
                        "and try again."}
    except anthropic.APIStatusError as e:
        yield {"error": f"Anthropic API error ({e.status_code}): {e.message}"}
    except anthropic.APIConnectionError:
        yield {"error": "Could not reach the Anthropic API — check the "
                        "server's network connection."}
    except Exception as e:  # never let the SSE stream die silently
        yield {"error": str(e) or type(e).__name__}
