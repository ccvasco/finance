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

| # | Kill-switch | Threshold | Rationale |
|---|---|---|---|
| 1 | **Distress risk** | Altman Z-Score < 1.8 | The classic distress zone. Between 1.8–3.0 is the grey zone (flag, don't kill). *Not meaningful for banks/financials.* |
| 2 | **Fundamental deterioration** | Piotroski F-Score ≤ 3 | Fewer than 4 of 9 basic health signals passing means the business is degrading on multiple fronts simultaneously. |
| 3 | **Twin-negative earnings** | Net Income < 0 **and** FCF < 0 | Losing money on both an accounting and a cash basis. One negative alone can be a timing artifact; both together is a business that consumes capital. |
| 4 | **Leverage overload** | Debt/EBITDA > 6, **or** EBITDA ≤ 0 with net debt (debt > cash) | Above ~6 turns of leverage, equity is effectively an option on the debt holders' goodwill. (Threshold can relax to ~4 as a *flag* level; > 6 is the kill level.) The second leg exists because Debt/EBITDA is undefined when EBITDA is negative — carrying more debt than cash while EBITDA is negative is strictly worse than any ratio above 6, and must not slip past the switch on a technicality. |
| 5 | **Liquidity crunch** | Current Ratio < 1.0 **and** Quick Ratio < 0.5 | Cannot cover near-term obligations even including inventory; without it, coverage is under half. |
| 6 | **Deep value destruction** | ROIC < 0 **and** Operating Margin < 0 | The core operations destroy capital — not a maturity or cycle problem, an economics problem. |

Two design principles behind these:

- **Kill-switches are compound where possible.** Negative FCF alone would kill many legitimate heavy-investment-phase companies; negative FCF *plus* negative net income rarely has an innocent explanation.
- **The thresholds are deliberately loose.** Stage 1 should only remove the clearly broken. The nuanced sorting happens in Stage 2.

---

## Stage 2 — Quality score (0–100)

Survivors are scored across four pillars. Each metric earns points based on where its value falls; missing values earn 0 for that metric (missing data is information — it should never help a stock).

### Pillar A — Value creation (30 points)

The single most important question in triage: **does the company earn more on its capital than that capital costs?**

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **ROIC − WACC spread** (20 pts) | Spread > +3 pts | Spread between −2 and +3 pts | Spread < −2 pts |
| **ROE** (10 pts) | > 15% | 8–15% | < 8% |

The ROIC−WACC spread is the framework's centerpiece. A company earning 18% on capital that costs 10% compounds wealth; a company earning 7% on capital that costs 11% destroys it even while reporting "profits." When comparing ROIC to WACC, mind the units — datasets often store one as a decimal (0.186) and the other as a percentage (9.7); normalize before subtracting.

**Secondary gate — negative spread caps the total score at 55.** Pillar A is only 30 of 100 points, so a company with a genuinely *negative* spread (destroying value on its invested capital) could otherwise still reach Advance purely on strong margins, balance sheet, and cash conversion — which contradicts calling the spread "the single most important question." When ROIC − WACC < 0, the Stage 2 score is capped at 55 (Watchlist ceiling) regardless of the other three pillars. The gate triggers only on a *negative* spread, not merely a thin positive one — WACC is a CAPM estimate (beta × equity risk premium plus a proxied cost of debt) and easily off by a point or more, so gating right at the +1–3pt boundary would re-categorize borderline names on estimation noise rather than on demonstrated value destruction.

*Caution on ROE:* it is leverage-amplified. A high ROE sitting on top of Debt/Equity > 1.5 is a leverage artifact, not operating excellence — cap it at half points in that case. And when shareholders' equity is outright **negative** (common in buyback-heavy names), ROE is arithmetic noise — negative income over negative equity even reads as a healthy positive — so it earns zero points, not a cap.

### Pillar B — Profitability (25 points)

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **Net Margin** (10 pts) | > 15% | 5–15% | < 5% |
| **Operating Margin** (10 pts) | > 20% | 8–20% | < 8% |
| **Gross Margin** (5 pts) | > 40% | 25–40% | < 25% |

Gross margin gets the smallest weight because it varies most by industry (a distributor at 20% gross can be a superb business). Operating margin is the cleanest single indicator of pricing power plus cost discipline.

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
| 🔻 Suspiciously cheap | P/E < 8, or EV/EBITDA < 5, alongside a Stage 2 score < 60 | Cheapness plus mediocrity is usually a value trap — the market may know something the ratios don't |
| ⚠️ Divergent multiples | Forward P/E < 50% of trailing P/E | Either explosive earnings growth is expected or trailing earnings were depressed by one-offs — find out which |
| 💰 Payout stress | Payout Ratio > 70%, or FCF dividend coverage < 1.5× | The dividend is competing with reinvestment and may be cut |
| 📉 Crowded short | Short Interest > 15% of float | Sophisticated money is betting against it — the deep dive must locate and evaluate the bear thesis |
| 🌀 High beta | Beta > 1.7 | Position-sizing consideration, not a quality signal |

---

## Sector and lifecycle adjustments

Applied blindly, any transversal screen produces systematic errors. Three standing adjustments:

**Financials (banks, insurers).** Altman Z, Debt/Equity, Current Ratio, and EV/EBITDA are structurally meaningless for balance-sheet-driven businesses. Score them on ROE, net margin, and Piotroski only, or triage them in a separate bucket. *Classify by industry, not sector:* data vendors' "Financial Services" sector also sweeps in fee businesses — insurance brokers, exchanges and data vendors, asset managers — whose balance sheets are ordinary; those belong on the standard rubric. Lending-adjacent industries (banks, insurance carriers, capital markets, credit services, mortgage finance, conglomerates) take the financial rubric; "credit services" deliberately stays in that bucket even though it mixes fee networks (Visa, Mastercard) with real lenders (Amex, Capital One) — the networks ace the ROE/net-margin rubric anyway, while a lender misrouted onto the industrial rubric would be zeroed by structurally missing EBITDA and current-ratio data.

**Capital-intensity spread.** Software businesses will structurally ace Pillar B and C thresholds; industrials and autos will structurally sit near the half-point bands. When a batch mixes sectors, compare scores *within* sector before comparing across, or you will simply select for asset-light business models rather than for quality within each model.

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
