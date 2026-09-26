# Stock Triage Strategy — A Values-Based Screening Framework

## Purpose and philosophy

This framework decides one thing only: **which stocks earn a deep dive and which get discarded**. It is not a valuation model and it does not rank buy candidates. Triage optimizes for a different error profile than analysis: it is acceptable to occasionally discard a decent company (you can only research so many names anyway), but it is costly to spend hours analyzing a business that a 30-second solvency check would have killed.

The strategy works in **sequential stages that get progressively softer**:

1. **Stage 0 — Data hygiene**: can this row even be evaluated?
2. **Stage 1 — Hard disqualifiers**: binary kill-switches on solvency and viability. One failure = discard.
3. **Stage 2 — Quality score**: a weighted score across profitability, value creation, balance sheet, and cash conversion. Below a floor = discard; above = advance.
4. **Stage 3 — Valuation context flags**: never disqualifying, but attached as warnings that shape the subsequent deep dive.

Because it operates on metric *values* (ratios, spreads, scores) rather than absolute figures, the framework applies identically to a mega-cap and a small-cap, and to any batch of tickers you feed it.

---

## Stage 0 — Data hygiene

Before judging a company, judge the row.

| Rule | Threshold | Action |
|---|---|---|
| Missing critical metrics | Any of {Net Income, FCF, Total Debt, Total Equity} absent | **Quarantine** — re-source the data before scoring. Do not score a company you can't see. |
| Overall completeness | > 40% of metric columns empty | Quarantine or drop the row as a data artifact |
| Duplicate / secondary listings | Same underlying company via ADR or foreign ticker | Keep the primary listing only (fullest data), discard the shadow row |
| Cross-listing distortions | ADRs and foreign listings (e.g. `.SZ`, `.MU`, OTC ADRs) | Score normally, but verify ratios against the primary-exchange filing during the deep dive — data vendors frequently mangle ADR share counts and currency conversions |

A row failing Stage 0 is not a "bad company" — it's an unanswerable question. Treat quarantined names as a to-fix list, not a reject list.

**Sanity checks worth automating:** a P/B above ~40, an EV/EBITDA above ~150, or a negative Enterprise Value are usually data errors or one-off accounting artifacts rather than real economics. Flag, don't trust.

---

## Stage 1 — Hard disqualifiers (any one = discard)

These are conditions under which further analysis is a waste of time regardless of how cheap or exciting the stock looks. They target the two ways equity holders get wiped out: insolvency and structural value destruction.

