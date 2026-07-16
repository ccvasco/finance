"""Wikipedia company context for the deep view — ethics & controversies.

Yahoo retired its ESG/controversy endpoint, so the "is this company involved
in anything immoral?" question is answered from the company's Wikipedia
article instead: we find the page, list its sections, pick the ones whose
headings look like controversy/ethics content (controversies, criticism,
lawsuits, labor practices, environmental record, …) and return their plain
text with a link to the article.

Everything that decides or transforms is a pure function so tests can cover
it without network access:

    clean_company_name(name)     'NIKE, Inc.' -> 'NIKE'
    pick_title(titles, name)     best search hit (skips disambiguation/lists)
    pick_ethics_sections(secs)   matching sections, children deduped
    section_blocks(html)         MediaWiki section HTML -> ordered typed blocks
                                 [{'t': 'h'|'p'|'li', 's': text}] for readable
                                 rendering (sub-headings kept, hatnotes dropped)

`company_context(name)` is the only function that talks to the API.
"""

import html as _html
import re

import requests

API = "https://en.wikipedia.org/w/api.php"
PAGE_URL = "https://en.wikipedia.org/wiki/"
# Wikimedia asks API clients to identify themselves with a descriptive UA.
HEADERS = {"User-Agent": "stock-terminal/1.0 (personal stock screener)"}
TIMEOUT = 12

MAX_SECTIONS = 6          # at most this many ethics sections per company
MAX_SECTION_CHARS = 2000  # per-section text cap (full text is on Wikipedia)

# Section headings that carry ethics/controversy content. Word stems on
# purpose ("controvers" covers Controversy/Controversies, "labo?u?r" covers
# both spellings); matched case-insensitively against the heading only.
ETHICS_HEADING = re.compile(
    r"controvers|criticism|scandal|lawsuit|litigation|legal (issue|dispute|"
    r"proceeding|action|trouble)|human rights|labou?r|working condition|"
    r"sweatshop|child lab|forced lab|slavery|exploitation|environmental "
    r"(record|issue|impact|concern|criticism|violation)|corruption|bribery|"
    r"fraud|antitrust|anti-competitive|price.fixing|privacy|data breach|"
    r"discrimination|harassment|animal (welfare|testing|cruelty)|boycott|"
    r"sanction|tax (avoidance|evasion)|safety (concern|issue|record|violation)"
    r"|misconduct|allegation", re.I)

# Corporate suffixes that hurt Wikipedia search relevance. The suffix must be
# its own word — preceded by whitespace or punctuation — so 'Visa' never loses
# its 'sa' ('Société Anonyme') and 'Cisco' never loses its 'co'.
_NAME_SUFFIX = re.compile(
    r"[\s,.]+(inc|incorporated|corp|corporation|co|company|plc|ltd|limited|"
    r"llc|sa|se|nv|ag|ab|asa|oyj|spa|holdings?|group|the)\.?\s*$", re.I)


def clean_company_name(name):
    """Strip trailing corporate suffixes: 'NIKE, Inc.' -> 'NIKE',
    'Toyota Motor Corp.' -> 'Toyota Motor'. Runs twice so 'X Holdings, Inc.'
    sheds both layers; never empties the name."""
    out = (name or "").strip()
    for _ in range(2):
        stripped = _NAME_SUFFIX.sub("", out).strip()
        if stripped:
            out = stripped
    return out


def pick_title(titles, name):
    """Best page title from search results: the first hit that isn't a
    disambiguation page or a 'List of …' article. None when nothing usable."""
    for t in titles:
        low = t.lower()
        if "disambiguation" in low or low.startswith("list of"):
            continue
        return t
    return None


def pick_ethics_sections(sections):
    """MediaWiki `parse.sections` list -> [{'index', 'line'}] whose headings
    match ETHICS_HEADING. When a parent section matches, its subsections are
    dropped (the parent's wikitext already contains them). `number` is the
    dotted TOC number ('8', '8.1', …)."""
    out, matched_prefixes = [], []
    for s in sections:
        heading = _html.unescape(re.sub(r"<[^>]+>", "", s.get("line") or ""))
        num = s.get("number") or ""
        if any(num.startswith(p + ".") for p in matched_prefixes):
            continue                      # child of an already-matched section
        if not ETHICS_HEADING.search(heading):
            continue
        idx = s.get("index")
        if not idx or not str(idx).isdigit():
            continue                      # transcluded sections aren't fetchable
        out.append({"index": str(idx), "line": heading})
        matched_prefixes.append(num)
        if len(out) >= MAX_SECTIONS:
            break
    return out


