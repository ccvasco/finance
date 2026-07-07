/* api.js — backend calls + value formatting helpers */
const API = (() => {
  async function get(path) {
    const r = await fetch(path, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
    return r.json();
  }
  // POST a JSON body to `path`, then save the returned spreadsheet as `filename`.
  async function downloadXlsx(path, body, filename) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Export failed");
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  return {
    health: () => get("/api/health"),
    // Static UI reference data (S1 flag legend), sourced from the grader.
    meta: () => get("/api/meta"),
    // `refresh` asks the server to evict its cache for the request first,
    // forcing a fresh pull from Yahoo.
    screener: (tickers, refresh = false) =>
      get(`/api/screener?tickers=${encodeURIComponent(tickers.join(","))}${refresh ? "&refresh=1" : ""}`),
    deepdive: (t, refresh = false) =>
      get(`/api/deepdive?ticker=${encodeURIComponent(t)}${refresh ? "&refresh=1" : ""}`),
    history: (t, range) => get(`/api/history?ticker=${encodeURIComponent(t)}&range=${range}`),
    financials: (t, stmt, freq) =>
      get(`/api/financials?ticker=${encodeURIComponent(t)}&stmt=${stmt}&freq=${freq}`),
    calendar: ({ start, end, limit, refresh } = {}) => {
      const p = new URLSearchParams();
      if (start) p.set("start", start);
      if (end) p.set("end", end);
      if (limit) p.set("limit", limit);
      if (refresh) p.set("refresh", "1");
      const q = p.toString();
      return get(`/api/calendar${q ? "?" + q : ""}`);
    },
    stockCalendar: (t) => get(`/api/stock_calendar?ticker=${encodeURIComponent(t)}`),
    async exportXlsx(tickers) {
      await downloadXlsx("/api/export", { tickers },
        `stock-terminal-${new Date().toISOString().slice(0, 10)}.xlsx`);
    },
    async exportDeepdive(ticker) {
      await downloadXlsx("/api/export_deepdive", { ticker },
        `${ticker}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    },
    clearCache: () => fetch("/api/cache/clear", { method: "POST" }),
    /* POST /api/chat and stream the agent's reply. Calls onEvent for every
       SSE event: {text} chunks while streaming, then {done,...} or {error}.
       Returns when the stream closes. */
    async chat({ messages, rows, context_label }, onEvent) {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, rows, context_label }),
      });
      if (!r.ok || !r.body) {
        onEvent({ error: `HTTP ${r.status}` });
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line; keep the tail partial.
        const frames = buf.split("\n\n");
        buf = frames.pop();
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try { onEvent(JSON.parse(line.slice(6))); } catch { /* skip bad frame */ }
        }
      }
    },
  };
})();

/* ---- formatting ---------------------------------------------------------- */
const Fmt = {
  na: '<span class="na">N/A</span>',
  isNull: (v) => v === null || v === undefined || (typeof v === "number" && isNaN(v)),

  num(v, dec = 2) {
    if (Fmt.isNull(v)) return null;
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  },
  price(v, cur = "") {
    if (Fmt.isNull(v)) return null;
    const sym = Fmt.curSym(cur);
    return sym + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  pct(v, dec = 2) {
    if (Fmt.isNull(v)) return null;
    return Number(v).toFixed(dec) + "%";
  },
  /* ratio (0.27) -> 27.00% */
  ratioPct(v, dec = 2) {
    if (Fmt.isNull(v)) return null;
    return (Number(v) * 100).toFixed(dec) + "%";
  },
  big(v, cur = "") {
    if (Fmt.isNull(v)) return null;
    const n = Number(v);
    const sign = n < 0 ? "-" : "";
    const a = Math.abs(n);
    const sym = Fmt.curSym(cur);
    if (a >= 1e12) return `${sign}${sym}${(a / 1e12).toFixed(2)}T`;
    if (a >= 1e9) return `${sign}${sym}${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${sign}${sym}${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `${sign}${sym}${(a / 1e3).toFixed(2)}K`;
    return `${sign}${sym}${a.toFixed(0)}`;
  },
  curSym(cur) {
    return { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", HKD: "HK$", CAD: "C$", AUD: "A$", INR: "₹" }[cur] || "";
  },
  /* 'YYYY-MM-DD' -> 'Mon DD, YYYY' (returns N/A span when missing) */
  date(s) {
    if (!s) return null;
    const d = new Date(s + (s.length === 10 ? "T00:00:00" : ""));
    if (isNaN(d)) return s;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  },
  /* weekday short name from 'YYYY-MM-DD' */
  weekday(s) {
    if (!s) return "";
    const d = new Date(s + "T00:00:00");
    return isNaN(d) ? "" : d.toLocaleDateString(undefined, { weekday: "short" });
  },
  /* split ratio from Yahoo's old/new share-worth pair -> 'N:M' */
  splitRatio(oldW, newW) {
    if (Fmt.isNull(oldW) || Fmt.isNull(newW) || !oldW) return null;
    const r = newW / oldW;
    // forward split (e.g. 4-for-1) vs reverse split (e.g. 1-for-5)
    return r >= 1 ? `${Fmt.trim(r)}:1` : `1:${Fmt.trim(oldW / newW)}`;
  },
  /* split factor (e.g. 4 -> '4:1', 0.2 -> '1:5') */
  splitFromRatio(r) {
    if (Fmt.isNull(r) || r <= 0) return null;
    return r >= 1 ? `${Fmt.trim(r)}:1` : `1:${Fmt.trim(1 / r)}`;
  },
  trim(n) {
    return Number(n.toFixed(2)).toString();
  },
  /* return the raw display string or N/A span */
  cell(v, formatter) {
    const s = formatter(v);
    return s === null ? Fmt.na : s;
  },

  /* Markdown-lite -> HTML for chat replies. Escapes first (model output is
     untrusted), then supports: ``` code fences, `code`, **bold**, *italic*,
     ### headings, - / 1. lists, | tables |, and paragraphs. */
  md(src) {
    const esc = (s) => s.replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const inline = (s) => s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

    const out = [];
    // Code fences first so their contents are never parsed as markdown.
    const parts = String(src == null ? "" : src).split(/```[^\n]*\n?/);
    parts.forEach((part, i) => {
      if (i % 2 === 1) {                       // inside a fence
        out.push(`<pre><code>${esc(part.replace(/\n$/, ""))}</code></pre>`);
        return;
      }
      let list = null;                          // "ul" | "ol" while open
      let table = null;                         // collected table rows
      const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
      const closeTable = () => {
        if (!table) return;
        const rows = table.map((cells, ri) =>
          `<tr>${cells.map((c) => `<t${ri === 0 ? "h" : "d"}>${inline(esc(c))}</t${ri === 0 ? "h" : "d"}>`).join("")}</tr>`);
        out.push(`<table>${rows.join("")}</table>`);
        table = null;
      };
      for (const rawLine of part.split("\n")) {
        const line = rawLine.trimEnd();
        const t = line.trim();
        if (/^\|.*\|$/.test(t)) {               // | table row |
          closeList();
          if (/^\|[\s:|-]+\|$/.test(t)) continue;  // |---|---| separator
          (table = table || []).push(t.slice(1, -1).split("|").map((c) => c.trim()));
          continue;
        }
        closeTable();
        const h = t.match(/^(#{1,4})\s+(.*)$/);
        const ul = t.match(/^[-*]\s+(.*)$/);
        const ol = t.match(/^\d+[.)]\s+(.*)$/);
        if (h) { closeList(); out.push(`<h4>${inline(esc(h[2]))}</h4>`); }
        else if (ul || ol) {
          const kind = ul ? "ul" : "ol";
          if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
          out.push(`<li>${inline(esc((ul || ol)[1]))}</li>`);
        } else if (t) { closeList(); out.push(`<p>${inline(esc(t))}</p>`); }
        else closeList();
      }
      closeList();
      closeTable();
    });
    return out.join("");
  },
};