| # | Kill-switch | Threshold | Applies to | Rationale |
|---|---|---|---|---|
| 1 | **Distress risk** | Altman Z-Score < 1.8 | **capital-intensive only, except utilities** | The Altman Z-Score is the 1968 *manufacturer* model, so it only disqualifies the asset-heavy businesses it was calibrated on. For asset-light, cyclical and **utility** names a low Z is surfaced as a non-disqualifying `⚠ Low Altman-Z` context flag instead (Altman excluded utilities from his sample, and a healthy regulated utility's Z sits below 1.8 as a matter of course); REITs and financials ignore it entirely. |
| 2 | **Fundamental deterioration** | Piotroski F-Score ≤ 3 | **non-financial, non-REIT** | Fewer than 4 of 9 basic health signals passing means the business is degrading on multiple fronts simultaneously. Two of the 9 tests (falling leverage, rising current ratio) are structurally biased against banks and REITs, which run intentionally high, stable leverage and don't have an industrial-style current ratio — so for those archetypes a low score is a `⚠ Low Piotroski F-Score` context flag instead of a kill. |
| 3 | **Twin-negative earnings** | Net Income < 0 **and** FCF < 0 | all | Losing money on both an accounting and a cash basis. One negative alone can be a timing artifact; both together is a business that consumes capital. |
| 4 | **Leverage overload** | Debt/EBITDA > 6 (**utilities: > 7**), **or** EBITDA ≤ 0 with net debt (debt > cash) | non-REIT, non-financial | Above ~6 turns of leverage, equity is effectively an option on the debt holders' goodwill. REITs are *exempt* — property is debt-funded by design — and regulated utilities kill at 7 rather than 6: they run 4.5–5.5× in the normal course, so the generic line would leave no headroom for an ordinary capex year. (Threshold can relax to ~4 as a *flag* level; > 6 is the kill level.) The second leg exists because Debt/EBITDA is undefined when EBITDA is negative — carrying more debt than cash while EBITDA is negative is strictly worse than any ratio above 6. |
| 5 | **Liquidity crunch** | Current Ratio < 1.0 **and** Quick Ratio < 0.5 | non-REIT, non-financial | Cannot cover near-term obligations even including inventory; without it, coverage is under half. REITs run thin current ratios by design and are exempt. |
| 6 | **Deep value destruction** | ROIC < 0 **and** Operating Margin < 0 | capital-intensive & asset-light | The core operations destroy capital — an economics problem, not a maturity or cycle one. *Exempt for cyclicals* (a cycle trough is not a broken business) *and REITs* (ROIC understates property returns). |

Three design principles behind these:

- **Kill-switches are business-type-aware.** A metric that disqualifies one business model is often meaningless for another — the Altman Z-Score is a manufacturer model, ROIC/WACC breaks down for asset-light and property businesses, and REITs are levered by design. See [Business-type archetypes](#business-type-archetypes) below.
- **Kill-switches are compound where possible.** Negative FCF alone would kill many legitimate heavy-investment-phase companies; negative FCF *plus* negative net income rarely has an innocent explanation.
- **The thresholds are deliberately loose.** Stage 1 should only remove the clearly broken. The nuanced sorting happens in Stage 2.

---

## Stage 2 — Quality score (0–100)

Survivors are scored across four pillars. Each metric earns points based on where its value falls; missing values earn 0 for that metric (missing data is information — it should never help a stock).

### Pillar A — Value creation (30 points)

The single most important question in triage: **does the company earn more on its capital than that capital costs?** — *for the businesses this question fits.* See [Business-type archetypes](#business-type-archetypes): the spread is central for capital-intensive names, de-weighted for asset-light ones (where invested capital omits the intangible/human capital base and ROIC is inflated), softened for cyclicals (single-year swings), and replaced entirely for REITs and financials.

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **ROIC − WACC spread** (20 pts, capital-intensive & cyclical) | Spread > +3 pts | Spread between −2 and +3 pts | Spread < −2 pts |
| **ROIC − WACC spread** (10 pts, asset-light — de-weighted) | Spread > +3 pts | Spread between −2 and +3 pts | Spread < −2 pts |
| **Gross-margin / positive-FCF quality** (10 pts, asset-light only) | Gross > 60% + FCF > 0 | Gross 40–60% | — |
| **ROE** (10 pts) | > 15% | 8–15% | < 8% |

The ROIC−WACC spread is the framework's centerpiece *for capital-intensive businesses*. A manufacturer earning 18% on capital that costs 10% compounds wealth; one earning 7% on capital that costs 11% destroys it even while reporting "profits." When comparing ROIC to WACC, mind the units — datasets often store one as a decimal (0.186) and the other as a percentage (9.7); normalize before subtracting. For an asset-light firm the same spread is far less meaningful: its "invested capital" (balance-sheet assets) understates the real capital base (R&D, brand, people), so ROIC reads artificially high and its spread over a noisy high-beta WACC is not the value signal it is for a factory. There the spread is halved and the freed points reward gross-margin durability and cash generation instead.

**Secondary gate — negative spread caps the total score at 55, scoped by archetype.** Pillar A is only 30 of 100 points, so a company genuinely *destroying value* on its invested capital could otherwise still reach Advance purely on strong margins, balance sheet, and cash conversion. When the spread is negative the Stage 2 score is capped at 55 (Watchlist ceiling) — but the trigger depends on the business type: **capital-intensive** names cap at any negative spread (< 0); **cyclical and asset-light** names cap only on a *deeply* negative spread (< −5), since a single-year WACC (noisy CAPM beta) or a cycle trough shouldn't disqualify on its own. **REITs and financials** are not spread-gated at all.

*Caution on ROE:* it is leverage-amplified. A high ROE sitting on top of Debt/Equity > 1.5 is a leverage artifact, not operating excellence — cap it at half points in that case. And when shareholders' equity is outright **negative** (common in buyback-heavy names), ROE is arithmetic noise — negative income over negative equity even reads as a healthy positive — so it earns zero points, not a cap.

### Pillar B — Profitability (25 points)

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **Net Margin** (10 pts) | > 15% | 5–15% | < 5% |
| **Operating Margin** (10 pts) | > 20% | 8–20% | < 8% |
| **Gross Margin** (5 pts) | > 40% | 25–40% | < 25% |

Gross margin gets the smallest weight because it varies most by industry (a distributor at 20% gross can be a superb business). Operating margin is the cleanest single indicator of pricing power plus cost discipline.

**Thin-margin escape hatch.** Absolute margin bands read a high-turnover model — a superb grocer or distributor at 2% net margin — as low-quality, when DuPont says the quality shows up as margin × turnover, a product the returns-on-capital metrics already capture. So when the pillar sums below half, strong returns floor it at half (12.5/25): ROIC ≥ 12%, or ROE ≥ 15% on positive equity without the leverage that would make ROE an artifact (D/E ≤ 1.0, or debt-free). Half, never full — the escape stops the bands taxing a business *model*; it cannot inflate a weak business.

### Pillar C — Balance sheet (25 points)

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **Debt/EBITDA** (10 pts) | < 1.5 | 1.5–3.0 | > 3.0 |
| **Debt/Equity** (8 pts) | < 0.5 | 0.5–1.0 | > 1.0 |
| **Current Ratio** (7 pts) | 1.5–4.0 | 1.0–1.5, or > 4.0 | < 1.0 |

Note the current-ratio scoring is a *band*, not a "more is better" scale. A ratio above ~4–5 often signals lazy capital (cash piling up with nowhere productive to go) and only merits half credit.

*Negative equity:* when total equity is negative, Debt/Equity flips sign and a naive "lower is better" read would award a deeply levered balance sheet **full** low-leverage points. Negative equity always scores zero on the Debt/Equity line — it is the most levered state a balance sheet can be in, not the least.

### Pillar D — Cash conversion and earnings quality (20 points)

Accounting profits are an opinion; cash is a fact. This pillar checks whether they agree.

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **FCF / Net Income** (12 pts) | 0.8 – 1.5 | 0.5–0.8, or > 1.5 | < 0.5 (or NI ≤ 0) |
| **EBITDA / FCF** (8 pts) | 1.0 – 2.5 | 2.5–4.0 | > 4.0 or < 0 |

FCF persistently *below* ~50% of net income suggests earnings inflated by accruals, aggressive revenue recognition, or capex the income statement isn't showing. FCF persistently far *above* net income can be fine (heavy D&A) but can also mean under-investment — hence half rather than full credit. A high EBITDA/FCF ratio means EBITDA evaporates before reaching shareholders — capex, working capital, interest, and taxes are eating it.

### Decision bands

| Score | Verdict | Meaning |
|---|---|---|
| **≥ 65** | **Advance** | Earns a full deep dive |
| **45 – 64** | **Watchlist** | Only advance if you have spare capacity or a specific thesis; re-screen next quarter |
| **< 45** | **Discard** | Weak on multiple pillars simultaneously — the base rate of these becoming good investments doesn't justify the research hours |

---

## Stage 3 — Valuation context flags (never disqualifying)

Triage screens business quality, not price — a wonderful business can be a terrible stock at the wrong price, but that is the deep dive's job to determine. Stage 3 simply attaches warnings so the analysis starts with eyes open:

| Flag | Trigger | What it warns of |
|---|---|---|
| 🔺 Priced for perfection | PEG > 3, or P/FCF > 40, or EV/EBITDA > 30 | Any stumble in growth will be punished violently; the deep dive must stress-test the growth assumptions |
| 🔻 Suspiciously cheap | P/E < 8, or EV/EBITDA < 5, alongside a Stage 2 score ≤ 60 | Cheapness plus mediocrity is usually a value trap — the market may know something the ratios don't |
| ⚠️ Divergent multiples | Forward P/E < 50% of trailing P/E | Either explosive earnings growth is expected or trailing earnings were depressed by one-offs — find out which |
| 💰 Payout stress | Payout Ratio > 60%, or FCF dividend coverage < 1.2×. **REITs:** FFO payout > 90% (or FFO coverage < 1.0×). **Mortgage REITs:** payout > 100%. **Banks:** payout > 60%, no FCF leg | The dividend is competing with reinvestment and may be cut. Judged on the payout the business type actually lives on: an equity REIT's earnings payout is meaningless under depreciation (every healthy REIT would fire), while a mortgage REIT distributes nearly all its earnings by design, so only above 100% is it eating book value. Banks and mortgage REITs skip the FCF leg — lending runs through operating cash flow, so a year of loan growth prints a hugely negative GAAP FCF (JPM: −$148B) that tracks the loan book, not the dividend |
| 📉 Crowded short | Short Interest > 15% of float | Sophisticated money is betting against it — the deep dive must locate and evaluate the bear thesis |
| 🌀 High beta | Beta > 1.7 | Position-sizing consideration, not a quality signal |

---

## Business-type archetypes

Applied blindly, a transversal screen selects for a *business model* rather than for quality within a model — and worse, disqualifies healthy companies on metrics that don't fit them (the Altman Z-Score is a manufacturer model; ROIC/WACC breaks down for asset-light and property businesses; REITs are levered by design). Every row is therefore classified into one of six archetypes (by sector, with financials and mortgage REITs caught by industry first, and a short industry-override list for the cases where the sector label misroutes: semiconductors sit in Technology but a fab is the opposite of asset-light, and telecoms sit in Communication Services beside content businesses while towers, spectrum and fibre are as capital-heavy as any industrial — both grade **capital-intensive**; the override moves fabless designers too, an accepted cost of a string match), and the kill-switches and Pillar-A weighting adjust accordingly:

| Archetype | Sectors | Altman-Z kill | Piotroski kill | ROIC−WACC gate | Leverage/liquidity kills | Rubric |
|---|---|---|---|---|---|---|
| **Capital-intensive** *(default)* | Industrials, Utilities, Consumer, unknown; industries: semiconductors, telecom | **kill < 1.8** (utilities: flag only) | **kill ≤ 3** | **full** (cap at spread < 0) | full (utilities: Debt/EBITDA kill at 7×) | standard 4-pillar |
| **Cyclical** | Energy, Basic Materials | flag only | kill ≤ 3 | softened (cap at spread < −5) | full | standard, cycle-tolerant |
| **Asset-light** | Technology, Communication Services, Healthcare | flag only | kill ≤ 3 | de-weighted (spread 10 pts; cap at < −5) | full | standard, spread halved |
| **REIT** (equity) | Real Estate | ignored | flag only | none | **exempt** | FFO-based cash-flow / distribution / valuation |
| **mREIT** (mortgage) | industry "REIT — Mortgage" | ignored | flag only | none | **exempt** | dividend coverage / P-B / leverage / book-value trend |
| **Financial** | banks, insurers, lenders *(by industry)* | ignored | flag only | none | exempt | ROE / net-margin / Piotroski (soft) |

**Financials (banks, insurers, lenders).** Altman Z, Debt/Equity, Current Ratio, and EV/EBITDA are structurally meaningless for balance-sheet-driven businesses; they score on ROE, net margin, and Piotroski only. *Classify by industry, not sector:* the "Financial Services" sector also sweeps in fee businesses — insurance brokers, exchanges and data vendors, asset managers — whose balance sheets are ordinary; those belong on the standard rubric. Lending-adjacent industries (banks, insurance carriers, capital markets, credit services, mortgage finance, conglomerates) take the financial rubric; "credit services" deliberately stays in that bucket even though it mixes fee networks (Visa, Mastercard) with real lenders (Amex, Capital One) — the networks ace the ROE/net-margin rubric anyway, while a lender misrouted onto the industrial rubric would be zeroed by structurally missing EBITDA and current-ratio data. A mortgage *originator* (industry "Mortgage Finance", no "REIT") is a lender and lands here; a mortgage *REIT* (industry "REIT — Mortgage") is its own **mREIT** archetype below. Piotroski's leverage/current-ratio tests don't fit a bank's balance sheet either, so a low F-Score is a flag here too, not a kill.

**REITs (equity, Real Estate).** Property is funded by debt and pays out ~90% of taxable income by law, so Debt/EBITDA, the liquidity kill, Altman-Z and the ROIC−WACC gate are all inapplicable — a REIT graded on the industrial rubric would be wrongly disqualified on leverage. Piotroski's leverage/current-ratio tests are similarly biased against REITs' intentionally high, stable leverage, so a low F-Score is a flag, not a kill.

**Mortgage REITs (mREITs, industry "REIT — Mortgage").** A mREIT is a *leveraged securities portfolio in a REIT wrapper* — it owns mortgage bonds financed with repo, not depreciating buildings. So neither of the other two rubrics fits: the equity-REIT FFO rubric is inapplicable (there's no property depreciation to add back — FFO degenerates to net income), and the bank rubric actively *misleads* — a mREIT's income statement shows a huge "net margin" (net income is a large fraction of net interest income), which the financial rubric rewards with full marks even as the REIT pays out more than it earns and erodes book value. Both the old and the new classifier keep mREITs off Altman-Z, Debt/EBITDA and the liquidity kills (they're leveraged by design). The mREIT rubric grades the four things that actually determine safety:

| Pillar | Metric | Full | Half | Zero |
|---|---|---|---|---|
| **Dividend coverage** (35) | Payout ratio (dividends ÷ earnings) | ≤ 100% | ≤ 120% | > 120% |
| **Price vs book** (25) | P/B | ≤ 0.90 | ≤ 1.10 | > 1.10 |
| **Leverage** (20) | Debt/Equity | ≤ 800% | ≤ 1000% | > 1000% |
| **Book-value trend** (20) | Annualized BVPS growth | > 0% | ≥ −5%/yr | < −5%/yr |

*Book-value trend is the headline signal.* A mREIT that holds or grows book value per share while paying its dividend is compounding; one whose book value steadily erodes is paying the dividend out of capital, however high the yield. The leverage bands are deliberately wide — agency mREITs run ~8× on government-guaranteed collateral, which is prudent, not distressed. **S2** reframes for mREITs as "does it preserve book value while paying a sustainable distribution?" (they aren't operating compounders); **S3** rewards a discount to book backed by a covered dividend and non-eroding book value as genuine defensive value. Like all REIT grades, treat these as directional: book-value trend comes from GAAP equity ÷ shares over a handful of annual statements, and coverage uses GAAP net income, which for a mREIT includes volatile mark-to-market swings rather than the "distributable earnings" the dividend is actually set from.

*Cash-flow basis:* REITs are graded on **approximate NAREIT FFO** (Funds From Operations = Net Income + D&A − property-sale gains + impairments) where the cash flow statement provides a D&A line — the measure real REIT investors use, computed instead of relying on GAAP FCF (which understates distributable cash, since reported capex isn't split into maintenance vs. growth/development spend). The gain backout matters: without it a REIT flatters its payout by selling a building, and the sale shrinks the portfolio the next dividend must come from. Both adjustments are read off the cash flow statement's operating reconciliation (see [REITs.md](REITs.md)). **It is still not exact NAREIT FFO, and it is not AFFO.** The residual gap is a data limitation: the gain line is a general non-cash gain/loss adjustment that can carry non-property items, and NAREIT adds back only real estate depreciation where the D&A line also covers intangibles. AFFO is further out of reach — it requires splitting capex into maintenance vs. growth, a split that isn't in any structured financial statement (real analysts pull it from each company's own investor-relations disclosures), and it isn't standardized industry-wide the way NAREIT FFO is, so no single formula could apply universally regardless of data availability. When FFO can't be computed (no D&A line), the rubric falls back to the GAAP-FCF proxy. **Treat REIT grades as directional, not precise** — use them to rule out clearly over-levered or under-covered names, not to fine-rank REIT against REIT.

Distribution is judged on the FFO payout ratio (dividends ÷ FFO) where available: ≤80% is a comfortable cushion, ≤100% is the sustainable norm (REITs must pay out most of taxable income by law), and above 100% means distributing more cash than the business generates — a genuine red flag. Valuation leans on P/FFO (the REIT-standard multiple, mirroring P/E) backed up by P/B.

*Leverage basis:* equity-REIT leverage is graded on **Debt/Total Assets** (≤45% full credit, ≤60% half, above that zero), in all three strategies — never Debt/Equity. Book equity is the worst available denominator for a depreciated-cost property business, for the same reason net income is the wrong earnings measure: accumulated depreciation erodes equity every year even as the buildings hold their value. So D/E climbs with portfolio *age* rather than with borrowing, blows up nonlinearly on mature portfolios (Simon Property ≈557%, Boston Properties ≈317% — both past a ≤200% band that then can't tell them apart), and inverts completely once accumulated depreciation exceeds equity (Iron Mountain ≈ −2010%), where a negative-equity guard would score an accounting artifact instead of a leverage judgment. The old bands were knife-edged too: Mid-America at 99.9% took full credit while Ventas at 101.6% took half — 1.7 percentage points in a noisy denominator swinging a tenth of the grade; on assets those two sit at 47.4% and 46.1%, adjacent as they should be. Genuine over-leverage still scores zero (Iron Mountain reads 93% of assets). Note this is *not* the ≤60% Debt/Gross-Book-Value covenant line REITs report against — the deep view shows that figure separately, but it needs an accumulated-depreciation add-back Yahoo exposes for only about one REIT in seven, so grading on it would let a data-feed quirk separate two otherwise identical REITs. See [REITs.md](REITs.md).

**Asset-light (tech, communications, healthcare).** These businesses will structurally ace Pillars B and C, and their reported ROIC is inflated because invested capital omits the real (intangible/human) capital base. The ROIC−WACC spread is therefore halved in Pillar A and the freed points reward gross-margin durability and positive FCF; a low Altman-Z becomes a context flag, not a kill. When a batch mixes archetypes, still compare scores *within* type before across.

**Cyclical (energy, materials).** Commodity earnings and ROIC swing violently with the cycle, so a single-year low Altman-Z or negative spread is softened (flag / deep-spread-only cap) rather than disqualifying — a miner at the bottom of the cycle is not a broken business.

**Utilities.** Regulated utilities grade on the capital-intensive rubric — their economics *are* plant and capital — but two of its kill-switches misfire on them. Altman excluded utilities from his 1968 sample, and their leverage-heavy, low-asset-turnover balance sheets put a perfectly healthy utility's Z routinely below the 1.8 "distress" line, so a low Z is the `⚠ Low Altman-Z` context flag rather than a kill. And where the generic leverage kill fires above 6× Debt/EBITDA, a regulated utility runs 4.5–5.5× in the normal course, so its kill line sits at 7× instead. The same Altman logic exempts utilities from Strategy 2's solvency-guard Z leg.

**Growth-phase companies.** A company deliberately running at breakeven to capture a market (heavy R&D, land-grab pricing) fails Pillars A/B for reasons that may be strategic rather than structural. The compound kill-switches (Stage 1 #3, #6) already protect the genuinely viable ones; but if a name scores 40–55 purely due to margin metrics while showing strong gross margin (> 60%) and positive FCF, route it to the Watchlist rather than Discard.

---

## Operating procedure (per batch)

1. Load the batch; run Stage 0. Set aside quarantined rows.
2. Apply Stage 1 kill-switches; record *which* switch fired for each discard (this is your audit trail and lets you revisit if data was wrong).
3. Score survivors on Stage 2; sort descending.
4. Attach Stage 3 flags to every Advance and Watchlist name.
5. Deep-dive the Advance bucket in score order, reading the flags first.
6. Re-run the whole batch each quarter — Watchlist names exist precisely to be re-scored on fresh filings.

**One-line summary:** *kill the insolvent, discard the value-destroyers, score the survivors on whether they turn capital into cash at returns above its cost, and let valuation inform — never decide — the triage.*

---

## Appendix — the framework applied to the uploaded batch (17 names)

To illustrate mechanics, not to give investment advice:

- **Stage 0**: `5UR.MU` (RTX via Munich listing) is missing 36 of 56 metric fields — quarantine; source RTX from its primary US listing instead.
- **Stage 1 examples**: `HMC` fires two kill-switches (Debt/EBITDA ≈ 15.5; Altman Z ≈ 1.11 in the distress zone, with negative net income). `AVAV` fires the Piotroski switch (F-Score 2) with twin-negative NI and FCF. `SYM` fails on value destruction (ROIC ≈ −29%) despite positive FCF — its Piotroski of 4 survives, but the ROIC/operating economics do not.
- **Stage 2 standouts**: `TER` (ROIC ≈ 20% vs WACC ≈ 14%, Debt/EBITDA ≈ 0.07, F-Score 5) and `ABBNY` (ROIC−WACC spread ≈ +9 pts, F-Score 7) score in the Advance band — though `TER` carries the 🔺 priced-for-perfection flag (P/E ≈ 68, P/FCF ≈ 128), and `ABBNY`'s P/B of 52 should be treated as a Stage 0 sanity-check item (likely an ADR data artifact).
- **Watchlist shape**: names like `MDT` (solid F-Score 7, but thin ROIC−WACC spread ≈ +0.4 pts) and `PATH` (F-Score 8, fortress balance sheet, but ROIC ≈ 2.6% far below WACC ≈ 9.8%) land in the middle band — healthy but not yet demonstrably value-creating.

*This document is an analytical screening framework, not financial advice; thresholds should be revisited against your own risk tolerance and the composition of each batch.*
