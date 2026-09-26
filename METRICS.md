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
| **Diluted EPS** | (Net Income − Preferred Dividends) ÷ Diluted Shares Outstanding (TTM), where the denominator = Basic shares **+** every share that would exist if all outstanding options, RSUs, warrants, and convertible securities were exercised/converted into common stock | Profit per share after accounting for all potentially dilutive securities. This is the standard EPS figure reported by most financial sites and used in P/E ratios. | Higher and rising is better; compare growth, not the absolute level. |
| **DCF Value** | 10-year two-stage FCFF DCF per share (see the methodology note below) | The model's inferred fair value per share, in the trading currency — directly comparable to Price. | Above Price = the model reads the stock as undervalued. N/A for financials/REITs, FCF ≤ 0, or WACC unavailable. |
| **DCF Upside** | DCF Value ÷ Price − 1 | How far the current price sits below (+) or above (−) the model's fair value. | Assumption-heavy — a screen for where to look closer, not a target price. |
| **Basic EPS** | (Net Income − Preferred Dividends) ÷ Basic Shares Outstanding (TTM), where the denominator = actual common shares outstanding only — nothing hypothetical added | Profit per share using only shares actually outstanding — no dilution assumed. Always ≥ Diluted EPS. A large gap between Basic and Diluted EPS signals heavy dilutive securities outstanding. | — |

> **REITs use P/FFO, not P/E, as their primary multiple.** REIT depreciation
> distorts earnings the same way it distorts ROIC, so P/E is a weak valuation
> signal for property businesses. See **§6b REIT-specific metrics**.

### How DCF Value is computed

A deliberately simple, fully automatic 10-year two-stage free-cash-flow-to-firm
(FCFF) model, discounted at the same **WACC** shown in §3:

1. **Base cash flow** — the latest annual Free Cash Flow (must be positive;
   loss-making-on-cash names get N/A rather than a fabricated value).
2. **Stage-1 growth** — the company's **own historical FCF CAGR**, computed
   from the ~4 fiscal years of cash-flow statements Yahoo provides, **clamped
   to 0–20%** so one-off spikes can't compound into absurdity. When no usable
   history exists (fewer than two positive-FCF years), the model falls back to
   a flat 2.5% — the conservative floor, not a guess.
3. **The fade** — growth declines **linearly from the stage-1 rate to 2.5%**
   across the 10 projected years. Why fade rather than hold-then-cliff: growth
   mean-reverts empirically (competition, scale, market saturation), a cliff
   makes the output hypersensitive to the horizon, and no company outgrows the
   economy forever — 2.5% ≈ long-run nominal GDP growth, the rate a mature
   business can sustain in perpetuity without implausibly becoming the whole
   economy. Fading also shrinks the terminal value's share of the total,
   making the output more robust to the assumptions.
4. **Terminal value** — Gordon growth on year-10 FCF at 2.5%, requiring WACC
   to exceed the terminal rate by at least 0.5 pt (otherwise the denominator
   approaches zero and the output would be absurd rather than merely rough —
   the model returns N/A instead).
5. **Enterprise → equity → per share** — PV of the 10 flows + PV of the
   terminal value, minus total debt, plus cash, divided by shares
   outstanding. For foreign-reporting tickers (§11) the statement-currency
   result is FX-converted so DCF Value is always in the **trading currency**,
   directly comparable to Price.

**Not computed for financials or REITs** — the same archetype logic as §6a:
FCF is meaningless for balance-sheet businesses (banks, insurers) and
depreciation/capex-distorted for property businesses (equity REITs are valued
on FFO, mortgage REITs on book value).

On the screener and watchlist tabs, **DCF Value sits next to Price**, colored
green when the model reads the stock as below its fair value and red when
above; hovering the cell shows the exact upside % versus price. **Sorting the
DCF Value column sorts by that upside** — descending puts the most-undervalued
names on top. (A standalone, separately sortable **DCF Upside** column also
lives in the Excel export.) The deep-dive Valuation panel shows both **DCF
Value** and **DCF Upside %** as rows.

**Treat it as a screen, not a target price.** Every input is a rough
automatic estimate: growth is extrapolated from as few as two annual
statements, and the discount rate inherits WACC's own caveats (CAPM beta, the
fixed 5.5% US ERP — see §3). The coloring flags names whose cash flows look
mispriced *under these assumptions*; it does not tell you the assumptions are
right. All the model's constants (10-year horizon, 0–20% clamp, 2.5% terminal,
0.5 pt WACC margin) are named constants in `app.py`.

