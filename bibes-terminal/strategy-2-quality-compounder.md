# Strategy 2 — Quality Compounder

## Purpose and philosophy

Where the triage framework (strategy 1) asks *"is this business broken?"*, this
strategy asks the long-term investor's question: **"can this business compound
capital for a decade?"** It looks for the signature of a durable franchise —
high returns on capital, defensible margins, disciplined balance sheets, and a
demonstrated track record of compounding — and only glances at valuation as a
sanity check, not a timing tool.

The philosophy is Buffett/Munger-shaped: *a wonderful company at a fair price
beats a fair company at a wonderful price.* Time is the friend of the
high-return business; the strategy therefore weights **what the business earns
on its capital** far above what the stock costs today.

Scores run 0–100. Missing data earns 0 for that metric — a compounding record
that can't be seen can't be credited.

---

## Solvency guard

A compounder must first survive. Before scoring, two guards apply:

| Guard | Condition | Effect |
|---|---|---|
| Distress | Altman Z-Score < 1.8 (**capital-intensive only, except utilities** — the Altman model is calibrated on manufacturers; Altman excluded utilities from his sample, and a healthy regulated utility's Z sits below 1.8 as a matter of course) | Score capped at 35 (Pass) |
| Capital consumption | Net Income < 0 **and** FCF < 0 (all archetypes) | Score capped at 35 (Pass) |

These are caps, not kills — the pillar breakdown stays visible for the audit
trail, but a distressed name cannot reach the Watch band.

---

## Pillar A — Returns on capital (30 points)

The engine of compounding: what the business earns on the money inside it.

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **ROIC** (12 pts) | > 15% | 8–15% | < 8% |
| **ROCE** (8 pts) | > 15% | 8–15% | < 8% |
| **ROE** (10 pts) | > 15% | 10–15% | < 10% |

*ROE leverage cap:* when Debt/Equity > 1.0, ROE earns at most half points —
returns bought with leverage are not the same as returns earned by the
franchise. When equity is outright **negative**, ROE earns zero: the ratio is
arithmetic noise at that point (negative income over negative equity reads as
a healthy positive).

## Pillar B — Margin moat (20 points)

Sustained pricing power shows up as margin.

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **Operating Margin** (12 pts) | > 15% | 8–15% | < 8% |
| **Gross Margin** (8 pts) | > 40% | 25–40% | < 25% |

*Thin-margin escape hatch:* a moat can be margin × turnover, not margin alone —
absolute bands read a superb grocer or distributor as moat-less. When the
pillar sums below half, strong returns on capital floor it at half (10/20):
ROIC ≥ 12%, or ROE ≥ 15% on positive equity without the leverage that would
make ROE an artifact (D/E ≤ 1.0, or debt-free). Half, never full — the escape
stops the bands taxing a business *model*; it cannot inflate a weak business.

## Pillar C — Capital discipline (20 points)

Compounding is interrupted by balance-sheet accidents and fictitious earnings.

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **Debt/EBITDA** (10 pts) | < 1.5× (or debt-free) | 1.5–3.0× | > 3.0× |
| **FCF / Net Income** (10 pts) | ≥ 0.8 (both positive) | 0.5–0.8 | < 0.5 or negative |

A company with no debt at all takes full leverage points — structurally clean
balance sheets are the best case, not missing data.

## Pillar D — Compounding track record (20 points)

Has the *business* actually compounded? Price CAGR embeds valuation swings and
momentum — "the stock went up" is not "the business grew" — so where the
statement history is deep enough to show a real trend (≥ 3 fiscal years, ~4 on
Yahoo's free feed), the pillar leads with **revenue-per-share growth**:
per-share, so dilution can't fake it (and buyback accretion rightly counts);
revenue, so it reads the same across business models where EPS and FCF swing
on accounting or cycle. The 5Y price CAGR stays as confirmation (dividends
excluded, so payers are modestly understated — acceptable for a growth lens).

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **Revenue/share trend** (12 pts) | ≥ 10%/yr | 5–10%/yr | < 5%/yr |
| **5Y price CAGR** (8 pts) | ≥ 12%/yr | 6–12%/yr | < 6%/yr |

The revenue/share figure is a least-squares trend fitted across *all* the
available fiscal years, not endpoint-to-endpoint CAGR. With only ~4 periods on
Yahoo's feed, endpoint CAGR hands one anomalous base year total control of the
number — a company that merely rebounded off a 2021 trough would print the
same "growth" as one that genuinely compounded. The fitted slope reads every
year, so a trough endpoint loses most of that leverage.

With fewer than 3 comparable fiscal years of revenue and share counts the
pillar falls back to the price-only legs (5Y and 10Y price CAGR, 10 pts each,
same bands) — a name never scores worse for having statements. A listing too
young for either earns 0: a track record must exist to be credited. This
deliberately tilts the strategy toward proven compounders and away from
stories — though the statement fallback means a company public only a few
years is now judged on the fundamental record it *does* have (statements often
predate the IPO) rather than on price history it cannot have.

## Pillar E — Valuation sanity (10 points)

Not a value test — only a guard against paying silly prices for quality.

| Condition | Points |
|---|---|
| PEG < 1.5 **or** P/FCF < 25 | 10 |
| PEG < 2.5 **or** P/FCF < 40 | 5 |
| Neither (or both unavailable) | 0 |

---

## Decision bands

| Score | Verdict | Meaning |
|---|---|---|
| **≥ 70** | **Compounder** | The quality profile is present — deep-dive for durability of the moat |
| **50 – 69** | **Quality watch** | Some compounding traits; re-check as the record lengthens |
| **< 50** | **Pass** | Not a compounder by this evidence |

---

## Sector adjustments

Rows are classified into the same [business-type
archetypes](stock-triage-strategy.md#business-type-archetypes) S1 uses.
**Financials** and **REITs** get substituted pillars (below); **cyclical** and
**asset-light** names stay on the standard rubric — they're ordinary operating
companies whose ROIC, margins and Debt/EBITDA genuinely apply (with more
year-to-year noise, which the 5Y/10Y track-record pillar smooths), and there
is no normalized/through-cycle data to justify a bespoke rubric for them.

**Financials (banks, insurers).** ROIC, ROCE, Debt/EBITDA and operating margin
are structurally meaningless for balance-sheet businesses. Classification is
by *industry* (banks, insurance carriers, capital markets, credit services,
mortgage finance, conglomerates) — fee businesses inside the "Financial
Services" sector (insurance brokers, exchanges/data vendors, asset managers)
have ordinary balance sheets and score on the standard rubric. Financials are
scored on the same 100-point scale with substitutions: Pillar A becomes ROE
alone (30 pts, > 15% full / 10–15% half), Pillar B uses net margin (20 pts,
> 20% full / 10–20% half), and Pillar C becomes payout discipline (payout
< 60%, 10 pts) plus fundamental trend (Piotroski ≥ 7 full / 4–6 half, 10 pts).
Pillars D and E are unchanged.

**REITs (Real Estate).** ROIC/ROCE are depreciation-understated and Debt/EBITDA
runs high by design, so the pillars are rebuilt on **approximate NAREIT FFO** (see
[REITs.md](REITs.md); falls back to GAAP FCF when no D&A line is available):

- **Pillar A — returns (30):** FFO over invested capital (debt + equity) — a
  REIT's real cash yield on deployed capital — banded > 7% full / > 4% half
  (20 pts), plus a lighter ROE band (> 10% / > 6%, 10 pts).
- **Pillar B — moat (20):** operating (NOI-style) margin only; gross margin
  isn't a meaningful line for a rental business.
- **Pillar C — discipline (20):** leverage on REIT D/E bands (≤ 100% → 10,
  ≤ 200% → 5, 10 pts) plus distribution discipline — paying *within* FFO
  (FFO payout ≤ 90% → 10, ≤ 100% → 5, 10 pts). Paying out more than FFO is the
  real red flag, not a high Debt/EBITDA.
- **Pillar E — valuation (10):** P/FFO (< 15× → 10, ≤ 22× → 5).
- **Pillar D** (compounding track record) is unchanged — revenue/share for a
  REIT is rental income per share, a fine growth line.

REIT grades remain directional — the FFO here approximates NAREIT FFO but is not exact, and is not AFFO.

**Mortgage REITs (industry "REIT — Mortgage").** Graded separately again: a
mREIT isn't an operating compounder, so the question becomes *does it preserve
book value while paying a sustainable distribution?* Book-value-per-share trend
(35) and dividend coverage (30) dominate, with a distribution record (20) and a
price-vs-book valuation sanity check (15). A mREIT can only reach the Compounder
band by genuinely holding book value and covering its payout — rare, and
correct. See the mREIT section in [stock-triage-strategy.md](stock-triage-strategy.md).

**Young companies.** With ≥ 3 fiscal years of statements, Pillar D judges the
fundamental record a young company *does* have (statements often predate the
IPO), so a genuinely compounding recent listing is no longer zeroed for lacking
price history. Below that there is nothing trend-shaped to credit, and the
pillar scores 0 — intentional: this is the *proven* compounder lens; unproven
names should earn their way in through strategy 1's quality score first.

---

**One-line summary:** *find businesses that earn far more on their capital
than it costs, protect those returns with real margins and clean balance
sheets, have already compounded for years — and aren't priced for a miracle.*
