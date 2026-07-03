/* views.js — renders Screener, Watchlist, Settings, Dashboard, Calendar and the
   Deep-dive overlay. Depends on API, Fmt, Store, Charts. */
const Views = (() => {
  // Plain-language descriptions shown in a hover bubble on each header.
  const COL_DESC = {
    ticker: "Stock symbol. Click a row to open the deep-dive view.",
    spark_6mo: "6-month price trend (dividend-unadjusted close). Green = up over the window, red = down.",
    spark_1y: "1-year price trend (dividend-unadjusted close). Green = up over the window, red = down.",
    spark_5y: "5-year price trend (dividend-unadjusted close). Green = up over the window, red = down.",
    price: "Latest trading price.",
    market_cap: "Market capitalization = share price × shares outstanding. The total value of the company's equity.",
    enterprise_value: "Enterprise Value = market cap + total debt − cash. The cost to acquire the whole business, debt included.",
    industry: "The company's industry classification.",
    pe: "Price / Earnings (trailing). Price ÷ last 12 months' earnings per share. Lower can mean cheaper relative to profits. (Years of current earning to pay back the price)",
    forward_pe: "Forward P/E. Price ÷ analysts' estimated earnings per share for the year ahead. Lower than trailing P/E signals implies expected earnings growth.",
    peg: "P/E ÷ expected earnings growth. Around 1.0 is often considered fairly valued for the growth.",
    pb: "Price / Book. Share price ÷ book value (net assets) per share.",
    ps: "Price / Sales. Price ÷ last 12 months' revenue per share.",
    pc: "Price / Cash. Market cap ÷ total cash. Lower means more cash backing the valuation.",
    p_fcf: "Price / Free Cash Flow. Market cap ÷ free cash flow.",
    ev_ebitda: "Enterprise Value ÷ EBITDA. A valuation neutral to capital structure (includes debt).",
    eps: "Diluted EPS (TTM). (Net Income − Preferred Dividends) ÷ Weighted Average Diluted Shares Outstanding. Accounts for all potentially dilutive securities (options, warrants, convertibles).",
    eps_basic: "Basic EPS (TTM). (Net Income − Preferred Dividends) ÷ Weighted Average Basic Shares Outstanding. Does not account for potentially dilutive securities.",
    income: "Net income to common shareholders (Yahoo's trailing-12-month figure). Note: Yahoo's TTM window and definition differ from the fiscal-year statement Net Income, so the two can disagree.",
    profit_margin: "Net Profit Margin = net income ÷ revenue (Yahoo's trailing-12-month figures). Share of each sales dollar kept as profit. Note: Yahoo derives its own net income and revenue base, so this can differ from margins computed off the statement lines (which the charts use).",
    gross_margin: "Gross Margin = (revenue − cost of goods sold) ÷ revenue (Yahoo's trailing-12-month figures). Pricing power and production efficiency. Note: Yahoo derives its own gross profit and revenue base, so this can differ from margins computed off the statement lines (which the charts use).",
    operating_margin: "Operating Margin = operating income ÷ revenue (Yahoo's trailing-12-month figures). Note: Yahoo derives its own operating income and revenue base, so this can differ — even in sign — from margins computed off the statement lines (which the charts use).",
    ebitda_margin: "EBITDA Margin = EBITDA ÷ revenue (Yahoo's trailing-12-month figures). Note: Yahoo's EBITDA is its own derived number and differs from the 'Normalized EBITDA' line in the statement, so dividing the statement figures won't reproduce this exactly.",
    fcf: "Free Cash Flow = operating cash flow − capital expenditure. Cash left for dividends, buybacks and debt.",
    roa: "Return on Assets = net income ÷ total assets. How efficiently assets generate profit.",
    roe: "Return on Equity = net income ÷ shareholders' equity.",
    roic: "Return on Invested Capital = after-tax operating profit ÷ (debt + equity). Compare against WACC: ROIC > WACC means the business is creating value; ROIC < WACC means it is destroying it.",
    roce: "Return on Capital Employed = EBIT ÷ (total assets − current liabilities). Pre-tax return on long-term capital.",
    wacc: "Weighted Average Cost of Capital. The minimum return the business must earn to satisfy all capital providers. Cost of equity via CAPM (10Y Treasury + Beta × 5.5% ERP); cost of debt from interest expense ÷ total debt. Compare against ROIC.",
    revenue_per_share: "Trailing 12-month revenue ÷ shares outstanding.",
    beta: "Beta measures how much the stock moves relative to the market (S&P 500). β = 1: moves in line with the market. β > 1: more volatile (e.g. β 1.5 means ~50% bigger swings). β < 1: less volatile. β < 0: tends to move against the market. Use it as a risk gauge — higher beta means higher volatility in both directions.",
    short_interest: "Shares sold short as a percentage of the public float. Higher means more investors betting the price will fall; very elevated levels can set up a short squeeze.",
    days_to_cover: "Short interest ÷ average daily volume — days of normal trading for shorts to buy back. Higher means a more crowded short.",
    altman_z: "Altman Z-Score: bankruptcy-risk gauge. >2.99 'safe', 1.81–2.99 'grey', <1.81 'distress'. Higher is safer. Less reliable for banks/financials.",
    piotroski_f: "Piotroski F-Score (0–9): fundamental strength across 9 tests (profitability, leverage and efficiency). 7–9 strong, 0–3 weak.",
    debt_to_equity: "Total debt ÷ shareholders' equity (shown as %), computed from the Total Debt and Total Equity in this row so the three reconcile. Higher means more leverage.",
    debt_to_equity_mrq: "Yahoo's pre-computed Debt/Equity from its most-recent-quarter balance sheet. Differs from the Debt/Eq column when the quarterly and annual periods don't coincide.",
    debt_ebitda: "Total Debt ÷ EBITDA. How many years of EBITDA it would take to repay all debt. Lower is safer — <3× is generally comfortable, >4–5× is heavily leveraged.",
    ebitda_fcf: "EBITDA ÷ Free Cash Flow. How much reported EBITDA it takes to produce a dollar of free cash. Closer to 1× means EBITDA converts cleanly to cash; high values flag heavy capex, taxes or working-capital drag.",
    lt_debt_to_equity: "Long-term debt ÷ shareholders' equity (shown as %).",
    current_ratio: "Current assets ÷ current liabilities. >1 covers bills due within a year.",
    quick_ratio: "(Current assets − inventory) ÷ current liabilities. Stricter liquidity test.",
    total_cash: "Cash and short-term investments on the balance sheet.",
    total_debt: "Short- plus long-term borrowings.",
    total_equity: "Shareholders' equity — total assets minus total liabilities (book value).",
    div_yield: "Dividend Yield = forward annual dividend ÷ price.",
    five_year_avg_yield: "Average dividend yield over the past 5 years.",
    div_growth_3y: "Annualized growth (CAGR) of dividends over the last 3 years.",
    div_growth_5y: "Annualized growth (CAGR) of dividends over the last 5 years.",
    dividend_estimate: "Forward annual dividend per share (the current run-rate estimate).",
    dividend_ttm: "Dividends actually paid per share over the trailing 12 months.",
    payout_ratio: "Payout Ratio = dividends ÷ earnings. The share of profit paid out as dividends.",
    fcf_coverage: "FCF Coverage = free cash flow ÷ dividends paid. How many times cash flow covers the dividend. Green ≥ 1.2×, yellow 0.8–1.2×, red < 0.8×.",
    years_div_increase: "Consecutive completed calendar years of rising annual dividends.",
    ex_dividend_date: "Buy before this date to receive the next dividend.",
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
    "PEG Ratio": "P/E ÷ expected earnings growth. <1.0 is potentially undervalued. 1.0 is roughly fair for the growth. >1.0 is potentially overvalued.",
    "Price/Book": "Share price ÷ net assets (book value) per share.",
    "Price/Sales": "Price ÷ trailing 12-month revenue per share. <1 low; 1-3 moderate; >10 rich (common in high-growth tech)",
    "Price/Cash": "Market cap ÷ total cash. Lower means more cash backing the valuation.",
    "Price/FCF": "Market cap ÷ free cash flow. Price vs. the actual cash the business generates.",
    "EV/EBITDA": "Enterprise value ÷ EBITDA — capital-structure-neutral valuation. (Ignores debt & tax differences)",
    "Diluted EPS": "(Net Income − Preferred Dividends) ÷ Weighted Average Diluted Shares Outstanding (TTM). Accounts for all potentially dilutive securities (options, warrants, convertibles). This is the standard EPS figure reported by most financial sites. (Higher and rising is better).",
    "Basic EPS": "(Net Income − Preferred Dividends) ÷ Weighted Average Basic Shares Outstanding (TTM). Does not account for potentially dilutive securities — always ≥ Diluted EPS. A large gap between Basic and Diluted EPS signals heavy dilutive securities outstanding.",
    "Dividend Rate": "Forward annual dividend per share.",
    "Dividend TTM": "Dividends actually paid per share over the trailing 12 months.",
    "Years ▲ Dividend": "Consecutive completed calendar years of rising annual dividends.",
    "Dividend Yield %": "Annual dividend ÷ price.",
    "Payout Ratio %": "Share of earnings paid out as dividends.",
    "FCF Coverage": "Free cash flow ÷ dividends paid. Times the dividend is covered by cash flow. Green ≥ 1.2×, amber 0.8–1.2×, red < 0.8×.",
    "Ex-Dividend Date": "Buy before this date to receive the next dividend.",
    "5Y Avg Yield %": "Average dividend yield over the last 5 years.",
    "Div Growth 3Y %": "Annualized growth (CAGR) of dividends over 3 years.",
    "Div Growth 5Y %": "Annualized growth (CAGR) of dividends over 5 years.",
    "Gross Margin %": "(Revenue − cost of goods) ÷ revenue. (Yahoo's trailing-12-month figure — Yahoo derives its own gross profit and revenue base, so this can differ from the fiscal-year statement margin shown in the revenue chart below.)",
    "Operating Margin %": "Operating income ÷ revenue. Profit after running the business, before interest & tax. (Yahoo's trailing-12-month figure — Yahoo derives its own operating income and revenue base, so this can differ, even in sign, from the fiscal-year statement margin shown in the revenue chart below.)",
    "EBITDA Margin %": "EBITDA ÷ revenue: Operating profitability before non-cash (D&A) and financing items. (Uses Yahoo's trailing-12-month figures).",
    "Profit Margin %": "Net income ÷ revenue. (Yahoo's trailing-12-month figure — Yahoo derives its own net income and revenue base, so this can differ from the fiscal-year net margin shown on hover in the revenue chart below.)",
    "ROE %": "Return on Equity: Net income ÷ shareholders' equity. (Can be inflated by high debt or small/negative equity base, as Shareholder's Equity = total assets minus total liabilities).",
    "ROA %": "Net income ÷ total assets. Shows how well assets are used to make profit. >5% is decent; banks/utilities run lower; asset-light firms higher.",
    "ROIC %": "Return on Invested Capital = after-tax operating profit ÷ (debt + equity). Compare against WACC: ROIC > WACC = value creation; ROIC < WACC = value destruction.",
    "ROCE %": "Return on Capital Employed = EBIT ÷ (total assets − current liabilities). Pre-tax return on the long-term capital running the business.",
    "WACC %": "Weighted Average Cost of Capital — the minimum return needed to satisfy all capital providers. Cost of equity via CAPM (10Y Treasury + Beta × 5.5% ERP); cost of debt from interest expense ÷ total debt (falls back to 10Y Treasury when unavailable). Compare against ROIC.",
    "Revenue/Share": "Trailing 12-month revenue ÷ shares outstanding. Shows sales backing each share. Rising over time is a good signal.",
    "Net Income": "Net income to common shareholders (Yahoo's trailing-12-month figure). Yahoo's TTM window and definition differ from the fiscal-year statement Net Income, so this can disagree with the Net Income bars in the revenue chart below.",
    "Beta": "Measures how much the stock moves relative to the S&P 500. β = 1: moves with the market. β > 1: amplified swings (e.g. 1.5 = ~50% more volatile). β < 1: more stable. β < 0: tends to move against the market.",
    "Short Interest %": "Shares sold short as a percentage of the public float. Higher means more investors are betting the price will fall; very elevated levels signal bearish sentiment and can set up a short squeeze.",
    "Days to Cover": "Short interest ÷ average daily volume — the number of days of normal trading it would take short sellers to buy back all shorted shares. Higher means a more crowded short and greater squeeze potential. <1 easy to cover; >5–7 crowded short, higher squeeze potential.",
    "Altman Z-Score": "Bankruptcy-risk gauge blending 5 weighted balance-sheet/earnings ratios. >2.99 = 'safe' zone, 1.81–2.99 = 'grey' zone, <1.81 = 'distress' zone. Higher is safer. Designed for manufacturers, so less reliable for banks and financials.",
    "Piotroski F-Score": "A 0–9 score of fundamental strength from 9 profitability, leverage and efficiency tests (1 point each). 7–9 = strong fundamentals, 0–3 = weak. Higher is better.",
    "Total Cash": "Cash and short-term investments on the balance sheet.",
    "Total Debt": "Short- plus long-term borrowings.",
    "Total Equity": "Shareholders' equity — total assets minus total liabilities (book value).",
    "Debt/Equity": "Total debt ÷ shareholders' equity (as %), computed from the Total Debt and Total Equity shown in this panel so the three figures reconcile.",
    "Debt/Equity (MRQ)": "Yahoo's pre-computed Debt/Equity from its most-recent-quarter balance sheet. Differs from Debt/Equity above when the quarterly and annual periods don't coincide.",
    "Debt/EBITDA": "Total Debt ÷ EBITDA — years of EBITDA needed to repay all debt. Lower is safer: <3× comfortable, >4–5× heavily leveraged.",
    "LT Debt/Equity": "Long-term debt ÷ shareholders' equity (as %). The long-term portion of leverage.",
    "EBITDA/FCF": "EBITDA ÷ Free Cash Flow — how much EBITDA it takes to produce a dollar of free cash. Closer to 1× means EBITDA converts cleanly to cash.",
    "Current Ratio": "Current assets ÷ current liabilities. Ability to cover bills due within a year. >1 covers near-term obligations; 1.5–3 comfortable; <1 potential squeeze;",
    "Quick Ratio": "Liquid assets (excl. inventory) ÷ current liabilities. Stricter liquidity test. >1 strong; <1 relies on selling inventory to pay bills.",
    "Free Cash Flow": "Operating cash flow − capital expenditure. Cash left for dividends, buybacks, and debt paydown.",
    "EBITDA": "Earnings Before Interest, Tax, Depreciation & Amortization — a proxy for operating cash earnings. Yahoo's own trailing-12-month figure (the same EBITDA behind the Debt/EBITDA and EBITDA/FCF ratios).",
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
    // leading mini price charts (like Yahoo Finance), longest window first
    { key: "spark_5y", label: "5Y Chart", kind: "spark" },
    { key: "spark_1y", label: "1Y Chart", kind: "spark" },
    { key: "spark_6mo", label: "6M Chart", kind: "spark" },
    { key: "price", label: "Price", fmt: (v, r) => Fmt.price(v, r.currency) },
    { key: "market_cap", label: "Mkt Cap", fmt: (v, r) => Fmt.big(v, r.currency) },
    { key: "enterprise_value", label: "EV", fmt: (v, r) => Fmt.big(v, r.currency) },
    { key: "industry", label: "Industry", kind: "text" },
    // valuation (most-scanned first)
    { key: "pe", label: "P/E", fmt: (v) => Fmt.num(v) },
    { key: "forward_pe", label: "Fwd P/E", fmt: (v) => Fmt.num(v) },
    { key: "peg", label: "PEG", fmt: (v) => Fmt.num(v) },
    { key: "ps", label: "P/S", fmt: (v) => Fmt.num(v) },
    { key: "pb", label: "P/B", fmt: (v) => Fmt.num(v) },
    { key: "ev_ebitda", label: "EV/EBITDA", fmt: (v) => Fmt.num(v) },
    { key: "p_fcf", label: "P/FCF", fmt: (v) => Fmt.num(v) },
    { key: "pc", label: "P/C", fmt: (v) => Fmt.num(v) },
    { key: "eps", label: "Diluted EPS", fmt: (v, r) => Fmt.price(v, r.currency) },
    { key: "eps_basic", label: "Basic EPS", fmt: (v, r) => Fmt.price(v, r.currency) },
    // profitability
    { key: "profit_margin", label: "Net Margin", fmt: (v) => Fmt.ratioPct(v) },
    { key: "gross_margin", label: "Gross Margin", fmt: (v) => Fmt.ratioPct(v) },
    { key: "operating_margin", label: "Op Margin", fmt: (v) => Fmt.ratioPct(v) },
    { key: "ebitda_margin", label: "EBITDA Margin", fmt: (v) => Fmt.ratioPct(v) },
    { key: "roe", label: "ROE", fmt: (v) => Fmt.ratioPct(v) },
    { key: "roa", label: "ROA", fmt: (v) => Fmt.ratioPct(v) },
    { key: "roic", label: "ROIC", fmt: (v) => Fmt.pct(v) },
    { key: "roce", label: "ROCE", fmt: (v) => Fmt.pct(v) },
    { key: "wacc", label: "WACC", fmt: (v) => Fmt.pct(v) },
    { key: "revenue_per_share", label: "Rev/Share", fmt: (v, r) => Fmt.price(v, r.currency) },
    { key: "income", label: "Income", fmt: (v, r) => Fmt.big(v, r.currency) },
    { key: "fcf", label: "FCF", fmt: (v, r) => Fmt.big(v, r.currency) },
    // financial health
    { key: "debt_to_equity", label: "Debt/Eq", fmt: (v) => Fmt.num(v, 1) },
    { key: "debt_to_equity_mrq", label: "Debt/Eq (MRQ)", fmt: (v) => Fmt.num(v, 1) },
    { key: "debt_ebitda", label: "Debt/EBITDA", fmt: (v) => v == null ? null : Fmt.num(v, 2) + "×" },
    { key: "lt_debt_to_equity", label: "LT Debt/Eq", fmt: (v) => Fmt.num(v, 1) },
    { key: "current_ratio", label: "Current", fmt: (v) => Fmt.num(v, 2) },
    { key: "quick_ratio", label: "Quick", fmt: (v) => Fmt.num(v, 2) },
    { key: "total_cash", label: "Cash", fmt: (v, r) => Fmt.big(v, r.currency) },
    { key: "total_debt", label: "Debt", fmt: (v, r) => Fmt.big(v, r.currency) },
    { key: "total_equity", label: "Equity", fmt: (v, r) => Fmt.big(v, r.currency) },
    { key: "ebitda_fcf", label: "EBITDA/FCF", fmt: (v) => v == null ? null : Fmt.num(v, 2) + "×" },
    // dividend
    { key: "div_yield", label: "Yield", fmt: (v) => Fmt.pct(v) },
    { key: "five_year_avg_yield", label: "5Y Avg Yld", fmt: (v) => Fmt.pct(v) },
    { key: "payout_ratio", label: "Payout", fmt: (v) => Fmt.ratioPct(v) },
    { key: "div_growth_3y", label: "Div Gr 3Y", fmt: (v) => Fmt.pct(v), signed: true },
    { key: "div_growth_5y", label: "Div Gr 5Y", fmt: (v) => Fmt.pct(v), signed: true },
    { key: "dividend_estimate", label: "Div Est", fmt: (v, r) => Fmt.price(v, r.currency) },
    { key: "dividend_ttm", label: "Div TTM", fmt: (v, r) => Fmt.price(v, r.currency) },
    { key: "fcf_coverage", label: "FCF Cov", fmt: (v) => v == null ? null : Fmt.num(v) + "×", cls: covClass },
    { key: "years_div_increase", label: "Yrs ▲Div", fmt: (v) => v == null ? null : String(v) },
    { key: "ex_dividend_date", label: "Ex-Div Date", fmt: (v) => Fmt.date(v) },
    // risk
    { key: "beta", label: "Beta", fmt: (v) => Fmt.num(v, 2) },
    { key: "short_interest", label: "Short %", fmt: (v) => Fmt.ratioPct(v, 1) },
    { key: "days_to_cover", label: "Days Cover", fmt: (v) => Fmt.num(v, 2) },
    { key: "altman_z", label: "Altman Z", fmt: (v) => Fmt.num(v, 2) },
    { key: "piotroski_f", label: "Piotroski", fmt: (v) => v == null ? null : Math.round(v) + "/9" },
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

  // HTML-escape untrusted text (company names, error strings) before it goes
  // into innerHTML — Yahoo names contain &, and defends against stray markup.
  const escHTML = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- shared screener fetch: throttled batches + result cache ------- */
  // Requests are chunked so a big ticker set (e.g. 500) is fetched a batch at a
  // time with a short pause between batches, rather than hammering the server in
  // one giant request. Fetched rows are cached by ticker-set signature, so tab
  // switches and deep-dive closes reuse them; only an explicit refresh (Analyze)
  // replaces an entry.
  // Batch size, inter-batch delay and cache capacity are user-configurable in
  // Settings; read them live so changes take effect on the next fetch.
  const rowsCache = new Map();
  let fetchRun = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function cfgInt(key, def, min) {
    const v = parseInt(Store.getSettings()[key], 10);
    return Number.isFinite(v) && v >= min ? v : def;
  }
  const cfgBatchSize = () => cfgInt("batchSize", 20, 1);
  const cfgBatchDelay = () => cfgInt("batchDelay", 400, 0);
  const cfgCacheSets = () => cfgInt("cacheSets", 25, 1);

  function cacheSet(key, rows) {
    rowsCache.delete(key);
    rowsCache.set(key, rows);
    while (rowsCache.size > cfgCacheSets()) rowsCache.delete(rowsCache.keys().next().value);
  }
  function clearRowsCache() { rowsCache.clear(); }

  /* Replace `ticker`'s row in every cached ticker-set. Used by a deep-dive
     refresh to sync that one ticker into the screener/dashboard/watchlist
     tables without re-fetching the whole set. */
  function updateCachedRow(ticker, row) {
    rowsCache.forEach((rows) => {
      const i = rows.findIndex((r) => r.ticker === ticker);
      if (i >= 0) rows[i] = row;
    });
  }

  /* Fetch screener rows for `tickers` in throttled batches, streaming partial
     results to onProgress after each batch. Reuses the cache unless refresh is
     set; `force` additionally tells the server to drop its own cache, so the
     data is re-pulled from Yahoo. Resolves to the full row array, or null if a
     newer fetch superseded it. */
  async function getScreenerRows(tickers, { refresh = false, force = false, onProgress } = {}) {
    const key = tickers.join(",");
    if (!refresh && !force && rowsCache.has(key)) {
      const hit = rowsCache.get(key);
      onProgress && onProgress({ rows: hit, loaded: hit.length, total: tickers.length,
                                 batch: 0, batches: 0, done: true, cached: true });
      return hit;
    }
    const size = cfgBatchSize(), delay = cfgBatchDelay();
    const batches = [];
    for (let i = 0; i < tickers.length; i += size) batches.push(tickers.slice(i, i + size));
    const runId = ++fetchRun;
    let rows = [];
    let failedBatches = 0;
    for (let b = 0; b < batches.length; b++) {
      if (runId !== fetchRun) return null;               // superseded by a newer fetch
      let res;
      try {
        res = await API.screener(batches[b], force);
      } catch (e) {
        // A failed batch (rate limit, network hiccup, server error) becomes
        // error rows for its own tickers — the remaining batches still load.
        failedBatches++;
        res = { rows: batches[b].map((t) => ({ ticker: t, error: e.message })) };
      }
      if (runId !== fetchRun) return null;
      rows = rows.concat(res.rows || []);
      onProgress && onProgress({ rows, loaded: rows.length, total: tickers.length,
                                 batch: b + 1, batches: batches.length,
                                 done: b === batches.length - 1, cached: false,
                                 failedBatches });
      if (b < batches.length - 1 && delay) await sleep(delay);
    }
    if (runId !== fetchRun) return null;
    // Don't cache a set containing transport failures — a retry (tab switch,
    // re-Analyze, ⟳ Refresh) should re-fetch rather than replay the errors.
    if (!failedBatches) cacheSet(key, rows);
    return rows;
  }

  /* Compact inline SVG sparkline. Line + faint area fill; colored green when the
     window ends above where it started, red otherwise (matching Yahoo). */
  function sparklineSVG(values) {
    if (!Array.isArray(values) || values.length < 2) return '<span class="na">—</span>';
    const w = 82, h = 24, pad = 2;
    let min = Infinity, max = -Infinity;
    for (const v of values) { if (v < min) min = v; if (v > max) max = v; }
    const span = (max - min) || 1;
    const n = values.length;
    const X = (i) => pad + (i / (n - 1)) * (w - 2 * pad);
    const Y = (v) => pad + (1 - (v - min) / span) * (h - 2 * pad);
    let line = "", area = `${X(0).toFixed(1)},${(h - pad).toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const px = X(i).toFixed(1), py = Y(values[i]).toFixed(1);
      line += (i ? " " : "") + px + "," + py;
      area += " " + px + "," + py;
    }
    area += ` ${X(n - 1).toFixed(1)},${(h - pad).toFixed(1)}`;
    const stroke = values[n - 1] >= values[0] ? "var(--up)" : "var(--down)";
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">` +
      `<polygon points="${area}" fill="${stroke}" fill-opacity="0.10"/>` +
      `<polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="1.3" ` +
      `stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  /* Period price change (%) over a sparkline window: last vs first close. */
  function sparkChangePct(values) {
    if (!Array.isArray(values) || values.length < 2 || !values[0]) return null;
    return (values[values.length - 1] / values[0] - 1) * 100;
  }

  /* ---------- comparison table (used by Screener + Watchlist) ---------- */
  function tableHTML(rows, { withSort = true } = {}) {
    const head = COLS.map((c) => {
      if (c.kind === "star") return `<th data-col="star"></th>`;
      const sortable = withSort && c.kind !== "spark";  // sparkline arrays aren't sortable
      const active = sortable && sort.key === c.key;
      const arrow = active ? `<span class="arrow">${sort.dir < 0 ? "▼" : "▲"}</span>` : "";
      const tip = COL_DESC[c.key];
      const tipAttr = tip ? ` data-tip="${tip.replace(/"/g, "&quot;")}"` : "";
      const cls = [tip ? "has-tip" : "", c.kind === "spark" ? "nosort" : ""].filter(Boolean).join(" ");
      return `<th data-col="${c.key}" class="${cls}"${tipAttr}>${c.label}${arrow}</th>`;
    }).join("");

    const body = rows.map((r) => rowHTML(r)).join("");
    return `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function rowHTML(r) {
    if (r.error) {
      return `<tr><td class="ticker-cell" data-ticker="${escHTML(r.ticker)}">${escHTML(r.ticker)}</td>` +
        `<td colspan="${COLS.length - 2}" class="na">— ${escHTML(r.error)} —</td>` +
        `<td>${starHTML(r.ticker)}</td></tr>`;
    }
    const cells = COLS.map((c) => {
      if (c.kind === "ticker") {
        return `<td class="ticker-cell" data-ticker="${escHTML(r.ticker)}">${escHTML(r.ticker)}` +
          `<div class="sub">${escHTML((r.name || "").slice(0, 22))}</div></td>`;
      }
      if (c.kind === "star") return `<td>${starHTML(r.ticker)}</td>`;
      const raw = r[c.key];
      if (c.kind === "spark") {
        const pct = sparkChangePct(raw);
        const period = c.label.replace(" Chart", "");
        const tipAttr = pct == null ? ""
          : ` data-tip="${period} price change: ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%"`;
        const cls = "spark-cell" + (pct == null ? "" : " has-tip");
        return `<td class="${cls}"${tipAttr}>${sparklineSVG(raw)}</td>`;
      }
      if (c.kind === "text") {
        return `<td class="text-cell">${raw ? escHTML(String(raw)) : '<span class="na">—</span>'}</td>`;
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
    // Attach the delegated handler once per container. paint() replaces the
    // inner <table> on every render (and on each streamed batch), but the
    // container element persists — re-adding the listener each time would stack
    // duplicate handlers. Delegation reads current state, so one binding covers
    // all subsequent re-renders.
    if (container.__wired) return;
    container.__wired = true;
    // Event delegation on the table catches clicks on the <th> OR any child
    // element inside it (e.g. the .arrow <span>), so closest() always resolves
    // to the header regardless of which pixel was clicked.
    container.addEventListener("click", (e) => {
      // --- sort header ---
      const th = e.target.closest("thead th[data-col]");
      if (th) {
        const col = th.dataset.col;
        if (col && col !== "star" && !th.classList.contains("nosort")) {
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
  async function screener(root, tickers, opts = {}) {
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
        <span class="scr-status" id="scr-status"></span>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="scr-refresh" title="Re-pull fresh data from Yahoo">⟳ Refresh</button>
        <button class="btn btn-sm" id="scr-save">💾 Save as watchlist</button>
        <button class="btn btn-sm" id="scr-addall">★ Add all to stars</button>
      </div>
      <div class="table-wrap" id="scr-table"><div class="loading-box"><span class="spinner"></span> Fetching market data…</div></div>`;

    const tableEl = root.querySelector("#scr-table");
    const sub = root.querySelector("#scr-sub");
    const statusEl = root.querySelector("#scr-status");
    const fi = root.querySelector("#scr-filter");
    fi.addEventListener("input", () => { filter = fi.value; paint(); });
    root.querySelector("#scr-refresh").addEventListener("click", () => {
      if (!tickers.length) { App.toast("Analyze some tickers first", "err"); return; }
      screener(root, tickers, { force: true });
    });
    root.querySelector("#scr-addall").addEventListener("click", () => {
      (lastRows || []).forEach((r) => { if (!r.error && !Store.inWatchlist(r.ticker)) Store.toggleWatch(r.ticker); });
      App.toast("Added to stars", "ok"); paint();
    });
    root.querySelector("#scr-save").addEventListener("click", saveAsList);

    // Save the current screener set as a named watchlist (popup for the name).
    async function saveAsList() {
      if (!tickers.length) { App.toast("Analyze some tickers first", "err"); return; }
      const name = await App.modalPrompt({
        title: "Save watchlist",
        label: `Save these ${tickers.length} tickers as a named watchlist`,
        placeholder: "e.g. Tech megacaps",
        confirmText: "Save",
      });
      if (name === null) return;
      if (Store.findListByName(name) &&
          !confirm(`A watchlist named "${name}" already exists. Overwrite it?`)) return;
      Store.saveList(name, tickers);
      App.toast(`Saved "${name}" · ${tickers.length} tickers`, "ok");
    }

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

    function setStatus(p) {
      if (p.cached) { statusEl.innerHTML = `<span class="ok">✓</span> cached`; return; }
      if (p.done) {
        statusEl.innerHTML = p.failedBatches
          ? `<span class="err">⚠ ${p.failedBatches} of ${p.batches} batches failed — use ⟳ Refresh to retry</span>`
          : `<span class="ok">✓</span> all ${p.total} loaded`;
        return;
      }
      const bi = p.batches > 1 ? ` · batch ${p.batch}/${p.batches}` : "";
      statusEl.innerHTML = `<span class="spinner" style="width:11px;height:11px"></span> loading ${p.loaded}/${p.total}${bi}`;
    }
    // Initial loading state, before the first batch returns.
    statusEl.innerHTML = `<span class="spinner" style="width:11px;height:11px"></span> loading 0/${tickers.length}`;

    let lastP = null;
    try {
      const rows = await getScreenerRows(tickers, {
        refresh: opts.refresh,
        force: opts.force,
        onProgress: (p) => { lastP = p; lastRows = p.rows; paint(); setStatus(p); },
      });
      if (rows == null) return;   // superseded by a newer analyze
      lastRows = rows;
      paint();
      // Announce completion for multi-batch (freshly fetched) loads.
      if (lastP && !lastP.cached && lastP.batches > 1) {
        if (lastP.failedBatches)
          App.toast(`${lastP.failedBatches} of ${lastP.batches} batches failed — ⟳ Refresh to retry`, "err");
        else
          App.toast(`Loaded all ${tickers.length} tickers`, "ok");
      }
    } catch (e) {
      statusEl.innerHTML = `<span class="err">⚠ ${e.message}</span>`;
      if (!lastRows || !lastRows.length)
        tableEl.innerHTML = `<div class="empty"><div class="big">⚠</div>${e.message}</div>`;
      App.toast(e.message, "err");
    }
  }

  /* =================== WATCHLISTS ===================== */
  const STARRED_ID = "__starred__";
  // Which saved list is open in the detail table. Persisted across re-renders so
  // navigating away and back keeps your selection; null = nothing loaded (and so
  // no API call is made until a list is explicitly selected).
  let wlSelected = null;

  function listCardHTML(l, isStarred) {
    const preview = l.tickers.slice(0, 8).join(" · ") + (l.tickers.length > 8 ? " …" : "");
    const foot = isStarred
      ? `<span class="wl-card-tag">from ☆ stars</span>`
      : `<span class="wl-card-actions">
           <button class="wl-act" data-rename="${l.id}" title="Rename">✎</button>
           <button class="wl-act" data-delete="${l.id}" title="Delete">🗑</button>
         </span>`;
    return `
      <div class="wl-card" data-list="${escHTML(l.id)}">
        <div class="wl-card-top">
          <span class="wl-card-name">${escHTML(l.name)}</span>
          <span class="wl-card-count">${l.tickers.length}</span>
        </div>
        <div class="wl-card-tickers">${escHTML(preview) || "—"}</div>
        <div class="wl-card-foot">${foot}</div>
      </div>`;
  }

  // Resolve the selected id to { name, tickers } (or null if it no longer exists).
  function selectedSet() {
    if (wlSelected === STARRED_ID) {
      const t = Store.getWatchlist();
      return t.length ? { name: "★ Starred", tickers: t } : null;
    }
    const l = wlSelected ? Store.getList(wlSelected) : null;
    return l ? { name: l.name, tickers: l.tickers } : null;
  }

  async function loadSelected(root, opts = {}) {
    const detail = root.querySelector("#wl-detail");
    if (!detail) return;
    const sel = selectedSet();
    if (!sel) { detail.innerHTML = ""; return; }
    const id = wlSelected;
    if (!sel.tickers.length) {
      detail.innerHTML = `<div class="empty"><div class="hint">This watchlist is empty.</div></div>`;
      return;
    }
    App.setExportTickers(sel.tickers);
    detail.innerHTML = `
      <div class="wl-detail-head">
        <span class="wl-detail-name">${escHTML(sel.name)}</span>
        <span class="view-sub">${sel.tickers.length} tickers</span>
        <button class="btn btn-sm" id="wl-refresh" title="Re-pull fresh data from Yahoo">⟳ Refresh</button>
      </div>
      <div class="table-wrap" id="wl-table"><div class="loading-box"><span class="spinner"></span> Loading ${escHTML(sel.name)}…</div></div>`;
    detail.querySelector("#wl-refresh").addEventListener("click", () => loadSelected(root, { force: true }));
    const tableEl = detail.querySelector("#wl-table");
    let lastRows = null;
    function paint() {
      const view = applyView(lastRows);
      tableEl.innerHTML = tableHTML(view);
      wireTable(tableEl, view, paint);
    }
    try {
      const rows = await getScreenerRows(sel.tickers, {
        refresh: opts.force,
        force: opts.force,
        onProgress: (p) => {
          if (wlSelected !== id) return;   // selection changed mid-stream
          lastRows = p.rows;
          paint();
        },
      });
      if (rows == null || wlSelected !== id) return;
      lastRows = rows;
      paint();
    } catch (e) {
      tableEl.innerHTML = `<div class="empty"><div class="big">⚠</div>${e.message}</div>`;
    }
  }

  async function watchlist(root) {
    render(root);
    const lists = Store.getLists();
    const starred = Store.getWatchlist();
    const cards = [];
    if (starred.length) cards.push(listCardHTML({ id: STARRED_ID, name: "★ Starred", tickers: starred }, true));
    lists.forEach((l) => cards.push(listCardHTML(l, false)));

    root.innerHTML = `
      <div class="view-head">
        <div class="view-title">Watchlists</div>
        <div class="view-sub">${lists.length} saved · select one to load</div>
        <div class="spacer"></div>
      </div>
      ${cards.length
        ? `<div class="wl-cards">${cards.join("")}</div>`
        : `<div class="empty"><div class="big">★</div>No watchlists yet.<div class="hint">Analyze tickers in the <b>Screener</b>, then click <b>💾 Save as watchlist</b> — or star ☆ individual stocks.</div></div>`}
      <div id="wl-detail"></div>`;

    // Select + load on card click (ignoring clicks on the action buttons).
    root.querySelectorAll(".wl-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-rename],[data-delete]")) return;
        wlSelected = card.dataset.list;
        root.querySelectorAll(".wl-card").forEach((c) => c.classList.toggle("active", c === card));
        loadSelected(root);
      });
    });
    root.querySelectorAll("[data-rename]").forEach((b) => b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = b.dataset.rename;
      const l = Store.getList(id);
      if (!l) return;
      const name = await App.modalPrompt({ title: "Rename watchlist", label: "New name", value: l.name, confirmText: "Rename" });
      if (name === null) return;
      const dup = Store.findListByName(name);
      if (dup && dup.id !== id) { App.toast(`A watchlist named "${name}" already exists`, "err"); return; }
      Store.renameList(id, name);
      watchlist(root);
    }));
    root.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = b.dataset.delete;
      const l = Store.getList(id);
      if (!l || !confirm(`Delete watchlist "${l.name}"?`)) return;
      if (wlSelected === id) wlSelected = null;
      Store.deleteList(id);
      watchlist(root);
    }));

    // Restore a still-valid selection after a re-render (rename/delete/nav return).
    if (wlSelected && selectedSet()) {
      const card = [...root.querySelectorAll(".wl-card")].find((c) => c.dataset.list === wlSelected);
      if (card) card.classList.add("active");
      loadSelected(root);
    } else {
      wlSelected = null;
    }
  }

  /* =================== DASHBOARD ===================== */
  async function dashboard(root, opts = {}) {
    render(root);
    const wl = Store.getWatchlist();
    const last = Store.getLastTickers();
    root.innerHTML = `
      <div class="view-head"><div class="view-title">Dashboard</div>
        <div class="view-sub">Market snapshot</div>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="dash-refresh" title="Re-pull fresh data from Yahoo">⟳ Refresh</button></div>
      <div class="cards" id="dash-cards"></div>
      <div style="height:20px"></div>
      <div class="panel">
        <div class="panel-head"><span class="dot"></span>${wl.length ? "Watchlist" : "Recently analyzed"}</div>
        <div class="table-wrap" style="border:0;max-height:none" id="dash-table"></div>
      </div>`;
    root.querySelector("#dash-refresh").addEventListener("click", () => dashboard(root, { force: true }));
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
      const rows = await getScreenerRows(set, {
        refresh: opts.force,
        force: opts.force,
        onProgress: (p) => {
          if (!p.done && !p.cached && p.batches > 1)
            tableEl.innerHTML = `<div class="loading-box"><span class="spinner"></span> Loading ${p.loaded}/${p.total}…</div>`;
        },
      });
      if (rows == null) return;   // superseded
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

  async function calendar(root, opts = {}) {
    render(root);
    const ranges = [["1w", "Next 7 days"], ["2w", "Next 14 days"], ["1m", "Next 30 days"]];
    root.innerHTML = `
      <div class="view-head">
        <div class="view-title">Calendar</div>
        <div class="view-sub" id="cal-sub"></div>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="cal-refresh" title="Re-pull fresh data from Yahoo">⟳ Refresh</button>
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

    root.querySelector("#cal-refresh").addEventListener("click", () => calendar(root, { force: true }));
    root.querySelectorAll("[data-cal]").forEach((t) =>
      t.addEventListener("click", () => { calState.tab = t.dataset.cal; calendar(root); }));
    root.querySelectorAll("#cal-ranges [data-r]").forEach((c) =>
      c.addEventListener("click", () => { calState.range = c.dataset.r; calendar(root); }));

    const tableEl = root.querySelector("#cal-table");
    const subEl = root.querySelector("#cal-sub");
    const { start, end } = calWindow(calState.range);
    subEl.textContent = `${Fmt.date(start)} – ${Fmt.date(end)}`;

    try {
      const data = await API.calendar({ start, end, limit: 100, refresh: opts.force });
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
          <div><div>Batch size</div><div class="desc">Tickers fetched per request when analyzing many at once</div></div>
          <input class="input" id="set-batch" type="number" min="1" style="width:100px" value="${s.batchSize}">
        </div>
        <div class="set-row">
          <div><div>Batch interval</div><div class="desc">Pause between batches, in milliseconds — higher is gentler on the server</div></div>
          <input class="input" id="set-delay" type="number" min="0" step="50" style="width:100px" value="${s.batchDelay}">
        </div>
        <div class="set-row">
          <div><div>Cached result sets</div><div class="desc">How many analyzed ticker-sets to keep in memory (each set caches all of its tickers)</div></div>
          <input class="input" id="set-cache-sets" type="number" min="1" style="width:100px" value="${s.cacheSets}">
        </div>
        <div class="set-row">
          <div><div>Server cache</div><div class="desc">Clear cached Yahoo responses (server + this browser) to force a refresh</div></div>
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
    const setNum = (id, key, def, min) => root.querySelector(id).addEventListener("change", (e) => {
      let v = parseInt(e.target.value, 10);
      if (!Number.isFinite(v) || v < min) v = def;
      Store.setSetting(key, v);
      e.target.value = v;   // reflect the clamped value
    });
    setNum("#set-batch", "batchSize", 20, 1);
    setNum("#set-delay", "batchDelay", 400, 0);
    setNum("#set-cache-sets", "cacheSets", 25, 1);
    root.querySelector("#set-cache").addEventListener("click", async () => { await API.clearCache(); clearRowsCache(); App.toast("Cache cleared", "ok"); });
    root.querySelector("#set-wipe").addEventListener("click", () => { if (confirm("Clear watchlist?")) { Store.clearWatchlist(); settings(root); } });
  }

  return { screener, watchlist, dashboard, calendar, settings, COLS, PANEL_TIPS, updateCachedRow };
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
    { key: "revenue", label: "Revenue", color: "accent", swatch: "var(--accent)",
      desc: "Total sales for the fiscal year." },
    { key: "gross_profit", label: "Gross Margin", color: "#2f81f7", swatch: "#2f81f7",
      tip: (d) => pctTip(d.gross_margin),
      desc: "Gross profit (revenue − cost of goods sold). Hover a bar for the gross margin %. Taken from the fiscal-year income statement, so it can differ from the TTM Gross Margin % in the Profitability panel (Yahoo derives that one itself)." },
    { key: "operating_income", label: "Operating Margin", color: "#e3b341", swatch: "#e3b341",
      tip: (d) => pctTip(d.operating_margin),
      desc: "Operating income — profit after running the business, before interest & tax. Hover a bar for the operating margin %. Taken from the fiscal-year income statement, so it can differ from the TTM Operating Margin % in the Profitability panel (Yahoo derives that one itself)." },
    { key: "net_income", label: "Net Income", color: "#5b6f86", swatch: "#5b6f86",
      tip: (d) => pctTip(d.net_margin),
      desc: "Bottom-line profit attributable to shareholders. Hover a bar for the net margin %. Taken from the fiscal-year income statement, so it can differ from the TTM Net Income and Profit Margin % in the Profitability panel (Yahoo derives those itself)." },
    { key: "fcf", label: "FCF", color: "#168512", swatch: "#168512",
      desc: "Free cash flow = operating cash flow − capital expenditure." },
  ];
  // Year-over-year growth bars (%) per year, shown in their own panel.
  const GROWTH_SERIES = [
    { key: "revenue_growth", label: "Revenue", color: "accent", swatch: "var(--accent)",
      desc: "Year-over-year growth in total revenue." },
    { key: "eps_growth", label: "Diluted EPS", color: "#2f81f7", swatch: "#2f81f7",
      desc: "Year-over-year growth in diluted earnings per share (falls back to basic EPS if diluted is unavailable)." },
    { key: "ebitda_growth", label: "EBITDA", color: "#168512", swatch: "#168512",
      desc: "Year-over-year growth in EBITDA (earnings before interest, tax, depreciation & amortization)." },
  ];
  // EBITDA margin drawn as a line (right %-axis) over the growth bars.
  const GROWTH_LINES = [
    { key: "ebitda_margin", label: "EBITDA Margin %", color: "#db61a2", swatch: "#db61a2",
      desc: "EBITDA ÷ revenue for each fiscal year (right axis). Statement-derived, so it can differ from the TTM EBITDA Margin % in the Profitability panel (Yahoo derives that one itself)." },
  ];
  // Share Dilution panel: share counts ($-axis bars) + yield/payout (% lines).
  const SHARE_BARS = [
    { key: "shares_outstanding", label: "Shares Outstanding", color: "accent", swatch: "var(--accent)",
      desc: "Total shares issued. Falling = buybacks (each share owns more); rising = dilution." },
    { key: "float_shares", label: "Float Shares", color: "#2f81f7", swatch: "#2f81f7",
      desc: "Shares freely tradable by the public. Only the latest year is available, so it appears on the most recent bar only." },
    { key: "treasury_shares", label: "Treasury Shares", color: "#5b6f86", swatch: "#5b6f86",
      desc: "Repurchased shares held by the company (often ~0 when bought-back shares are retired)." },
  ];
  const SHARE_LINES = [
    { key: "div_yield", label: "Dividend Yield %", color: "#e3b341", swatch: "#e3b341",
      desc: "Historical dividend yield — annual dividends ÷ year-end price." },
    { key: "payout_ratio", label: "Payout Ratio %", color: "#db61a2", swatch: "#db61a2",
      desc: "Dividends as a share of earnings, per year." },
  ];
  const pctAxis = (v) => Math.round(v) + "%";
  const pct1Axis = (v) => Number(v).toFixed(1) + "%";

  // Build chart-legend items; each series with a `desc` gets a hover tooltip,
  // matching the per-metric tooltips on the other deep-dive panels. `line`
  // renders the swatch as a thin bar (for line series).
  function legendItems(series, line = false) {
    return series.map((s) => {
      const keyStyle = line
        ? `background:${s.swatch};height:3px;border-radius:2px`
        : `background:${s.swatch}`;
      const tipAttr = s.desc ? ` data-tip="${s.desc.replace(/"/g, "&quot;")}"` : "";
      const cls = s.desc ? ' class="has-tip"' : "";
      return `<span${cls}${tipAttr}><span class="legend-key" style="${keyStyle}"></span>${s.label}</span>`;
    }).join("");
  }

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

  async function open(ticker, opts = {}) {
    current = ticker;
    const ov = elOverlay();
    ov.classList.remove("hidden");
    ov.innerHTML = `<div class="dd-top"><span class="dd-back" id="dd-back">‹ Back</span>
      <span class="dd-title">${ticker}</span></div>
      <div class="dd-body"><div class="loading-box"><span class="spinner"></span> ${opts.refresh ? "Refreshing" : "Loading"} ${ticker}…</div></div>`;
    document.getElementById("dd-back").addEventListener("click", close);
    document.addEventListener("keydown", escClose);

    let d;
    // refresh drops the server's cache for this ticker first, so the panels,
    // charts, statements and calendar below all reload with fresh Yahoo data.
    try { d = await API.deepdive(ticker, opts.refresh); }
    catch (e) { ov.querySelector(".dd-body").innerHTML = `<div class="empty"><div class="big">⚠</div>${e.message}</div>`; return; }
    if (current !== ticker) return;

    // After a refresh, sync this one ticker's row into the cached screener/
    // dashboard/watchlist tables. Sent with refresh=1 so the row is built from
    // a brand-new Yahoo pull (never from cache — a refresh may be recovering
    // from a bad cached fetch). Only this ticker is touched, not the full set.
    if (opts.refresh) {
      API.screener([ticker], true)
        .then((res) => {
          const row = res.rows && res.rows[0];
          if (row && !row.error) Views.updateCachedRow(ticker, row);
        })
        .catch(() => {});
    }

    const cur = d.currency || "USD";
    const big = (v) => Fmt.cell(v, (x) => Fmt.big(x, cur));
    const fmtMaps = {
      valuation: { "Market Cap": (v) => Fmt.big(v, cur), "Enterprise Value": (v) => Fmt.big(v, cur), "Diluted EPS": (v) => Fmt.price(v, cur), "Basic EPS": (v) => Fmt.price(v, cur) },
      dividend: { "Dividend Rate": (v) => Fmt.price(v, cur), "Dividend TTM": (v) => Fmt.price(v, cur), "FCF Coverage": (v) => Fmt.num(v) + "×", "Years ▲ Dividend": (v) => String(Math.round(v)) },
      profitability: { "Net Income": (v) => Fmt.big(v, cur), "Revenue/Share": (v) => Fmt.price(v, cur), "ROIC %": (v) => Fmt.num(v, 1) + "%", "ROCE %": (v) => Fmt.num(v, 1) + "%", "WACC %": (v) => Fmt.num(v, 1) + "%" },
      health: { "Total Cash": (v) => Fmt.big(v, cur), "Total Debt": (v) => Fmt.big(v, cur), "Total Equity": (v) => Fmt.big(v, cur), "Free Cash Flow": (v) => Fmt.big(v, cur), "EBITDA": (v) => Fmt.big(v, cur), "Debt/EBITDA": (v) => Fmt.num(v, 2) + "×", "EBITDA/FCF": (v) => Fmt.num(v, 2) + "×" },
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
      <button class="btn btn-sm" id="dd-refresh" title="Re-pull fresh data from Yahoo">⟳ Refresh</button>
      <button class="btn btn-sm" id="dd-export" title="Export ${ticker} to Excel">⭳ Export</button>
      <button class="btn btn-sm" id="dd-star">${star ? "★ Watching" : "☆ Watch"}</button>`;
    document.getElementById("dd-back").addEventListener("click", close);
    document.getElementById("dd-refresh").addEventListener("click", () => open(ticker, { refresh: true }));
    document.getElementById("dd-star").addEventListener("click", () => {
      const now = Store.toggleWatch(ticker);
      document.getElementById("dd-star").textContent = now ? "★ Watching" : "☆ Watch";
      App.toast(now ? `★ ${ticker} added` : `${ticker} removed`, "ok");
    });
    document.getElementById("dd-export").addEventListener("click", async () => {
      const btn = document.getElementById("dd-export");
      const old = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:12px;height:12px"></span> Exporting…`;
      try { await API.exportDeepdive(ticker); App.toast(`Exported ${ticker} to .xlsx`, "ok"); }
      catch (e) { App.toast(e.message, "err"); }
      finally { btn.disabled = false; btn.textContent = old; }
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
          <div class="chart-legend">${legendItems(FIN_SERIES)}</div>
          <div class="chart-box" id="dd-revni"></div>
        </div></div>

        <div class="col-6"><div class="panel">
          <div class="panel-head"><span class="dot"></span>Growth · YoY % (last 5Y)<span class="hint" style="margin-left:auto;font-weight:400">bars: YoY % (left) · line: EBITDA margin % (right)</span></div>
          <div class="chart-legend">${legendItems(GROWTH_SERIES) + legendItems(GROWTH_LINES, true)}</div>
          <div class="chart-box" id="dd-growth"></div>
        </div></div>

        <div class="col-6"><div class="panel">
          <div class="panel-head"><span class="dot"></span>Share Dilution · last 5Y<span class="hint" style="margin-left:auto;font-weight:400">bars: shares · lines: % (right) · float = latest only</span></div>
          <div class="chart-legend">${legendItems(SHARE_BARS) + legendItems(SHARE_LINES, true)}</div>
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

    // year-over-year growth bars, grouped by year (last 5Y) + EBITDA margin line
    Charts.bars(document.getElementById("dd-growth"), d.growth || [],
      GROWTH_SERIES, { height: 230, yFmt: pctAxis, lines: GROWTH_LINES, y2Fmt: pct1Axis });

    // share dilution — share counts ($-axis bars) + yield/payout (% lines)
    Charts.bars(document.getElementById("dd-dilution"), d.share_dilution || [],
      SHARE_BARS, { height: 230, lines: SHARE_LINES, y2Fmt: pct1Axis });

    // price chart with range tabs — mirrors the Settings range options, and
    // always includes the configured default so it renders as an active tab.
    const RANGES = ["1mo", "6mo", "1y", "2y", "5y", "max"];
    const def = Store.getSettings().range || "1y";
    const ranges = RANGES.includes(def) ? RANGES : [...RANGES, def];
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

  // Hover descriptions for the Earnings & Splits Calendar rows.
  const CAL_TIPS = {
    "Next Earnings": "Scheduled date(s) of the next earnings release.",
    "EPS Estimate (avg)": "Analysts' average earnings-per-share estimate for the upcoming report.",
    "EPS Estimate range": "Low–high spread of analyst EPS estimates for the upcoming report.",
    "Revenue Estimate (avg)": "Analysts' average revenue estimate for the upcoming report.",
    "Ex-Dividend Date": "Buy before this date to receive the next dividend.",
    "Dividend Date": "Date the next dividend is scheduled to be paid.",
  };

  function kvRow(k, v) {
    const tip = CAL_TIPS[k];
    const tipAttr = tip ? ` data-tip="${tip.replace(/"/g, "&quot;")}"` : "";
    const kCls = tip ? "k has-tip" : "k";
    return `<div class="kv-row"><span class="${kCls}"${tipAttr}>${k}</span><span class="v">${v}</span></div>`;
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
