# Metrics Reference

A plain-language guide to every metric shown in the Stock Terminal, how it is
calculated, how to read it, and — where one exists — a rough rule-of-thumb range.

> **Caveat that applies to everything below.** "Good" and "bad" ranges are
> rules of thumb that vary enormously by **sector, business model, and stage of
> growth**. A software company and a bank are not comparable on most of these.
> Always judge a number against the company's own history and its direct peers,
> not an absolute threshold. All data comes from Yahoo Finance via `yfinance`
> and can be delayed, restated, or occasionally missing (shown as `N/A`).

---

## 1. Price & size

| Metric | Meaning | How to read it |
| --- | --- | --- |
| **Price** | Latest traded share price. | Quote only — meaningless for "cheap/expensive" without the valuation ratios below. |
| **Market Cap** | Share price × shares outstanding. The market's price tag on all equity. | Size bucket: mega >$200B, large $10–200B, mid $2–10B, small $300M–2B, micro <$300M. Larger = generally more stable, slower growth. |
| **Enterprise Value (EV)** | Market cap + total debt − cash. What it would cost to buy the whole business, debt included. | Used in EV/EBITDA. Better than market cap for comparing companies with different debt loads. |

---

## 2. Valuation ratios

How much you pay per unit of value. **Lower is usually cheaper**, but a low
multiple can also signal a struggling business ("value trap"), and a high
multiple can be justified by fast growth.

| Metric | Formula | How to read it | Rough range |
| --- | --- | --- | --- |
| **P/E (Trailing)** | Price ÷ last-12-month EPS | Years of current earnings to "pay back" the price. | <15 cheap-ish, 15–25 average, >25 priced for growth. Negative if loss-making (shown N/A). |
| **Forward P/E** | Price ÷ estimated next-year EPS | Same idea, using analyst forecasts. Lower than trailing P/E implies expected earnings growth. | As above. |
| **PEG** | P/E ÷ expected earnings growth % | P/E adjusted for growth. | ~1.0 is "fair for the growth"; <1 potentially undervalued; >2 expensive. |
| **P/B (Price/Book)** | Price ÷ book value per share | Price vs. net assets on the books. | <1 trades below book (cheap or troubled); 1–3 typical; high for asset-light firms. |
| **P/S (Price/Sales)** | Price ÷ revenue per share | Useful when earnings are negative. | <1 low, 1–3 moderate, >10 rich (common in high-growth tech). |
| **P/C (Price/Cash)** | Market cap ÷ total cash | How much cash backs the valuation. | Lower = more cash cushion. |
| **P/FCF** | Market cap ÷ free cash flow | Price vs. actual cash generated. | <15 attractive, 15–25 fair, >25 expensive. Negative FCF → N/A. |
| **EV/EBITDA** | Enterprise value ÷ EBITDA | Capital-structure-neutral valuation (ignores debt & tax differences). | <10 cheap, 10–15 average, >15 expensive (sector-dependent). |
| **Diluted EPS** | (Net Income − Preferred Dividends) ÷ Weighted Average **Diluted** Shares Outstanding (TTM) | Profit per share after accounting for all potentially dilutive securities (options, warrants, convertibles). This is the standard EPS figure reported by most financial sites and used in P/E ratios. | Higher and rising is better; compare growth, not the absolute level. |
| **Basic EPS** | (Net Income − Preferred Dividends) ÷ Weighted Average **Basic** Shares Outstanding (TTM) | Profit per share using only shares actually outstanding — no dilution assumed. Always ≥ Diluted EPS. A large gap between Basic and Diluted EPS signals heavy dilutive securities outstanding. | — |

---

## 3. Profitability

How efficiently the company turns revenue and capital into profit. **Higher is
better**, and consistency over time matters as much as the level.

