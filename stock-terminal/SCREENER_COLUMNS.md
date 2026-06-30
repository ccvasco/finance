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
> - **currency** — an absolute amount in the company's reporting currency (USD, EUR, …).
>   Per-share values (Price, EPS, dividends) are per single share.
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
| Ticker | `ticker` | Stock symbol. | text |
| Name | `name` | Company name. | text |
| Sector | `sector` | High-level sector classification. | text |
| Industry | `industry` | Finer industry classification. | text |
| Price | `price` | Latest traded share price. | currency / share |
| Market Cap | `market_cap` | Share price × shares outstanding — total equity value. | currency |
| Enterprise Value | `enterprise_value` | Market cap + total debt − cash. Cost to acquire the whole business, debt included. | currency |

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
| Altman Z-Score | `altman_z` | Bankruptcy-risk gauge (higher = safer). | number | >2.99 safe, 1.81–2.99 grey, <1.81 distress. Unreliable for banks/financials (blank). |
| Piotroski F-Score | `piotroski_f` | Fundamental strength across 9 tests (1 pt each). | integer 0–9 | 7–9 strong, 4–6 middling, 0–3 weak. |

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