# Block-level elements dropped wholesale: styling, scripts, tables, reference
# superscripts and the "Main article: …" hatnote navigation.
_DROP_RE = re.compile(r"(?is)<(style|script|table|sup)\b[^>]*>.*?</\1>")
_HATNOTE_RE = re.compile(r'(?is)<div[^>]*class="[^"]*hatnote[^"]*"[^>]*>.*?</div>')
# Paragraphs, list items and sub-headings (h3–h6; the section's own h2 heading
# is handled separately and skipped here), captured in document order.
_BLOCK_RE = re.compile(
    r"(?is)<h([3-6])\b[^>]*>(?P<h>.*?)</h\1>"
    r"|<p\b[^>]*>(?P<p>.*?)</p>"
    r"|<li\b[^>]*>(?P<li>.*?)</li>")


def _inline_text(fragment):
    """Inline HTML fragment -> plain text: drop reference markers and the
    [edit] links, strip remaining tags, unescape entities, drop [n] citation
    leftovers, collapse whitespace."""
    t = re.sub(r"(?is)<sup[^>]*>.*?</sup>", "", fragment or "")
    t = re.sub(r"<[^>]+>", "", t)
    t = _html.unescape(t)
    t = t.replace("[edit]", "")
    t = re.sub(r"\[\d+\]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def section_blocks(html_text, max_chars=MAX_SECTION_CHARS):
    """MediaWiki rendered-section HTML -> ordered, typed blocks for readable
    rendering: [{'t': 'h'|'p'|'li', 's': text}] where 'h' is a sub-heading,
    'p' a paragraph and 'li' a list item. Style/script/table/reference and the
    'Main article' hatnotes are dropped; blocks accumulate until `max_chars`."""
    t = _DROP_RE.sub(" ", html_text or "")
    t = _HATNOTE_RE.sub(" ", t)
    blocks, total = [], 0
    for m in _BLOCK_RE.finditer(t):
        if m.group("h") is not None:
            kind, s = "h", _inline_text(m.group("h"))
        elif m.group("p") is not None:
            kind, s = "p", _inline_text(m.group("p"))
        else:
            kind, s = "li", _inline_text(m.group("li"))
        if not s:
            continue
        blocks.append({"t": kind, "s": s})
        total += len(s)
        if total >= max_chars:
            break
    # A trailing sub-heading with no body beneath it reads as dangling — drop it.
    while blocks and blocks[-1]["t"] == "h":
        blocks.pop()
    return blocks


def _get(params):
    params = dict(params, format="json", formatversion="2")
    r = requests.get(API, params=params, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def _search_title(name):
    j = _get({"action": "query", "list": "search", "srsearch": name,
              "srlimit": 5, "srnamespace": 0})
    titles = [h.get("title") for h in j.get("query", {}).get("search", [])]
    return pick_title([t for t in titles if t], name)


def company_context(name):
    """{'query', 'title', 'url', 'sections': [{'heading', 'blocks'}]} for the
    company's Wikipedia article, where `blocks` is the ordered list produced by
    section_blocks. `sections` is empty when the article has no controversy-like
    headings. {'error': …} on lookup failure; never raises."""
    query = (name or "").strip()
    out = {"query": query, "title": None, "url": None, "sections": []}
    try:
        # Search the name as-is first — the corporate suffix disambiguates
        # ('Visa Inc.' finds the company, 'Visa' the travel document). Only
        # fall back to the suffix-stripped name when the raw one finds nothing.
        title = _search_title(query)
        if not title:
            cleaned = clean_company_name(query)
            if cleaned and cleaned != query:
                title = _search_title(cleaned)
        if not title:
            out["error"] = "no Wikipedia page found"
            return out
        out["title"] = title
        out["url"] = PAGE_URL + title.replace(" ", "_")

        parsed = _get({"action": "parse", "page": title, "prop": "sections",
                       "redirects": 1}).get("parse", {})
        # follow the redirect's resolved title for the canonical URL
        if parsed.get("title"):
            out["title"] = parsed["title"]
            out["url"] = PAGE_URL + parsed["title"].replace(" ", "_")

        for sec in pick_ethics_sections(parsed.get("sections") or []):
            j = _get({"action": "parse", "page": out["title"], "prop": "text",
                      "section": sec["index"], "redirects": 1})
            blocks = section_blocks(j.get("parse", {}).get("text") or "")
            if blocks:
                out["sections"].append({"heading": sec["line"],
                                        "blocks": blocks})
    except requests.RequestException as e:
        out["error"] = f"Wikipedia unreachable: {e.__class__.__name__}"
    except Exception as e:  # malformed payloads must never 500 the deep view
        out["error"] = str(e) or e.__class__.__name__
    return out