| Metric | Formula | How to read it | Rough range |
| --- | --- | --- | --- |
| **Gross Margin %** | (Revenue − COGS) ÷ revenue | Pricing power and production efficiency. | >40% strong, varies hugely (software 70%+, retail <30%). |
| **Operating Margin %** | Operating income ÷ revenue (Yahoo's trailing-12-month figures) | Profit after running the business, before interest & tax. **Note:** Yahoo derives its own operating income and revenue base, so this can differ — even in sign — from the fiscal-year statement margin shown in the revenue chart. | >15% healthy; negative means core operations lose money. |
| **EBITDA Margin %** | EBITDA ÷ revenue | Operating profitability before non-cash (D&A) and financing items. | >20% generally strong; useful for capital-intensive firms. |
| **Net Profit Margin %** | Net income ÷ revenue | Bottom-line cents kept per sales dollar. | >10% solid, >20% excellent, negative = unprofitable. |
| **ROE %** (Return on Equity) | Net income ÷ shareholders' equity | Return generated on owners' capital. | >15% good. **Caution:** can be inflated by high debt or a small/negative equity base. |
| **ROA %** (Return on Assets) | Net income ÷ total assets | How well assets are used to make profit. | >5% decent; banks/utilities run lower, asset-light firms higher. |
| **ROIC %** (Return on Invested Capital) | After-tax operating profit ÷ (debt + equity) | Return on **all** capital employed — the cleanest quality gauge. Compare directly against **WACC**: ROIC > WACC = value creation; ROIC < WACC = value destruction. | >15% is excellent. Meaningful only relative to WACC. |
| **WACC %** (Weighted Average Cost of Capital) | (Equity weight × Cost of Equity) + (Debt weight × After-tax Cost of Debt) | The minimum return the business must earn to satisfy all capital providers. Cost of equity via CAPM (10Y Treasury + Beta × 5.5% ERP); cost of debt from interest expense ÷ total debt. | Benchmark for ROIC. Typical range 6–12% depending on beta, leverage, and the rate environment. Falls back to 10Y Treasury for cost of debt when interest expense is unavailable. |
| **ROCE %** (Return on Capital Employed) | EBIT ÷ (total assets − current liabilities) | Pre-tax sibling of ROIC. | >15% strong; compare to ROIC and to peers. |
| **Revenue/Share** | TTM revenue ÷ shares outstanding | Sales backing each share. | Rising over time is the signal to want. |

> **Why a margin can differ from the statement figures.** The margins and
> **Net Income** above are Yahoo's **trailing-twelve-month (TTM)** figures —
> TTM profit ÷ TTM revenue. The statement tables and the
> **Revenue · Profit · Net Income · FCF** chart use the **annual / fiscal-year**
> columns instead, so dividing (or reading) those won't reproduce the panel. On
> top of the window difference, Yahoo **derives its own** gross profit,
> operating income, net income (to common), EBITDA, and revenue base, which can
> classify expenses differently from the statement lines — so a panel margin can
> differ from the chart's margin **even in sign** (e.g. a negative TTM Operating
> Margin % next to a positive fiscal-year operating margin). Read the panel as
> Yahoo's published TTM view and the charts as the audited fiscal-year view.
> See **§10 Interpreting panel-vs-chart discrepancies** for what to conclude
> from these gaps.

---

## 4. Financial health (balance sheet & liquidity)

Can the company pay its bills and survive a downturn?

