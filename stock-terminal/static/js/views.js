/* views.js — renders Screener, Watchlist, Settings, Dashboard, Calendar and the
   Deep-dive overlay. Depends on API, Fmt, Store, Charts. */
const Views = (() => {
  // Plain-language descriptions shown in a hover bubble on each header.
  const COL_DESC = {
    ticker: "Stock symbol. Click a row to open the deep-dive view.",
    price: "Latest trading price.",
    market_cap: "Market capitalization = share price × shares outstanding. The total value of the company's equity.",
    industry: "The company's industry classification.",
    pe: "Price / Earnings (trailing). Price ÷ last 12 months' earnings per share. Lower can mean cheaper relative to profits.",
    forward_pe: "Forward P/E. Price ÷ analysts' estimated earnings per share for the year ahead.",
    peg: "P/E ÷ expected earnings growth. Around 1.0 is often considered fairly valued for the growth.",
    pb: "Price / Book. Share price ÷ book value (net assets) per share.",
    ps: "Price / Sales. Price ÷ last 12 months' revenue per share.",
    pc: "Price / Cash. Market cap ÷ total cash. Lower means more cash backing the valuation.",
    p_fcf: "Price / Free Cash Flow. Market cap ÷ free cash flow.",
    ev_ebitda: "Enterprise Value ÷ EBITDA. A valuation neutral to capital structure (includes debt).",
    eps: "Earnings per share over the trailing 12 months.",
    income: "Net income — profit attributable to shareholders (trailing 12 months).",
    profit_margin: "Net Profit Margin = net income ÷ revenue. Share of each sales dollar kept as profit.",
    fcf: "Free Cash Flow = operating cash flow − capital expenditure. Cash left for dividends, buybacks and debt.",
    roa: "Return on Assets = net income ÷ total assets. How efficiently assets generate profit.",
    roe: "Return on Equity = net income ÷ shareholders' equity.",
    roic: "Return on Invested Capital = after-tax operating profit ÷ (debt + equity). Returns on all capital employed.",
    beta: "Beta measures how much the stock moves relative to the market (S&P 500). β = 1: moves in line with the market. β > 1: more volatile (e.g. β 1.5 means ~50% bigger swings). β < 1: less volatile. β < 0: tends to move against the market. Use it as a risk gauge — higher beta means higher volatility in both directions.",
    debt_to_equity: "Total debt ÷ shareholders' equity (shown as %). Higher means more leverage.",
    lt_debt_to_equity: "Long-term debt ÷ shareholders' equity (shown as %).",
    div_yield: "Dividend Yield = forward annual dividend ÷ price.",
    five_year_avg_yield: "Average dividend yield over the past 5 years.",
    dividend_estimate: "Forward annual dividend per share (the current run-rate estimate).",
    dividend_ttm: "Dividends actually paid per share over the trailing 12 months.",
    payout_ratio: "Payout Ratio = dividends ÷ earnings. The share of profit paid out as dividends.",
    fcf_coverage: "FCF Coverage = free cash flow ÷ dividends paid. How many times cash flow covers the dividend. Green ≥ 1.2×, yellow 0.8–1.2×, red < 0.8×.",
    years_div_increase: "Consecutive completed calendar years of rising annual dividends.",
    perf_ytd: "Price return since Jan 1 of this year. Excludes dividends.",
    perf_1y: "Price return over the last 1 year. Excludes dividends.",
    perf_3y: "Price return over the last 3 years. Excludes dividends.",
    perf_5y: "Price return over the last 5 years. Excludes dividends.",
    perf_10y: "Price return over the last 10 years. Excludes dividends.",
  };

  // Descriptions for the deep-dive panel rows (keyed by their exact labels).
  const PANEL_TIPS = {
    "Market Cap": "Share price × shares outstanding — total equity value.",
    "Enterprise Value": "Market cap + debt − cash. The cost to acquire the whole business.",
    "Trailing P/E": "Price ÷ last 12 months' earnings per share.",
    "Forward P/E": "Price ÷ estimated earnings per share for the year ahead.",
    "PEG Ratio": "P/E ÷ expected earnings growth. ~1.0 is roughly fair for the growth.",
    "Price/Book": "Share price ÷ net assets (book value) per share.",
    "Price/Sales": "Price ÷ trailing 12-month revenue per share.",
    "EV/EBITDA": "Enterprise value ÷ EBITDA — capital-structure-neutral valuation.",
    "Dividend Rate": "Forward annual dividend per share.",
    "Dividend Yield %": "Annual dividend ÷ price.",
    "Payout Ratio %": "Share of earnings paid out as dividends.",
    "FCF Coverage": "Free cash flow ÷ dividends paid. Times the dividend is covered by cash flow. Green ≥ 1.2×, amber 0.8–1.2×, red < 0.8×.",
    "Ex-Dividend Date": "Buy before this date to receive the next dividend.",
    "5Y Avg Yield %": "Average dividend yield over the last 5 years.",
    "Div Growth 3Y %": "Annualized growth (CAGR) of dividends over 3 years.",
    "Div Growth 5Y %": "Annualized growth (CAGR) of dividends over 5 years.",
    "Gross Margin %": "(Revenue − cost of goods) ÷ revenue.",
    "Operating Margin %": "Operating income ÷ revenue.",
    "EBITDA Margin %": "EBITDA (earnings before interest, tax, depreciation & amortization) ÷ revenue. Operating profitability before non-cash and financing items.",
    "Profit Margin %": "Net income ÷ revenue.",
    "ROE %": "Net income ÷ shareholders' equity.",
    "ROA %": "Net income ÷ total assets.",
    "ROIC %": "Return on Invested Capital = after-tax operating profit ÷ (debt + equity). How efficiently all invested capital generates profit; compare against the cost of capital.",
    "ROCE %": "Return on Capital Employed = EBIT ÷ (total assets − current liabilities). Pre-tax return on the long-term capital running the business.",
    "Revenue/Share": "Trailing 12-month revenue ÷ shares outstanding.",
    "Beta": "Measures how much the stock moves relative to the S&P 500. β = 1: moves with the market. β > 1: amplified swings (e.g. 1.5 = ~50% more volatile). β < 1: more stable. β < 0: tends to move against the market.",
    "Short Interest %": "Shares sold short as a percentage of the public float. Higher means more investors are betting the price will fall; very elevated levels signal bearish sentiment and can set up a short squeeze.",
    "Days to Cover": "Short interest ÷ average daily volume — the number of days of normal trading it would take short sellers to buy back all shorted shares. Higher means a more crowded short and greater squeeze potential.",
    "Altman Z-Score": "Bankruptcy-risk gauge blending 5 weighted balance-sheet/earnings ratios. >2.99 = 'safe' zone, 1.81–2.99 = 'grey' zone, <1.81 = 'distress' zone. Higher is safer. Designed for manufacturers, so less reliable for banks and financials.",
    "Piotroski F-Score": "A 0–9 score of fundamental strength from 9 profitability, leverage and efficiency tests (1 point each). 7–9 = strong fundamentals, 0–3 = weak. Higher is better.",
    "Total Cash": "Cash and short-term investments on the balance sheet.",
    "Total Debt": "Short- plus long-term borrowings.",
    "Total Equity": "Shareholders' equity — total assets minus total liabilities (book value).",
    "Debt/Equity": "Total debt ÷ shareholders' equity (as %).",
    "Current Ratio": "Current assets ÷ current liabilities. >1 covers near-term bills.",
    "Quick Ratio": "Liquid assets (excl. inventory) ÷ current liabilities.",
    "Free Cash Flow": "Operating cash flow − capital expenditure.",
  };

  // FCF dividend-coverage color band (Free Cash Flow / Dividends Paid).
  function covClass(v) {
    if (Fmt.isNull(v)) return "";
    if (v >= 1.2) return "cov-green";
    if (v >= 0.8) return "cov-yellow";
    return "cov-red";
  }

  // Column definitions for the comparison/screener table.
  const COLS = [
    { key: "ticker", label: "Ticker", kind: "ticker" },
    { key: "price", label: "Price", fmt: (v, r) => Fmt.price(v, r.currency) },
    { key: "market_cap", label: "Mkt Cap", fmt: (v, r) => Fmt.big(v, r.currency) },
    { key: "industry", label: "Industry", kind: "text" },
    // valuation
    { key: "pe", label: "P/E", fmt: (v) => Fmt.num(v) },
    { key: "forward_pe", label: "Fwd P/E", fmt: (v) => Fmt.num(v) },
    { key: "peg", label: "PEG", fmt: (v) => Fmt.num(v) },
    { key: "pb", label: "P/B", fmt: (v) => Fmt.num(v) },
    { key: "ps", label: "P/S", fmt: (v) => Fmt.num(v) },
    { key: "pc", label: "P/C", fmt: (v) => Fmt.num(v) },
    { key: "p_fcf", label: "P/FCF", fmt: (v) => Fmt.num(v) },
    { key: "ev_ebitda", label: "EV/EBITDA", fmt: (v) => Fmt.num(v) },
    { key: "eps", label: "EPS", fmt: (v, r) => Fmt.price(v, r.currency) },
    // profitability / income
    { key: "income", label: "Income", fmt: (v, r) => Fmt.big(v, r.currency) },
    { key: "profit_margin", label: "Margin", fmt: (v) => Fmt.ratioPct(v) },
    { key: "fcf", label: "FCF", fmt: (v, r) => Fmt.big(v, r.currency) },
    { key: "roa", label: "ROA", fmt: (v) => Fmt.ratioPct(v) },
    { key: "roe", label: "ROE", fmt: (v) => Fmt.ratioPct(v) },
    { key: "roic", label: "ROIC", fmt: (v) => Fmt.pct(v) },
    // financial health
    { key: "beta", label: "Beta", fmt: (v) => Fmt.num(v, 2) },
    { key: "debt_to_equity", label: "Debt/Eq", fmt: (v) => Fmt.num(v, 1) },
    { key: "lt_debt_to_equity", label: "LT Debt/Eq", fmt: (v) => Fmt.num(v, 1) },
    // dividend
    { key: "div_yield", label: "Yield", fmt: (v) => Fmt.pct(v) },
    { key: "five_year_avg_yield", label: "5Y Avg Yld", fmt: (v) => Fmt.pct(v) },
    { key: "dividend_estimate", label: "Div Est", fmt: (v, r) => Fmt.price(v, r.currency) },
    { key: "dividend_ttm", label: "Div TTM", fmt: (v, r) => Fmt.price(v, r.currency) },
    { key: "payout_ratio", label: "Payout", fmt: (v) => Fmt.ratioPct(v) },
    { key: "fcf_coverage", label: "FCF Cov", fmt: (v) => v == null ? null : Fmt.num(v) + "×", cls: covClass },
    { key: "years_div_increase", label: "Yrs ▲Div", fmt: (v) => v == null ? null : String(v) },
    // performance (price only, excludes dividends)
    { key: "perf_ytd", label: "Perf YTD", fmt: (v) => Fmt.pct(v), signed: true },
    { key: "perf_1y", label: "Perf 1Y", fmt: (v) => Fmt.pct(v), signed: true },
    { key: "perf_3y", label: "Perf 3Y", fmt: (v) => Fmt.pct(v), signed: true },
    { key: "perf_5y", label: "Perf 5Y", fmt: (v) => Fmt.pct(v), signed: true },
    { key: "perf_10y", label: "Perf 10Y", fmt: (v) => Fmt.pct(v), signed: true },
    { key: "star", label: "", kind: "star" },
  ];

  let sort = { key: "market_cap", dir: -1 };
  let filter = "";

  function render(root) { root.innerHTML = ""; return root; }

  /* ---------- comparison table (used by Screener + Watchlist) ---------- */
  function tableHTML(rows, { withSort = true } = {}) {
    const head = COLS.map((c) => {
      if (c.kind === "star") return `<th data-col="star"></th>`;
      const active = sort.key === c.key;
      const arrow = active ? `<span class="arrow">${sort.dir < 0 ? "▼" : "▲"}</span>` : "";
      const tip = COL_DESC[c.key];
      const tipAttr = tip ? ` data-tip="${tip.replace(/"/g, "&quot;")}"` : "";
      const tipCls = tip ? " has-tip" : "";
      return `<th data-col="${c.key}" class="${tipCls.trim()}"${tipAttr}>${c.label}${withSort ? arrow : ""}</th>`;
    }).join("");

    const body = rows.map((r) => rowHTML(r)).join("");
    return `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function rowHTML(r) {
    if (r.error) {
      return `<tr><td class="ticker-cell" data-ticker="${r.ticker}">${r.ticker}</td>` +
        `<td colspan="${COLS.length - 2}" class="na">— ${r.error} —</td>` +
        `<td>${starHTML(r.ticker)}</td></tr>`;
    }
    const cells = COLS.map((c) => {
      if (c.kind === "ticker") {
        return `<td class="ticker-cell" data-ticker="${r.ticker}">${r.ticker}` +
          `<div class="sub">${(r.name || "").slice(0, 22)}</div></td>`;
      }
      if (c.kind === "star") return `<td>${starHTML(r.ticker)}</td>`;
      const raw = r[c.key];
      if (c.kind === "text") {
        return `<td class="text-cell">${raw ? String(raw) : '<span class="na">—</span>'}</td>`;
      }
      const disp = c.fmt ? c.fmt(raw, r) : Fmt.num(raw);
      if (disp === null) return `<td class="na">N/A</td>`;
      let cls = c.cls ? c.cls(raw) : "";
      if (c.signed && typeof raw === "number") cls += (raw >= 0 ? " pos" : " neg");
      const txt = c.signed && typeof raw === "number" && raw > 0 ? "+" + disp : disp;
      return `<td class="${cls.trim()}">${txt}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }

  function starHTML(t) {
    const on = Store.inWatchlist(t);
    return `<span class="star-btn ${on ? "on" : ""}" data-star="${t}" title="${on ? "Remove from" : "Add to"} watchlist">${on ? "★" : "☆"}</span>`;
  }

  function applyView(rows) {
    let out = rows.slice();
    if (filter) {
      const f = filter.toLowerCase();
      out = out.filter((r) => (r.ticker + " " + (r.name || "") + " " + (r.sector || "")).toLowerCase().includes(f));
    }
    const k = sort.key;
    out.sort((a, b) => {
      const av = a[k], bv = b[k];
      const an = av === null || av === undefined || (typeof av === "number" && isNaN(av));
      const bn = bv === null || bv === undefined || (typeof bv === "number" && isNaN(bv));
      if (an && bn) return 0;
      if (an) return 1;        // nulls always sink
      if (bn) return -1;
      if (typeof av === "string") return sort.dir * av.localeCompare(bv);
      return sort.dir * (av - bv);
    });
    return out;
  }

  /* wires sticky header sort + star toggles + row->deepdive for a rendered table */
  function wireTable(container, rows, rerender) {
    // Event delegation on the table catches clicks on the <th> OR any child
    // element inside it (e.g. the .arrow <span>), so closest() always resolves
    // to the header regardless of which pixel was clicked.
    container.addEventListener("click", (e) => {
      // --- sort header ---
      const th = e.target.closest("thead th[data-col]");
      if (th) {
        const col = th.dataset.col;
        if (col && col !== "star") {
          if (sort.key === col) sort.dir *= -1;
          else sort = { key: col, dir: col === "ticker" ? 1 : -1 };
          rerender();
        }
        return;
      }
      // --- watchlist star ---
      const star = e.target.closest("[data-star]");
      if (star) {
        e.stopPropagation();
        const t = star.dataset.star;
        const now = Store.toggleWatch(t);
        App.toast(now ? `★ ${t} added to watchlist` : `${t} removed from watchlist`, "ok");
        return;
      }
      // --- row deep-dive ---
      const cell = e.target.closest("[data-ticker]");
      if (cell) DeepDive.open(cell.dataset.ticker);
    });
  }

  /* =================== SCREENER ===================== */
  async function screener(root, tickers) {
    render(root);
    root.innerHTML = `
      <div class="view-head">
        <div class="view-title">Screener</div>
        <div class="view-sub" id="scr-sub"></div>
        <div class="spacer"></div>
      </div>
      <div class="toolbar">
        <input class="filter-input" id="scr-filter" placeholder="Filter by ticker, name, sector…" value="${filter}">
        <span class="view-sub" id="scr-count"></span>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="scr-addall">★ Add all to watchlist</button>
      </div>
      <div class="table-wrap" id="scr-table"><div class="loading-box"><span class="spinner"></span> Fetching market data…</div></div>`;

    const tableEl = root.querySelector("#scr-table");
    const sub = root.querySelector("#scr-sub");
    const fi = root.querySelector("#scr-filter");
    fi.addEventListener("input", () => { filter = fi.value; paint(); });
    root.querySelector("#scr-addall").addEventListener("click", () => {
      (lastRows || []).forEach((r) => { if (!r.error && !Store.inWatchlist(r.ticker)) Store.toggleWatch(r.ticker); });
      App.toast("Added to watchlist", "ok"); paint();
    });

    let lastRows = null;
    function paint() {
      if (!lastRows) return;
      const view = applyView(lastRows);
      tableEl.innerHTML = tableHTML(view);
      root.querySelector("#scr-count").textContent = `${view.length} of ${lastRows.length} shown`;
      wireTable(tableEl, view, paint);
    }

    if (!tickers.length) {
      tableEl.innerHTML = `<div class="empty"><div class="big">▦</div>Enter tickers above and hit <b>Analyze</b>.<div class="hint">e.g. AAPL, MSFT, NVDA</div></div>`;
      sub.textContent = "";
      return;
    }
    sub.textContent = `${tickers.length} tickers`;
    App.setExportTickers(tickers);
    try {
      const { rows } = await API.screener(tickers);
      lastRows = rows;
      paint();
    } catch (e) {
      tableEl.innerHTML = `<div class="empty"><div class="big">⚠</div>${e.message}</div>`;
    }
  }

  /* =================== WATCHLIST ===================== */
  async function watchlist(root) {
    render(root);
    const wl = Store.getWatchlist();
    root.innerHTML = `
      <div class="view-head">
        <div class="view-title">Watchlist</div>
        <div class="view-sub">${wl.length} saved · persists locally</div>
        <div class="spacer"></div>
        ${wl.length ? `<button class="btn btn-sm btn-ghost" id="wl-clear">Clear all</button>` : ""}
      </div>
      <div class="table-wrap" id="wl-table"></div>`;
    const tableEl = root.querySelector("#wl-table");
    if (root.querySelector("#wl-clear"))
      root.querySelector("#wl-clear").addEventListener("click", () => {
        if (confirm("Clear the entire watchlist?")) { Store.clearWatchlist(); watchlist(root); }
      });

    if (!wl.length) {
      tableEl.innerHTML = `<div class="empty"><div class="big">★</div>Your watchlist is empty.<div class="hint">Click the ☆ on any stock to save it here.</div></div>`;
      return;
    }
    App.setExportTickers(wl);
    tableEl.innerHTML = `<div class="loading-box"><span class="spinner"></span> Loading watchlist…</div>`;
    let lastRows = null;
    function paint() {
      const view = applyView(lastRows);
      tableEl.innerHTML = tableHTML(view);
      wireTable(tableEl, view, paint);
    }
    try {
      const { rows } = await API.screener(wl);
      lastRows = rows;
      paint();
    } catch (e) {
      tableEl.innerHTML = `<div class="empty"><div class="big">⚠</div>${e.message}</div>`;
    }
  }

  /* =================== DASHBOARD ===================== */
  async function dashboard(root) {
    render(root);
    const wl = Store.getWatchlist();
    const last = Store.getLastTickers();
    root.innerHTML = `
      <div class="view-head"><div class="view-title">Dashboard</div>
        <div class="view-sub">Market snapshot</div></div>
      <div class="cards" id="dash-cards"></div>
      <div style="height:20px"></div>
      <div class="panel">
        <div class="panel-head"><span class="dot"></span>${wl.length ? "Watchlist" : "Recently analyzed"}</div>
        <div class="table-wrap" style="border:0;max-height:none" id="dash-table"></div>
      </div>`;
    const set = wl.length ? wl : last;
    const tableEl = root.querySelector("#dash-table");
    const cardsEl = root.querySelector("#dash-cards");
    if (!set.length) {
      cardsEl.innerHTML = "";
      tableEl.innerHTML = `<div class="empty"><div class="big">◧</div>Welcome to Stock Terminal.<div class="hint">Type tickers up top and press Analyze, or build a watchlist.</div></div>`;
      return;
    }
    tableEl.innerHTML = `<div class="loading-box"><span class="spinner"></span> Loading…</div>`;
    try {
      const { rows } = await API.screener(set);
      const ok = rows.filter((r) => !r.error);
      const totalMcap = ok.reduce((s, r) => s + (r.market_cap || 0), 0);
      const gainers = ok.filter((r) => (r.change_pct || 0) > 0).length;
      const avgPe = (() => { const v = ok.map((r) => r.pe).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; })();
      cardsEl.innerHTML = `
        ${card("Tracked", ok.length, "stocks")}
        ${card("Total Mkt Cap", Fmt.big(totalMcap, "USD"), "combined")}
        ${card("Advancing", `${gainers}/${ok.length}`, "positive today")}
        ${card("Avg P/E", avgPe != null ? avgPe.toFixed(1) : "N/A", "trailing")}`;
      const view = applyView(rows);
      tableEl.innerHTML = tableHTML(view);
      wireTable(tableEl, view, () => { tableEl.innerHTML = tableHTML(applyView(rows)); wireTable(tableEl, rows, () => {}); });
    } catch (e) {
      tableEl.innerHTML = `<div class="empty">${e.message}</div>`;
    }
  }
  function card(label, value, sub) {
    return `<div class="stat-card"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub || ""}</div></div>`;
  }

  /* =================== CALENDAR ===================== */
  // Persisted across re-renders within a session.
  let calState = { tab: "earnings", range: "1w" };
  const TIMING = { AMC: "After close", BMO: "Before open", TAS: "During", TNS: "—" };

  function calWindow(key) {
    const fmt = (d) => d.toISOString().slice(0, 10);
    const today = new Date();
    const end = new Date(today);
    if (key === "2w") end.setDate(end.getDate() + 14);
    else if (key === "1m") end.setDate(end.getDate() + 30);
    else end.setDate(end.getDate() + 7);
    return { start: fmt(today), end: fmt(end) };
  }

  function groupByDate(items) {
    const map = new Map();
    items.forEach((it) => {
      const k = it.date || "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }

  function emptyMsg(icon, msg, hint) {
    return `<div class="empty"><div class="big">${icon}</div>${msg}${hint ? `<div class="hint">${hint}</div>` : ""}</div>`;
  }

  function earningsTable(items) {
    const groups = groupByDate(items);
    const head = `<thead><tr><th>Ticker</th><th class="text-cell">Company</th><th>Mkt Cap</th>` +
      `<th>Timing</th><th>EPS Est.</th><th>Reported</th><th>Surprise</th></tr></thead>`;
    const body = groups.map(([date, rows]) => {
      const hdr = `<tr class="cal-group"><td colspan="7">${Fmt.weekday(date)} · ${Fmt.date(date) || date}` +
        `<span class="cal-count">${rows.length}</span></td></tr>`;
      const trs = rows.map((r) => {
        const sur = r.surprise_pct;
        const surCls = Fmt.isNull(sur) ? "" : (sur >= 0 ? "pos" : "neg");
        const surTxt = Fmt.isNull(sur) ? Fmt.na : (sur > 0 ? "+" : "") + Fmt.num(sur, 1) + "%";
        return `<tr>` +
          `<td class="ticker-cell" data-ticker="${r.ticker}">${r.ticker}</td>` +
          `<td class="text-cell">${r.name || ""}</td>` +
          `<td>${Fmt.cell(r.market_cap, (v) => Fmt.big(v, "USD"))}</td>` +
          `<td>${TIMING[r.timing] || r.timing || "—"}</td>` +
          `<td>${Fmt.cell(r.eps_estimate, (v) => Fmt.num(v))}</td>` +
          `<td>${Fmt.cell(r.eps_actual, (v) => Fmt.num(v))}</td>` +
          `<td class="${surCls}">${surTxt}</td></tr>`;
      }).join("");
      return hdr + trs;
    }).join("");
    return `<table class="data">${head}<tbody>${body}</tbody></table>`;
  }

  function splitsTable(items) {
    const groups = groupByDate(items);
    const head = `<thead><tr><th>Ticker</th><th class="text-cell">Company</th>` +
      `<th>Ratio</th><th>Type</th><th>Optionable</th></tr></thead>`;
    const body = groups.map(([date, rows]) => {
      const hdr = `<tr class="cal-group"><td colspan="5">${Fmt.weekday(date)} · ${Fmt.date(date) || date}` +
        `<span class="cal-count">${rows.length}</span></td></tr>`;
      const trs = rows.map((r) => {
        const ratio = Fmt.splitRatio(r.old_share_worth, r.share_worth);
        const fwd = !Fmt.isNull(r.old_share_worth) && !Fmt.isNull(r.share_worth)
          ? (r.share_worth > r.old_share_worth ? "Forward" : r.share_worth < r.old_share_worth ? "Reverse" : "—")
          : "—";
        const fwdCls = fwd === "Forward" ? "pos" : fwd === "Reverse" ? "neg" : "";
        return `<tr>` +
          `<td class="ticker-cell" data-ticker="${r.ticker}">${r.ticker}</td>` +
          `<td class="text-cell">${r.name || ""}</td>` +
          `<td>${ratio || Fmt.na}</td>` +
          `<td class="${fwdCls}">${fwd}</td>` +
          `<td>${r.optionable ? "Yes" : "—"}</td></tr>`;
      }).join("");
      return hdr + trs;
    }).join("");
    return `<table class="data">${head}<tbody>${body}</tbody></table>`;
  }

  async function calendar(root) {
    render(root);
    const ranges = [["1w", "Next 7 days"], ["2w", "Next 14 days"], ["1m", "Next 30 days"]];
    root.innerHTML = `
      <div class="view-head">
        <div class="view-title">Calendar</div>
        <div class="view-sub" id="cal-sub"></div>
        <div class="spacer"></div>
      </div>
      <div class="toolbar">
        <div class="stmt-tabs" style="padding:0;border:0">
          <div class="stmt-tab ${calState.tab === "earnings" ? "active" : ""}" data-cal="earnings">Earnings</div>
          <div class="stmt-tab ${calState.tab === "splits" ? "active" : ""}" data-cal="splits">Stock Splits</div>
        </div>
        <div class="spacer"></div>
        <div class="range-tabs" id="cal-ranges">
          ${ranges.map(([k, l]) => `<span class="chip ${calState.range === k ? "active" : ""}" data-r="${k}">${l}</span>`).join("")}
        </div>
      </div>
      <div class="table-wrap" id="cal-table"><div class="loading-box"><span class="spinner"></span> Loading calendar…</div></div>`;

    root.querySelectorAll("[data-cal]").forEach((t) =>
      t.addEventListener("click", () => { calState.tab = t.dataset.cal; calendar(root); }));
    root.querySelectorAll("#cal-ranges [data-r]").forEach((c) =>
      c.addEventListener("click", () => { calState.range = c.dataset.r; calendar(root); }));

    const tableEl = root.querySelector("#cal-table");
    const subEl = root.querySelector("#cal-sub");
    const { start, end } = calWindow(calState.range);
    subEl.textContent = `${Fmt.date(start)} – ${Fmt.date(end)}`;

    try {
      const data = await API.calendar({ start, end, limit: 100 });
      if (data.error) { tableEl.innerHTML = emptyMsg("⚠", data.error); return; }
      const earnings = calState.tab === "earnings";
      const items = (earnings ? data.earnings : data.splits) || [];
      const err = earnings ? data.earnings_error : data.splits_error;
      if (!items.length) {
        tableEl.innerHTML = err
          ? emptyMsg("⚠", err)
          : emptyMsg("▤", `No ${earnings ? "earnings" : "stock splits"} in this window.`,
                     "Try a wider date range.");
        return;
      }
      tableEl.innerHTML = earnings ? earningsTable(items) : splitsTable(items);
      tableEl.addEventListener("click", (e) => {
        const cell = e.target.closest("[data-ticker]");
        if (cell) DeepDive.open(cell.dataset.ticker);
      });
    } catch (e) {
      tableEl.innerHTML = emptyMsg("⚠", e.message);
    }
  }

  /* =================== SETTINGS ===================== */
  function settings(root) {
    render(root);
    const s = Store.getSettings();
    const accents = [["green", "#1fd1a0"], ["blue", "#2f81f7"], ["amber", "#f5a623"], ["violet", "#a371f7"]];
    root.innerHTML = `
      <div class="view-head"><div class="view-title">Settings</div></div>
      <div class="panel" style="max-width:640px">
        <div class="set-row">
          <div><div>Accent color</div><div class="desc">Terminal highlight color</div></div>
          <div style="display:flex;gap:8px">
            ${accents.map(([n, c]) => `<div class="swatch ${s.accent === n ? "sel" : ""}" data-accent="${n}" style="background:${c}"></div>`).join("")}
          </div>
        </div>
        <div class="set-row">
          <div><div>Default tickers</div><div class="desc">Pre-filled in the search box on load</div></div>
          <input class="input" id="set-default" style="width:260px" value="${s.defaultTickers}">
        </div>
        <div class="set-row">
          <div><div>Price chart range</div><div class="desc">Default range in deep-dive</div></div>
          <select class="input" id="set-range">
            ${["1mo", "6mo", "1y", "2y", "5y", "max"].map((r) => `<option ${s.range === r ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </div>
        <div class="set-row">
          <div><div>Server cache</div><div class="desc">Clear cached Yahoo responses to force a refresh</div></div>
          <button class="btn btn-sm" id="set-cache">Clear cache</button>
        </div>
        <div class="set-row">
          <div><div>Watchlist data</div><div class="desc">${Store.getWatchlist().length} symbols stored in this browser</div></div>
          <button class="btn btn-sm btn-ghost" id="set-wipe">Clear watchlist</button>
        </div>
      </div>`;
    root.querySelectorAll("[data-accent]").forEach((sw) =>
      sw.addEventListener("click", () => { Store.setSetting("accent", sw.dataset.accent); App.applyAccent(); settings(root); }));
    root.querySelector("#set-default").addEventListener("change", (e) => Store.setSetting("defaultTickers", e.target.value));
    root.querySelector("#set-range").addEventListener("change", (e) => Store.setSetting("range", e.target.value));
    root.querySelector("#set-cache").addEventListener("click", async () => { await API.clearCache(); App.toast("Cache cleared", "ok"); });
    root.querySelector("#set-wipe").addEventListener("click", () => { if (confirm("Clear watchlist?")) { Store.clearWatchlist(); settings(root); } });
  }

  return { screener, watchlist, dashboard, calendar, settings, COLS, PANEL_TIPS };
})();

/* =================== DEEP DIVE OVERLAY ===================== */
const DeepDive = (() => {
  const elOverlay = () => document.getElementById("deepdive");
  let current = null;

  // Hover suffix that appends a margin "(xx.x%)" when present.
  const pctTip = (v) => (v == null ? "" : ` (${Number(v).toFixed(1)}%)`);

  // Bar series ($) shown in the income/cash-flow grouped-bar chart.
  // Gross/Operating "Margin" bars show the absolute amount (gross profit /
  // operating income); their `tip` adds the margin % to the hover tooltip.
  const FIN_SERIES = [
    { key: "revenue", label: "Revenue", color: "accent", swatch: "var(--accent)" },
    { key: "gross_profit", label: "Gross Margin", color: "#2f81f7", swatch: "#2f81f7",
      tip: (d) => pctTip(d.gross_margin) },
    { key: "operating_income", label: "Operating Margin", color: "#e3b341", swatch: "#e3b341",
      tip: (d) => pctTip(d.operating_margin) },
    { key: "net_income", label: "Net Income", color: "#5b6f86", swatch: "#5b6f86",
      tip: (d) => pctTip(d.net_margin) },
    { key: "fcf", label: "FCF", color: "#168512", swatch: "#168512" },
  ];
  // Year-over-year growth bars (%) per year, shown in their own panel.
  const GROWTH_SERIES = [
    { key: "revenue_growth", label: "Revenue", color: "accent", swatch: "var(--accent)" },
    { key: "eps_growth", label: "EPS", color: "#2f81f7", swatch: "#2f81f7" },
    { key: "ebitda_growth", label: "EBITDA", color: "#168512", swatch: "#168512" },
  ];
  // Share Dilution panel: share counts ($-axis bars) + yield/payout (% lines).
  const SHARE_BARS = [
    { key: "shares_outstanding", label: "Shares Outstanding", color: "accent", swatch: "var(--accent)" },
    { key: "float_shares", label: "Float Shares", color: "#2f81f7", swatch: "#2f81f7" },
    { key: "treasury_shares", label: "Treasury Shares", color: "#5b6f86", swatch: "#5b6f86" },
  ];
  const SHARE_LINES = [
    { key: "div_yield", label: "Dividend Yield %", color: "#e3b341", swatch: "#e3b341" },
    { key: "payout_ratio", label: "Payout Ratio %", color: "#db61a2", swatch: "#db61a2" },
  ];
  const pctAxis = (v) => Math.round(v) + "%";
  const pct1Axis = (v) => Number(v).toFixed(1) + "%";

  function panel(title, obj, fmtMap) {
    const rows = Object.entries(obj).map(([k, v]) => {
      let disp;
      if (v === null || v === undefined) disp = Fmt.na;
      else if (typeof v === "string") disp = v;
      else {
        const f = fmtMap && fmtMap[k];
        disp = f ? f(v) : Fmt.num(v);
        if (disp === null) disp = Fmt.na;
      }
      let cls = "";
      if (/Growth|Yield|Margin|ROE|ROA|ROIC|ROCE/.test(k) && typeof v === "number") cls = v >= 0 ? "pos" : "neg";
      if (k === "FCF Coverage" && typeof v === "number") cls = v >= 1.2 ? "pos" : v >= 0.8 ? "amber" : "neg";
      const tip = Views.PANEL_TIPS[k];
      const tipAttr = tip ? ` data-tip="${tip.replace(/"/g, "&quot;")}"` : "";
      const kCls = tip ? "k has-tip" : "k";
      return `<div class="kv-row"><span class="${kCls}"${tipAttr}>${k}</span><span class="v ${cls}">${disp}</span></div>`;
    }).join("");
    return `<div class="panel"><div class="panel-head"><span class="dot"></span>${title}</div><div class="kv">${rows}</div></div>`;
  }

  async function open(ticker) {
    current = ticker;
    const ov = elOverlay();
    ov.classList.remove("hidden");
    ov.innerHTML = `<div class="dd-top"><span class="dd-back" id="dd-back">‹ Back</span>
      <span class="dd-title">${ticker}</span></div>
      <div class="dd-body"><div class="loading-box"><span class="spinner"></span> Loading ${ticker}…</div></div>`;
    document.getElementById("dd-back").addEventListener("click", close);
    document.addEventListener("keydown", escClose);

    let d;
    try { d = await API.deepdive(ticker); }
    catch (e) { ov.querySelector(".dd-body").innerHTML = `<div class="empty"><div class="big">⚠</div>${e.message}</div>`; return; }
    if (current !== ticker) return;

    const cur = d.currency || "USD";
    const big = (v) => Fmt.cell(v, (x) => Fmt.big(x, cur));
    const fmtMaps = {
      valuation: { "Market Cap": (v) => Fmt.big(v, cur), "Enterprise Value": (v) => Fmt.big(v, cur) },
      dividend: { "Dividend Rate": (v) => Fmt.price(v, cur), "FCF Coverage": (v) => Fmt.num(v) + "×" },
      profitability: {},
      health: { "Total Cash": (v) => Fmt.big(v, cur), "Total Debt": (v) => Fmt.big(v, cur), "Total Equity": (v) => Fmt.big(v, cur), "Free Cash Flow": (v) => Fmt.big(v, cur) },
      risk: {
        "Beta": (v) => Fmt.num(v, 2),
        "Days to Cover": (v) => Fmt.num(v, 2),
        "Altman Z-Score": (v) => Fmt.num(v, 2),
        "Piotroski F-Score": (v) => `${Math.round(v)} / 9`,
      },
    };
    const chg = d.change_pct;
    const chgTxt = chg == null ? "" : `<span class="${chg >= 0 ? "pos" : "neg"}">${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%</span>`;
    const star = Store.inWatchlist(ticker);

    ov.querySelector(".dd-top").innerHTML = `
      <span class="dd-back" id="dd-back">‹ Back</span>
      <span class="dd-title">${ticker}</span>
      <span class="dd-name">${d.name || ""} · ${d.exchange || ""} ${d.sector ? "· " + d.sector : ""}</span>
      <span class="dd-price">${Fmt.cell(d.price, (v) => Fmt.price(v, cur))} ${chgTxt}</span>
      <button class="btn btn-sm" id="dd-star">${star ? "★ Watching" : "☆ Watch"}</button>`;
    document.getElementById("dd-back").addEventListener("click", close);
    document.getElementById("dd-star").addEventListener("click", () => {
      const now = Store.toggleWatch(ticker);
      document.getElementById("dd-star").textContent = now ? "★ Watching" : "☆ Watch";
      App.toast(now ? `★ ${ticker} added` : `${ticker} removed`, "ok");
    });

    ov.querySelector(".dd-body").innerHTML = `
      <div class="dd-grid">
        <div class="col-3">${panel("Valuation", d.panels.valuation, fmtMaps.valuation)}</div>
        <div class="col-3">${panel("Dividend", d.panels.dividend, fmtMaps.dividend)}</div>
        <div class="col-3">${panel("Profitability", d.panels.profitability, fmtMaps.profitability)}</div>
        <div class="col-3">${panel("Financial Health", d.panels.health, fmtMaps.health)}</div>

        <div class="col-6"><div class="panel">
          <div class="panel-head"><span class="dot"></span>Price
            <div class="range-tabs" id="dd-ranges" style="margin-left:auto"></div></div>
          <div class="chart-box" id="dd-price"><div class="loading-box"><span class="spinner"></span></div></div>
        </div></div>

        <div class="col-6"><div class="panel">
          <div class="panel-head"><span class="dot"></span>Revenue · Profit · Net Income · FCF<span class="hint" style="margin-left:auto;font-weight:400">hover margins for %</span></div>
          <div class="chart-legend">${FIN_SERIES.map((s) =>
            `<span><span class="legend-key" style="background:${s.swatch}"></span>${s.label}</span>`).join("")}</div>
          <div class="chart-box" id="dd-revni"></div>
        </div></div>

        <div class="col-6"><div class="panel">
          <div class="panel-head"><span class="dot"></span>Growth · YoY % (last 5Y)</div>
          <div class="chart-legend">${GROWTH_SERIES.map((s) =>
            `<span><span class="legend-key" style="background:${s.swatch}"></span>${s.label}</span>`).join("")}</div>
          <div class="chart-box" id="dd-growth"></div>
        </div></div>

        <div class="col-6"><div class="panel">
          <div class="panel-head"><span class="dot"></span>Share Dilution · last 5Y<span class="hint" style="margin-left:auto;font-weight:400">bars: shares · lines: % (right) · float = latest only</span></div>
          <div class="chart-legend">${SHARE_BARS.map((s) =>
            `<span><span class="legend-key" style="background:${s.swatch}"></span>${s.label}</span>`).join("")
            + SHARE_LINES.map((s) =>
            `<span><span class="legend-key" style="background:${s.swatch};height:3px;border-radius:2px"></span>${s.label}</span>`).join("")}</div>
          <div class="chart-box" id="dd-dilution"></div>
        </div></div>

        <div class="col-6">${panel("Risk", d.panels.risk, fmtMaps.risk)}</div>

        <div class="col-6"><div class="panel" id="dd-calendar">
          <div class="panel-head"><span class="dot"></span>Earnings &amp; Splits Calendar</div>
          <div class="chart-box" style="padding:0"><div class="loading-box"><span class="spinner"></span></div></div>
        </div></div>

        <div class="col-12"><div class="panel">
          <div class="stmt-tabs" id="dd-stmt-tabs">
            <div class="stmt-tab active" data-stmt="income">Income Statement</div>
            <div class="stmt-tab" data-stmt="balance">Balance Sheet</div>
            <div class="stmt-tab" data-stmt="cashflow">Cash Flow</div>
            <div class="freq-toggle">
              <span class="chip active" data-freq="annual">Annual</span>
              <span class="chip" data-freq="quarterly">Quarterly</span>
            </div>
          </div>
          <div class="table-wrap" style="border:0;border-top:1px solid var(--border);border-radius:0;max-height:460px" id="dd-stmt">
            <div class="loading-box"><span class="spinner"></span> Loading statement…</div>
          </div>
        </div></div>
      </div>`;

    // revenue · margins · net income · fcf — all $ bars; margins show % on hover
    Charts.bars(document.getElementById("dd-revni"), d.revenue_net_income, FIN_SERIES,
      { height: 230 });

    // year-over-year growth bars, grouped by year (last 5Y)
    Charts.bars(document.getElementById("dd-growth"), d.growth || [],
      GROWTH_SERIES, { height: 230, yFmt: pctAxis });

    // share dilution — share counts ($-axis bars) + yield/payout (% lines)
    Charts.bars(document.getElementById("dd-dilution"), d.share_dilution || [],
      SHARE_BARS, { height: 230, lines: SHARE_LINES, y2Fmt: pct1Axis });

    // price chart with range tabs
    const ranges = ["1mo", "6mo", "1y", "5y", "max"];
    const def = Store.getSettings().range || "1y";
    const rt = document.getElementById("dd-ranges");
    rt.innerHTML = ranges.map((r) => `<span class="chip ${r === def ? "active" : ""}" data-r="${r}">${r}</span>`).join("");
    async function loadPrice(r) {
      const box = document.getElementById("dd-price");
      box.innerHTML = `<div class="loading-box"><span class="spinner"></span></div>`;
      try { const h = await API.history(ticker, r); Charts.line(box, h.points, { height: 260 }); }
      catch (e) { box.innerHTML = `<div class="empty">${e.message}</div>`; }
    }
    rt.querySelectorAll("[data-r]").forEach((c) => c.addEventListener("click", () => {
      rt.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active"); loadPrice(c.dataset.r);
    }));
    loadPrice(def);

    // statements
    let stmt = "income", freq = "annual";
    async function loadStmt() {
      const box = document.getElementById("dd-stmt");
      box.innerHTML = `<div class="loading-box"><span class="spinner"></span> Loading…</div>`;
      try {
        const f = await API.financials(ticker, stmt, freq);
        if (!f.rows.length) { box.innerHTML = `<div class="empty"><div class="hint">No ${stmt} data available</div></div>`; return; }
        const head = `<th>Line Item</th>` + f.periods.map((p) => `<th>${p.slice(0, 7)}</th>`).join("");
        const body = f.rows.map((row) => {
          const tds = row.values.map((v) => v == null ? `<td class="na">N/A</td>` : `<td>${Fmt.big(v, cur)}</td>`).join("");
          return `<tr><td class="ticker-cell" style="cursor:default">${row.label}</td>${tds}</tr>`;
        }).join("");
        box.innerHTML = `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
      } catch (e) { box.innerHTML = `<div class="empty">${e.message}</div>`; }
    }
    const tabs = document.getElementById("dd-stmt-tabs");
    tabs.querySelectorAll("[data-stmt]").forEach((t) => t.addEventListener("click", () => {
      tabs.querySelectorAll("[data-stmt]").forEach((x) => x.classList.remove("active"));
      t.classList.add("active"); stmt = t.dataset.stmt; loadStmt();
    }));
    tabs.querySelectorAll("[data-freq]").forEach((t) => t.addEventListener("click", () => {
      tabs.querySelectorAll("[data-freq]").forEach((x) => x.classList.remove("active"));
      t.classList.add("active"); freq = t.dataset.freq; loadStmt();
    }));
    loadStmt();

    // earnings & splits calendar (fetched independently of the deep-dive blob)
    loadCalendar(ticker, cur);
  }

  function kvRow(k, v) {
    return `<div class="kv-row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  }

  function calendarHTML(c, cur) {
    const u = c.upcoming || {};
    const nextE = (u.earnings_dates || []).map((d) => Fmt.date(d)).join(", ") || Fmt.na;
    const epsRange = (u.eps_low != null && u.eps_high != null)
      ? `${Fmt.num(u.eps_low)} – ${Fmt.num(u.eps_high)}` : Fmt.na;
    const upcoming =
      kvRow("Next Earnings", nextE) +
      kvRow("EPS Estimate (avg)", Fmt.cell(u.eps_avg, (v) => Fmt.num(v))) +
      kvRow("EPS Estimate range", epsRange) +
      kvRow("Revenue Estimate (avg)", Fmt.cell(u.revenue_avg, (v) => Fmt.big(v, cur))) +
      kvRow("Ex-Dividend Date", Fmt.cell(u.ex_dividend_date, (v) => Fmt.date(v))) +
      kvRow("Dividend Date", Fmt.cell(u.dividend_date, (v) => Fmt.date(v)));

    let history = "";
    const hist = (c.earnings_history || []).slice(0, 6);
    if (hist.length) {
      const rows = hist.map((r) => {
        const sur = r.surprise_pct;
        const cls = Fmt.isNull(sur) ? "" : (sur >= 0 ? "pos" : "neg");
        const txt = Fmt.isNull(sur) ? Fmt.na : (sur > 0 ? "+" : "") + Fmt.num(sur, 1) + "%";
        return `<tr><td class="ticker-cell" style="cursor:default">${Fmt.date(r.date) || r.date}</td>` +
          `<td>${Fmt.cell(r.eps_estimate, (v) => Fmt.num(v))}</td>` +
          `<td>${Fmt.cell(r.eps_actual, (v) => Fmt.num(v))}</td>` +
          `<td class="${cls}">${txt}</td></tr>`;
      }).join("");
      history = `<div class="cal-sub-head">Recent Earnings</div>` +
        `<table class="data"><thead><tr><th>Date</th><th>Est.</th><th>Actual</th><th>Surprise</th></tr></thead>` +
        `<tbody>${rows}</tbody></table>`;
    }

    let splits = `<div class="cal-sub-head">Stock Splits</div>`;
    const sp = c.splits || [];
    if (sp.length) {
      splits += `<div class="cal-splits">` + sp.map((s) =>
        `<span class="cal-split-pill">${Fmt.splitFromRatio(s.ratio) || "?"}` +
        `<span class="cal-split-date">${Fmt.date(s.date) || s.date}</span></span>`).join("") + `</div>`;
    } else {
      splits += `<div class="hint" style="padding:0 0 4px">No stock splits on record.</div>`;
    }

    return `<div class="kv" style="padding:10px 14px 4px">${upcoming}</div>` +
      `<div style="padding:0 14px 12px">${history}${splits}</div>`;
  }

  async function loadCalendar(ticker, cur) {
    const panelEl = document.getElementById("dd-calendar");
    if (!panelEl) return;
    const box = panelEl.querySelector(".chart-box");
    try {
      const c = await API.stockCalendar(ticker);
      if (current !== ticker) return;
      box.innerHTML = calendarHTML(c, cur);
    } catch (e) {
      box.innerHTML = `<div class="empty"><div class="hint">${e.message}</div></div>`;
    }
  }

  function escClose(e) { if (e.key === "Escape") close(); }
  function close() {
    current = null;
    elOverlay().classList.add("hidden");
    elOverlay().innerHTML = "";
    document.removeEventListener("keydown", escClose);
    App.refreshCurrent();   // reflect any watchlist changes
  }

  return { open, close };
})();
