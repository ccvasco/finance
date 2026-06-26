/* api.js — backend calls + value formatting helpers */
const API = (() => {
  async function get(path) {
    const r = await fetch(path, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
    return r.json();
  }
  return {
    health: () => get("/api/health"),
    screener: (tickers) => get(`/api/screener?tickers=${encodeURIComponent(tickers.join(","))}`),
    deepdive: (t) => get(`/api/deepdive?ticker=${encodeURIComponent(t)}`),
    history: (t, range) => get(`/api/history?ticker=${encodeURIComponent(t)}&range=${range}`),
    financials: (t, stmt, freq) =>
      get(`/api/financials?ticker=${encodeURIComponent(t)}&stmt=${stmt}&freq=${freq}`),
    calendar: ({ start, end, limit } = {}) => {
      const p = new URLSearchParams();
      if (start) p.set("start", start);
      if (end) p.set("end", end);
      if (limit) p.set("limit", limit);
      const q = p.toString();
      return get(`/api/calendar${q ? "?" + q : ""}`);
    },
    stockCalendar: (t) => get(`/api/stock_calendar?ticker=${encodeURIComponent(t)}`),
    async exportXlsx(tickers) {
      const r = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Export failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock-terminal-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    clearCache: () => fetch("/api/cache/clear", { method: "POST" }),
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
};
