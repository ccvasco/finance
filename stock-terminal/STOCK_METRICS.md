# Individual Stock Metrics — Data Legend

This document explains every metric in the single-company **deep-dive** view and
in its Excel export (`TICKER-YYYYMMDD.xlsx`, produced by the "⭳ Export" button on
a company's deep-dive page). It is intended as a reference for a human or an AI
assistant interpreting that spreadsheet.

The export has five sheets: **Overview**, **Charts Data**, **Income Statement**,
**Balance Sheet**, and **Cash Flow**. Each is documented below.

> **Units cheat-sheet.** This workbook uses **one convention for every rate**: all
> margins, returns, yields, growth rates, payout and short interest are stored as
> **decimal fractions** — multiply by 100 for a percentage. So `0.478` = 47.8%,
> `0.0038` = 0.38%. This matches the multi-ticker screener export
> ([SCREENER_COLUMNS.md](SCREENER_COLUMNS.md)), so the same metric reads the same
> in both files. The other value types are:
> - **currency** — an absolute amount in the company's reporting currency. Per-share
>   values are per single share.
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
**Exchange**, **Currency** (the reporting currency for every absolute figure),
**Price** (latest share price), and **Change** (intraday price change, **fraction**).

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
| EBITDA | Earnings before interest, tax, depreciation & amortization (Yahoo's TTM figure — the same one behind Debt/EBITDA and EBITDA/FCF). | currency | Proxy for operating cash earnings; compare to debt and FCF. |
| EBITDA/FCF | EBITDA ÷ Free Cash Flow — how much EBITDA it takes to produce a dollar of free cash. | multiple (×) | Closer to 1× = cleaner cash conversion. |

### Risk

| Metric | Meaning | Units | Rough read |
| --- | --- | --- | --- |
| Beta | Sensitivity vs. the market (S&P 500). | number | 1 = with market; >1 amplified; <1 stabler; <0 inverse. |
| Short Interest | Shares sold short ÷ public float. | fraction | <0.05 normal, 0.05–0.10 elevated, >0.10–0.20 heavily shorted. |
| Days to Cover | Short interest ÷ average daily volume. | number (days) | <1 easy; >5–7 crowded short. |
| Altman Z-Score | Bankruptcy-risk gauge (higher = safer). | number | >2.99 safe, 1.81–2.99 grey, <1.81 distress. Blank for banks/financials. |
| Piotroski F-Score | Fundamental strength across 9 tests (1 pt each). | integer 0–9 | 7–9 strong, 4–6 middling, 0–3 weak. |

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
| Shares Outstanding | Total shares issued. Falling = buybacks; rising = dilution. | share count |
| Float Shares | Shares freely tradable by the public. Latest year only (current snapshot); other years blank. | share count |
| Treasury Shares | Repurchased shares held by the company (often ~0 when retired). | share count |
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

## Not in the export

The deep-dive page also shows an **Earnings & Splits Calendar** (next earnings
date, EPS/revenue estimates, recent earnings surprises, stock-split history) and
an interactive **Price** chart. These are not part of the Excel export.

See [SCREENER_COLUMNS.md](SCREENER_COLUMNS.md) for the multi-ticker screener
export, and [METRICS.md](METRICS.md) §6 for the strategy-rating methodology in
plain language.
