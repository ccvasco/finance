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
    dcf_value: "DCF fair value per share — a 10-year two-stage discounted cash flow. Latest annual free cash flow grown at the company's own historical FCF CAGR (clamped to 0–20%; flat 2.5% when no usable history), fading linearly to 2.5% terminal growth, discounted at this row's WACC, plus a Gordon terminal value; minus debt, plus cash, ÷ shares. Shown in the trading currency, next to Price for a direct read. The cell is colored green when the model reads the stock as below fair value, red when above; hover it for the exact upside % vs. price. Sorting this column sorts by that upside — descending surfaces the most-undervalued names first. N/A for financials and REITs (an FCF model doesn't fit those businesses), when FCF ≤ 0, or when WACC is unavailable or ≤ 3%. The deep-dive Excel export ('⭳ DCF') shows the full working.",
    eps: "Diluted EPS (TTM). (Net Income − Preferred Dividends) ÷ Diluted Shares Outstanding — denominator = Basic shares + every share that would exist if all options, RSUs, warrants, and convertibles were exercised/converted.",
    eps_basic: "Basic EPS (TTM). (Net Income − Preferred Dividends) ÷ Basic Shares Outstanding — denominator = actual common shares outstanding only, nothing hypothetical added.",
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
    roic_wacc: "Economic spread = ROIC − WACC. The excess return the business earns above its cost of capital. Positive means value creation; negative means value destruction. A durable, wide positive spread is the hallmark of a high-quality compounder.",
    revenue_per_share: "Trailing 12-month revenue ÷ shares outstanding.",
    beta: "Beta measures how much the stock moves relative to the market (S&P 500). β = 1: moves in line with the market. β > 1: more volatile (e.g. β 1.5 means ~50% bigger swings). β < 1: less volatile. β < 0: tends to move against the market. Use it as a risk gauge — higher beta means higher volatility in both directions.",
    short_interest: "Shares sold short as a percentage of the public float. Higher means more investors betting the price will fall; very elevated levels can set up a short squeeze.",
    days_to_cover: "Short interest ÷ average daily volume — days of normal trading for shorts to buy back. Higher means a more crowded short.",
    altman_z: "Altman Z-Score: bankruptcy-risk gauge. >2.99 'safe', 1.81–2.99 'grey', <1.81 'distress'. Higher is safer. Less reliable for banks/financials.",
    piotroski_f: "Piotroski F-Score (0–9): fundamental strength across 9 tests (profitability, leverage and efficiency). 7–9 strong, 0–3 weak.",
    debt_to_equity: "Total debt ÷ shareholders' equity (shown as %), computed from the Total Debt and Total Equity in this row so the three reconcile. Higher means more leverage.",
    debt_to_equity_mrq: "Yahoo's pre-computed Debt/Equity from its most-recent-quarter balance sheet. Differs from the Debt/Eq column when the quarterly and annual periods don't coincide.",
    ebitda: "Net Income + Interest + Tax + Depreciation & Amortization — built up from the bottom line, not down from revenue. A proxy for operating cash earnings. Yahoo's own trailing-12-month figure (the same EBITDA behind the Debt/EBITDA and EBITDA/FCF ratios).",
    debt_ebitda: "Total Debt ÷ EBITDA. How many years of EBITDA it would take to repay all debt. Lower is safer — <3× is generally comfortable, >4–5× is heavily leveraged.",
    ebitda_fcf: "EBITDA ÷ Free Cash Flow — how much EBITDA it takes to produce a dollar of free cash. 1× is the floor (all EBITDA converts to cash); the ratio sits at or above it. (1) Cash-conversion quality: near 1× = profits convert cleanly to cash; well above 1× = cash lost to tax, interest, capex or working-capital drag (red flag). (2) Capital intensity: asset-heavy industries (manufacturing, telecom) sit higher on ongoing capex; asset-light ones (software, consulting) sit near 1×. Compare within a sector — the absolute level is only meaningful against peers.",
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
    strategy_1: "Strategy 1 · Triage — \"Is this business broken?\" A first-pass filter (0–100). Rows with too little data are quarantined (N/A); fatal problems — bankruptcy-level Altman-Z, drowning in debt (Debt/EBITDA > 6), losing money on both earnings and cash flow — fail straight to 0. Survivors are scored on basic quality: does it earn more than its capital costs, are margins healthy, is the balance sheet safe, does profit turn into real cash. Banks, REITs and mortgage REITs get their own rubrics. ≥65 Advance (green), 45–64 Watchlist (yellow), <45 Discard (red). Hover a grade for its full derivation; rules: stock-triage-strategy.md.",
    strategy_2: "Strategy 2 · Quality Compounder — \"Is this a great business worth holding for years?\" Scores (0–100) how good the machine is: high returns on capital (ROIC/ROCE/ROE), fat defensible margins, sensible debt with clean cash conversion, a 5–10-year compounding track record, and a sanity check that you're not wildly overpaying. ≥70 Compounder (green), 50–69 Quality watch (yellow), <50 Pass (red). Hover a grade for its full derivation; rules: strategy-2-quality-compounder.md.",
    strategy_3: "Strategy 3 · Defensive Value — \"Is this a safe, cheap stock?\" A Graham-style value screen (0–100): is the price low relative to earnings, cash flow and assets; is the company strong enough to survive trouble (interest covered, debt repayable from the cash it keeps); has it been consistently profitable year after year; does it pay a well-covered dividend. ≥70 Value candidate (green), 50–69 Fair (yellow), <50 Expensive/weak (red). Hover a grade for its full derivation; rules: strategy-3-defensive-value.md.",
    strategy_min: "Minimum of the three strategy grades — a stock only scores high here when it looks good under every lens: not broken (S1), a quality business (S2) AND safely priced (S3). Sort descending to find names that hold up across ALL strategies. N/A when any strategy could not be graded.",
    strategy_1_flags: "Strategy 1 context flags — never disqualifying, they shape the deep dive: 🔺 priced for perfection · 🔻 suspiciously cheap · ⚠ divergent multiples / data-sanity warnings · 💰 payout stress · 📉 crowded short (>15% of float) · 🌀 high beta (>1.7). Empty = no warnings.",
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
    "DCF Value": "Inferred fair value per share from a 10-year two-stage FCFF DCF: latest annual free cash flow grown at the company's historical FCF CAGR (clamped 0–20%; flat 2.5% when no usable history), fading to 2.5% terminal growth, discounted at this stock's WACC, plus a Gordon terminal value; minus debt, plus cash, ÷ shares. In the trading currency, comparable to Price. N/A for financials and REITs. Use the '⭳ DCF' button for the full working.",
    "DCF Upside %": "DCF Value ÷ Price − 1. Positive (green) = the model reads the stock as below fair value; negative (red) = above. Assumption-heavy — a screen for where to look closer, not a target price.",
    "Diluted EPS": "(Net Income − Preferred Dividends) ÷ Diluted Shares Outstanding (TTM) — denominator = Basic shares + every share that would exist if all options, RSUs, warrants, and convertibles were exercised/converted. This is the standard EPS figure reported by most financial sites. (Higher and rising is better).",
    "Basic EPS": "(Net Income − Preferred Dividends) ÷ Basic Shares Outstanding (TTM) — denominator = actual common shares outstanding only, nothing hypothetical added. Always ≥ Diluted EPS. A large gap between Basic and Diluted EPS signals heavy dilutive securities outstanding.",
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
    "Revenue": "Total sales (Yahoo's trailing-12-month figure). The base every margin % below is computed against — can differ from the fiscal-year Revenue bars in the chart below, since Yahoo's TTM window and revenue base are its own.",
    "Gross Margin %": "(Revenue − cost of goods) ÷ revenue. (Yahoo's trailing-12-month figure — Yahoo derives its own gross profit and revenue base, so this can differ from the fiscal-year statement margin shown in the revenue chart below.)",
    "Operating Margin %": "Operating income ÷ revenue. Profit after running the business, before interest & tax. (Yahoo's trailing-12-month figure — Yahoo derives its own operating income and revenue base, so this can differ, even in sign, from the fiscal-year statement margin shown in the revenue chart below.)",
    "EBITDA Margin %": "EBITDA ÷ revenue: Operating profitability before non-cash (D&A) and financing items. (Uses Yahoo's trailing-12-month figures).",
    "Profit Margin %": "Net income ÷ revenue. (Yahoo's trailing-12-month figure — Yahoo derives its own net income and revenue base, so this can differ from the fiscal-year net margin shown on hover in the revenue chart below.)",
    "ROE %": "Return on Equity: Net income ÷ shareholders' equity. (Can be inflated by high debt or small/negative equity base, as Shareholder's Equity = total assets minus total liabilities).",
    "ROA %": "Net income ÷ total assets. Shows how well assets are used to make profit. >5% is decent; banks/utilities run lower; asset-light firms higher.",
    "ROIC %": "Return on Invested Capital = after-tax operating profit ÷ (debt + equity). Compare against WACC: ROIC > WACC = value creation; ROIC < WACC = value destruction.",
    "ROCE %": "Return on Capital Employed = EBIT ÷ (total assets − current liabilities). Pre-tax return on the long-term capital running the business.",
    "WACC %": "Weighted Average Cost of Capital — the minimum return needed to satisfy all capital providers. Cost of equity via CAPM (10Y Treasury + Beta × 5.5% ERP); cost of debt from interest expense ÷ total debt (falls back to 10Y Treasury when unavailable). Compare against ROIC.",
    "ROIC − WACC %": "Economic spread = ROIC − WACC. The excess return earned above the cost of capital. Positive = value creation; negative = value destruction. A wide, durable positive spread signals a high-quality compounder.",
    "Revenue/Share": "Trailing 12-month revenue ÷ shares outstanding. Shows sales backing each share. Rising over time is a good signal.",
    "Operating Income": "Revenue × Operating Margin % (both Yahoo trailing-12-month figures, so the two rows above reconcile with this one). Profit after running the business, before interest & tax — can differ, even in sign, from the fiscal-year Operating Income bars in the revenue chart below.",
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
    "EBITDA/FCF": "EBITDA ÷ Free Cash Flow — how much EBITDA it takes to produce a dollar of free cash. 1× is the floor (all EBITDA converts to cash); the ratio sits at or above it. (1) Cash-conversion quality: near 1× = profits convert cleanly to cash; well above 1× = cash lost to tax, interest, capex or working-capital drag (red flag). (2) Capital intensity: asset-heavy industries (manufacturing, telecom) sit higher on ongoing capex; asset-light ones (software, consulting) sit near 1×. Compare within a sector — the absolute level is only meaningful against peers.",
    "Current Ratio": "Current assets ÷ current liabilities. Ability to cover bills due within a year. >1 covers near-term obligations; 1.5–3 comfortable; <1 potential squeeze;",
    "Quick Ratio": "Liquid assets (excl. inventory) ÷ current liabilities. Stricter liquidity test. >1 strong; <1 relies on selling inventory to pay bills.",
    "Operating Cash Flow": "Cash generated by core operations, before investing or financing activity — the fiscal-year statement figure (falls back to Yahoo's trailing-12-month figure only if the statement value is missing). Feeds Free Cash Flow below (OCF + Capital Expenditure).",
    "Capital Expenditure": "Cash spent on property, plant & equipment — reported as a negative (a cash outflow), matching the statement. Free Cash Flow above = Operating Cash Flow + this figure. Derived from Operating Cash Flow − Free Cash Flow when the statement doesn't report it directly.",
    "Free Cash Flow": "Operating cash flow − capital expenditure. Cash left for dividends, buybacks, and debt paydown.",
    "EBITDA": "Net Income + Interest + Tax + Depreciation & Amortization — built up from the bottom line, not down from revenue. A proxy for operating cash earnings. Yahoo's own trailing-12-month figure (the same EBITDA behind the Debt/EBITDA and EBITDA/FCF ratios).",
    // REIT Metrics panel
    "FFO": "Funds From Operations = Net Income + Depreciation & Amortization − property-sale gains + impairments — the REIT-standard earnings measure. Property depreciation is a large non-cash charge that buildings usually don't actually lose (they often appreciate), so net income understates a REIT's real earning power; FFO adds it back. One-off sale gains are backed out for the opposite reason: selling a building shouldn't look like operating performance, or a REIT could flatter its payout by liquidating the portfolio the next dividend depends on. This approximates NAREIT FFO but isn't exact, so treat it as directional. See REITs.md.",
    "FFO/Share": "FFO ÷ shares outstanding — the per-share earning power the dividend is paid from (the REIT analogue of EPS).",
    "P/FFO": "Price ÷ FFO per share — the REIT equivalent of the P/E ratio, and the standard REIT valuation multiple. Real-world equity REITs commonly trade around 10–20× FFO. No forward P/FFO is shown: Yahoo provides a forward EPS estimate but no forward FFO estimate.",
    "FFO Payout %": "Dividends ÷ FFO. REITs must distribute ~90% of taxable income by law, so this runs higher than a normal payout ratio: ≤80% is a comfortable cushion, ≤100% sustainable, >100% means paying out more than FFO generates.",
    "FFO Coverage": "FFO ÷ dividends paid — how many times FFO covers the dividend (the inverse of the payout ratio). ≥1.0× is sustainable; below 1.0× the dividend exceeds FFO.",
    "Book Value/Share": "Shareholders' equity ÷ shares outstanding — net asset value per share. This is the primary metric for a mortgage REIT (which owns financial assets marked toward market value), far more so than earnings: the stock effectively tracks book value, and dividends are ultimately paid out of it.",
    "Book Value Trend %": "Annualized trend of book value per share, fitted (least-squares) across all available years so a single anomalous year can't set the number — the single most important mortgage-REIT quality signal, and the heaviest input to its strategy grades. A mREIT that holds or grows book value while paying its dividend is compounding; one with a steadily negative trend is paying the dividend out of capital (destroying book value), however high the headline yield.",
    "Div Coverage (NI)": "Net income ÷ dividends paid — how well earnings cover the payout. Below 1.0× the REIT is distributing more than it earns (funding the gap from capital or leverage), a common and important warning sign for mortgage REITs. Note net income here includes volatile mark-to-market swings, so read the trend, not one quarter.",
    "S1 · Triage": "\"Is this business broken?\" A first-pass filter (0–100): rows with too little data are quarantined (N/A); fatal problems (bankruptcy-level Altman-Z, Debt/EBITDA > 6, losses on both earnings and cash flow) fail straight to 0; survivors are scored on basic quality — value creation, margins, balance sheet, cash conversion. ≥65 Advance, 45–64 Watchlist, <45 Discard. Full rules: stock-triage-strategy.md.",
    "S2 · Compounder": "\"Is this a great business worth holding for years?\" Scores (0–100) how good the machine is: high returns on capital, fat defensible margins, sensible debt with clean cash conversion, a 5–10-year compounding track record, and a check that you're not wildly overpaying. ≥70 Compounder, 50–69 Quality watch, <50 Pass. Full rules: strategy-2-quality-compounder.md.",
    "S3 · Defensive Value": "\"Is this a safe, cheap stock?\" A Graham-style value screen (0–100): price low relative to earnings, cash flow and assets; strong enough to survive trouble (interest covered, debt repayable from cash); consistently profitable year after year; a well-covered dividend. ≥70 Value candidate, 50–69 Fair, <50 Expensive/weak. Full rules: strategy-3-defensive-value.md.",
    "S1 · Flags": "Strategy 1 context flags — never disqualifying, they tell the deep dive where to look first: 🔺 priced for perfection · 🔻 suspiciously cheap · ⚠ divergent multiples / data-sanity warnings · 💰 payout stress · 📉 crowded short · 🌀 high beta.",
    "Min · All Strategies": "The minimum of the three strategy grades — a stock only scores high here when it looks good under every lens: not broken (S1), a quality business (S2) AND safely priced (S3). This is the number to rank by when hunting names that are strong across all strategies.",
  };

  // FCF dividend-coverage color band (Free Cash Flow / Dividends Paid).
  function covClass(v) {
    if (Fmt.isNull(v)) return "";
    if (v >= 1.2) return "cov-green";
    if (v >= 0.8) return "cov-yellow";
    return "cov-red";
  }

  // Strategy-grade color band; `hi`/`lo` are each strategy's decision-band
  // cutoffs (reuses the cov-* classes so no new CSS is needed).
  const gradeClass = (hi, lo) => (v) => {
    if (Fmt.isNull(v)) return "";
    if (v >= hi) return "cov-green";
    if (v >= lo) return "cov-yellow";
    return "cov-red";
  };
  // Advance/watch/fail bands per strategy (must match the graders + COLS below).
  const STRAT_BANDS = { strategy_1: [65, 45], strategy_2: [70, 50], strategy_3: [70, 50] };
  // Colour the Strat Min cell with the bands of whichever strategy produced the
  // min — the min IS that strategy's score, so the same number must never carry
  // a different colour than its source column (e.g. an S3 of 48 shown red there
  // must not turn yellow here).
  const minGradeClass = (v, r) => {
    if (Fmt.isNull(v)) return "";
    const disp = Math.round(v);
    const rank = { "cov-red": 0, "cov-yellow": 1, "cov-green": 2 };
    let worst = "";
    // Among the strategy cells showing this same (rounded) number, take the
    // most severe colour — the min can't look healthier than its source cell.
    for (const k of ["strategy_1", "strategy_2", "strategy_3"]) {
      if (r && r[k] != null && Math.round(r[k]) === disp) {
        const c = gradeClass(STRAT_BANDS[k][0], STRAT_BANDS[k][1])(r[k]);
        if (worst === "" || rank[c] < rank[worst]) worst = c;
      }
    }
    return worst || gradeClass(65, 45)(v);
  };
  const gradeFmt = (v) => (v == null ? null : String(Math.round(v)));

  // ---- strategy-grade derivation tooltip ----------------------------------
  const GRADE_FULL = { "1": "S1 · Triage", "2": "S2 · Compounder", "3": "S3 · Defensive Value" };
  // Points as a tidy number: 25.0 → "25", 12.5 → "12.5", −17 → "−17".
  const fmtPts = (v) => String(parseFloat(v.toFixed(1))).replace("-", "−");

  // Compact payload stashed on each grade cell (parsed back on hover). Returns
  // null when there is nothing to show (a fully blank row).
  function gradePayload(which, r) {
    if (which === "min") {
      const s = [r.strategy_1, r.strategy_2, r.strategy_3];
      if (s.every((v) => v == null) && r.strategy_min == null) return null;
      return { kind: "min", s, min: r.strategy_min };
    }
    return {
      kind: "s", label: GRADE_FULL[which], score: r["strategy_" + which],
      verdict: r["strategy_" + which + "_verdict"],
      // Left undefined (not []) when the row predates the breakdown feature —
      // an empty list means a genuine kill/quarantine, a missing field means
      // the detail simply wasn't loaded. The two get different messages.
      pillars: r["strategy_" + which + "_detail"],
    };
  }

  // Build the tooltip HTML from a parsed payload. Trusted input (our own data).
  function gradeTipHTML(d) {
    if (d.kind === "min") {
      const names = ["S1 Triage", "S2 Compounder", "S3 Defensive"];
      const body = d.s.map((v, i) => {
        const isMin = v != null && v === d.min;
        return `<tr class="${isMin ? "tip-min" : ""}"><td>${names[i]}</td>` +
          `<td class="tip-p">${v == null ? "—" : v}</td></tr>`;
      }).join("");
      return `<div class="tip-h">Strat Min · ${d.min == null ? "N/A" : d.min + " / 100"}</div>` +
        `<div class="tip-sub">the lowest of the three — a name ranks high here only when it holds up under every lens</div>` +
        `<table class="tip-tbl">${body}</table>`;
    }
    const head = `<div class="tip-h">${escHTML(d.label)} · ` +
      `${d.score == null ? "N/A" : d.score + " / 100"}` +
      `${d.verdict ? " — " + escHTML(d.verdict) : ""}</div>`;
    if (d.pillars === undefined) {          // row cached before the breakdown existed
      return head + `<div class="tip-sub">Breakdown not loaded for this row — press ↻ Refresh to compute it.</div>`;
    }
    if (!d.pillars.length) {                // quarantine (null): critical data missing
      return head + `<div class="tip-sub">${d.score == null
        ? "Not scored — reason above." : "Disqualified before scoring — reason above."}</div>`;
    }
    // A disqualified row (score forced to 0) still carries its full breakdown,
    // ending in a signed "Disqualified" adjustment — the values render below.
    const body = d.pillars.map((p) => {
      const adj = p.m === 0;                       // signed adjustment row (a cap)
      const pts = adj
        ? `<span class="tip-adj">${p.p > 0 ? "+" : ""}${fmtPts(p.p)}</span>`
        : `${fmtPts(p.p)}<span class="tip-max">/${p.m}</span>`;
      return `<tr><td>${escHTML(p.k)}</td><td class="tip-p">${pts}</td>` +
        `<td class="tip-d">${escHTML(p.d)}</td></tr>`;
    }).join("");
    return head + `<table class="tip-tbl">${body}</table>`;
  }

  // Column definitions for the comparison/screener table.
  const COLS = [
    { key: "star", label: "", kind: "star" },
    { key: "ticker", label: "Ticker", kind: "ticker" },
    // leading mini price charts (like Yahoo Finance), longest window first
    { key: "spark_5y", label: "5Y Chart", kind: "spark" },
    { key: "spark_1y", label: "1Y Chart", kind: "spark" },
    { key: "spark_6mo", label: "6M Chart", kind: "spark" },
    { key: "price", label: "Price", fmt: (v, r) => Fmt.price(v, r.currency) },
    // DCF fair value sits beside Price for a direct read; it's colored by the
    // (now column-less) upside, whose value + a short legend ride along in the
    // cell's hover tooltip. See the dcf_value special case in rowHTML.
    { key: "dcf_value", label: "DCF Value", kind: "dcf", sortKey: "dcf_upside", fmt: (v, r) => Fmt.price(v, r.currency) },
    { key: "market_cap", label: "Mkt Cap", fmt: (v, r) => Fmt.big(v, r.currency) },
    { key: "enterprise_value", label: "EV", fmt: (v, r) => Fmt.big(v, r.financial_currency || r.currency) },
    { key: "industry", label: "Industry", kind: "text" },
    // strategy grades (0-100) — see the strategy .md docs in stock-terminal/.
    // `gradeTip` marks the cell for the derivation-table hover tooltip.
    { key: "strategy_1", label: "S1 Triage", fmt: gradeFmt, cls: gradeClass(65, 45), gradeTip: "1" },
    { key: "strategy_2", label: "S2 Compounder", fmt: gradeFmt, cls: gradeClass(70, 50), gradeTip: "2" },
    { key: "strategy_3", label: "S3 Defensive", fmt: gradeFmt, cls: gradeClass(70, 50), gradeTip: "3" },
    { key: "strategy_min", label: "Strat Min", fmt: gradeFmt, cls: minGradeClass, gradeTip: "min" },
    { key: "strategy_1_flags", label: "S1 Flags", kind: "text" },
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
    { key: "eps_basic", label: "Basic EPS", fmt: (v, r) => Fmt.price(v, r.financial_currency || r.currency) },
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
    { key: "roic_wacc", label: "ROIC−WACC", fmt: (v) => Fmt.pct(v) },
    { key: "revenue_per_share", label: "Rev/Share", fmt: (v, r) => Fmt.price(v, r.financial_currency || r.currency) },
    { key: "income", label: "Income", fmt: (v, r) => Fmt.big(v, r.financial_currency || r.currency) },
    { key: "fcf", label: "FCF", fmt: (v, r) => Fmt.big(v, r.financial_currency || r.currency) },
    // financial health
    { key: "debt_to_equity", label: "Debt/Eq", fmt: (v) => Fmt.pct(v, 1) },
    { key: "debt_to_equity_mrq", label: "Debt/Eq (MRQ)", fmt: (v) => Fmt.pct(v, 1) },
    { key: "debt_ebitda", label: "Debt/EBITDA", fmt: (v) => v == null ? null : Fmt.num(v, 2) + "×" },
    { key: "lt_debt_to_equity", label: "LT Debt/Eq", fmt: (v) => Fmt.pct(v, 1) },
    { key: "current_ratio", label: "Current", fmt: (v) => Fmt.num(v, 2) },
    { key: "quick_ratio", label: "Quick", fmt: (v) => Fmt.num(v, 2) },
    { key: "total_cash", label: "Cash", fmt: (v, r) => Fmt.big(v, r.financial_currency || r.currency) },
    { key: "total_debt", label: "Debt", fmt: (v, r) => Fmt.big(v, r.financial_currency || r.currency) },
    { key: "total_equity", label: "Equity", fmt: (v, r) => Fmt.big(v, r.financial_currency || r.currency) },
    { key: "ebitda", label: "EBITDA", fmt: (v, r) => Fmt.big(v, r.financial_currency || r.currency) },
    { key: "ebitda_fcf", label: "EBITDA/FCF", fmt: (v) => v == null ? null : Fmt.num(v, 2) + "×" },
    // dividend
    { key: "div_yield", label: "Yield", fmt: (v) => Fmt.pct(v) },
    { key: "five_year_avg_yield", label: "5Y Avg Yld", fmt: (v) => Fmt.pct(v) },
    { key: "payout_ratio", label: "Payout", fmt: (v) => Fmt.ratioPct(v) },
    { key: "div_growth_3y", label: "Div Gr 3Y", fmt: (v) => Fmt.pct(v), signed: true },
    { key: "div_growth_5y", label: "Div Gr 5Y", fmt: (v) => Fmt.pct(v), signed: true },
    { key: "dividend_estimate", label: "Div Est", fmt: (v, r) => Fmt.price(v, r.currency) },
    { key: "dividend_ttm", label: "Div TTM", fmt: (v, r) => Fmt.price(v, r.financial_currency || r.currency) },
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
  ];

  let sort = { key: "market_cap", dir: -1 };
  let filter = "";

  function render(root) { root.innerHTML = ""; return root; }

  /* Run `fn` (a re-render) without losing the user's place in the list.
     Rebuilding a view recreates its scroller — the screener and watchlist scroll
     inside .table-wrap, which the dashboard does too — and a fresh element
     starts at offset 0, so the list would snap back to the top. Snapshot the
     offsets, run the render, then put them back. The re-render is synchronous
     for cache-backed data (the only case that reaches here with rows on screen);
     the rAF pass re-applies once layout has settled. */
  function preserveScroll(fn) {
    const scrollers = [...document.querySelectorAll(".view-root, .table-wrap")];
    const saved = scrollers.map((el) => [el.scrollTop, el.scrollLeft]);
    fn();
    const restore = () => {
      document.querySelectorAll(".view-root, .table-wrap").forEach((el, i) => {
        if (saved[i]) { el.scrollTop = saved[i][0]; el.scrollLeft = saved[i][1]; }
      });
    };
    restore();
    requestAnimationFrame(restore);
  }

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
  // Per-ticker-set run counters (keyed the same way as rowsCache), so a fetch
  // is only ever superseded by a NEWER fetch for that SAME set — e.g. mashing
  // ↻ Refresh twice on one list. A single global counter here previously meant
  // refreshing watchlist B silently cancelled an unrelated, still-running
  // refresh of watchlist A: the two calls shared one counter, so B's fetch
  // bumped it and A's next batch check (`runId !== fetchRun`) saw a mismatch
  // and gave up — switching back to A showed only the batches that had
  // completed before the interruption, not a resumed fetch.
  const fetchRuns = new Map();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Hydrate persisted rows so cached tables survive page reloads.
  try {
    Store.getRowsCache().forEach(([k, rows]) => {
      if (typeof k === "string" && Array.isArray(rows)) rowsCache.set(k, rows);
    });
  } catch { /* corrupted entry — start with an empty cache */ }

  // Delegated hover for the strategy-grade cells: build the derivation table on
  // demand from the compact [data-grade] payload and show it as a rich tooltip.
  document.addEventListener("mouseover", (e) => {
    const cell = e.target.closest("[data-grade]");
    if (!cell) return;
    let d;
    try { d = JSON.parse(cell.getAttribute("data-grade")); } catch { return; }
    App.tip.html(cell, gradeTipHTML(d));
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest("[data-grade]")) App.tip.hide();
  });

  // Persist (debounced — entries can be several MB for big ticker sets).
  let persistTimer = null;
  function persistRowsCache() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => Store.setRowsCache([...rowsCache.entries()]), 400);
  }

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
    persistRowsCache();
  }
  function clearRowsCache() { rowsCache.clear(); persistRowsCache(); }

  /* Cached rows for a ticker-set, or null — never triggers a fetch. Views use
     this so that no Yahoo data is pulled on startup or tab switches; fetching
     happens only on explicit user action (Analyze, ↻ Refresh, opening a list). */
  function peekRows(tickers) {
    return rowsCache.get(tickers.join(",")) || null;
  }

  /* Like peekRows, but reuses rows per ticker from ANY cached set (screener
     runs, other lists, dashboard) when the exact set isn't cached. Tickers
     cached nowhere become "not loaded" placeholder rows. Returns null only
     when none of the tickers have cached data. Newer sets win on conflicts. */
  function assembleCachedRows(tickers) {
    const exact = peekRows(tickers);
    if (exact) return exact;
    const byTicker = new Map();
    rowsCache.forEach((rows) => rows.forEach((r) => {
      if (!r.error) byTicker.set(r.ticker, r);
    }));
    if (!tickers.some((t) => byTicker.has(t))) return null;
    return tickers.map((t) =>
      byTicker.get(t) || { ticker: t, error: "Not loaded — press ↻ Refresh" });
  }

  /* Status-line fragments shared by the cache-first views (watchlist,
     dashboard): a small spinner with text, and the final "✓ N loaded
     (x cached, y fetched)" / "⚠ n batches failed" summary. */
  const spinHTML = (txt) =>
    `<span class="spinner" style="width:11px;height:11px"></span> ${txt}`;
  function doneStatusHTML(total, fetched, fromCache, failedBatches) {
    return failedBatches
      ? `<span class="err">⚠ ${failedBatches} batch${failedBatches > 1 ? "es" : ""} failed — ↻ Refresh to retry</span>`
      : `<span class="ok">✓</span> ${total} loaded` +
        (fromCache ? ` (${fromCache} cached${fetched ? `, ${fetched} fetched` : ""})` : "");
  }

  /* Replace `ticker`'s row in every cached ticker-set. Used by a deep-dive
     refresh to sync that one ticker into the screener/dashboard/watchlist
     tables without re-fetching the whole set. */
  function updateCachedRow(ticker, row) {
    rowsCache.forEach((rows) => {
      const i = rows.findIndex((r) => r.ticker === ticker);
      if (i >= 0) rows[i] = row;
    });
    persistRowsCache();
  }

  /* In-flight full fetches, keyed the same way as rowsCache. A caller that
     lands back on a ticker-set already being fetched in the background (e.g.
     ↻ Refresh on watchlist A, switch to watchlist B mid-fetch, switch back to
     A before it finishes) JOINS that same fetch — getting its live progress
     and eventual result — instead of duplicating the request, and instead of
     the caller's own cache check reporting "already loaded" from a snapshot
     that predates the fetch's completion (which used to silently strand the
     view on stale pre-refresh data even after the refresh went on to finish
     correctly in the background). */
  const inFlight = new Map();  // key -> { promise, subs: Set<onProgress> }

  function joinInFlight(key, onProgress) {
    const existing = inFlight.get(key);
    if (!existing) return null;
    if (onProgress) existing.subs.add(onProgress);
    return existing.promise.finally(() => { if (onProgress) existing.subs.delete(onProgress); });
  }

  /* Fetch screener rows for `tickers` in throttled batches, streaming partial
     results to onProgress after each batch. Reuses the cache unless refresh is
     set; `force` additionally tells the server to drop its own cache, so the
     data is re-pulled from Yahoo. Resolves to the full row array, or null if a
     newer fetch superseded it. */
  async function getScreenerRows(tickers, { refresh = false, force = false, onProgress } = {}) {
    const key = tickers.join(",");
    // A forced refresh always starts fresh (see the fetchRuns bump below,
    // which supersedes it); anything else joins an already-running fetch for
    // this exact set, if one exists.
    if (!force) {
      const joined = joinInFlight(key, onProgress);
      if (joined) return joined;
    }
    if (!refresh && !force && rowsCache.has(key)) {
      const hit = rowsCache.get(key);
      onProgress && onProgress({ rows: hit, loaded: hit.length, total: tickers.length,
                                 batch: 0, batches: 0, done: true, cached: true });
      return hit;
    }
    const size = cfgBatchSize(), delay = cfgBatchDelay();
    const batches = [];
    for (let i = 0; i < tickers.length; i += size) batches.push(tickers.slice(i, i + size));
    const runId = (fetchRuns.get(key) || 0) + 1;
    fetchRuns.set(key, runId);
    const subs = new Set();
    if (onProgress) subs.add(onProgress);
    const fanOut = (p) => subs.forEach((fn) => fn(p));

    const run = (async () => {
      let rows = [];
      let failedBatches = 0;
      for (let b = 0; b < batches.length; b++) {
        if (fetchRuns.get(key) !== runId) return null;    // superseded by a newer fetch of THIS set
        let res;
        try {
          res = await API.screener(batches[b], force);
        } catch (e) {
          // A failed batch (rate limit, network hiccup, server error) becomes
          // error rows for its own tickers — the remaining batches still load.
          failedBatches++;
          res = { rows: batches[b].map((t) => ({ ticker: t, error: e.message })) };
        }
        if (fetchRuns.get(key) !== runId) return null;
        rows = rows.concat(res.rows || []);
        fanOut({ rows, loaded: rows.length, total: tickers.length,
                 batch: b + 1, batches: batches.length,
                 done: b === batches.length - 1, cached: false, failedBatches });
        if (b < batches.length - 1 && delay) await sleep(delay);
      }
      if (fetchRuns.get(key) !== runId) return null;
      return { rows, failedBatches };
    })();
    const entry = { promise: run.then((r) => r && r.rows), subs };
    inFlight.set(key, entry);
    let result;
    try {
      result = await run;
    } finally {
      // Only remove OUR entry — a newer fetch for this same key (started
      // while this one was still finishing) must keep its own registration.
      if (inFlight.get(key) === entry) inFlight.delete(key);
    }
    if (result == null) return null;
    const { rows, failedBatches } = result;
    // Don't cache a set containing transport failures — a retry (tab switch,
    // re-Analyze, ↻ Refresh) should re-fetch rather than replay the errors.
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

  /* Collapsible reference for the strategy grades + S1 flags. Explains what
     each grade measures and — crucially — that the flags are valuation/data
     context that never move the grade, so a top-rated and a bottom-rated
     stock can carry the same flag (e.g. both "Priced for perfection").
     The flag rows are hydrated from /api/meta (see hydrateFlagLegend) so their
     triggers stay in lock-step with the grader's own catalogue. */
  function legendBox() {
    // Collapsed by default on every tab — click the summary to expand.
    return `
      <details class="legend-box" id="scr-legend">
        <summary><span class="legend-ico">ⓘ</span> What the grades &amp; flags mean</summary>
        <div class="legend-grid">
          <div class="legend-sec">
            <div class="legend-h">Strategy grades — 0–100, higher is better. Each views the same company through a different lens; the cell colour is that grade's band <span class="legend-band"><b class="g">green</b> pass · <b class="y">yellow</b> watch · <b class="r">red</b> fail</span>.</div>
            <ul class="legend-list">
              <li><b>S1 Triage</b> — overall business quality after data-hygiene &amp; kill-switch checks: value creation, profitability, balance sheet, cash conversion. <span class="legend-bands">≥65 · 45–64 · &lt;45</span></li>
              <li><b>S2 Compounder</b> — quality-compounder fit: returns on capital, margin moat, capital discipline, long-run compounding, valuation sanity. <span class="legend-bands">≥70 · 50–69 · &lt;50</span></li>
              <li><b>S3 Defensive</b> — Graham-style defensive value: earnings/cash yield, asset backing, financial strength, earnings quality, dividend record. <span class="legend-bands">≥70 · 50–69 · &lt;50</span></li>
              <li><b>Strat Min</b> — the lowest of the three: how the stock holds up under <i>every</i> lens at once.</li>
            </ul>
          </div>
          <div class="legend-sec">
            <div class="legend-h">S1 Flags — context only, they <b>never change the grade</b>. They flag the <b>price you'd pay</b> and data quality, so a top-rated and a bottom-rated stock can share a flag (e.g. NVDA and COIN both "Priced for perfection" — both trade at rich multiples, whatever their quality score).</div>
            <ul class="legend-list legend-flags"><li class="legend-loading">Loading flag reference…</li></ul>
          </div>
        </div>
      </details>`;
  }

  // Flag legend metadata from /api/meta, fetched once and cached. Single source
  // of truth is the backend grader (strategies.TRIAGE_FLAGS).
  let _flagMeta = null;
  async function getFlagMeta() {
    if (_flagMeta) return _flagMeta;
    try { _flagMeta = (await API.meta()).flags || []; }
    catch { _flagMeta = []; }
    return _flagMeta;
  }
  // Fill any rendered legend's flag list (within `scope`) from the cached meta.
  async function hydrateFlagLegend(scope) {
    const ul = (scope || document).querySelector(".legend-flags");
    if (!ul) return;
    const flags = await getFlagMeta();
    if (!flags.length) {
      ul.innerHTML = `<li class="legend-loading">Flag reference unavailable — server offline.</li>`;
      return;
    }
    ul.innerHTML = flags.map((f) => {
      const trig = f.threshold
        ? ` <span class="legend-bands">${escHTML(f.threshold)}</span>` : "";
      return `<li><span class="flag-ico">${escHTML(f.icon)}</span> <b>${escHTML(f.name)}</b>${trig}` +
        `<div class="flag-why">${escHTML(f.why)}</div></li>`;
    }).join("");
  }

  /* ---------- comparison table (used by Screener + Watchlist) ---------- */
  /* Column widths: once the user drags any header edge, Store holds an explicit
     px width for every column and the table switches to `table-layout: fixed`
     (the .sized class) so cells honour those widths instead of auto-sizing to
     their content. Until then the map is empty and layout is untouched. The
     star column is never resizable — the CSS pins it at 40px and the ticker
     column's sticky `left` offset is hardcoded to match. */
  const STAR_COL_W = 40;      // must match the sticky offsets in styles.css
  const COL_DEFAULT_W = 96;   // fallback for a column with no stored width
  // Star + ticker lead every table and are never reordered: styles.css freezes
  // them with :nth-child(1)/(2) rules, so they only stay pinned while they stay
  // put. Everything after them is the user's to arrange.
  const PINNED_COLS = 2;

  /* COLS in the user's saved order. The stored key list is never trusted as-is:
     columns since added to COLS are missing from it and columns since removed
     linger in it, so it's reconciled on every read. A newly added column is
     spliced in after whichever of its COLS neighbours it followed originally,
     landing where its author put it rather than at the far right. */
  function orderedCols() {
    const saved = Store.getColOrder();
    if (!saved.length) return COLS.slice();
    const byKey = new Map(COLS.map((c) => [c.key, c]));
    const out = saved.map((k) => byKey.get(k)).filter(Boolean);   // drops stale keys
    const have = new Set(out.map((c) => c.key));
    COLS.forEach((c, i) => {
      if (have.has(c.key)) return;
      let at = 0;
      for (let j = i - 1; j >= 0; j--) {
        const idx = out.findIndex((o) => o.key === COLS[j].key);
        if (idx >= 0) { at = idx + 1; break; }
      }
      out.splice(at, 0, c);
      have.add(c.key);
    });
    const pinned = COLS.slice(0, PINNED_COLS);
    return pinned.concat(out.filter((c) => !pinned.includes(c)));
  }

  /* Pinned width for one column. Under fixed layout a column with no width
     collapses to nothing, so a column added to COLS after the user last saved
     their widths falls back to a usable default rather than vanishing with no
     grip left to drag it back. */
  function colWidth(c, widths) {
    // the star column is pinned, never user-sized: the ticker column sticks to
    // `left: 40px` and the two would overlap if it drifted
    if (c.kind === "star") return STAR_COL_W;
    return widths[c.key] || COL_DEFAULT_W;
  }

  function colgroupHTML(cols) {
    const w = Store.getColWidths();
    const sized = Object.keys(w).length;
    return `<colgroup>${cols.map((c) => {
      const px = sized ? colWidth(c, w) : (c.kind === "star" ? STAR_COL_W : null);
      return `<col data-col="${c.key}"${px ? ` style="width:${px}px"` : ""}>`;
    }).join("")}</colgroup>`;
  }

  /* Total px width of a fully-sized table — the sum of its columns. Fixed
     layout ignores `table-layout: fixed` unless the table itself has a
     definite width, so this rides along as an inline style. Null until every
     column is pinned (i.e. before the first drag). */
  function sizedTableWidth() {
    const w = Store.getColWidths();
    if (!Object.keys(w).length) return null;
    return COLS.reduce((sum, c) => sum + colWidth(c, w), 0);
  }

  function tableHTML(rows, { withSort = true } = {}) {
    const cols = orderedCols();
    const head = cols.map((c) => {
      if (c.kind === "star") return `<th data-col="star"></th>`;
      const sortable = withSort && c.kind !== "spark";  // sparkline arrays aren't sortable
      const active = sortable && sort.key === c.key;
      const arrow = active ? `<span class="arrow">${sort.dir < 0 ? "▼" : "▲"}</span>` : "";
      const tip = COL_DESC[c.key];
      const tipAttr = tip ? ` data-tip="${tip.replace(/"/g, "&quot;")}"` : "";
      const cls = [tip ? "has-tip" : "", c.kind === "spark" ? "nosort" : ""].filter(Boolean).join(" ");
      // grip sits on the column's right edge; drag = resize, dblclick = reset
      const grip = `<span class="col-grip" data-grip="${c.key}" title="Drag to resize · double-click to reset"></span>`;
      return `<th data-col="${c.key}" class="${cls}"${tipAttr}>${c.label}${arrow}${grip}</th>`;
    }).join("");

    const body = rows.map((r) => rowHTML(r, cols)).join("");
    const total = sizedTableWidth();
    const attrs = total ? ` class="data sized" style="width:${total}px"` : ` class="data"`;
    return `<table${attrs}>${colgroupHTML(cols)}` +
      `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function rowHTML(r, cols) {
    if (r.error) {
      return `<tr><td>${starHTML(r.ticker)}</td>` +
        `<td class="ticker-cell" data-ticker="${escHTML(r.ticker)}">${escHTML(r.ticker)}</td>` +
        `<td colspan="${cols.length - PINNED_COLS}" class="na">— ${escHTML(r.error)} —</td></tr>`;
    }
    const cells = cols.map((c) => {
      if (c.kind === "ticker") {
        // hover blurb: what the company is/does (absent on rows cached
        // before the field existed — reappears after a ↻ Refresh)
        const tipAttr = r.summary ? ` data-tip="${escHTML(r.summary)}"` : "";
        return `<td class="ticker-cell" data-ticker="${escHTML(r.ticker)}"${tipAttr}>${escHTML(r.ticker)}` +
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
      if (c.key === "strategy_1_flags") {
        // Flags are ellipsis-truncated in the cell; the full list (one per
        // line) rides along in a hover tooltip so none are lost.
        if (!raw) return `<td class="text-cell"><span class="na">—</span></td>`;
        const full = String(raw).replace(/ · /g, "\n");
        return `<td class="text-cell has-tip" data-tip="${escHTML(full)}">${escHTML(String(raw))}</td>`;
      }
      if (c.kind === "text") {
        return `<td class="text-cell">${raw ? escHTML(String(raw)) : '<span class="na">—</span>'}</td>`;
      }
      if (c.kind === "dcf") {
        // DCF fair value: colored by upside (green = model reads it below fair
        // value, red = above), with the upside % + a one-line legend in the
        // hover tooltip (the standalone DCF Upside column was folded in here).
        const disp = c.fmt ? c.fmt(raw, r) : Fmt.num(raw);
        if (disp === null) return `<td class="na">N/A</td>`;
        const up = r.dcf_upside;
        const cls = typeof up === "number" ? (up >= 0 ? "pos" : "neg") : "";
        let tip = "";
        if (typeof up === "number") {
          const sign = up >= 0 ? "+" : "";
          const read = up >= 0 ? "below fair value (potentially undervalued)"
                               : "above fair value (potentially overvalued)";
          tip = `DCF Upside ${sign}${up.toFixed(1)}% — price is ${read}.\n`
              + `10y two-stage FCFF discounted at WACC. A screen, not a target price.`;
        }
        // Mismatched-currency ticker: DCF Value is shown in the trading currency
        // (next to Price), but the model runs on reporting-currency figures —
        // spell out the unconverted figure so it isn't misread.
        const finCcy = r.financial_currency || r.currency;
        if (finCcy && r.currency && finCcy !== r.currency && r.dcf_value_native != null) {
          tip = (tip ? tip + "\n" : "")
              + `${Fmt.price(r.dcf_value_native, finCcy)} in the reporting currency (${finCcy}), `
              + `converted to ${r.currency} to compare against Price.`;
        }
        const tipAttr = tip ? ` data-tip="${escHTML(tip)}"` : "";
        const hasTip = tip ? " has-tip" : "";
        return `<td class="${(cls + hasTip).trim()}"${tipAttr}>${disp}</td>`;
      }
      if (c.gradeTip) {
        const disp = c.fmt ? c.fmt(raw, r) : Fmt.num(raw);
        const payload = gradePayload(c.gradeTip, r);
        const attr = payload ? ` data-grade="${escHTML(JSON.stringify(payload))}"` : "";
        const cls = ((c.cls ? c.cls(raw, r) : "") + (payload ? " has-tip grade-cell" : "")).trim();
        const inner = disp === null ? '<span class="na">N/A</span>' : disp;
        return `<td class="${cls}"${attr}>${inner}</td>`;
      }
      const disp = c.fmt ? c.fmt(raw, r) : Fmt.num(raw);
      if (disp === null) return `<td class="na">N/A</td>`;
      let cls = c.cls ? c.cls(raw, r) : "";
      if (c.signed && typeof raw === "number") cls += (raw >= 0 ? " pos" : " neg");
      const txt = c.signed && typeof raw === "number" && raw > 0 ? "+" + disp : disp;
      return `<td class="${cls.trim()}">${txt}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }

  function starHTML(t) {
    // Three states so the glyph never lies about ★ Starred membership:
    //   gold ★  — in the flat ★ Starred set
    //   silver ★ — saved to some named list, but NOT Starred
    //   outline ☆ — in no list at all
    const starred = Store.inWatchlist(t);
    const other = !starred && Store.inAnyList(t);
    const cls = starred ? "on" : other ? "on-other" : "";
    const title = starred ? "In ★ Starred — edit watchlists"
      : other ? "Saved to a watchlist (not ★ Starred) — edit"
      : "Save to watchlists";
    return `<span class="star-btn ${cls}" data-star="${t}" title="${title}">${starred || other ? "★" : "☆"}</span>`;
  }

  /* Star click → checklist popup: pick one or more watchlists (the flat ★
     Starred set plus every named list) to save/remove the ticker from, or type
     a name to create a new list. Applies the diff and refreshes the glyph. */
  async function openStarPicker(t, starEl) {
    t = t.toUpperCase();
    const lists = Store.getLists();
    const items = [
      { id: STARRED_ID, label: "★ Starred", checked: Store.inWatchlist(t) },
      ...lists.map((l) => ({ id: l.id, label: l.name, checked: l.tickers.includes(t) })),
    ];
    const result = await App.modalChecklist({
      title: `Save ${t} to watchlists`,
      label: "Pick one or more lists — check to add, uncheck to remove.",
      items,
      confirmText: "Save",
    });
    if (!result) return;   // cancelled

    let count = 0;
    result.forEach((it) => {
      if (it.isNew) {
        if (it.checked) { Store.saveList(it.label, [t]); count++; }
        return;
      }
      if (it.id === STARRED_ID) {
        const now = Store.inWatchlist(t);
        if (it.checked && !now) Store.toggleWatch(t);
        else if (!it.checked && now) Store.removeWatch(t);
      } else if (it.checked) {
        Store.addToList(it.id, [t]);
      } else {
        Store.removeFromList(it.id, [t]);
      }
      if (it.checked) count++;
    });

    if (starEl) starEl.outerHTML = starHTML(t);
    App.toast(count ? `★ ${t} saved to ${count} list${count > 1 ? "s" : ""}` : `${t} removed from all lists`, "ok");
  }

  function applyView(rows) {
    let out = rows.slice();
    if (filter) {
      const f = filter.toLowerCase();
      out = out.filter((r) => (r.ticker + " " + (r.name || "") + " " + (r.sector || "")).toLowerCase().includes(f));
    }
    // A column may sort on a different field than it displays (e.g. DCF Value
    // sorts by DCF Upside — the actual signal — since its own column is gone).
    const sortCol = COLS.find((c) => c.key === sort.key);
    const k = (sortCol && sortCol.sortKey) || sort.key;
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

  /* ---------- column resizing ---------- */
  const COL_MIN_W = 44;   // px — floor for a dragged column

  const colEl = (table, key) => table.querySelector(`col[data-col="${key}"]`);

  /* Pin every column at its current rendered width and switch the table to
     fixed layout. Called on the first drag: without it the un-dragged columns
     would re-flow the moment one of them stops auto-sizing. */
  function freezeCols(table) {
    if (table.classList.contains("sized")) return;
    const ths = table.querySelectorAll("thead th[data-col]");
    const widths = {};
    ths.forEach((th) => {
      const key = th.dataset.col;
      if (key === "star") return;
      widths[key] = th.getBoundingClientRect().width;
    });
    Object.entries(widths).forEach(([k, px]) => {
      const c = colEl(table, k);
      if (c) c.style.width = `${Math.round(px)}px`;
    });
    Store.setColWidths(widths);
    table.classList.add("sized");
    table.style.width = `${sizedTableWidth()}px`;   // definite width — see .sized in styles.css
  }

  /* Re-fit one column to its widest cell: drop its pinned width, let auto
     layout size it from content for a frame, then re-pin at that measurement. */
  function autofitCol(table, key) {
    const col = colEl(table, key);
    const th = table.querySelector(`thead th[data-col="${key}"]`);
    if (!col || !th) return;
    const prev = col.style.width, prevTableW = table.style.width;
    // drop this column's pin *and* the table's definite width so auto layout
    // sizes the column from its content for one reflow
    col.style.width = "";
    table.style.width = "";
    table.classList.remove("sized");
    const natural = th.getBoundingClientRect().width;   // forces reflow
    table.classList.add("sized");
    if (!natural) {                                     // measurement failed — restore
      col.style.width = prev;
      table.style.width = prevTableW;
      return;
    }
    const px = Math.max(COL_MIN_W, Math.round(natural));
    col.style.width = `${px}px`;
    Store.setColWidths({ [key]: px });
    table.style.width = `${sizedTableWidth()}px`;
  }

  // A drag ends with a click landing on the header underneath, which would
  // otherwise read as a sort. Set on pointerup, consumed by the next click.
  let dragJustEnded = false;

  /* Header-edge drag -> live column resize. */
  function startColDrag(e, table) {
    const grip = e.target.closest(".col-grip");
    if (!grip) return;
    e.preventDefault();
    const key = grip.dataset.grip;
    freezeCols(table);
    const col = colEl(table, key);
    if (!col) return;
    const startX = e.clientX;
    const startW = parseFloat(col.style.width) || COL_MIN_W;
    // the table's width must track the drag too, or fixed layout redistributes
    // the difference across the other columns
    const otherW = (parseFloat(table.style.width) || 0) - startW;
    document.body.classList.add("col-resizing");

    const onMove = (ev) => {
      const w = Math.max(COL_MIN_W, Math.round(startW + ev.clientX - startX));
      col.style.width = `${w}px`;
      table.style.width = `${otherW + w}px`;
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.classList.remove("col-resizing");
      dragJustEnded = true;
      Store.setColWidths({ [key]: parseFloat(col.style.width) });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  /* ---------- column reordering ---------- */
  const REORDER_SLOP = 5;   // px of travel before a header press becomes a drag

  /* The header under `x`. DOM order matters: the star and ticker headers are
     sticky and float over their neighbours once scrolled right, so hit-testing
     them first is what keeps a drop onto the frozen pair from resolving to the
     column hidden underneath. */
  function headerAt(table, x) {
    const ths = Array.from(table.querySelectorAll("thead th[data-col]"));
    return ths.find((th) => {
      const r = th.getBoundingClientRect();
      return x >= r.left && x <= r.right;
    }) || null;
  }

  const clearDropMarks = (table) =>
    table.querySelectorAll(".drop-before, .drop-after")
      .forEach((el) => el.classList.remove("drop-before", "drop-after"));

  /* Header drag -> column reorder. Only commits past REORDER_SLOP px, so a
     plain click still falls through to the sort handler untouched. */
  function startColReorder(e, table, rerender) {
    const th = e.target.closest("thead th[data-col]");
    if (!th) return;
    const key = th.dataset.col;
    const keys = orderedCols().map((c) => c.key);
    if (keys.indexOf(key) < PINNED_COLS) return;   // star + ticker don't move

    const startX = e.clientX;
    let dragging = false, dropKey = null, dropAfter = false;

    const onMove = (ev) => {
      if (!dragging) {
        if (Math.abs(ev.clientX - startX) < REORDER_SLOP) return;
        dragging = true;
        document.body.classList.add("col-reordering");
        th.classList.add("col-drag-src");
      }
      clearDropMarks(table);
      dropKey = null;
      const target = headerAt(table, ev.clientX);
      if (!target || target === th) return;
      const tKey = target.dataset.col;
      if (keys.indexOf(tKey) < PINNED_COLS) return;   // can't drop ahead of the frozen pair
      const r = target.getBoundingClientRect();
      dropKey = tKey;
      dropAfter = ev.clientX > r.left + r.width / 2;
      target.classList.add(dropAfter ? "drop-after" : "drop-before");
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.classList.remove("col-reordering");
      th.classList.remove("col-drag-src");
      clearDropMarks(table);
      if (!dragging) return;
      // the drag's trailing click lands on a header — never treat it as a sort
      dragJustEnded = true;
      if (!dropKey) return;
      // pull the column out first, so the target's index below is already the
      // one it will have in the final array
      keys.splice(keys.indexOf(key), 1);
      keys.splice(keys.indexOf(dropKey) + (dropAfter ? 1 : 0), 0, key);
      Store.setColOrder(keys);
      rerender();
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  /* Drop any custom column layout — widths and order both — for the ⇔ button
     the Screener and Watchlist share. */
  function resetCols(rerender) {
    const custom = Object.keys(Store.getColWidths()).length || Store.getColOrder().length;
    if (!custom) { App.toast("Columns are already at their default layout", "ok"); return; }
    Store.resetColWidths();
    Store.resetColOrder();
    preserveScroll(rerender);
    App.toast("Columns reset to default order and widths", "ok");
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
    // --- column resize + reorder (must run before the click handler below
    // sees it) — the grip resizes its own column, the rest of the header drags
    // the column to a new position ---
    container.addEventListener("pointerdown", (e) => {
      // every click is preceded by a pointerdown, so clearing here keeps a
      // drag that ended off-table from swallowing an unrelated later click
      dragJustEnded = false;
      const table = e.target.closest("table.data");
      if (!table) return;
      if (e.target.closest(".col-grip")) startColDrag(e, table);
      else startColReorder(e, table, rerender);
    });
    container.addEventListener("dblclick", (e) => {
      const grip = e.target.closest(".col-grip");
      const table = e.target.closest("table.data");
      if (grip && table) { e.stopPropagation(); autofitCol(table, grip.dataset.grip); }
    });
    // Event delegation on the table catches clicks on the <th> OR any child
    // element inside it (e.g. the .arrow <span>), so closest() always resolves
    // to the header regardless of which pixel was clicked.
    container.addEventListener("click", (e) => {
      // a resize gesture is never a sort — the drag's trailing click lands on
      // whatever header the pointer finished over
      if (dragJustEnded) { dragJustEnded = false; return; }
      if (e.target.closest(".col-grip")) return;
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
        // Opens the list picker; it refreshes this star's glyph on save.
        openStarPicker(star.dataset.star, star);
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
        <button class="btn btn-sm" id="scr-refresh" title="Re-pull fresh data from Yahoo">↻ Refresh</button>
        <button class="btn btn-sm" id="scr-cols" title="Restore the default column order and auto-fit widths">⇔ Reset columns</button>
        <button class="btn btn-sm" id="scr-save">💾 Save as watchlist</button>
        <button class="btn btn-sm" id="scr-addall">★ Add all to stars</button>
      </div>
      ${legendBox()}
      <div class="table-wrap fill" id="scr-table"><div class="loading-box"><span class="spinner"></span> Fetching market data…</div></div>`;
    hydrateFlagLegend(root);

    const tableEl = root.querySelector("#scr-table");
    const sub = root.querySelector("#scr-sub");
    const statusEl = root.querySelector("#scr-status");
    const fi = root.querySelector("#scr-filter");
    fi.addEventListener("input", () => { filter = fi.value; paint(); });
    root.querySelector("#scr-refresh").addEventListener("click", () => {
      if (!tickers.length) { App.toast("Analyze some tickers first", "err"); return; }
      screener(root, tickers, { force: true });
    });
    root.querySelector("#scr-cols").addEventListener("click", () => resetCols(paint));
    root.querySelector("#scr-addall").addEventListener("click", () => {
      (lastRows || []).forEach((r) => { if (!r.error && !Store.inWatchlist(r.ticker)) Store.toggleWatch(r.ticker); });
      App.toast("Added to stars", "ok"); preserveScroll(paint);
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
      setChatContext("Screener", lastRows);
    }

    if (!tickers.length) {
      tableEl.innerHTML = `<div class="empty"><div class="big">▦</div>Enter tickers above and hit <b>Analyze</b>.<div class="hint">e.g. AAPL, MSFT, NVDA</div></div>`;
      sub.textContent = "";
      return;
    }
    sub.textContent = `${tickers.length} tickers`;
    App.setExportTickers(tickers);

    // Fetch only on explicit user action — Analyze (refresh) or ↻ Refresh
    // (force). Otherwise render from the browser cache, or show a hint; no
    // Yahoo data is pulled just by opening the app or switching tabs.
    if (!opts.refresh && !opts.force) {
      const hit = peekRows(tickers);
      if (hit) {
        lastRows = hit;
        paint();
        statusEl.innerHTML = `<span class="ok">✓</span> cached`;
      } else {
        tableEl.innerHTML = `<div class="empty"><div class="big">▦</div>Data not loaded.` +
          `<div class="hint">Press <b>Analyze</b> or <b>↻ Refresh</b> to fetch these ${tickers.length} tickers.</div></div>`;
        statusEl.innerHTML = "";
      }
      return;
    }

    function setStatus(p) {
      if (p.cached) { statusEl.innerHTML = `<span class="ok">✓</span> cached`; return; }
      if (p.done) {
        statusEl.innerHTML = p.failedBatches
          ? `<span class="err">⚠ ${p.failedBatches} of ${p.batches} batches failed — use ↻ Refresh to retry</span>`
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
          App.toast(`${lastP.failedBatches} of ${lastP.batches} batches failed — ↻ Refresh to retry`, "err");
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
    App.setExportTickers(sel.tickers);
    detail.innerHTML = `
      <div class="wl-detail-head">
        <span class="wl-detail-name">${escHTML(sel.name)}</span>
        <span class="view-sub">${sel.tickers.length} tickers</span>
        <span class="scr-status" id="wl-status"></span>
        <div class="spacer"></div>
        <input class="input wl-edit" id="wl-edit" placeholder="Tickers — e.g. AAPL, MSFT"
               title="Type one or more tickers (comma or space separated), then Add or Remove">
        <button class="btn btn-sm" id="wl-add" title="Add these tickers to the list">+ Add</button>
        <button class="btn btn-sm btn-ghost" id="wl-del" title="Remove these tickers from the list">− Remove</button>
        <button class="btn btn-sm" id="wl-cols" title="Restore the default column order and auto-fit widths">⇔ Reset columns</button>
        <button class="btn btn-sm" id="wl-refresh" title="Re-pull fresh data from Yahoo">↻ Refresh</button>
      </div>
      ${legendBox()}
      <div class="table-wrap fill" id="wl-table"></div>`;
    hydrateFlagLegend(detail);
    detail.querySelector("#wl-refresh").addEventListener("click", () => loadSelected(root, { force: true }));
    detail.querySelector("#wl-cols").addEventListener("click", () => resetCols(paint));

    // Bulk add/remove: parse the input like the top search box, mutate the
    // list (stars for ★ Starred, the saved list otherwise) and re-render.
    function editList(mode) {
      const input = detail.querySelector("#wl-edit");
      const arr = App.parseTickers(input.value);
      if (!arr.length) { App.toast("Enter one or more tickers", "err"); return; }
      const before = sel.tickers.slice();
      let after;
      if (id === STARRED_ID) {
        if (mode === "add") arr.forEach((t) => { if (!Store.inWatchlist(t)) Store.toggleWatch(t); });
        else arr.forEach((t) => Store.removeWatch(t));
        after = Store.getWatchlist();
      } else {
        const l = mode === "add" ? Store.addToList(id, arr) : Store.removeFromList(id, arr);
        if (!l) return;
        after = l.tickers;
      }
      // Carry cached rows over to the new set signature so the table stays
      // usable without a re-fetch; freshly added tickers are then fetched
      // automatically by the cache-first load below.
      const prev = peekRows(before);
      if (prev && after.length) {
        const byTicker = new Map(prev.map((r) => [r.ticker, r]));
        cacheSet(after.join(","), after.map((t) =>
          byTicker.get(t) || { ticker: t, error: "Not loaded — press ↻ Refresh" }));
      }
      const delta = Math.abs(after.length - before.length);
      if (delta) {
        App.toast(`${mode === "add" ? "Added" : "Removed"} ${delta} ticker${delta > 1 ? "s" : ""}`, "ok");
      } else {
        App.toast(mode === "add" ? "Already in the list" : "None of those are in the list", "err");
      }
      // re-render cards (counts) and restore the selection, without losing the
      // reader's place — editing tickers is a routine edit to a long list
      preserveScroll(() => watchlist(root));
    }
    detail.querySelector("#wl-add").addEventListener("click", () => editList("add"));
    detail.querySelector("#wl-del").addEventListener("click", () => editList("remove"));
    detail.querySelector("#wl-edit").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); editList("add"); }
    });

    const tableEl = detail.querySelector("#wl-table");
    const statusEl = detail.querySelector("#wl-status");
    if (!sel.tickers.length) {
      tableEl.innerHTML = `<div class="empty"><div class="hint">This watchlist is empty — add tickers above.</div></div>`;
      return;
    }
    let lastRows = null;
    function paint() {
      if (!lastRows) return;   // ⇔ Reset columns can fire before the first load lands
      const view = applyView(lastRows);
      tableEl.innerHTML = tableHTML(view);
      wireTable(tableEl, view, paint);
      setChatContext("Watchlist · " + sel.name, lastRows);
    }
    const spin = spinHTML;
    const finishStatus = (fetched, fromCache, failedBatches) => {
      statusEl.innerHTML = doneStatusHTML(sel.tickers.length, fetched, fromCache, failedBatches);
    };

    // Cache-first: show every ticker we already have data for immediately,
    // then fetch ONLY the missing ones. A full re-fetch happens exclusively
    // on an explicit ↻ Refresh.
    if (!opts.force) {
      const have = new Map();
      (assembleCachedRows(sel.tickers) || []).forEach((r) => {
        if (!r.error) have.set(r.ticker, r);
      });
      const missing = sel.tickers.filter((t) => !have.has(t));
      const fullKey = sel.tickers.join(",");
      // A per-ticker cache check can look "fully satisfied" from a snapshot
      // that predates an already-running full-set fetch (e.g. this exact list
      // was ↻ Refreshed, the user flipped to another list mid-fetch, and is
      // now back before it finished) — that stale snapshot must not be shown
      // as the final answer. Route through getScreenerRows in that case so it
      // joins the live fetch instead, and reflects its actual completion.
      const joiningLiveRefresh = !missing.length && inFlight.has(fullKey);
      lastRows = sel.tickers.map((t) =>
        have.get(t) || { ticker: t, error: "loading…" });
      paint();
      if (!missing.length && !joiningLiveRefresh) {
        cacheSet(fullKey, lastRows);   // exact-set hit next time
        finishStatus(0, have.size, 0);
        return;
      }
      const fetchTickers = joiningLiveRefresh ? sel.tickers : missing;
      statusEl.innerHTML = spin(joiningLiveRefresh
        ? "refreshing…"
        : `${have.size} cached · loading ${missing.length} more…`);
      let lastP = null;
      try {
        const rows = await getScreenerRows(fetchTickers, {
          onProgress: (p) => {
            if (wlSelected !== id) return;   // selection changed mid-stream
            lastP = p;
            const byT = new Map(p.rows.map((r) => [r.ticker, r]));
            lastRows = lastRows.map((r) => byT.get(r.ticker) || r);
            paint();
            statusEl.innerHTML = spin(joiningLiveRefresh
              ? `refreshing ${p.loaded}/${p.total}…`
              : `${have.size} cached · loading ${p.loaded}/${p.total} more…`);
          },
        });
        if (rows == null || wlSelected !== id) return;
        const byT = new Map(rows.map((r) => [r.ticker, r]));
        lastRows = lastRows.map((r) => byT.get(r.ticker) || r);
        paint();
        const failed = (lastP && lastP.failedBatches) || 0;
        if (!failed) cacheSet(fullKey, lastRows);
        finishStatus(joiningLiveRefresh ? sel.tickers.length : missing.length, have.size, failed);
      } catch (e) {
        statusEl.innerHTML = `<span class="err">⚠ ${e.message}</span>`;
      }
      return;
    }

    // Explicit ↻ Refresh: re-fetch the whole list fresh from Yahoo.
    tableEl.innerHTML = `<div class="loading-box"><span class="spinner"></span> Loading ${escHTML(sel.name)}…</div>`;
    let lastP = null;
    try {
      const rows = await getScreenerRows(sel.tickers, {
        refresh: true,
        force: true,
        onProgress: (p) => {
          if (wlSelected !== id) return;   // selection changed mid-stream
          lastP = p;
          lastRows = p.rows;
          paint();
          statusEl.innerHTML = spin(`refreshing ${p.loaded}/${p.total}…`);
        },
      });
      if (rows == null || wlSelected !== id) return;
      lastRows = rows;
      paint();
      finishStatus(sel.tickers.length, 0, (lastP && lastP.failedBatches) || 0);
    } catch (e) {
      statusEl.innerHTML = `<span class="err">⚠ ${e.message}</span>`;
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

    // Restore a still-valid selection after a re-render (rename/delete/nav
    // return) — from cache only, so returning to the tab never re-fetches.
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
        <span class="scr-status" id="dash-status"></span>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="dash-refresh" title="Re-pull fresh data from Yahoo">↻ Refresh</button></div>
      <div class="cards" id="dash-cards"></div>
      <div style="height:20px"></div>
      ${(wl.length || last.length) ? legendBox() : ""}
      <div class="panel fill">
        <div class="panel-head"><span class="dot"></span>${wl.length ? "Watchlist" : "Recently analyzed"}</div>
        <div class="table-wrap" style="border:0" id="dash-table"></div>
      </div>`;
    hydrateFlagLegend(root);
    root.querySelector("#dash-refresh").addEventListener("click", () => dashboard(root, { force: true }));
    const set = wl.length ? wl : last;
    // ⭳ Export must cover every row the table shows, which is the watchlist
    // whenever there is one — not the last-analyzed set App would fall back to.
    App.setExportTickers(set);
    const tableEl = root.querySelector("#dash-table");
    const cardsEl = root.querySelector("#dash-cards");
    const statusEl = root.querySelector("#dash-status");
    if (!set.length) {
      cardsEl.innerHTML = "";
      tableEl.innerHTML = `<div class="empty"><div class="big">◧</div>Welcome to Bibes Terminal.<div class="hint">Type tickers up top and press Analyze, or build a watchlist.</div></div>`;
      return;
    }
    let lastRows = null;
    function paint() {
      const ok = lastRows.filter((r) => !r.error);
      const totalMcap = ok.reduce((s, r) => s + (r.market_cap || 0), 0);
      const gainers = ok.filter((r) => (r.change_pct || 0) > 0).length;
      const avgPe = (() => { const v = ok.map((r) => r.pe).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; })();
      cardsEl.innerHTML = `
        ${card("Tracked", ok.length, "stocks")}
        ${card("Total Mkt Cap", Fmt.big(totalMcap, "USD"), "combined")}
        ${card("Advancing", `${gainers}/${ok.length}`, "positive today")}
        ${card("Avg P/E", avgPe != null ? avgPe.toFixed(1) : "N/A", "trailing")}`;
      const view = applyView(lastRows);
      tableEl.innerHTML = tableHTML(view);
      wireTable(tableEl, view, paint);
      setChatContext("Dashboard", lastRows);
    }
    const mergeInto = (fetched) => {
      const byT = new Map(fetched.map((r) => [r.ticker, r]));
      lastRows = lastRows.map((r) => byT.get(r.ticker) || r);
    };

    // Cache-first: render every ticker we already have data for immediately,
    // then fetch ONLY the missing ones. A full re-fetch happens exclusively
    // on an explicit ↻ Refresh.
    if (!opts.force) {
      const have = new Map();
      (assembleCachedRows(set) || []).forEach((r) => {
        if (!r.error) have.set(r.ticker, r);
      });
      const missing = set.filter((t) => !have.has(t));
      const fullKey = set.join(",");
      // See the identical comment in loadSelected: a per-ticker cache check
      // can look "fully satisfied" from a snapshot that predates an
      // already-running full-set fetch (e.g. ↻ Refresh, then navigate away
      // and back before it finishes) — join that live fetch instead of
      // trusting the stale snapshot as final.
      const joiningLiveRefresh = !missing.length && inFlight.has(fullKey);
      lastRows = set.map((t) => have.get(t) || { ticker: t, error: "loading…" });
      paint();
      if (!missing.length && !joiningLiveRefresh) {
        cacheSet(fullKey, lastRows);
        statusEl.innerHTML = doneStatusHTML(set.length, 0, have.size, 0);
        return;
      }
      const fetchTickers = joiningLiveRefresh ? set : missing;
      statusEl.innerHTML = spinHTML(joiningLiveRefresh
        ? "refreshing…"
        : `${have.size} cached · loading ${missing.length} more…`);
      let lastP = null;
      try {
        const rows = await getScreenerRows(fetchTickers, {
          onProgress: (p) => {
            lastP = p;
            mergeInto(p.rows);
            paint();
            statusEl.innerHTML = spinHTML(joiningLiveRefresh
              ? `refreshing ${p.loaded}/${p.total}…`
              : `${have.size} cached · loading ${p.loaded}/${p.total} more…`);
          },
        });
        if (rows == null) return;   // superseded
        mergeInto(rows);
        paint();
        const failed = (lastP && lastP.failedBatches) || 0;
        if (!failed) cacheSet(fullKey, lastRows);
        statusEl.innerHTML = doneStatusHTML(set.length, joiningLiveRefresh ? set.length : missing.length, have.size, failed);
      } catch (e) {
        statusEl.innerHTML = `<span class="err">⚠ ${e.message}</span>`;
      }
      return;
    }

    // Explicit ↻ Refresh: re-fetch the whole set fresh from Yahoo.
    tableEl.innerHTML = `<div class="loading-box"><span class="spinner"></span> Loading…</div>`;
    let lastP = null;
    try {
      const rows = await getScreenerRows(set, {
        refresh: true,
        force: true,
        onProgress: (p) => {
          lastP = p;
          lastRows = p.rows;
          paint();
          statusEl.innerHTML = spinHTML(`refreshing ${p.loaded}/${p.total}…`);
        },
      });
      if (rows == null) return;   // superseded
      lastRows = rows;
      paint();
      statusEl.innerHTML = doneStatusHTML(set.length, set.length, 0, (lastP && lastP.failedBatches) || 0);
    } catch (e) {
      statusEl.innerHTML = `<span class="err">⚠ ${e.message}</span>`;
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
    setChatContext("Calendar", []);   // events, not stock rows — no snapshot
    const ranges = [["1w", "Next 7 days"], ["2w", "Next 14 days"], ["1m", "Next 30 days"]];
    root.innerHTML = `
      <div class="view-head">
        <div class="view-title">Calendar</div>
        <div class="view-sub" id="cal-sub"></div>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="cal-refresh" title="Re-pull fresh data from Yahoo">↻ Refresh</button>
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
      <div class="table-wrap fill" id="cal-table"><div class="loading-box"><span class="spinner"></span> Loading calendar…</div></div>`;

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
    setChatContext("Settings", []);
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

  /* ===================== ANALYST CHAT — TAB CONTEXT ==================== */
  // Row keys stripped before the chat agent sees them: chart arrays and the
  // derivation blobs are big and carry nothing extra (scores/verdicts/flags
  // stay). The FAB widget (window.ChatWidget) reads getChatContext() when the
  // user sends a message, so it always analyses whatever tab they're on.
  const CHAT_SKIP_KEYS = new Set([
    "spark_6mo", "spark_1y", "spark_5y",
    "strategy_1_detail", "strategy_2_detail", "strategy_3_detail",
  ]);

  let chatContext = { label: "", rows: [] };

  /* Publish the active tab's rows as chat context: drop error/loading rows
     and heavy keys, round nothing (already numbers). The widget's header
     updates live via ChatWidget.contextChanged(). */
  function setChatContext(label, rows) {
    const slim = (rows || [])
      .filter((r) => r && !r.error && r.ticker)
      .map((r) => {
        const o = {};
        for (const [k, v] of Object.entries(r)) {
          if (!CHAT_SKIP_KEYS.has(k) && v !== null && v !== "") o[k] = v;
        }
        return o;
      });
    chatContext = { label, rows: slim };
    if (window.ChatWidget) window.ChatWidget.contextChanged();
  }
  function getChatContext() { return chatContext; }

  return { screener, watchlist, dashboard, calendar, settings,
           getChatContext, COLS, PANEL_TIPS, updateCachedRow, gradePayload,
           openStarPicker, preserveScroll };
})();

/* =================== DEEP DIVE OVERLAY ===================== */
const DeepDive = (() => {
  const elOverlay = () => document.getElementById("deepdive");
  let current = null;

  // HTML-escape helper — the Views IIFE has its own; this one keeps the two
  // modules independent (DeepDive can't see Views' module-scoped consts).
  const escHTML = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

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
  // Revenue/Share ($) drawn as a line on the revenue chart's right axis. Its
  // shape tracks revenue, but diverges when the share count changes — a flat or
  // falling line under rising revenue reveals dilution outrunning growth.
  const FIN_LINES = [
    { key: "revenue_per_share", label: "Revenue/Share", color: "#db61a2", swatch: "#db61a2",
      desc: "Fiscal-year revenue ÷ shares outstanding (right axis). Per-share sales power: rising means growth is compounding faster than dilution; falling means dilution is eating into it. Statement-derived, so it can differ from the TTM Revenue/Share in the Profitability panel (Yahoo derives that one itself)." },
  ];
  // Year-over-year growth bars (%) per year, shown in their own panel.
  const GROWTH_SERIES = [
    { key: "revenue_growth", label: "Revenue", color: "accent", swatch: "var(--accent)",
      desc: "Year-over-year growth in total revenue." },
    { key: "eps_growth", label: "Diluted EPS Growth", color: "#2f81f7", swatch: "#2f81f7",
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
  // The share bar is built per-render by shareBars() below, since its label
  // depends on which balance-sheet row the backend found.
  const SHARE_BARS_TAIL = [
    { key: "treasury_shares", label: "Treasury Shares", color: "#5b6f86", swatch: "#5b6f86",
      desc: "Repurchased shares held by the company (often ~0 when bought-back shares are retired)." },
  ];
  // The share bars are outstanding shares, except for the rare ticker where
  // Yahoo has neither an outstanding row nor a treasury row to reconstruct one
  // from — there the bars are issued shares (treasury included, so the level
  // runs high) and say so. basis "derived" needs no caveat: it is outstanding
  // shares, reconstructed exactly. See _shares_outstanding_series in app.py.
  function shareBars(basis) {
    const issued = basis === "issued";
    return [{
      key: "shares_outstanding",
      label: issued ? "Shares Issued" : "Shares Outstanding",
      color: "accent", swatch: "var(--accent)",
      desc: issued
        ? "Shares ISSUED — Yahoo has no shares-outstanding row for this ticker and no treasury row to net off, so these bars count any shares the company holds in treasury and the level may overstate the true outstanding count. The trend still reads normally: falling = buybacks, rising = dilution."
        : "Shares outstanding. Falling = buybacks (each share owns more); rising = dilution.",
    }, ...SHARE_BARS_TAIL];
  }
  const SHARE_LINES = [
    // EPS ($/share) rides its own private scale (indep) so it can sit among the
    // % lines without distorting their right axis; its $ value shows on hover.
    { key: "eps", label: "Diluted EPS ($)", color: "#a371f7", swatch: "#a371f7", indep: true,
      desc: "Fiscal-year diluted earnings per share (statement-derived). The counterpart to the dilution bars: EPS rising while the share count holds or falls is per-share earnings compounding; EPS lagging a growing share count is dilution eating into it. Drawn on its own scale (no axis label) — hover for the value." },
    { key: "div_yield", label: "Dividend Yield %", color: "#e3b341", swatch: "#e3b341",
      desc: "Historical dividend yield — annual dividends ÷ year-end price." },
    { key: "payout_ratio", label: "Payout Ratio %", color: "#db61a2", swatch: "#db61a2",
      desc: "Dividends as a share of earnings, per year." },
  ];
  // ROIC vs Cost of Capital panel: historical ROIC bars against the per-year
  // WACC line — both on the SAME %-axis (sharedAxis), so a bar clearing the
  // line reads directly as value creation that year.
  const ROIC_WACC_BARS = [
    { key: "roic", label: "ROIC", color: "accent", swatch: "var(--accent)",
      desc: "Return on Invested Capital for that fiscal year — after-tax operating profit ÷ (debt + equity), computed from that year's own statement figures." },
  ];
  const ROIC_WACC_LINES = [
    { key: "wacc", label: "WACC (cost of capital)", color: "#e3b341", swatch: "#e3b341",
      desc: "Weighted-average cost of capital reconstructed for each fiscal year, so the spread against ROIC can be read historically — is it consistently positive/widening, or eroding? Every input is that year's own: the risk-free rate is the 10Y Treasury as of that year-end, the debt/equity weights come from that year's market cap and total debt, the cost of debt from that year's interest expense ÷ debt, and the tax rate from that year's pretax/tax. The one exception is beta, which Yahoo reports only as a single current value (a true historical beta would need a per-period market regression); it is held constant across the years — the least time-variable input — so the line still tracks the drivers that actually move, chiefly interest rates and leverage. The rightmost year is pinned to the current WACC shown elsewhere in the app so the two reconcile." },
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

  // `hint` renders small print under the title — for a panel whose *contents*
  // need explaining, not just its rows (the mortgage-REIT panel, whose whole
  // point is which metrics are deliberately absent).
  function panel(title, obj, fmtMap, hint, valueTips) {
    const rows = Object.entries(obj).map(([k, v]) => {
      let disp;
      if (v === null || v === undefined) disp = Fmt.na;
      else if (typeof v === "string") disp = v;
      else {
        const f = fmtMap && fmtMap[k];
        // Fallback for any key not given a custom formatter: a label ending in
        // "%" always carries a pre-multiplied percentage value (see app.py), so
        // append the sign here rather than relying on every fmtMap to remember
        // it — the gap this closes is exactly why some panel rows previously
        // showed a bare number next to a "... %" label.
        disp = f ? f(v) : (k.trim().endsWith("%") ? Fmt.num(v, 2) + "%" : Fmt.num(v));
        if (disp === null) disp = Fmt.na;
      }
      let cls = "";
      if (/Growth|Yield|Margin|ROE|ROA|ROIC|ROCE/.test(k) && typeof v === "number") cls = v >= 0 ? "pos" : "neg";
      if (k === "DCF Upside %" && typeof v === "number") cls = v >= 0 ? "pos" : "neg";
      if (k === "FCF Coverage" && typeof v === "number") cls = v >= 1.2 ? "pos" : v >= 0.8 ? "amber" : "neg";
      if (typeof v === "string" && / \/ 100/.test(v)) {   // strategy-grade rows
        cls = /Advance|Compounder|Value candidate/.test(v) ? "pos"
          : /Watchlist|Quality watch|Fair/.test(v) ? "amber"
          : /Discard|Pass|Expensive/.test(v) ? "neg" : "";
      }
      const tip = Views.PANEL_TIPS[k];
      const tipAttr = tip ? ` data-tip="${tip.replace(/"/g, "&quot;")}"` : "";
      const kCls = tip ? "k has-tip" : "k";
      // Optional hover on the value itself (not the label) — e.g. the reporting-
      // currency DCF figure behind an FX-converted DCF Value.
      const vTip = valueTips && valueTips[k];
      const vAttr = vTip ? ` data-tip="${vTip.replace(/"/g, "&quot;")}"` : "";
      const vCls = "v " + cls + (vTip ? " has-tip" : "");
      return `<div class="kv-row"><span class="${kCls}"${tipAttr}>${k}</span><span class="${vCls.trim()}"${vAttr}>${disp}</span></div>`;
    }).join("");
    const noteHTML = hint ? `<div class="panel-note">${hint}</div>` : "";
    return `<div class="panel"><div class="panel-head"><span class="dot"></span>${title}</div>${noteHTML}<div class="kv">${rows}</div></div>`;
  }

  // Which grade key each Strategy Ratings row corresponds to, for gradePayload.
  const STRAT_GRADE_KEY = {
    "S1 · Triage": "1", "S2 · Compounder": "2",
    "S3 · Defensive Value": "3", "Min · All Strategies": "min",
  };

  // Strategy Ratings panel: same text as the generic panel(), but the S1/S2/
  // S3/Min values get the identical per-pillar derivation tooltip shown on the
  // Screener/Watchlist grade cells (built from strategy_raw — the same field
  // shape as a screener row — via Views.gradePayload). Views' document-level
  // [data-grade] hover listener picks these up automatically; no separate
  // tooltip wiring needed here. S1 Flags gets the screener's plain multi-line
  // flag-list tooltip instead (flags have no pillar breakdown of their own).
  function strategyPanelHTML(d) {
    const obj = d.panels.strategies || {};
    const raw = d.strategy_raw || {};
    const rows = Object.entries(obj).map(([k, v]) => {
      const disp = v == null ? Fmt.na : escHTML(v);
      let cls = "";
      if (typeof v === "string") {
        cls = /Advance|Compounder|Value candidate/.test(v) ? "pos"
          : /Watchlist|Quality watch|Fair/.test(v) ? "amber"
          : /Discard|Pass|Expensive/.test(v) ? "neg" : "";
      }
      const tip = Views.PANEL_TIPS[k];
      const tipAttr = tip ? ` data-tip="${tip.replace(/"/g, "&quot;")}"` : "";
      const kCls = tip ? "k has-tip" : "k";

      let vAttrs = "", vCls = `v ${cls}`;
      const which = STRAT_GRADE_KEY[k];
      const payload = which ? Views.gradePayload(which, raw) : null;
      if (payload) {
        vAttrs = ` data-grade="${escHTML(JSON.stringify(payload))}"`;
        vCls += " has-tip";
      } else if (k === "S1 · Flags" && v) {
        const full = String(v).replace(/ · /g, "\n");
        vAttrs = ` data-tip="${escHTML(full)}"`;
        vCls += " has-tip";
      }
      return `<div class="kv-row"><span class="${kCls}"${tipAttr}>${escHTML(k)}</span>` +
        `<span class="${vCls}"${vAttrs}>${disp}</span></div>`;
    }).join("");
    return `<div class="panel"><div class="panel-head"><span class="dot"></span>Strategy Ratings</div><div class="kv">${rows}</div></div>`;
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
    // Statement-derived figures (revenue, cash, debt, EBITDA, net income, FCF,
    // book value, etc.) are reported in `financial_currency`, which usually
    // matches `cur` but diverges for foreign-reporting tickers like ADRs
    // (e.g. WIT trades in USD, reports in INR) — see app.py's _screener_row.
    const finCur = d.financial_currency || cur;
    const big = (v) => Fmt.cell(v, (x) => Fmt.big(x, cur));
    const fmtMaps = {
      valuation: { "Market Cap": (v) => Fmt.big(v, cur), "Enterprise Value": (v) => Fmt.big(v, finCur), "DCF Value": (v) => Fmt.price(v, cur), "DCF Upside %": (v) => (v >= 0 ? "+" : "") + Fmt.num(v, 1) + "%", "Diluted EPS": (v) => Fmt.price(v, cur), "Basic EPS": (v) => Fmt.price(v, finCur) },
      dividend: { "Dividend Rate": (v) => Fmt.price(v, cur), "Dividend TTM": (v) => Fmt.price(v, finCur), "FCF Coverage": (v) => Fmt.num(v) + "×", "Years ▲ Dividend": (v) => String(Math.round(v)) },
      profitability: { "Revenue": (v) => Fmt.big(v, finCur), "Operating Income": (v) => Fmt.big(v, finCur), "Net Income": (v) => Fmt.big(v, finCur), "Revenue/Share": (v) => Fmt.price(v, finCur), "ROIC %": (v) => Fmt.num(v, 1) + "%", "ROCE %": (v) => Fmt.num(v, 1) + "%", "WACC %": (v) => Fmt.num(v, 1) + "%", "ROIC − WACC %": (v) => Fmt.num(v, 1) + "%" },
      health: { "Total Cash": (v) => Fmt.big(v, finCur), "Total Debt": (v) => Fmt.big(v, finCur), "Total Equity": (v) => Fmt.big(v, finCur), "Operating Cash Flow": (v) => Fmt.big(v, finCur), "Capital Expenditure": (v) => Fmt.big(v, finCur), "Free Cash Flow": (v) => Fmt.big(v, finCur), "EBITDA": (v) => Fmt.big(v, finCur), "Debt/EBITDA": (v) => Fmt.num(v, 2) + "×", "EBITDA/FCF": (v) => Fmt.num(v, 2) + "×",
        // percentage-point metrics whose label has no trailing "%" (mirrors
        // app.py's _DD_PCT_LABELS, which the Excel export already treats this way)
        "Debt/Equity": (v) => Fmt.num(v, 1) + "%", "Debt/Equity (MRQ)": (v) => Fmt.num(v, 1) + "%", "LT Debt/Equity": (v) => Fmt.num(v, 1) + "%" },
      risk: {
        "Beta": (v) => Fmt.num(v, 2),
        "Days to Cover": (v) => Fmt.num(v, 2),
        "Altman Z-Score": (v) => Fmt.num(v, 2),
        "Piotroski F-Score": (v) => `${Math.round(v)} / 9`,
      },
      reit: {
        "FFO": (v) => Fmt.big(v, finCur), "FFO/Share": (v) => Fmt.price(v, finCur),
        "P/FFO": (v) => Fmt.num(v, 2), "FFO Coverage": (v) => Fmt.num(v, 2) + "×",
        "Book Value/Share": (v) => Fmt.price(v, finCur), "Price/Book": (v) => Fmt.num(v, 2),
        "Net Income": (v) => Fmt.big(v, finCur), "Div Coverage (NI)": (v) => Fmt.num(v, 2) + "×",
      },
    };
    const chg = d.change_pct;
    const chgTxt = chg == null ? "" : `<span class="${chg >= 0 ? "pos" : "neg"}">${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%</span>`;

    // Mirror the table's three-state star so the drilldown button never lies
    // about ★ Starred vs. a silver "saved elsewhere" list. Clicking opens the
    // same watchlist picker as the table star (openStarPicker), not a plain
    // toggle — so you can pick which lists to save into from here too.
    const ddStarHTML = () => {
      const starred = Store.inWatchlist(ticker);
      const other = !starred && Store.inAnyList(ticker);
      const cls = starred ? "on" : other ? "on-other" : "";
      const glyph = starred || other ? "★" : "☆";
      const label = starred ? "Watching" : other ? "Saved" : "Watch";
      return `<span class="star-btn ${cls}" style="font-size:inherit">${glyph}</span> ${label}`;
    };

    // For a mismatched-currency ticker (trades in `cur`, reports in `finCur`),
    // DCF Value is shown in the trading currency so it sits next to Price — but
    // the model runs on `finCur` statement figures. Hover the value to see the
    // unconverted reporting-currency figure, so it isn't mistaken for one.
    const valuationValueTips = {};
    if (finCur !== cur && d.dcf_value_native != null) {
      valuationValueTips["DCF Value"] =
        `${Fmt.price(d.dcf_value_native, finCur)} in the reporting currency (${finCur}). `
        + `The DCF is computed from ${finCur} statement figures, then converted to ${cur} to compare against Price.`;
    }
    // Market Cap is shown in the trading currency (${cur}), but Enterprise Value,
    // Total Cash and Total Debt are all reported in ${finCur}. So the EV bridge
    // (mkt cap + debt − cash) can't be checked by eye from the on-screen numbers.
    // Surface the ${finCur}-converted market cap on hover — the figure EV is
    // actually built from — so the arithmetic reconciles.
    if (finCur !== cur && d.market_cap_native != null) {
      valuationValueTips["Market Cap"] =
        `${Fmt.big(d.market_cap_native, finCur)} in the reporting currency (${finCur}). `
        + `Enterprise Value is built from this figure: ${finCur} market cap + total debt − total cash.`;
    }

    ov.querySelector(".dd-top").innerHTML = `
      <span class="dd-back" id="dd-back">‹ Back</span>
      <span class="dd-title">${ticker}</span>
      <span class="dd-name">${d.name || ""} · ${d.exchange || ""} ${d.sector ? "· " + d.sector : ""}</span>
      <span class="dd-price">${Fmt.cell(d.price, (v) => Fmt.price(v, cur))} ${chgTxt}</span>
      <button class="btn btn-sm" id="dd-refresh" title="Re-pull fresh data from Yahoo">↻ Refresh</button>
      <button class="btn btn-sm" id="dd-export" title="Export ${ticker} to Excel">⭳ Export</button>
      ${d.dcf_value != null ? `<button class="btn btn-sm" id="dd-export-dcf" title="Export the full DCF valuation for ${ticker} — every input, the WACC breakdown, the 10-year projection table, and the valuation bridge">⭳ DCF</button>` : ""}
      <button class="btn btn-sm" id="dd-star" title="Save to watchlists">${ddStarHTML()}</button>`;
    document.getElementById("dd-back").addEventListener("click", close);
    document.getElementById("dd-refresh").addEventListener("click", () => open(ticker, { refresh: true }));
    document.getElementById("dd-star").addEventListener("click", async () => {
      await Views.openStarPicker(ticker, null);
      document.getElementById("dd-star").innerHTML = ddStarHTML();
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
    const dcfBtn = document.getElementById("dd-export-dcf");
    if (dcfBtn) dcfBtn.addEventListener("click", async () => {
      const old = dcfBtn.textContent;
      dcfBtn.disabled = true;
      dcfBtn.innerHTML = `<span class="spinner" style="width:12px;height:12px"></span> Exporting…`;
      try { await API.exportDcf(ticker); App.toast(`Exported ${ticker} DCF to .xlsx`, "ok"); }
      catch (e) { App.toast(e.message, "err"); }
      finally { dcfBtn.disabled = false; dcfBtn.textContent = old; }
    });

    ov.querySelector(".dd-body").innerHTML = `
      <div class="dd-grid">
        <div class="col-3">${panel("Valuation", d.panels.valuation, fmtMaps.valuation, undefined, valuationValueTips)}</div>
        <div class="col-3">${panel("Dividend", d.panels.dividend, fmtMaps.dividend)}</div>
        <div class="col-3">${panel("Profitability", d.panels.profitability, fmtMaps.profitability)}</div>
        <div class="col-3">${panel("Financial Health", d.panels.health, fmtMaps.health)}</div>
        ${d.panels.reit ? `<div class="col-3">${panel(
            d.reit_kind === "mortgage" ? "Mortgage REIT Metrics" : "REIT Metrics",
            d.panels.reit, fmtMaps.reit,
            d.reit_kind === "mortgage"
              ? "No FFO: this REIT owns securities, not depreciable buildings, so there is no depreciation to add back. Book value is the metric that matters here."
              : "")}</div>` : ""}

        <div class="col-6">${profilePanelHTML(d)}</div>
        <div class="col-6"><div class="panel" id="dd-wiki">
          <div class="panel-head"><span class="dot"></span>Ethics &amp; Controversies
            <span class="hint" style="margin-left:auto;font-weight:400">from Wikipedia — community-written, verify independently</span></div>
          <div class="chart-box" style="padding:0"><div class="loading-box"><span class="spinner"></span></div></div>
        </div></div>

        <div class="col-6"><div class="panel">
          <div class="panel-head"><span class="dot"></span>Price
            <div class="range-tabs" id="dd-ranges" style="margin-left:auto"></div></div>
          <div class="chart-toolbar"><div class="range-tabs" id="dd-smas"></div></div>
          <div class="chart-box" id="dd-price"><div class="loading-box"><span class="spinner"></span></div></div>
        </div></div>

        <div class="col-6"><div class="panel">
          <div class="panel-head"><span class="dot"></span>Revenue · Profit · Net Income · FCF<span class="hint" style="margin-left:auto;font-weight:400">bars: $ (left) · line: Revenue/Share (right) · hover margins for %</span></div>
          <div class="chart-legend">${legendItems(FIN_SERIES) + legendItems(FIN_LINES, true)}</div>
          <div class="chart-box" id="dd-revni"></div>
        </div></div>

        <div class="col-6"><div class="panel">
          <div class="panel-head"><span class="dot"></span>Growth · YoY % (last 5Y)<span class="hint" style="margin-left:auto;font-weight:400">bars: YoY % (left) · line: EBITDA margin % (right)</span></div>
          <div class="chart-legend">${legendItems(GROWTH_SERIES) + legendItems(GROWTH_LINES, true)}</div>
          <div class="chart-box" id="dd-growth"></div>
        </div></div>

        <div class="col-6"><div class="panel">
          <div class="panel-head"><span class="dot"></span>Share Dilution · last 5Y<span class="hint" style="margin-left:auto;font-weight:400">${
            d.share_dilution_basis === "issued"
              ? `<span style="color:#e3b341">⚠ bars are issued shares — may include treasury</span>`
              : "bars: shares · lines: % (right)"}</span></div>
          <div class="chart-legend">${legendItems(shareBars(d.share_dilution_basis)) + legendItems(SHARE_LINES, true)}</div>
          <div class="chart-box" id="dd-dilution"></div>
        </div></div>

        <div class="col-6"><div class="panel">
          <div class="panel-head"><span class="dot"></span>ROIC vs Cost of Capital · last 5Y<span class="hint" style="margin-left:auto;font-weight:400">bars: historical ROIC · line: historical WACC (hover for how)</span></div>
          <div class="chart-legend">${legendItems(ROIC_WACC_BARS) + legendItems(ROIC_WACC_LINES, true)}</div>
          <div class="chart-box" id="dd-roic-wacc"></div>
        </div></div>

        ${d.panels.strategies ? `<div class="col-6">${strategyPanelHTML(d)}</div>` : ""}
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

    // revenue · margins · net income · fcf — all $ bars; margins show % on hover.
    // Revenue/Share rides the right axis as a per-share $ line.
    Charts.bars(document.getElementById("dd-revni"), d.revenue_net_income, FIN_SERIES,
      { height: 230, lines: FIN_LINES, y2Fmt: (v) => Fmt.price(v, finCur) });

    // year-over-year growth bars, grouped by year (last 5Y) + EBITDA margin line
    Charts.bars(document.getElementById("dd-growth"), d.growth || [],
      GROWTH_SERIES, { height: 230, yFmt: pctAxis, lines: GROWTH_LINES, y2Fmt: pct1Axis });

    // share dilution — share counts ($-axis bars) + EPS ($, own scale) and
    // yield/payout (% lines). EPS gets a currency-aware tooltip formatter here,
    // where finCur is in scope.
    const shareLines = SHARE_LINES.map((s) =>
      s.key === "eps" ? { ...s, fmt: (v) => Fmt.price(v, finCur) } : s);
    Charts.bars(document.getElementById("dd-dilution"), d.share_dilution || [],
      shareBars(d.share_dilution_basis), { height: 230, lines: shareLines, y2Fmt: pct1Axis });

    // historical ROIC bars against the per-year cost-of-capital line, both on
    // the same %-axis (sharedAxis). Each roic_history row now carries its own
    // `wacc` for that fiscal year (see _period_wacc in app.py), so the line
    // tracks how the cost of capital actually moved rather than sitting flat.
    Charts.bars(document.getElementById("dd-roic-wacc"), d.roic_history || [],
      ROIC_WACC_BARS, { height: 230, yFmt: pctAxis, lines: ROIC_WACC_LINES, y2Fmt: pctAxis, sharedAxis: true });

    // price chart (candlesticks) with range tabs — mirrors the Settings range
    // options, and always includes the configured default so it renders as an
    // active tab. SMA overlay chips re-render from the already-fetched points
    // (the backend sends sma20/50/200 with every history response); the
    // active set persists in Settings across stocks and reloads.
    const RANGES = ["1mo", "6mo", "1y", "2y", "5y", "max"];
    const SMA_DEFS = [
      { key: "sma20", label: "SMA 20", color: "#f5a623" },
      { key: "sma50", label: "SMA 50", color: "#2f81f7" },
      { key: "sma200", label: "SMA 200", color: "#a371f7" },
    ];
    const def = Store.getSettings().range || "1y";
    const ranges = RANGES.includes(def) ? RANGES : [...RANGES, def];
    const rt = document.getElementById("dd-ranges");
    rt.innerHTML = ranges.map((r) => `<span class="chip ${r === def ? "active" : ""}" data-r="${r}">${r}</span>`).join("");
    let lastHist = null;
    function renderPrice() {
      if (!lastHist) return;
      const active = Store.getSettings().smas || [];
      Charts.candles(document.getElementById("dd-price"), lastHist.points,
        { height: 260, smas: SMA_DEFS.filter((s) => active.includes(s.key)) });
    }
    async function loadPrice(r) {
      const box = document.getElementById("dd-price");
      box.innerHTML = `<div class="loading-box"><span class="spinner"></span></div>`;
      try { lastHist = await API.history(ticker, r); renderPrice(); }
      catch (e) { lastHist = null; box.innerHTML = `<div class="empty">${e.message}</div>`; }
    }
    rt.querySelectorAll("[data-r]").forEach((c) => c.addEventListener("click", () => {
      rt.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active"); loadPrice(c.dataset.r);
    }));
    const st = document.getElementById("dd-smas");
    function renderSmaChips() {
      const active = Store.getSettings().smas || [];
      st.innerHTML = SMA_DEFS.map((s) =>
        `<span class="chip ${active.includes(s.key) ? "active" : ""}" data-s="${s.key}">` +
        `<i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${s.color};margin-right:5px;vertical-align:baseline"></i>${s.label}</span>`).join("");
      st.querySelectorAll("[data-s]").forEach((c) => c.addEventListener("click", () => {
        const cur = new Set(Store.getSettings().smas || []);
        cur.has(c.dataset.s) ? cur.delete(c.dataset.s) : cur.add(c.dataset.s);
        Store.setSetting("smas", SMA_DEFS.map((s) => s.key).filter((k) => cur.has(k)));
        renderSmaChips(); renderPrice();
      }));
    }
    renderSmaChips();
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
    // ethics & controversies from Wikipedia (independent fetch, cached server-side)
    loadWiki(ticker);
  }

  // Company Profile panel: what the company is and does, where it's based —
  // qualitative context only; the financial numbers live in the other panels.
  function profilePanelHTML(d) {
    const site = d.website
      ? `<a href="${escHTML(d.website)}" target="_blank" rel="noopener noreferrer">` +
        `${escHTML(String(d.website).replace(/^https?:\/\/(www\.)?/, ""))}</a>` : Fmt.na;
    const emp = d.employees != null
      ? Math.round(d.employees).toLocaleString() : Fmt.na;
    const facts =
      kvRow("Headquarters", d.hq ? escHTML(d.hq) : Fmt.na) +
      kvRow("Website", site) +
      kvRow("Employees", emp) +
      kvRow("Sector · Industry",
        [d.sector, d.industry].filter(Boolean).map(escHTML).join(" · ") || Fmt.na) +
      kvRow("Exchange", d.exchange ? escHTML(d.exchange) : Fmt.na);
    const desc = d.summary
      ? `<div class="dd-profile-text">${escHTML(d.summary)}</div>`
      : `<div class="hint" style="padding:10px 14px">No business description available.</div>`;
    return `<div class="panel">
      <div class="panel-head"><span class="dot"></span>Company Profile</div>
      ${desc}<div class="kv" style="padding:0 14px 10px">${facts}</div>
    </div>`;
  }

  async function loadWiki(ticker) {
    const panelEl = document.getElementById("dd-wiki");
    if (!panelEl) return;
    const box = panelEl.querySelector(".chart-box");
    try {
      const w = await API.companyProfile(ticker);
      if (current !== ticker) return;
      box.innerHTML = wikiHTML(w);
    } catch (e) {
      box.innerHTML = `<div class="empty"><div class="hint">${e.message}</div></div>`;
    }
  }

  function wikiHTML(w) {
    const link = w.url
      ? `<a href="${escHTML(w.url)}" target="_blank" rel="noopener noreferrer">` +
        `${escHTML(w.title)} on Wikipedia →</a>` : "";
    if (w.error) {
      return `<div class="empty"><div class="hint">${escHTML(w.error)}` +
        `${link ? " · " + link : ""}</div></div>`;
    }
    if (!w.sections.length) {
      return `<div class="empty"><div class="hint">No controversy or ethics sections ` +
        `on the company's Wikipedia article.${link ? "<br>" + link : ""}</div></div>`;
    }
    const block = (b) =>
      b.t === "h" ? `<div class="dd-wiki-sub">${escHTML(b.s)}</div>`
      : b.t === "li" ? `<div class="dd-wiki-li">${escHTML(b.s)}</div>`
      : `<p class="dd-wiki-p">${escHTML(b.s)}</p>`;
    const secs = w.sections.map((s) =>
      `<div class="cal-sub-head">${escHTML(s.heading)}</div>` +
      `<div class="dd-wiki-sec">${(s.blocks || []).map(block).join("")}</div>`).join("");
    return `<div class="dd-wiki-body">${secs}` +
      `<div class="dd-wiki-src">${link}</div></div>`;
  }

  // A single confirmed date, with weekday and a live countdown.
  function confirmedEarningsHTML(d) {
    const days = Fmt.daysUntil(d);
    const cd = Fmt.countdown(d);
    let out = [Fmt.date(d), Fmt.weekday(d)].filter(Boolean).join(" · ");
    if (cd) {
      const cls = days <= 7 ? "cal-countdown soon" : "cal-countdown";
      out += ` <span class="${cls}">${cd}</span>`;
    }
    return out;
  }

  // Next results delivery date. Yahoo's calendar gives either a single confirmed
  // date or an estimated window (two dates, when the exact day isn't locked in) —
  // but that date is often stale: once it slips into the past Yahoo simply hasn't
  // published the next one yet. So we only trust the calendar window while its
  // late edge is still ahead of today; otherwise we fall back to the soonest
  // genuinely-future date in the earnings-date history, and failing that we show
  // the last known date plainly rather than counting down to a date that's gone.
  function nextEarningsHTML(u, history) {
    const ds = (u.earnings_dates || []).filter(Boolean);
    const first = ds[0], last = ds[ds.length - 1];
    const calCurrent = ds.length && Fmt.daysUntil(last) >= 0;

    if (calCurrent) {
      const estimated = last !== first;                // 2-date window = estimate
      if (!estimated) return confirmedEarningsHTML(first);
      // "Apr 24 – Apr 28, 2025" (drop the repeated year/month on the low end)
      const a = new Date(first + "T00:00:00"), b = new Date(last + "T00:00:00");
      const optLow = { month: "short", day: "2-digit" };
      const lowTxt = (!isNaN(a) && a.getFullYear() === b.getFullYear())
        ? a.toLocaleDateString(undefined, optLow) : Fmt.date(first);
      let out = `${lowTxt} – ${Fmt.date(last)} <span class="cal-est">estimated</span>`;
      const cd = Fmt.countdown(first);
      if (cd) out += ` <span class="${Fmt.daysUntil(first) <= 7 ? "cal-countdown soon" : "cal-countdown"}">${cd}</span>`;
      return out;
    }

    // Calendar has no upcoming date — take the soonest future date the earnings
    // history knows about (get_earnings_dates carries Yahoo's scheduled dates).
    const histDates = (history || []).map((r) => r.date).filter(Boolean);
    const future = histDates.filter((d) => Fmt.daysUntil(d) >= 0).sort();
    if (future.length) return confirmedEarningsHTML(future[0]);

    // Nothing upcoming anywhere: the only date Yahoo has is already in the past,
    // so the next report isn't scheduled. Flag it as unconfirmed instead of
    // presenting a stale past date as the next one.
    const lastKnown = last || histDates.sort().pop();
    if (!lastKnown) return Fmt.na;
    return `${[Fmt.date(lastKnown), Fmt.weekday(lastKnown)].filter(Boolean).join(" · ")} `
      + `<span class="cal-est">unconfirmed</span> `
      + `<span class="cal-countdown past">${Fmt.countdown(lastKnown)}</span>`;
  }

  // Hover descriptions for the Earnings & Splits Calendar rows.
  const CAL_TIPS = {
    "Next Earnings": "Next results delivery date. A single confirmed date, or an estimated window when Yahoo hasn't locked the exact day; the countdown is days from today. When Yahoo's only date is already in the past — the next report isn't scheduled yet — it's flagged \"unconfirmed\".",
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
    const nextE = nextEarningsHTML(u, c.earnings_history);
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
    // refreshCurrent() rebuilds the view to reflect any watchlist stars toggled
    // in the deep-dive; keep the user's place in the list across that rebuild.
    Views.preserveScroll(() => App.refreshCurrent());
  }

  return { open, close };
})();

/* ================= ANALYST CHAT — FLOATING WIDGET ================= */
/* A persistent bubble on every tab. It lives outside the view root (mounted
   once on <body>), so the conversation survives tab switches; each send pulls
   the CURRENT tab's rows from Views.getChatContext(). History is persisted to
   localStorage so it also survives reloads. */
window.ChatWidget = (() => {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const state = {
    history: Store.getChatHistory(),   // [{role, content}]
    open: false,
    busy: false,
    attach: true,                      // send the current tab's rows as context
  };
  let els = null;                      // {fab, panel, log, input, send, attach, ctx}

  const ctx = () => (window.Views ? Views.getChatContext() : { label: "", rows: [] });

  function persist() { Store.setChatHistory(state.history); }

  function bubbleHTML(role, html) {
    return `<div class="chat-msg ${role}"><div class="chat-bubble">${html}</div></div>`;
  }

  function paintLog() {
    els.log.innerHTML = state.history.length
      ? state.history.map((m) =>
          bubbleHTML(m.role, m.role === "assistant" ? Fmt.md(m.content) : esc(m.content))).join("")
      : `<div class="chat-empty"><div class="big">✦</div>Ask the analyst about the stocks on this tab.` +
        `<div class="hint">Answers are grounded in the rows currently shown — grades, valuation, health, dividends. Your conversation follows you across tabs.</div></div>`;
    els.log.scrollTop = els.log.scrollHeight;
  }

  // Reflect the active tab's context in the header + attach toggle.
  function contextChanged() {
    if (!els) return;
    const c = ctx();
    const n = c.rows.length;
    els.attach.disabled = !n;
    if (!n) els.attach.checked = false;
    else if (state.attach) els.attach.checked = true;
    els.ctx.textContent = (els.attach.checked && n)
      ? `${c.label || "This tab"} · ${n} stock${n === 1 ? "" : "s"}`
      : (n ? `${n} available — off` : "no table data on this tab");
  }

  function setOpen(open) {
    state.open = open;
    els.panel.classList.toggle("hidden", !open);
    els.fab.classList.toggle("active", open);
    if (open) { contextChanged(); paintLog(); els.input.focus(); }
  }

  async function submit() {
    const text = els.input.value.trim();
    if (!text || state.busy) return;
    state.busy = true;
    els.input.value = "";
    els.send.disabled = true;
    state.history.push({ role: "user", content: text });
    persist();
    paintLog();
    els.log.insertAdjacentHTML("beforeend",
      bubbleHTML("assistant", '<span class="spinner" style="width:11px;height:11px"></span> thinking…'));
    els.log.scrollTop = els.log.scrollHeight;
    const bubble = els.log.lastElementChild.querySelector(".chat-bubble");

    const c = ctx();
    let reply = "";
    let failed = null;
    try {
      await API.chat({
        messages: state.history,
        rows: (els.attach.checked ? c.rows : []),
        context_label: (els.attach.checked ? c.label : ""),
      }, (ev) => {
        if (ev.text) {
          reply += ev.text;
          bubble.innerHTML = Fmt.md(reply);
          els.log.scrollTop = els.log.scrollHeight;
        } else if (ev.error) {
          failed = ev.error;
        }
      });
    } catch (e) {
      failed = String(e.message || e);
    }
    if (reply) { state.history.push({ role: "assistant", content: reply }); persist(); }
    else state.history.pop();              // failed turn: drop it so a retry is clean
    if (failed) {
      bubble.innerHTML = (reply ? Fmt.md(reply) : "") +
        `<div class="chat-error">⚠ ${esc(failed)}</div>`;
    } else if (!reply) {
      bubble.innerHTML = `<div class="chat-error">⚠ No reply — is the server still running?</div>`;
    }
    if (failed || !reply) persist();
    state.busy = false;
    els.send.disabled = false;
    els.input.focus();
    els.log.scrollTop = els.log.scrollHeight;
  }

  function init() {
    if (els) return;
    const fab = document.createElement("button");
    fab.className = "chat-fab";
    fab.title = "Analyst chat";
    fab.innerHTML = "✦";

    const panel = document.createElement("div");
    panel.className = "chat-panel hidden";
    panel.innerHTML = `
      <div class="chat-head">
        <span class="chat-title">✦ Analyst</span>
        <span class="chat-ctxlabel has-tip" id="cw-ctx"
              data-tip="The agent analyses the stocks on your current tab. Toggle 'data' off to ask general questions. Your conversation continues as you move between tabs."></span>
        <div class="spacer"></div>
        <label class="chat-attach has-tip" data-tip="Attach the current tab's rows as context.">
          <input type="checkbox" id="cw-attach"> data
        </label>
        <button class="chat-icon" id="cw-clear" title="Clear conversation">🗑</button>
        <button class="chat-icon" id="cw-close" title="Close">✕</button>
      </div>
      <div class="chat-log" id="cw-log"></div>
      <div class="chat-inputrow">
        <textarea class="input chat-input" id="cw-input" rows="1"
          placeholder="Ask about this tab’s stocks…"></textarea>
        <button class="btn btn-primary btn-sm" id="cw-send">Send</button>
      </div>`;

    document.body.append(fab, panel);
    els = {
      fab, panel,
      log: panel.querySelector("#cw-log"),
      input: panel.querySelector("#cw-input"),
      send: panel.querySelector("#cw-send"),
      attach: panel.querySelector("#cw-attach"),
      ctx: panel.querySelector("#cw-ctx"),
    };
    els.attach.checked = state.attach;

    fab.addEventListener("click", () => setOpen(!state.open));
    panel.querySelector("#cw-close").addEventListener("click", () => setOpen(false));
    panel.querySelector("#cw-clear").addEventListener("click", () => {
      state.history = []; persist(); paintLog();
    });
    els.send.addEventListener("click", submit);
    els.attach.addEventListener("change", () => { state.attach = els.attach.checked; contextChanged(); });
    els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    contextChanged();
  }

  return { init, contextChanged };
})();

document.addEventListener("DOMContentLoaded", () => window.ChatWidget.init());
