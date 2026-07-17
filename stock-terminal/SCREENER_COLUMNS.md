# Screener Columns — Data Legend

This document explains every column in the **Screener** tab and in the
multi-ticker Excel export (the **`Metrics`** sheet of `stock-terminal-YYYYMMDD.xlsx`,
produced by the "⭳ Export .xlsx" button). One row = one company.

It is intended as a reference for a human or an AI assistant interpreting the
exported spreadsheet. Each column lists the **Excel header**, the **field key**,
what it means, and the **units of the raw exported value**.

> **Units cheat-sheet.** The exported workbook uses **one convention for every
> rate**: all margins, returns, yields, growth rates, payout, short interest and
> price performance are stored as **decimal fractions** — multiply by 100 for a
> percentage. So `0.478` = 47.8%, `0.0038` = 0.38%, `0.41` = 41%.
> The other value types are:
> - **currency** — an absolute amount. For most tickers this is simply the
>   company's one currency. For a foreign-reporting ticker (an ADR like WIT,
>   which trades in USD but reports in INR), it isn't one currency: Price,
>   Market Cap, and Diluted EPS are in the trading currency, while Enterprise
>   Value, Revenue, Cash, Debt, Equity, EBITDA, Net Income, FCF, Basic EPS, and
>   Dividend TTM are in the reporting currency — see the callout below and
>   [METRICS.md](METRICS.md) §11. Per-share values (Price, EPS, dividends) are
>   per single share.
> - **multiple (×)** — a valuation or coverage ratio (P/E, EV/EBITDA, FCF Coverage).
> - **ratio** — a plain liquidity ratio (Current, Quick).
> - **number / integer / date** — as labelled.
>
> (The on-screen Screener **tab** shows these same metrics formatted as
> percentages, e.g. `47.8%`, for readability. The **export** stores raw fractions
> so the numbers are calculation-ready and consistent with the single-company
> export — see [STOCK_METRICS.md](STOCK_METRICS.md).)
>
> All data comes from Yahoo Finance via `yfinance` and may be delayed, restated,
> or missing (empty cell = `N/A`). "Good/bad" ranges are rough rules of thumb that
> vary by sector, business model, and growth stage — always compare against the
> company's own history and direct peers.

---

## Identity & size

| Excel header | Field key | Meaning | Units |
| --- | --- | --- | --- |
| Ticker | `ticker` | Stock symbol. Hovering the cell shows a short description of what the company is and does (from Yahoo's business summary). | text |
| Name | `name` | Company name. | text |
| Sector | `sector` | High-level sector classification. | text |
| Industry | `industry` | Finer industry classification. | text |
| Price | `price` | Latest traded share price. | currency / share |
| Market Cap | `market_cap` | Share price × shares outstanding — total equity value. | currency |
| Enterprise Value | `enterprise_value` | Market cap + total debt − cash. Cost to acquire the whole business, debt included. | currency |

> **No currency column in this export.** Unlike the single-company Excel
> export ([STOCK_METRICS.md](STOCK_METRICS.md)), this multi-ticker sheet
> doesn't label which currency each row's dollar figures are in. For the
> overwhelming majority of rows that's a non-issue — the whole sheet is one
> currency (USD). But for a foreign-reporting ticker in the batch (an ADR like
> WIT), Enterprise Value/Revenue/Cash/Debt/Equity/EBITDA/Net Income/FCF/Basic
> EPS/Dividend TTM are silently in that company's reporting currency (₹ for
> WIT), while Price/Market Cap/Diluted EPS are in its trading currency (USD) —
> both stored as plain numbers in the same-looking column as every other
> ticker's dollar figures. The screener **view** and the single-ticker deep
> dive both label this correctly (see [METRICS.md](METRICS.md) §11); this
> batch export currently doesn't carry that label through, so cross-checking a
> foreign ticker's absolute figures here against a same-currency peer will be
> misleading — verify in the deep dive instead when a batch includes one.

## Strategy grades (0–100 integers; higher is better)

Each stock is graded against the three long-term investing strategies
documented in this directory. Grades are computed server-side from the same
row metrics listed below, so an empty metric can lower a grade (missing data
never helps a stock).

