# Individual Stock Metrics — Data Legend

This document explains every metric in the single-company **deep-dive** view and
in its Excel export (`TICKER-YYYYMMDD.xlsx`, produced by the "⭳ Export" button on
a company's deep-dive page). It is intended as a reference for a human or an AI
assistant interpreting that spreadsheet.

The export has five sheets: **Overview**, **Charts Data**, **Income Statement**,
**Balance Sheet**, and **Cash Flow**. Each is documented below. The deep-dive
page also offers a second, DCF-specific export (`TICKER-DCF-YYYYMMDD.xlsx`, the
"⭳ DCF" button) — see **The DCF export** near the end of this document.

> **Units cheat-sheet.** This workbook uses **one convention for every rate**: all
> margins, returns, yields, growth rates, payout and short interest are stored as
> **decimal fractions** — multiply by 100 for a percentage. So `0.478` = 47.8%,
> `0.0038` = 0.38%. This matches the multi-ticker screener export
> ([SCREENER_COLUMNS.md](SCREENER_COLUMNS.md)), so the same metric reads the same
> in both files. The other value types are:
> - **currency** — an absolute amount. For most tickers this is simply the
>   company's one currency, shown as **Currency** near the top of the Overview
>   sheet. For a foreign-reporting ticker (an ADR like WIT, which trades in USD
>   but reports in INR) it isn't one currency: **Price, Market Cap, Diluted
>   EPS** are in the trading currency (**Currency**), while **Enterprise Value,
>   Revenue, Cash, Debt, Equity, EBITDA, Net Income, FCF, Basic EPS, Dividend
>   TTM** and similar statement-derived figures are in the reporting currency
>   (**Financial Statement Currency**, shown only when it differs from
>   Currency). See §11 in [METRICS.md](METRICS.md) for why. Per-share values
>   are per single share.
> - **multiple (×)** — a valuation/coverage ratio (P/E, EV/EBITDA, FCF Coverage).
> - **ratio** — a plain liquidity ratio (Current, Quick).
> - **number / integer / date / share count** — as labelled.
>
> (The on-screen deep-dive **view** shows these metrics formatted as percentages,
> e.g. `47.8%`; the export stores raw fractions so they are calculation-ready.)
>
> All data comes from Yahoo Finance via `yfinance` and may be delayed, restated, or
> missing (empty cell = `N/A`). "Good/bad" ranges are rough rules of thumb that vary
> by sector, business model, and growth stage — judge against the company's own
> history and direct peers.

---

## Sheet 1 — Overview

Top rows carry identity: **Ticker — Name**, then **Sector**, **Industry**,
**Exchange**, **Currency** (the currency the stock trades in — Price and
Market Cap are in this currency), **Price** (latest share price), and
**Change** (intraday price change, **fraction**). A **Financial Statement
Currency** row appears here too, only for a foreign-reporting ticker whose
statements are denominated in a different currency than it trades in — see
the units cheat-sheet above and [METRICS.md](METRICS.md) §11.

Below that, metrics are grouped into the same panels shown in the app.

### Valuation

| Metric | Meaning | Units | Rough read |
| --- | --- | --- | --- |
| Market Cap | Share price × shares outstanding — total equity value. | currency | Size bucket. |
| Enterprise Value | Market cap + debt − cash. Cost to acquire the whole business. | currency | Used in EV/EBITDA. |
| Trailing P/E | Price ÷ trailing 12-month EPS. | multiple (×) | <15 cheap-ish, 15–25 average, >25 priced for growth. |
| Forward P/E | Price ÷ estimated next-year EPS. | multiple (×) | Below trailing P/E implies expected growth. |
| PEG Ratio | P/E ÷ expected earnings growth. | ratio | ~1.0 fair; <1 potentially cheap; >2 expensive. |
| Price/Book | Price ÷ book value per share. | multiple (×) | <1 below book; 1–3 typical. |
| Price/Sales | Price ÷ trailing 12-month revenue per share. | multiple (×) | <1 low, >10 rich. |
| Price/Cash | Market cap ÷ total cash. | multiple (×) | Lower = more cash backing the valuation. |
| Price/FCF | Market cap ÷ free cash flow. | multiple (×) | <15 attractive, >25 expensive. Blank if FCF ≤ 0. |
| EV/EBITDA | Enterprise value ÷ EBITDA. | multiple (×) | <10 cheap, 10–15 average, >15 expensive. |
| DCF Value | Inferred fair value per share — 10-year two-stage FCFF DCF discounted at WACC (methodology: [METRICS.md](METRICS.md) §2). Trading currency. | currency / share | Compare against Price. Blank for financials/REITs. Use the **⭳ DCF** button for the full working. |
| DCF Upside | DCF Value ÷ Price − 1 (labelled "DCF Upside %" in the app; exported as a fraction). | fraction | >0 = model reads it below fair value; <0 above. |
| EPS | Trailing 12-month earnings per share. | currency / share | Higher and rising is better. |

### Dividend

| Metric | Meaning | Units | Rough read (as fraction) |
| --- | --- | --- | --- |
| Dividend Rate | Forward annual dividend per share. | currency / share | — |
| Dividend TTM | Dividends actually paid per share, trailing 12 months. | currency / share | — |
| Dividend Yield | Annual dividend ÷ price. | fraction | <0.02 low, 0.02–0.04 typical, 0.04–0.06 high, >0.07–0.08 cut-risk. |
| Payout Ratio | Dividends ÷ earnings. | fraction | <0.60 comfortable, 0.60–0.80 watch, >1.0 unsustainable. |
| FCF Coverage | Free cash flow ÷ dividends paid. | multiple (×) | ≥1.2 safe, 0.8–1.2 tight, <0.8 under-covered. |
| Ex-Dividend Date | Buy before this date to receive the next dividend. | date | — |
| 5Y Avg Yield | Average dividend yield over the past 5 years. | fraction | Context for today's yield. |
| Div Growth 3Y | Annualized dividend CAGR over 3 years. | fraction | Positive growth = healthy payer. |
| Div Growth 5Y | Annualized dividend CAGR over 5 years. | fraction | Longer track record. |
| Years ▲ Dividend | Consecutive completed years of rising dividends. | integer (years) | 10+ strong culture, 25+ "dividend aristocrat". |

### Profitability

| Metric | Meaning | Units | Rough read (as fraction) |
| --- | --- | --- | --- |
| Gross Margin | (Revenue − cost of goods) ÷ revenue (Yahoo's TTM figures — Yahoo derives its own gross profit and revenue base, so this can differ from the fiscal-year statement margin in Charts Data). | fraction | >0.40 strong (software 0.70+, retail <0.30). |
| Operating Margin | Operating income ÷ revenue (Yahoo's TTM figures — Yahoo derives its own operating income and revenue base, so this can differ, even in sign, from the fiscal-year statement margin in Charts Data). | fraction | >0.15 healthy; negative = core ops lose money. |
| EBITDA Margin | EBITDA ÷ revenue. | fraction | >0.20 generally strong. |
| Profit Margin | Net income ÷ revenue (Yahoo's TTM figures — Yahoo derives its own net income and revenue base, so this can differ from the fiscal-year Net Margin in Charts Data). | fraction | >0.10 solid, >0.20 excellent, negative = unprofitable. |
| ROE | Net income ÷ shareholders' equity. | fraction | >0.15 good; can be inflated by leverage. |
| ROA | Net income ÷ total assets. | fraction | >0.05 decent; banks/utilities lower. |
| ROIC | After-tax operating profit ÷ (debt + equity). | fraction | Creates value only when > cost of capital (~0.08–0.10). >0.15 excellent. |
| WACC | Weighted average cost of capital: (equity weight × CAPM cost of equity) + (debt weight × after-tax cost of debt). Cost of equity = 10Y Treasury + Beta × 5.5% equity risk premium (a fixed US-market estimate — see [METRICS.md](METRICS.md) §3). | fraction | Benchmark for ROIC; typically 0.06–0.12. |
| ROIC − WACC | ROIC − WACC. | fraction | >0 value creation, <0 value destruction. Blank if either input is missing. |
| ROCE | EBIT ÷ (total assets − current liabilities). | fraction | >0.15 strong; pre-tax sibling of ROIC. |
| Revenue/Share | Trailing 12-month revenue ÷ shares outstanding. | currency / share | Rising is the signal to want. |
| Net Income | Net income to common shareholders (Yahoo's trailing 12 months — its window and definition differ from the fiscal-year statement figure in Charts Data, so the two can disagree). | currency | Positive and growing is the goal. |

### Financial Health

| Metric | Meaning | Units | Rough read |
| --- | --- | --- | --- |
| Total Cash | Cash + short-term investments. | currency | Compare to total debt. |
| Total Debt | Short- + long-term borrowings. | currency | Judge against cash, equity, EBITDA. |
| Total Equity | Assets − liabilities (book value). | currency | Negative is a red flag. |
| Debt/Equity | Total Debt ÷ Total Equity, computed from the two figures in this panel so they reconcile. | fraction | <1.0 conservative, 1.0–2.0 moderate, >2.0 aggressive. |
| Debt/Equity (MRQ) | Yahoo's pre-computed Debt/Equity from its most-recent-quarter balance sheet. | fraction | Same ranges; differs from Debt/Equity when the latest quarter has moved since fiscal year-end. |
| Debt/EBITDA | Total Debt ÷ EBITDA — years of EBITDA needed to repay all debt. | multiple (×) | <3× comfortable, 3–4× watch, >4–5× heavily leveraged. |
| LT Debt/Equity | Long-term debt ÷ shareholders' equity. | fraction | Long-term portion of leverage. |
| Current Ratio | Current assets ÷ current liabilities. | ratio | >1 covers near-term bills; 1.5–3 comfortable. |
| Quick Ratio | (Current assets − inventory) ÷ current liabilities. | ratio | >1 strong; stricter than current ratio. |
| Free Cash Flow | Operating cash flow − capital expenditure. | currency | Positive and growing is the goal. |
| EBITDA | Net Income + Interest + Tax + Depreciation & Amortization — built up from the bottom line, not down from revenue (Yahoo's TTM figure — the same one behind Debt/EBITDA and EBITDA/FCF). | currency | Proxy for operating cash earnings; compare to debt and FCF. |
| EBITDA/FCF | EBITDA ÷ Free Cash Flow — how much EBITDA it takes to produce a dollar of free cash. | multiple (×) | Closer to 1× = cleaner cash conversion. |

### REIT Metrics

Present **only for REITs** (the panel is omitted entirely for every other
company). Which rows appear depends on which of three REIT kinds the company
is — the app decides this from its industry and its statements, and the panel
is titled "Mortgage REIT Metrics" for the third:

- **Equity REIT** — owns depreciable buildings under US GAAP, so FFO is
  computable and the FFO family is shown.
- **Fair-value REIT** — also owns buildings, but reports them at fair value
  under IFRS (most Canadian REITs). There is no depreciation line to add back,
  so FFO can't be built; the book-value rows are shown instead. Book value ≈ NAV
  here, and Net Income swings with unrealized property revaluations.
- **Mortgage REIT (mREIT)** — owns mortgage securities, not property. FFO is
  meaningless by construction, so the book-value rows are shown.

| Metric | Meaning | Units | Rough read |
| --- | --- | --- | --- |
| FFO | Funds From Operations = Net Income + D&A − property-sale gains + impairments. The REIT-standard earnings measure: property depreciation is a large non-cash charge that buildings usually don't actually incur, so net income understates a REIT's earning power. Equity REITs only. | currency | Compare to debt and the dividend, as FCF is used elsewhere. |
| FFO/Share | FFO ÷ shares outstanding — the REIT analogue of EPS. | currency / share | The per-share earning power the dividend comes from. |
| P/FFO | Market cap ÷ FFO — the REIT equivalent of P/E, and the sector's standard multiple. | multiple (×) | <12× cheap-ish, 12–18× typical, >18× rich. |
| FFO Payout | Dividends paid ÷ FFO. REITs must distribute ~90% of *taxable* income by law, so this runs structurally higher than a normal payout ratio. | fraction | ≤0.80 comfortable cushion, ≤1.00 sustainable, >1.00 paying out more than FFO generates. |
| FFO Coverage | FFO ÷ dividends paid (the inverse of FFO Payout). | multiple (×) | ≥1.0× sustainable, <1.0× under-covered. |
| Book Value/Share | Shareholders' equity ÷ shares outstanding — net asset value per share. | currency / share | The primary gauge for mortgage and fair-value REITs; ≈ NAV for a fair-value REIT. |
| Book Value Trend | Annualized trend of book value per share, least-squares-fitted across all available years so one anomalous year can't set it. Mortgage and fair-value REITs. | fraction | The single most important mREIT quality signal. >0 compounding; persistently <0 means the dividend is being paid out of capital. |
| Price/Book | Price ÷ book value per share. | multiple (×) | <0.90 discount to the portfolio, >1.10 premium — the primary valuation anchor for mortgage REITs. |
| Net Income | Net income to common shareholders. Mortgage and fair-value REITs. | currency | For a fair-value REIT this includes unrealized property revaluations; for an mREIT, mark-to-market swings. Read the trend, not one period. |
| Div Coverage (NI) | Net income ÷ dividends paid. Mortgage and fair-value REITs. | multiple (×) | <1.0× means distributing more than it earns — a common mREIT warning sign. |
| Debt/GBV | Total Debt ÷ **gross book value** (total assets with accumulated depreciation added back — the asset base at undepreciated cost). Property REITs only: equity and fair-value kinds. | fraction | <0.45 conservative, 0.45–0.55 typical, >0.60 highly levered. |

**Why Debt/GBV rather than plain debt-to-assets.** It is the leverage gauge
property REITs actually report and covenant against — declarations of trust
commonly cap it near 60%. Measuring debt against the *undepreciated* asset base
matters for the same reason FFO adds depreciation back to earnings: accounting
depreciation shrinks the carrying value of buildings that usually haven't lost
value, so debt-to-assets overstates how levered a property REIT really is. Two
data caveats: Yahoo carries US-GAAP REIT property at **net** value with no
accumulated-depreciation row to add back, so for those REITs the figure runs
slightly **high** (conservative); for fair-value REITs it is exact, since their
assets already sit at fair value and that is precisely how their covenants
define it. Mortgage REITs are excluded — "gross book" has no meaning for a
securities portfolio, and their repo financing isn't fully captured in Total
Debt, so the ratio would understate their real leverage.

**Occupancy rate is not available.** It is the one headline REIT metric this
export cannot carry: occupancy is an *operational* disclosure published in each
REIT's quarterly supplemental package, not a financial-statement line, so no
normalized data feed (Yahoo included) provides it. Read it from the REIT's own
supplemental. See [REITs.md](REITs.md) for the full REIT methodology.

### Risk

| Metric | Meaning | Units | Rough read |
| --- | --- | --- | --- |
| Beta | Sensitivity vs. the market (S&P 500). | number | 1 = with market; >1 amplified; <1 stabler; <0 inverse. |
| Short Interest | Shares sold short ÷ public float. | fraction | <0.05 normal, 0.05–0.10 elevated, >0.10–0.20 heavily shorted. |
| Days to Cover | Short interest ÷ average daily volume. | number (days) | <1 easy; >5–7 crowded short. |
| Altman Z-Score | Bankruptcy-risk gauge (higher = safer). | number | >2.99 safe, 1.81–2.99 grey, <1.81 distress. Ignored for financials/REITs/mortgage REITs; softened to a flag (not a kill) for asset-light and cyclical names — see [business-type archetypes](stock-triage-strategy.md#business-type-archetypes). |
| Piotroski F-Score | Fundamental strength across 9 tests (1 pt each). | integer 0–9 | 7–9 strong, 4–6 middling, 0–3 weak. Replaced by ROE/net-margin for financials and REITs, and by book-value-per-share trend for mortgage REITs. |

### Strategy Ratings

This company graded against three long-term investing strategies, each
0–100 (unlike every other metric in this sheet, these are **not** fraction-
scaled — the raw score out of 100 is exported directly). Computed server-side
from the same underlying metrics shown elsewhere on this sheet, so a blank
input anywhere can lower a score (missing data never helps a stock).

| Metric | Meaning | Units | Rough read |
| --- | --- | --- | --- |
| S1 · Triage | [Triage framework](stock-triage-strategy.md) grade: data-hygiene quarantine → hard kill-switches (distress, twin-negative earnings, leverage, liquidity, value destruction) → quality score across value creation, profitability, balance sheet, cash conversion. | integer 0–100, or text | ≥65 "Advance", 45–64 "Watchlist", <45 "Discard". Reads as `N/A` in the Overview panel value when quarantined (a critical field like Total Debt or Net Income is missing and unrecoverable) — the reason is shown instead. |
| S1 · Flags | Triage Stage-0 sanity + Stage-3 valuation-context flags. Never disqualifying — they tell the deep dive where to look first: 🔺 priced for perfection · 🔻 suspiciously cheap · ⚠ divergent multiples / data-sanity warnings · 💰 payout stress · 📉 crowded short · 🌀 high beta. | text | `N/A` = no warnings (or S1 quarantined). |
| S2 · Compounder | [Quality Compounder](strategy-2-quality-compounder.md) grade: returns on capital (ROIC/ROCE/ROE), margin moat, capital discipline, 5Y/10Y compounding track record, valuation sanity. A distress or twin-negative-earnings guard caps the score at 35. | integer 0–100 | ≥70 "Compounder", 50–69 "Quality watch", <50 "Pass". |
| S3 · Defensive Value | [Defensive Value](strategy-3-defensive-value.md) grade: Graham-style margin of safety — earnings/cash yield, asset backing (incl. P/E × P/B ≤ 22.5), financial strength, earnings quality, dividend record. | integer 0–100 | ≥70 "Value candidate", 50–69 "Fair", <50 "Expensive/weak". |
| Min · All Strategies | The minimum of the three scores above — the "good under every lens" figure. | integer 0–100, or blank | Blank when any strategy above is ungradable (e.g. S1 quarantined). |

In the exported Overview sheet, each strategy's cell reads as
`"<score> / 100 — <verdict>"` (e.g. `71 / 100 — Advance`) rather than a bare
number, so the grade and its interpretation travel together in one cell.
Financials (banks, insurers) are graded on each strategy's own documented
sector substitution rather than the metrics above.

---

## Sheet 2 — Charts Data

Three stacked tables, each keyed by fiscal **Year**. The oldest year is often
blank — Yahoo's free feed reliably populates ~4 fiscal years, and the growth
table needs a prior year per bar, so it shows one fewer.

### Revenue · Profit · Net Income · FCF

| Column | Meaning | Units |
| --- | --- | --- |
| Year | Fiscal year. | year |
| Revenue | Total sales. | currency |
| Gross Profit | Revenue − cost of goods sold. | currency |
| Operating Income | Profit after running the business, before interest & tax. | currency |
| Net Income | Bottom-line profit attributable to shareholders (fiscal-year statement — can differ from the Overview sheet's TTM Net Income, which Yahoo derives itself). | currency |
| FCF | Free cash flow = operating cash flow − capex. | currency |
| Gross Margin | Gross profit ÷ revenue (from the fiscal-year statement — can differ from the Overview sheet's TTM Gross Margin, which Yahoo derives itself). | fraction |
| Operating Margin | Operating income ÷ revenue (from the fiscal-year statement — can differ from the Overview sheet's TTM Operating Margin, which Yahoo derives itself). | fraction |
| Net Margin | Net income ÷ revenue (from the fiscal-year statement — can differ from the Overview sheet's TTM Profit Margin, which Yahoo derives itself). | fraction |

### Growth · YoY

| Column | Meaning | Units |
| --- | --- | --- |
| Year | Fiscal year. | year |
| Revenue Growth | Year-over-year growth in total revenue. | fraction |
| EPS Growth | Year-over-year growth in earnings per share. | fraction |
| EBITDA Growth | Year-over-year growth in EBITDA. | fraction |
| EBITDA Margin | EBITDA ÷ revenue for that fiscal year (shown as a line on the chart). | fraction |

### Share Dilution

| Column | Meaning | Units |
| --- | --- | --- |
| Year | Fiscal year. | year |
| Shares Outstanding | Shares held by investors, excluding treasury. Falling = buybacks; rising = dilution. Reconstructed as issued − treasury where Yahoo has no outstanding row; renamed **Shares Issued (incl. treasury)** in the rarer case where there is no treasury row to net off either, since the level may then run high. | share count |
| Treasury Shares | Repurchased shares held by the company (often ~0 when retired). Excluded from shares outstanding. | share count |
| Dividend Yield | Historical yield = annual dividends ÷ year-end price. | fraction |
| Payout Ratio | Dividends as a share of earnings, per year. | fraction |

---

## Sheets 3–5 — Income Statement / Balance Sheet / Cash Flow

Each statement sheet (annual) has **Line Item** in column A, then a leading
**TTM** column, then one column per fiscal-year-end date. Values are in the
company's reporting currency. The set of line items is whatever Yahoo provides
for that company (e.g. Total Revenue, EBIT, Net Income; Total Assets, Total Debt,
Stockholders Equity; Operating Cash Flow, Free Cash Flow). The oldest fiscal-year
column is frequently blank.

**The leading column:**
- **Income Statement & Cash Flow → `TTM`** (trailing twelve months) = the sum of
  the four most-recent quarters. Present only when a full year of quarterly data
  exists; a row is left blank if it isn't reported in all four quarters.
- **Balance Sheet → `MRQ`** (most-recent quarter). A balance sheet is a
  point-in-time snapshot, so summing quarters would be meaningless — this column
  is simply the latest quarter-end balance.

This TTM revenue is the denominator behind the TTM-based ratios on the Overview
sheet (e.g. margins), which is why those ratios use the TTM column's revenue, not
the latest *annual* revenue.

**`EBITDA (Yahoo TTM)` row** (income statement only): an extra line carrying
Yahoo's own trailing-12-month EBITDA — the figure behind the **EBITDA Margin**
metric. It populates the TTM column only. It usually differs from the statement's
own **EBITDA / Normalized EBITDA** line (a different, often higher, definition),
and is shown beside it so EBITDA Margin (Yahoo EBITDA ÷ TTM revenue) can be
reconciled.

---

## The DCF export (⭳ DCF button)

A second, separate export on the deep-dive page: `TICKER-DCF-YYYYMMDD.xlsx`,
a single **DCF Valuation** sheet that shows every input and intermediate step
behind the screener's **DCF Value** column (methodology:
[METRICS.md](METRICS.md) §2). The button appears only when a DCF exists for
the stock — financials and REITs (where an FCF model doesn't fit) don't get
one.

**It is a live spreadsheet model, not a static dump.** The input cells
(base FCF, growth, WACC components, debt, cash, shares, FX) hold plain values;
**every downstream cell holds an actual Excel formula** referencing those
inputs — the growth fade, each year's projected FCF and discount factor, the
present values, the terminal value, the whole enterprise → equity → per-share
→ DCF-Value bridge, and the WACC composition. So you can trace exactly how each
number was reached, and if you edit an assumption (say, the terminal growth or
a projected year's growth) the valuation recomputes in your spreadsheet app.

Sections:

- **Result** — DCF Value (trading currency), current price, upside
  (**fraction**, like every rate in these exports). When the DCF is N/A a
  **Why N/A** row states the exact reason (business type, FCF ≤ 0, WACC
  unavailable or too close to terminal growth, shares missing).
- **Inputs** — business-type archetype, base FCF, raw historical FCF CAGR and
  the clamped stage-1 growth actually used, terminal growth, horizon, WACC,
  debt, cash, shares outstanding (flagged when derived from market cap ÷
  price), and both currencies plus the FX rate for foreign-reporting tickers.
- **WACC breakdown (CAPM)** — beta, risk-free rate, ERP, cost of
  equity/debt, tax rate, capital weights, and the WACC formula result.
- **Historical FCF** — the statement series the growth rate came from, with
  YoY growth per year.
- **Projection** — one row per forecast year: fading growth rate, projected
  FCF, discount factor, present value; plus the terminal-value row.
- **Valuation bridge** — PV of the forecast years + PV of terminal value =
  enterprise value, − debt + cash = equity value, ÷ shares (× FX for ADRs) =
  DCF Value, against the current price.

All rates are stored as decimal fractions with a percent display format;
currency amounts are raw values in the currency stated in each row label.

## Not in the export

The deep-dive page also shows an **Earnings & Splits Calendar** (next earnings
date, EPS/revenue estimates, recent earnings surprises, stock-split history), an
interactive **Price** chart, and a **ROIC vs Cost of Capital** chart (ROIC bars
against a per-fiscal-year WACC line — every input except beta reconstructed
historically, not today's WACC repeated; see [METRICS.md](METRICS.md) §8).
These are not part of the Excel export.

See [SCREENER_COLUMNS.md](SCREENER_COLUMNS.md) for the multi-ticker screener
export, and [METRICS.md](METRICS.md) §6 for the strategy-rating methodology in
plain language.