**To see the model's full work for one stock**, use the deep dive's
**⭳ DCF** button: it exports a `TICKER-DCF-*.xlsx` workbook that is a **live
spreadsheet model** — the inputs are values and every downstream cell (growth
fade, projected cash flows, discount factors, present values, terminal value,
the WACC composition, and the enterprise → equity → per-share bridge) is an
actual Excel formula, so you can trace every number and tweak assumptions to
watch the valuation recompute. See [STOCK_METRICS.md](STOCK_METRICS.md),
"The DCF export".

---

## 3. Profitability

How efficiently the company turns revenue and capital into profit. **Higher is
better**, and consistency over time matters as much as the level.

| Metric | Formula | How to read it | Rough range |
| --- | --- | --- | --- |
| **Gross Margin %** | (Revenue − COGS) ÷ revenue, where COGS = Cost of Goods Sold (a.k.a. Cost of Revenue): the direct cost of producing/delivering what was sold — materials, direct labor, manufacturing overhead (Yahoo's trailing-12-month figures) | Pricing power and production efficiency. **Note:** Yahoo derives its own gross profit and revenue base, so this can differ from the fiscal-year statement margin shown in the revenue chart. | >40% strong, varies hugely (software 70%+, retail <30%). |
| **Operating Margin %** | Operating income ÷ revenue (Yahoo's trailing-12-month figures) | Profit after running the business, before interest & tax. **Note:** Yahoo derives its own operating income and revenue base, so this can differ — even in sign — from the fiscal-year statement margin shown in the revenue chart. | >15% healthy; negative means core operations lose money. |
| **EBITDA Margin %** | EBITDA ÷ revenue | Operating profitability before non-cash (D&A) and financing items. | >20% generally strong; useful for capital-intensive firms. |
| **Net Profit Margin %** | Net income ÷ revenue | Bottom-line cents kept per sales dollar. | >10% solid, >20% excellent, negative = unprofitable. |
| **ROE %** (Return on Equity) | Net income ÷ shareholders' equity | Return generated on owners' capital. | >15% good. **Caution:** can be inflated by high debt or a small/negative equity base. |
| **ROA %** (Return on Assets) | Net income ÷ total assets | How well assets are used to make profit. | >5% decent; banks/utilities run lower, asset-light firms higher. |
| **ROIC %** (Return on Invested Capital) | After-tax operating profit ÷ (debt + equity) | Return on **all** capital employed — the cleanest quality gauge. Compare directly against **WACC**: ROIC > WACC = value creation; ROIC < WACC = value destruction. | >15% is excellent. Meaningful only relative to WACC. |
| **WACC %** (Weighted Average Cost of Capital) | (Equity weight × Cost of Equity) + (Debt weight × After-tax Cost of Debt) | The minimum return the business must earn to satisfy all capital providers. Cost of equity via CAPM (10Y Treasury + Beta × 5.5% ERP); cost of debt from interest expense ÷ total debt. | Benchmark for ROIC. Typical range 6–12% depending on beta, leverage, and the rate environment. Falls back to 10Y Treasury for cost of debt when interest expense is unavailable. |
| **ROIC − WACC %** | ROIC − WACC | Excess return over the cost of capital — the direct value-creation/destruction signal. | > 0 = value creation, < 0 = value destruction. Blank if either input is missing. |
| **ROCE %** (Return on Capital Employed) | EBIT ÷ (total assets − current liabilities) | Pre-tax sibling of ROIC. | >15% strong; compare to ROIC and to peers. |
| **Revenue/Share** | TTM revenue ÷ shares outstanding | Sales backing each share. | Rising over time is the signal to want. |

> **The 5.5% ERP is a fixed US-market estimate, not a live figure.** Unlike the
> risk-free rate (a live 10Y Treasury quote), there's no clean data feed for
> equity risk premium — it's a modeling input Aswath Damodaran (NYU Stern)
> re-derives by hand each month, historically landing in a ~4–6% band, and 5.5%
> is a reasonable fixed point within it. It is also a **US-market** number,
> applied uniformly to every ticker regardless of where the company is
> domiciled. For a foreign company (see **§11** on ADRs) this understates the
> true cost of equity — emerging markets in particular carry a higher equity
> risk premium than the US — so treat a foreign ticker's WACC as directionally
> useful but a slight underestimate, not a precise figure.
>
> **The "ROIC vs Cost of Capital" chart (§8) shows WACC historically**, not as
> today's single value repeated — every input except beta is recomputed for
> each fiscal year.

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
| **EBITDA** | Net Income **+** Interest **+** Tax **+** Depreciation & Amortization — built up from the bottom line, not down from revenue (Yahoo's trailing-12-month figure) | Proxy for operating cash earnings — the raw figure behind the Debt/EBITDA and EBITDA/FCF ratios shown alongside it. | Compare against total debt and FCF; negative EBITDA means the ratios built on it are suppressed. |
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

> **REITs use FFO, not FCF, for coverage.** Payout/FCF Coverage above are
> computed the same way for every company, but for REITs the S1 Triage grade
> substitutes **FFO Payout / FFO Coverage** instead — see **§6b REIT-specific
> metrics**. GAAP FCF understates a REIT's true distributable cash because
> reported capex isn't split into maintenance vs. growth spend.

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
| **S1 Flags** | Where should the deep dive look first? The triage framework's never-disqualifying context flags: 🔺 priced for perfection · 🔻 suspiciously cheap · ⚠ low Altman-Z (non-manufacturer) · ⚠ low Piotroski F-Score (bank/REIT) · ⚠ divergent multiples and data-sanity warnings (P/B > 40, EV/EBITDA > 150, negative EV) · 💰 payout stress · 📉 crowded short · 🌀 high beta. | Informational only — flags never change a score. Blank = no warnings. | [stock-triage-strategy.md](stock-triage-strategy.md) (Stages 0 & 3) |

Every row is classified into a **business-type archetype** — financial, REIT,
asset-light, cyclical, or capital-intensive — and each strategy substitutes
metrics that don't fit that archetype (see **§6a** below). **Financials** and
**REITs** get substituted pillars in all three strategies: S1 and S2 swap in
ROE/net-margin/Piotroski for financials and a dedicated FFO-based rubric for
REITs (FFO returns, REIT Debt/Assets bands, P/FFO — never zeroing them on the
industrial Debt/EBITDA or a depreciation-inflated P/E); S3 swaps in ROA
(financials) or FFO-based earnings-yield/quality/dividend pillars (REITs).
**Cyclical and asset-light** names stay on the standard rubrics across all
three strategies — they are ordinary operating companies whose ROIC, margins
and P/E genuinely apply (with more year-to-year noise, which the track-record
pillars smooth); there is no normalized/through-cycle data that would justify a
bespoke rubric, so none is imposed. S1 additionally softens their *kill*
switches (Altman-Z → flag, ROIC−WACC gate → deep-spread-only) so a cycle trough
or a noisy WACC doesn't disqualify them — see **§6a**.

**Where to sort:** rank by **Strat Min**, descending, to surface the stocks
that score well under *all three* strategies simultaneously — a business in
demonstrable health (S1), with a durable moat (S2), at a defensible price
(S3) is the intersection this whole framework exists to find.

### 6a. Business-type archetypes (S1 Triage)

A metric that disqualifies one business model is often meaningless for
another — the Altman Z-Score is a 1968 *manufacturer* model, ROIC/WACC breaks
down for asset-light and property businesses, and REITs are levered by
design. S1 classifies every row into one of six archetypes by sector
(financials and mortgage REITs caught by industry first) and adjusts
accordingly:

| Archetype | Sectors | Altman-Z kill | Piotroski kill | ROIC−WACC gate | Leverage/liquidity kills |
| --- | --- | --- | --- | --- | --- |
| **Capital-intensive** *(default)* | Industrials, Utilities, Consumer, unknown | kill < 1.8 | kill ≤ 3 | full (cap at spread < 0) | full |
| **Cyclical** | Energy, Basic Materials | flag only | kill ≤ 3 | softened (cap at spread < −5) | full |
| **Asset-light** | Technology, Communication Services, Healthcare | flag only | kill ≤ 3 | de-weighted (spread halved; cap at < −5) | full |
| **REIT** (equity) | Real Estate | ignored | flag only | none | exempt |
| **mREIT** (mortgage) | industry "REIT — Mortgage" | ignored | flag only | none | exempt |
| **Financial** | banks, insurers, lenders *(by industry)* | ignored | flag only | none | exempt |

**Mortgage REITs** get their own rubric across all three strategies rather than
the bank rubric (whose net-margin points reward a mREIT income-statement
artifact) or the equity-REIT FFO rubric (mREITs own no depreciating property).
S1 grades them on dividend coverage (payout ratio), price vs book (P/B),
leverage (wide agency-appropriate bands, ≤800% / ≤1000%), and **book-value-per-
share trend** — the headline signal, since a mREIT eroding book value to fund
its dividend is destroying capital however high the yield.

Full rationale and the flag-vs-kill design for each row: see
[stock-triage-strategy.md](stock-triage-strategy.md) § *Business-type
archetypes*.

### 6b. REIT-specific metrics (all three strategies)

REITs are graded on FFO-based rubrics rather than the standard ones across
**all three** strategies — S1 substitutes a cash-flow / distribution /
valuation rubric for the 4-pillar one, and S2/S3 rebuild their returns,
discipline, earnings-quality and valuation pillars on FFO too (never zeroing a
REIT on the industrial Debt/EBITDA or a depreciation-inflated P/E). All are
built around **approximate NAREIT FFO**:

| Metric | Formula | How to read it | Rough range |
| --- | --- | --- | --- |
| **FFO (Funds From Operations)** | Net Income + D&A − property-sale gains + impairments | The REIT-standard cash-generation measure — adds back the large non-cash depreciation charge that understates a property business's real operating performance, and strips one-off property-sale gains so a REIT can't flatter its payout by selling buildings. Equity REITs only (mortgage REITs own no depreciable property; they're judged on book value). | Compare to Total Debt and the dividend, same as FCF elsewhere. |
| **P/FFO** | Market cap ÷ FFO | The REIT equivalent of P/E — the standard REIT valuation multiple. | <12× cheap-ish, 12–18× typical, >18× rich (real-world REIT P/FFO commonly runs 10–20×). |
| **FFO Payout Ratio %** | Dividends paid ÷ FFO | Share of FFO distributed. REITs must legally pay out ~90% of *taxable* income, so this runs structurally higher than a normal payout ratio. | ≤80% comfortable cushion, ≤100% sustainable norm, **>100% paying out more than the business generates** — a real red flag. |
| **FFO Coverage** | FFO ÷ dividends paid | How many times FFO covers the dividend (inverse of payout ratio, as a multiple). | ≥1.0× sustainable, <1.0× tight to under-covered. |
| **Debt/Assets %** | Total Debt ÷ Total Assets | **The leverage figure all three REIT rubrics are graded on**, in place of Debt/Equity. Shown in the deep view beside Debt/GBV, which is the same ratio *with* the accumulated-depreciation add-back — so the two coincide for most REITs and the gap between them is exactly that add-back. | **≤45% conservative**, ≤60% typical, **>60% aggressive**. |
| **Debt/GBV %** | Total Debt ÷ (Total Assets + accumulated-depreciation add-back) | Balance-sheet leverage against **gross book value** — the asset base at undepreciated cost, the gauge property REITs covenant against (declarations of trust commonly cap it near 60%). Deep view only, property REITs only (equity and fair-value kinds; a mortgage REIT's repo leverage isn't fully in Total Debt and "gross book" has no meaning for a securities portfolio). Yahoo carries US-GAAP REIT property at *net* value with no accumulated-depreciation row, so for those the shown ratio runs a little high (conservative); exact for fair-value (IFRS) REITs, whose assets already sit at fair value. | **<45% conservative**, 45–55% typical, **>60% highly levered**. |

> **Why two leverage rows, and why neither is Debt/Equity.** Book equity is the
> worst available denominator for a depreciated-cost property business, for the
> same reason net income is the wrong earnings measure: depreciation erodes it
> every year while the buildings hold their value. Debt/Equity therefore climbs
> with portfolio *age* rather than borrowing (Simon Property ≈557%, Boston
> Properties ≈317%), and inverts entirely once accumulated depreciation exceeds
> equity (Iron Mountain ≈ −2010%). Both alternatives below fix that; they differ
> in what they trade off.
>
> **Debt/GBV is the more accurate figure** — gross book value is the
> undepreciated asset base, and the ≤60% cap REIT declarations of trust draw is
> written against it. But it needs an accumulated-depreciation add-back that
> Yahoo exposes for only about **one REIT in seven**, and where present it is
> worth up to 45% of the ratio (Host Hotels: 43.3% → 23.9%).
>
> **Debt/Assets is the more consistent figure** — total assets is reported by
> every REIT, so it is defined identically across the whole graded population.
> That is why **the strategy grades score on Debt/Assets** while the deep view
> *displays* both: accuracy wins for a figure you read with its caveat in front
> of you, consistency wins for one that assigns scores, where a data-feed quirk
> must never separate two otherwise identical REITs.
>
> **Occupancy rate is deliberately absent.** It sits beside leverage in every
> REIT supplemental and is a genuine REIT metric, but it is an *operational*
> disclosure rather than a financial-statement line: no normalized data feed
> (Yahoo included) carries it, so it cannot be computed or displayed here. Read
> it from the REIT's own quarterly supplemental package.

> **This is *approximate* NAREIT FFO, not full NAREIT FFO or AFFO — a data
> ceiling, not a choice.** The property-sale gains and impairments are backed
> out via the cash flow statement's `Operating Gains Losses` and
> `Asset Impairment Charge` lines, which is close but not exact: the former is a
> general non-cash gain/loss adjustment that can also carry debt-extinguishment
> or derivative items, and the D&A add-back includes intangible and
> deferred-financing amortization NAREIT would exclude. AFFO further
> requires splitting capex into maintenance vs. growth spend — a split no
> structured financial statement provides; real analysts get it from each
> REIT's own investor disclosures, and AFFO isn't even standardized
> industry-wide the way NAREIT FFO is, so no universal formula could compute
> it regardless of data access. **Treat REIT grades as directional** — good
> for ruling out clearly over-levered or under-covered names, not for
> fine-ranking REIT against REIT. When a REIT's cash flow statement lacks a
> D&A line, S1 falls back to the GAAP-FCF proxy automatically. Full detail:
> [REITs.md](REITs.md).

---

## 7. Risk

Volatility, crowding, and distress signals.

| Metric | Formula / source | How to read it | Ranges |
| --- | --- | --- | --- |
| **Beta** | Sensitivity of the stock vs. the market (S&P 500) | Volatility/market-risk gauge. | **β = 1** moves with the market; **>1** amplified (1.5 ≈ 50% bigger swings); **<1** more stable; **<0** moves opposite the market. |
| **Short Interest %** | Shares sold short ÷ public float | How much of the float is bet against. | <5% normal, 5–10% elevated, **>10–20% heavily shorted** (bearish sentiment and/or squeeze fuel). |
| **Days to Cover** | Short interest ÷ average daily volume | Days of normal trading for shorts to buy back. | <1 easy to cover; **>5–7 crowded short**, higher squeeze potential. |
| **Altman Z-Score** | `1.2·WC/TA + 1.4·RE/TA + 3.3·EBIT/TA + 0.6·MktCap/TL + 1.0·Sales/TA` | Bankruptcy-risk gauge (higher = safer). | **>2.99 "safe" zone, 1.81–2.99 "grey" zone, <1.81 "distress" zone.** Built for manufacturers, so the strategy grades only *disqualify* capital-intensive names on it — asset-light/cyclical get a soft flag, REITs/financials ignore it (see stock-triage-strategy.md archetypes). |
| **Piotroski F-Score** | 0–9 points across 9 fundamental tests (see below) | Overall fundamental strength. | **7–9 strong, 4–6 middling, 0–3 weak.** Needs a prior year of statements. Two of the 9 tests (falling leverage, rising current ratio) are biased against banks and REITs' intentionally high, stable leverage, so the strategy grade only *disqualifies* other archetypes on ≤3 — banks/REITs get a soft flag instead (see stock-triage-strategy.md archetypes). |

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
- **Treasury Shares** (bar) — repurchased shares held by the company (often ~0
  for firms that retire bought-back shares).
- **Dividend Yield %** (line) — historical yield (annual dividends ÷ year-end price).
- **Payout Ratio %** (line) — dividends as a share of earnings, over time.

> **Where the share count comes from** — Yahoo reports two different share rows,
> and they are not interchangeable: *issued* shares include treasury stock,
> *outstanding* shares don't (for KO the gap is 64%). This panel always plots
> outstanding. Where Yahoo has no outstanding row, it is reconstructed exactly as
> issued − treasury. Only if the treasury row is missing too do the bars fall
> back to issued shares — then they relabel to **Shares Issued** with a ⚠ in the
> panel header, and the level may overstate the true count (the trend still reads
> normally).

*Read it for:* whether management is returning capital (shrinking share count,
steady/rising dividend) or diluting holders, and whether the payout ratio is
creeping toward unsustainable levels.

### ROIC vs Cost of Capital (last 5 years)

**ROIC** bars against a **WACC** line, both on the same %-axis so a bar
clearing the line reads directly as value creation that year, and one falling
short reads as value destruction.

Unlike the flat reference line this chart used to show, **the WACC line is
now historical** — each fiscal year gets its own reconstructed cost of
capital, not today's figure repeated:

- **Risk-free rate** — the 10-year Treasury yield as of that year's fiscal
  year-end (not today's).
- **Capital-structure weights** — that year's own market cap (period-end price
  × shares outstanding) and total debt.
- **Cost of debt** — that year's interest expense ÷ that year's total debt
  (falls back to the risk-free rate when interest expense is unavailable, same
  as the current-year WACC).
- **Tax rate** — that year's pretax income and tax provision.
- **Beta** — held at **today's** value across every year. This is the one
  input Yahoo doesn't expose historically (only a single current trailing
  beta), and reconstructing it per year would need a full regression against
  market returns for every period — not a reliable, available data point. Beta
  is also the least time-variable of WACC's inputs, so freezing it loses the
  least; the line still tracks what actually moves year to year (rates,
  leverage, tax rate).

The rightmost year is pinned to the same current WACC shown in the
Profitability panel, so the two figures always reconcile.

*Read it for:* whether the ROIC−WACC spread has been consistently positive
and widening (compounding value), consistently negative (structurally
destroying value), or crossing back and forth (cyclical, or newly
improving/deteriorating) — not just where today's snapshot sits.

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

## 11. Foreign-reporting tickers (ADRs) and currency

Most tickers trade and report in the same currency, and every dollar figure in
the app is simply "dollars" (or whatever that one currency is). **Foreign
private issuers — ADRs like WIT (Wipro), or any ticker whose exchange currency
differs from the currency its filings are denominated in — break that
assumption**: the stock *trades* in one currency but the company *reports* its
financials in another.

For WIT: **Price** and **Market Cap** are in USD (it trades on the NYSE in
dollars), but **Revenue, Total Cash, Total Debt, Total Equity, EBITDA, Net
Income, FCF**, and similar statement-derived figures are in **INR** (Wipro
reports in rupees). Yahoo's raw data mixes these silently — its own
`enterpriseValue`, `enterpriseToEbitda`, and `priceToSalesTrailing12Months`
fields, for example, quietly divide a USD number by an INR one, producing
nonsense (a negative Enterprise Value, an EV/EBITDA under zero).

**What the app does about it:**

- Every metric that combines the two currencies — Enterprise Value,
  EV/EBITDA, Price/Sales, Price/Cash, Price/FCF, WACC's capital weights,
  Altman Z-Score — is recomputed from a market cap **converted into the
  statement's reporting currency** via a live FX rate, instead of trusting
  Yahoo's cross-currency passthrough fields.
- Every figure is tagged with the currency it's actually denominated in.
  **Price**, **Market Cap**, and **Diluted EPS** show in the trading currency;
  **Enterprise Value, Revenue, Cash, Debt, Equity, EBITDA, Net Income, FCF,
  Basic EPS, Dividend TTM**, and similar statement-derived figures show in the
  reporting currency (₹ for WIT) — both on-screen and in the Excel export
  (which adds a **Financial Statement Currency** row alongside Currency when
  the two differ).
- Ratios that are unitless (P/E, P/B, margins, ROE/ROA/ROIC) needed no fix —
  currency cancels out of a ratio as long as both sides already agreed, which
  they did for those.

For the overwhelming majority of tickers (reporting currency = trading
currency), none of this changes anything — the conversion is a no-op.

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
| Revenue/Growth/Share-Dilution/ROIC-vs-WACC charts | §8 Charts |
| Performance columns | §9 Performance |
| Foreign-reporting tickers (ADRs) | §11 |