| Excel header | Field key | Meaning | Bands |
| --- | --- | --- | --- |
| S1 Triage | `strategy_1` | [Triage framework](stock-triage-strategy.md): data-hygiene quarantine → hard kill-switches (distress, twin-negative earnings, leverage, liquidity, value destruction) → quality score across value creation, profitability, balance sheet, cash conversion. Empty cell = quarantined (missing critical data); 0 = a kill-switch fired. | ≥65 Advance · 45–64 Watchlist · <45 Discard |
| S2 Compounder | `strategy_2` | [Quality Compounder](strategy-2-quality-compounder.md): returns on capital (ROIC/ROCE/ROE), margin moat, capital discipline, 5Y/10Y compounding track record, valuation sanity. Distress or twin-negative earnings caps the score at 35. | ≥70 Compounder · 50–69 Quality watch · <50 Pass |
| S3 Defensive | `strategy_3` | [Defensive Value](strategy-3-defensive-value.md): Graham-style — earnings/cash yield, asset backing (incl. P/E×P/B ≤ 22.5), financial strength, earnings quality, dividend record. | ≥70 Value candidate · 50–69 Fair · <50 Expensive/weak |
| Strat Min | `strategy_min` | Minimum of the three grades — the "good under every lens" rank. **Sort this column descending to find the stocks with the best rating across all strategies.** Empty when any strategy could not be graded. | interpret via the per-strategy bands |
| S1 Flags | `strategy_1_flags` | Triage Stage-0/Stage-3 context flags — never disqualifying, they tell the deep dive where to look first: 🔺 priced for perfection (PEG > 3, P/FCF > 40 or EV/EBITDA > 30) · 🔻 suspiciously cheap (P/E < 8 or EV/EBITDA < 5 with a score ≤ 60) · ⚠ low Altman-Z (< 1.8 for an asset-light, cyclical or utility business — a soft caution, since Altman-Z is a manufacturer model that only *disqualifies* capital-intensive names; Altman excluded utilities from his sample, and a healthy regulated utility's Z sits below 1.8 as a matter of course) · ⚠ low Piotroski F-Score (≤ 3 for a bank, REIT, or mortgage REIT — two of the 9 tests are biased against their intentionally high, stable leverage) · ⚠ divergent multiples / data-sanity warnings (P/B > 40, EV/EBITDA > 150, negative EV) · 💰 payout stress (payout > 60% or FCF coverage < 1.2×; equity REITs judged on FFO payout > 90% instead, mortgage REITs on payout > 100%, and banks and mortgage REITs skip the FCF leg — lending runs through operating cash flow, so GAAP FCF tracks the loan book, not the dividend) · 📉 crowded short (>15% of float) · 🌀 high beta (>1.7). | empty = no warnings |

Every stock is classified into one of six business-type archetypes — see
[Business-type archetypes](stock-triage-strategy.md#business-type-archetypes)
for the full table — and each strategy substitutes metrics that don't fit that
type. **Financials** (banks, insurance carriers, capital markets, credit
services, mortgage *finance*, conglomerates — classified by *industry*; fee
businesses Yahoo files under "Financial Services," like insurance brokers,
exchanges/data vendors and asset managers, score on the standard rubric
instead) get each strategy's ROE/net-margin/Piotroski substitution, since
Altman Z, Debt/EBITDA, current ratio and ROIC are structurally meaningless for
balance-sheet businesses. **Mortgage REITs** (industry "REIT — Mortgage") get
their own dedicated rubric rather than the bank one — a mREIT's net margin is
an income-statement artifact, not a quality signal — graded instead on
dividend coverage, price vs. book value, leverage (wide agency-appropriate
bands), and book-value-per-share trend, the headline mREIT quality signal.

## Valuation (lower is usually cheaper; a very low multiple can signal trouble)

| Excel header | Field key | Meaning | Units | Rough read |
| --- | --- | --- | --- | --- |
| P/E | `pe` | Price ÷ trailing 12-month EPS. | multiple (×) | <15 cheap-ish, 15–25 average, >25 priced for growth. Blank if loss-making. |
| Forward P/E | `forward_pe` | Price ÷ estimated next-year EPS. | multiple (×) | Below trailing P/E implies expected earnings growth. |
| PEG | `peg` | P/E ÷ expected earnings growth. | ratio | ~1.0 fair for the growth; <1 potentially cheap; >2 expensive. |
| P/S | `ps` | Price ÷ trailing 12-month revenue per share. | multiple (×) | Useful when earnings are negative. <1 low, >10 rich. |
| P/B | `pb` | Price ÷ book value (net assets) per share. | multiple (×) | <1 below book; 1–3 typical; high for asset-light firms. |
| EV/EBITDA | `ev_ebitda` | Enterprise value ÷ EBITDA. Capital-structure-neutral. | multiple (×) | <10 cheap, 10–15 average, >15 expensive. |
| P/FCF | `p_fcf` | Market cap ÷ free cash flow. | multiple (×) | <15 attractive, >25 expensive. Blank if FCF ≤ 0. |
| P/C | `pc` | Market cap ÷ total cash. | multiple (×) | Lower = more cash backing the valuation. |
| DCF Value | `dcf_value` | Inferred fair value per share from a 10-year two-stage FCFF DCF: latest annual FCF grown at the company's historical FCF CAGR (clamped 0–20%; flat 2.5% when no usable history), fading linearly to 2.5% terminal growth, discounted at the row's WACC; Gordon terminal value; minus debt, plus cash, ÷ shares outstanding. In the trading currency, directly comparable to Price. On-screen it sits **next to Price**, colored green when the model reads the stock as below fair value and red when above; hover it for the exact **DCF Upside %**. Sorting this column sorts by that upside — descending surfaces the most-undervalued names first. See [METRICS.md](METRICS.md) §2 for the full methodology, and use the deep-dive **⭳ DCF** button for the complete working. | currency / share | Compare against Price. Blank for financials/REITs (FCFF doesn't fit), FCF ≤ 0, or WACC unavailable/≤ 3%. |
| DCF Upside | `dcf_upside` | DCF Value ÷ Price − 1. On the screener/watchlist tabs this isn't its own column — it colors the DCF Value cell, shows on hover, and is what the DCF Value column sorts by. It is a full standalone column in the exported workbook. | fraction | >0 = model reads the stock as below fair value; <0 above. Assumption-heavy — a screen for what deserves a closer look, not a target price. |
| EPS | `eps` | Trailing 12-month earnings per share. | currency / share | Higher and rising is better. |

## Profitability (higher is better; consistency matters as much as level)

| Excel header | Field key | Meaning | Units | Rough read (as fraction) |
| --- | --- | --- | --- | --- |
| Net Margin | `profit_margin` | Net income ÷ revenue. | fraction | >0.10 solid, >0.20 excellent, negative = unprofitable. |
| Gross Margin | `gross_margin` | (Revenue − cost of goods sold) ÷ revenue. | fraction | >0.40 strong (software 0.70+, retail <0.30). |
| Operating Margin | `operating_margin` | Operating income ÷ revenue (before interest & tax). | fraction | >0.15 healthy; negative = core operations lose money. |
| EBITDA Margin | `ebitda_margin` | EBITDA ÷ revenue. | fraction | >0.20 generally strong. |
| ROE | `roe` | Net income ÷ shareholders' equity. | fraction | >0.15 good; can be inflated by leverage or thin equity. |
| ROA | `roa` | Net income ÷ total assets. | fraction | >0.05 decent; banks/utilities lower. |
| ROIC | `roic` | After-tax operating profit ÷ (debt + equity). | fraction | Creates value only when > cost of capital (~0.08–0.10). >0.15 excellent. |
| ROCE | `roce` | EBIT ÷ (total assets − current liabilities). Pre-tax sibling of ROIC. | fraction | >0.15 strong. |
| WACC | `wacc` | Weighted average cost of capital: cost of equity via CAPM (10Y Treasury + Beta × 5.5% equity risk premium — a fixed US-market estimate, applied to every ticker regardless of domicile; see [METRICS.md](METRICS.md) §3) + after-tax cost of debt. | fraction | Benchmark for ROIC; typically ~0.06–0.12. Value is created when ROIC > WACC. |
| Revenue/Share | `revenue_per_share` | Trailing 12-month revenue ÷ shares outstanding. | currency / share | Rising over time is the signal to want. |
| Net Income | `income` | Net income (trailing 12 months). | currency | Profit attributable to shareholders. |
| FCF | `fcf` | Free cash flow = operating cash flow − capex. | currency | Positive and growing is the goal. |

## Financial health (can the company pay its bills and survive a downturn?)

| Excel header | Field key | Meaning | Units | Rough read |
| --- | --- | --- | --- | --- |
| Debt/Eq | `debt_to_equity` | Total Debt ÷ Total Equity, computed from the two columns in this row so they reconcile. | fraction | <1.0 conservative, 1.0–2.0 moderate, >2.0 aggressive (ex banks/utilities). |
| Debt/Eq (MRQ) | `debt_to_equity_mrq` | Yahoo's pre-computed Debt/Equity from its most-recent-quarter balance sheet. | fraction | Same ranges; differs from Debt/Eq when the latest quarter has moved since fiscal year-end. |
| Debt/EBITDA | `debt_ebitda` | Total Debt ÷ EBITDA — years of EBITDA needed to repay all debt. | multiple (×) | <3× comfortable, 3–4× watch, >4–5× heavily leveraged. |
| LT Debt/Eq | `lt_debt_to_equity` | Long-term debt ÷ shareholders' equity. | fraction | As above, long-term portion only. |
| Current Ratio | `current_ratio` | Current assets ÷ current liabilities. | ratio | >1 covers near-term bills; 1.5–3 comfortable; <1 possible squeeze. |
| Quick Ratio | `quick_ratio` | (Current assets − inventory) ÷ current liabilities. | ratio | >1 strong; stricter than current ratio. |
| Total Cash | `total_cash` | Cash + short-term investments. | currency | Dry powder; compare to total debt. |
| Total Debt | `total_debt` | Short- + long-term borrowings. | currency | Judge against cash, equity, EBITDA. |
| Total Equity | `total_equity` | Assets − liabilities (book value). | currency | Negative is a red flag. |
| EBITDA | `ebitda` | Net Income + Interest + Tax + Depreciation & Amortization — built up from the bottom line, not down from revenue (Yahoo's TTM figure — the same one behind Debt/EBITDA and EBITDA/FCF). | currency | Proxy for operating cash earnings; compare to debt and FCF. |
| EBITDA/FCF | `ebitda_fcf` | EBITDA ÷ Free Cash Flow — how much EBITDA it takes to produce a dollar of free cash. | multiple (×) | Closer to 1× = cleaner cash conversion; high values flag capex/tax/working-capital drag. |

## Dividends (sustainability matters more than headline yield)

| Excel header | Field key | Meaning | Units | Rough read (as fraction) |
| --- | --- | --- | --- | --- |
| Yield | `div_yield` | Forward annual dividend ÷ price. | fraction | <0.02 low, 0.02–0.04 typical, 0.04–0.06 high, >0.07–0.08 often signals cut risk. |
| 5Y Avg Yield | `five_year_avg_yield` | Average yield over the past 5 years. | fraction | Context for whether today's yield is unusually high/low. |
| Payout Ratio | `payout_ratio` | Dividends ÷ earnings. | fraction | <0.60 comfortable, 0.60–0.80 watch, >1.0 paying more than it earns. |
| Div Growth 3Y | `div_growth_3y` | Annualized dividend CAGR over 3 years. | fraction | Steady positive growth = healthy payer. |
| Div Growth 5Y | `div_growth_5y` | Annualized dividend CAGR over 5 years. | fraction | As above, longer track record. |
| Div Estimate | `dividend_estimate` | Forward annual dividend per share (run-rate). | currency / share | — |
| Div TTM | `dividend_ttm` | Dividends actually paid per share, trailing 12m. | currency / share | — |
| FCF Coverage | `fcf_coverage` | Free cash flow ÷ dividends paid. | multiple (×) | ≥1.2 safe, 0.8–1.2 tight, <0.8 under-covered. |
| Yrs Div Increase | `years_div_increase` | Consecutive completed years of rising dividends. | integer (years) | 10+ strong culture, 25+ "dividend aristocrat". |
| Ex-Dividend Date | `ex_dividend_date` | Buy before this date to receive the next dividend. | date (YYYY-MM-DD) | — |

## Risk (volatility, crowding, distress signals)

| Excel header | Field key | Meaning | Units | Rough read |
| --- | --- | --- | --- | --- |
| Beta | `beta` | Sensitivity vs. the market (S&P 500). | number | 1 = moves with market; >1 amplified; <1 stabler; <0 inverse. |
| Short Interest | `short_interest` | Shares sold short ÷ public float. | fraction | <0.05 normal, 0.05–0.10 elevated, >0.10–0.20 heavily shorted. |
| Days to Cover | `days_to_cover` | Short interest ÷ average daily volume. | number (days) | <1 easy to cover; >5–7 crowded short, squeeze potential. |
| Altman Z-Score | `altman_z` | Bankruptcy-risk gauge (higher = safer). | number | >2.99 safe, 1.81–2.99 grey, <1.81 distress. Ignored for financials/REITs/mortgage REITs; a soft flag (not a kill) for asset-light and cyclical names. |
| Piotroski F-Score | `piotroski_f` | Fundamental strength across 9 tests (1 pt each). | integer 0–9 | 7–9 strong, 4–6 middling, 0–3 weak. Replaced by ROE/net-margin for financials/REITs, and by book-value-per-share trend for mortgage REITs. |

## Performance (price return — **excludes dividends**)

| Excel header | Field key | Meaning | Units |
| --- | --- | --- | --- |
| Perf YTD | `perf_ytd` | Price return since Jan 1 this year. | fraction |
| Perf 1Y | `perf_1y` | Price return over the last 1 year. | fraction |
| Perf 3Y | `perf_3y` | Price return over the last 3 years. | fraction |
| Perf 5Y | `perf_5y` | Price return over the last 5 years. | fraction |
| Perf 10Y | `perf_10y` | Price return over the last 10 years. | fraction |

*These are price appreciation only, so a high-yield stock's true total return is
higher than shown.*

---

## Other sheets in the screener export

- **Price History** — daily closing price (last 1 year) for each ticker, aligned by date. One column per ticker; values in the company's reporting currency.
- **Financials** — annual income statement, stacked per ticker. Rows are line items (Total Revenue, Net Income, …); columns are fiscal-year-end dates. Values in reporting currency. Note: the oldest annual column is often blank — Yahoo's free feed reliably populates ~4 fiscal years.

See [STOCK_METRICS.md](STOCK_METRICS.md) for the single-company deep-dive export,
which uses the **same fraction convention**.