| Metric | Formula | How to read it | Rough range |
| --- | --- | --- | --- |
| **Total Cash** | Cash + short-term investments | Dry powder and safety buffer. | More is safer; compare to total debt. |
| **Total Debt** | Short- + long-term borrowings | Leverage load. | Judge against cash, equity, and EBITDA. |
| **Total Equity** | Assets − liabilities, book value (latest **annual** balance sheet) | Owners' stake / net worth. | Negative equity is a red flag (often from heavy buybacks or losses). |
| **Debt/Equity** | Total Debt ÷ Total Equity (as %), computed from the two figures shown above so they **reconcile** | Leverage relative to owners' capital. | <100% conservative, 100–200% moderate, >200% aggressive (except banks/utilities). |
| **Debt/Equity (MRQ)** | Yahoo's pre-computed Debt/Equity, taken from its **most-recent-quarter** balance sheet | Same leverage gauge, but on the freshest quarterly figures rather than the annual ones. | Read with the same ranges. It can differ from **Debt/Equity** above when the latest quarter's debt or equity has moved since fiscal year-end — a larger or smaller recent equity base shifts the ratio. |
| **Debt/EBITDA** | Total Debt ÷ EBITDA | How many years of EBITDA it would take to repay all debt — the leverage gauge lenders watch most. | **<3× comfortable**, 3–4× watch, **>4–5× heavily leveraged**. Varies by sector; utilities/REITs sustain more. |
| **Current Ratio** | Current assets ÷ current liabilities | Ability to cover bills due within a year. | **>1 covers near-term obligations**; 1.5–3 comfortable; <1 potential squeeze; very high may mean idle assets. |
| **Quick Ratio** | (Current assets − inventory) ÷ current liabilities | Stricter liquidity test (excludes inventory). | >1 strong; <1 relies on selling inventory to pay bills. |
| **Free Cash Flow (FCF)** | Operating cash flow − capital expenditure | Cash left for dividends, buybacks, and debt paydown. | Positive and growing is the goal; persistent negative FCF needs external funding. |
| **EBITDA** | Earnings before interest, tax, depreciation & amortization (Yahoo's trailing-12-month figure) | Proxy for operating cash earnings — the raw figure behind the Debt/EBITDA and EBITDA/FCF ratios shown alongside it. | Compare against total debt and FCF; negative EBITDA means the ratios built on it are suppressed. |
| **EBITDA/FCF** | EBITDA ÷ Free Cash Flow | Cash-conversion check: how much reported EBITDA it takes to produce a dollar of free cash. | **Closer to 1× = cleaner conversion.** High values flag heavy capex, taxes or working-capital drag eating into the cash EBITDA implies. |

---

## 5. Dividends

For income investors. Sustainability matters more than headline yield.

| Metric | Formula | How to read it | Rough range |
| --- | --- | --- | --- |
| **Dividend Rate / Estimate** | Forward annual dividend per share | The current run-rate payout. | — |
| **Dividend TTM** | Dividends actually paid per share (trailing 12m) | What was really paid recently. | — |
| **Dividend Yield %** | Annual dividend ÷ price | Income return at today's price. | <2% low, 2–4% typical, 4–6% high, **>7–8% often signals risk** of a cut. |
| **5Y Avg Yield %** | Average yield over the last 5 years | Context for whether today's yield is unusually high/low. | Today's yield far above its 5Y average can flag a falling price or a stretched payout. |
| **Payout Ratio %** | Dividends ÷ earnings | Share of profit paid out. | <60% comfortable, 60–80% watch, **>100% paying more than it earns** (unsustainable unless temporary). |
| **FCF Coverage** | Free cash flow ÷ dividends paid | How many times cash flow covers the dividend. | **🟢 ≥1.2× safe, 🟡 0.8–1.2× tight, 🔴 <0.8× under-covered.** |
| **Div Growth 3Y / 5Y %** | Annualized dividend CAGR | Track record of raising the payout. | Steady positive growth is a sign of a healthy, confident payer. |
| **Years ▲ Dividend** | Consecutive completed years of rising dividends | Reliability streak. | 10y+ = strong culture of returning cash; 25y+ = "dividend aristocrat" territory. |
| **Ex-Dividend Date** | Cutoff to own shares for the next dividend | Buy **before** this date to receive the upcoming dividend. | — |

---

## 6. Strategy ratings

Three independent long-term investing strategies, each grading every stock
0–100 from the metrics above. Missing data always scores 0 for that metric —
a strategy can never be flattered by a gap in the data. Each strategy is fully
documented in its own file in this directory; this section is a summary.

| Strategy | Question it answers | Verdict bands | Full rules |
| --- | --- | --- | --- |
| **S1 · Triage** | Is this business obviously broken? Quarantines unreadable rows, then applies hard kill-switches (distress, twin-negative earnings, over-leverage, liquidity crunch, value destruction) before scoring survivors on value creation, profitability, balance sheet, and cash conversion. | ≥65 **Advance**, 45–64 **Watchlist**, <45 **Discard**. Blank = quarantined (a critical field like Total Debt or Net Income is missing and unrecoverable). | [stock-triage-strategy.md](stock-triage-strategy.md) |
| **S2 · Compounder** | Can this business compound capital for a decade? Weighs returns on capital (ROIC/ROCE/ROE), margin moat, capital discipline, a demonstrated 5Y/10Y price-compounding record, and a valuation sanity check. | ≥70 **Compounder**, 50–69 **Quality watch**, <50 **Pass**. A distress or twin-negative-earnings guard caps the score at 35 regardless of the rest. | [strategy-2-quality-compounder.md](strategy-2-quality-compounder.md) |
| **S3 · Defensive Value** | Is this cheap *and* safe enough to hold? A Graham-style margin-of-safety score: earnings/cash yield, asset backing (including the classic P/E × P/B ≤ 22.5 test), financial strength, earnings quality, and dividend record. | ≥70 **Value candidate**, 50–69 **Fair**, <50 **Expensive/weak**. | [strategy-3-defensive-value.md](strategy-3-defensive-value.md) |
| **Strat Min** | Which stocks hold up under *every* lens at once? The minimum of the three scores above. | Read against whichever strategy produced the minimum. Blank if any strategy is ungradable (e.g. S1 quarantined). | — (composite; see `strategies.py`) |
| **S1 Flags** | Where should the deep dive look first? The triage framework's never-disqualifying context flags: 🔺 priced for perfection · 🔻 suspiciously cheap · ⚠ divergent multiples and data-sanity warnings (P/B > 40, EV/EBITDA > 150, negative EV) · 💰 payout stress · 📉 crowded short · 🌀 high beta. | Informational only — flags never change a score. Blank = no warnings. | [stock-triage-strategy.md](stock-triage-strategy.md) (Stages 0 & 3) |

Financials (banks, insurers) are graded on each strategy's own documented
substitution — e.g. S1 and S2 swap in ROE/net-margin/Piotroski where
Altman Z, Debt/EBITDA and ROIC are structurally meaningless for
balance-sheet-driven businesses; S3 swaps in ROA for the financial-strength
pillar.

**Where to sort:** rank by **Strat Min**, descending, to surface the stocks
that score well under *all three* strategies simultaneously — a business in
demonstrable health (S1), with a durable moat (S2), at a defensible price
(S3) is the intersection this whole framework exists to find.

---

## 7. Risk

Volatility, crowding, and distress signals.

| Metric | Formula / source | How to read it | Ranges |
| --- | --- | --- | --- |
| **Beta** | Sensitivity of the stock vs. the market (S&P 500) | Volatility/market-risk gauge. | **β = 1** moves with the market; **>1** amplified (1.5 ≈ 50% bigger swings); **<1** more stable; **<0** moves opposite the market. |
| **Short Interest %** | Shares sold short ÷ public float | How much of the float is bet against. | <5% normal, 5–10% elevated, **>10–20% heavily shorted** (bearish sentiment and/or squeeze fuel). |
| **Days to Cover** | Short interest ÷ average daily volume | Days of normal trading for shorts to buy back. | <1 easy to cover; **>5–7 crowded short**, higher squeeze potential. |
| **Altman Z-Score** | `1.2·WC/TA + 1.4·RE/TA + 3.3·EBIT/TA + 0.6·MktCap/TL + 1.0·Sales/TA` | Bankruptcy-risk gauge (higher = safer). | **>2.99 "safe" zone, 1.81–2.99 "grey" zone, <1.81 "distress" zone.** Built for manufacturers — **unreliable for banks/financials** (shown N/A when inputs don't fit). |
| **Piotroski F-Score** | 0–9 points across 9 fundamental tests (see below) | Overall fundamental strength. | **7–9 strong, 4–6 middling, 0–3 weak.** Needs a prior year of statements. |

**Piotroski F-Score — the 9 tests (1 point each):**
*Profitability:* (1) positive net income, (2) positive operating cash flow,
(3) ROA improving year-over-year, (4) operating cash flow > net income
(earnings backed by cash). *Leverage/liquidity:* (5) lower long-term-debt
ratio, (6) higher current ratio, (7) no new share issuance. *Efficiency:*
(8) higher gross margin, (9) higher asset turnover.

---

## 8. Charts (deep-dive)

### Revenue · Profit · Net Income · FCF (last 5 years)
Dollar bars per fiscal year:
- **Revenue** — total sales.
- **Gross Margin** (bar = gross profit $) — hover shows the gross **margin %**. Fiscal-year statement figure — can differ from the TTM Gross Margin % in the Profitability panel.
- **Operating Margin** (bar = operating income $) — hover shows operating **margin %**. Taken from the fiscal-year income statement, so it can differ from the TTM Operating Margin % in the Profitability panel (Yahoo derives that one itself).
- **Net Income** (bar) — hover shows net **margin %**. Fiscal-year statement figure — can differ from the TTM Net Income and Profit Margin % in the Profitability panel.
- **FCF** — free cash flow.

*Read it for:* the trend (rising bars), and how much of each revenue dollar
survives down to operating income, net income, and cash. Widening gaps between
Revenue and the profit bars mean rising costs.

### Growth · YoY % (last 5 years)
Year-over-year growth rate of **Revenue, EPS, and EBITDA** (bars, left axis),
plus an **EBITDA Margin %** line on the right axis. *Read it for:* acceleration
vs. deceleration and consistency. EPS growing faster than revenue usually means
improving margins and/or buybacks; the EBITDA-margin line shows whether that
profitability is actually trending up or down over the same years. (Bars need a
prior year, so the oldest statement year has no growth bar.)

### Share Dilution (last 5 years)
Share counts as bars (left axis) with payout/yield as lines (right %-axis):
- **Shares Outstanding** (bar) — total shares. **Falling = buybacks** (each
  remaining share owns more of the company); **rising = dilution** (your stake
  shrinks, often from stock-based compensation or equity raises).
- **Float Shares** (bar) — shares freely tradable by the public. *Only the
  latest year is available from the data source, so it appears on the most
  recent bar only.*
- **Treasury Shares** (bar) — repurchased shares held by the company (often ~0
  for firms that retire bought-back shares).
- **Dividend Yield %** (line) — historical yield (annual dividends ÷ year-end price).
- **Payout Ratio %** (line) — dividends as a share of earnings, over time.

*Read it for:* whether management is returning capital (shrinking share count,
steady/rising dividend) or diluting holders, and whether the payout ratio is
creeping toward unsustainable levels.

---

## 9. Performance (price return)

Price-only returns over **YTD, 1Y, 3Y, 5Y, 10Y**. These **exclude dividends**
(they are price appreciation only), so a high-yield stock's true total return is
higher than shown here. *Read it for:* momentum and long-run track record —
but past performance does not predict future returns.

---

## 10. Interpreting panel-vs-chart discrepancies

The metric panels and the charts can show different figures for the same
metric — sometimes very different (a panel Operating Margin of −7% next to a
chart bar at +20%). This section explains what those gaps mean and what to
conclude from them.

### The two numbers answer different questions

- **Charts / statements (fiscal year)** — the audited record: *"how did the
  last full year go?"* Reliable, but can be up to ~15 months stale.
- **Panels (Yahoo TTM)** — the freshest four quarters: *"how is the business
  doing right now?"* Updates every earnings report, but uses Yahoo's own
  (unaudited, black-box) expense classification.

Neither is wrong. **The gap between them is itself a signal**, and it
decomposes into two parts.

### 1. The window gap → momentum

When the TTM and fiscal-year figures cover different quarters, the divergence
tells you which way the business is turning:

- **TTM worse than FY** → the quarters *since* fiscal year-end are dragging
  the average down: the business deteriorated recently. The chart's rising
  bars are the past; the panel is closer to the present.
- **TTM better than FY** → recent quarters are improving; the annual chart
  understates the current run-rate.

So a stock showing a strong fiscal year but a weak TTM panel isn't simply
"profitable" or "unprofitable" — the honest reading is *"last year was strong,
but profitability has deteriorated in the most recent quarters."* Verify in
the quarterly statement tables: the last 4–6 quarterly columns almost always
explain the gap.

### 2. The definition gap → earnings quality

Even over the same window, Yahoo's derived profit lines can sit far from the
statement lines (its operating income can be a billion dollars away from the
income statement's). A gap that large means there are **big items whose
classification is debatable** — mark-to-market losses on held assets,
impairments, restructuring charges, heavy stock-based compensation, legal
settlements.

- A wide definition gap flags **low earnings quality / a heavy "unusual
  items" load**. Clean businesses (e.g. consumer staples) show near-identical
  numbers from both sources.
- It also means earnings are **sensitive to something other than operations**
  (e.g. a crypto exchange whose profits swing with the coins on its balance
  sheet, regardless of how the exchange itself performs).

### Practical rules of thumb

1. **Never average the two or pick the prettier one.** Use fiscal-year
   statements for *"what is this business structurally"*; use TTM for
   *"what's happening now."*
2. **When they disagree, open the quarterly statements** and scan the last
   4–6 quarters — that shows whether the gap is a trend or one bad quarter.
3. **Sign flips are a red flag to investigate, not a verdict.** A negative
   TTM margin against a positive fiscal-year margin means at least one recent
   quarter was ugly — find out whether the cause is recurring (e.g. fee
   compression) or episodic (a one-off loss).
4. **Persistent large gaps = treat headline ratios skeptically** for that
   company. P/E, PEG, and margin screens are unstable when the "E" itself is
   volatile and definition-dependent.
5. **Trust direction over level.** Both sources usually agree on the *trend*
   (margins expanding or compressing) even when the levels differ.

---

## How the deep-dive panels map to this doc

| Panel in the app | Section here |
| --- | --- |
| Valuation | §1 Price & size, §2 Valuation ratios |
| Profitability | §3 Profitability |
| Financial Health | §4 Financial health |
| Dividend | §5 Dividends |
| Strategy Ratings | §6 Strategy ratings |
| Risk | §7 Risk |
| Revenue/Growth/Share-Dilution charts | §8 Charts |
| Performance columns | §9 Performance |
