# Strategy 3 — Defensive Value

## Purpose and philosophy

This is the margin-of-safety lens, in the Graham "defensive investor"
tradition: **pay clearly less than the business is conservatively worth, and
only for businesses strong enough to survive being wrong about.** Where
strategy 2 hunts excellence and tolerates a full price, this strategy hunts
resilience at a discount — the long-term return here comes as much from the
price paid as from the business bought.

It complements the other two deliberately: strategy 1 removes the broken,
strategy 2 finds the excellent, strategy 3 finds the *safe and cheap*. A stock
that scores well on **all three** is a quality business, in demonstrable
health, at a defensible price — the intersection the whole framework exists to
find.

Scores run 0–100. Missing data earns 0 for that metric — an unverifiable
margin of safety is no margin of safety. The single exception is Pillar D's
earnings-stability legs, which fall back to a single-year sign test when there
is no history to count; see the note there for why absent *history* is treated
differently from an absent *figure*.

---

## Pillar A — Earnings and cash yield (25 points)

Cheapness against what the business actually produces.

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **P/E** (10 pts) | 0 < P/E < 15 | 15–25 | > 25 or loss-making |
| **P/FCF** (10 pts) | < 15 | 15–25 | > 25 or FCF ≤ 0 |
| **EV/EBITDA** (5 pts) | 0 < EV/EBITDA < 10 | 10–14 | > 14 |

## Pillar B — Asset backing (15 points)

The classic anchor: what is the claim on real net assets worth?

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **P/B** (8 pts) | 0 < P/B < 1.5 | 1.5–3.0 | > 3.0 |
| **Graham multiplier** — P/E × P/B (7 pts) | ≤ 22.5 | — | > 22.5 (or either input unavailable) |

The 22.5 threshold is Graham's original (15 × 1.5): a stock may exceed one
bound if it compensates on the other. Asset-light franchises will routinely
fail Pillar B — that is by design; they belong to strategy 2.

## Pillar C — Financial strength (25 points)

Cheap and fragile is a value trap. The discount only counts on a balance sheet
that can wait out a bad decade.

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **Current Ratio** (8 pts) | ≥ 2.0 | 1.5–2.0 | < 1.5 |
| **Debt/Equity** (9 pts) | < 0.5 (or debt-free) | 0.5–1.0 | > 1.0 |
| **Altman Z-Score** (8 pts) | ≥ 3.0 | 1.81–3.0 | < 1.81 |

A company with no debt at all takes full Debt/Equity points. A company with
**negative equity** takes zero: the sign-flipped D/E would otherwise read as
"low leverage" when it is in fact the most levered state a balance sheet can
be in — the opposite of the resilience this pillar is buying.

*Financials* score this pillar on ROA alone (25 pts). *REITs* replace it too:
Current Ratio and Altman-Z don't apply to a property business and its leverage
is high by design, so strength is judged on REIT-appropriate D/E bands (≤100%
conservative, ≤200% typical) plus how well **FFO** covers the mandatory, high
distribution — GAAP FCF understates a REIT's distributable cash, so it is only
the fallback when no FFO is available (and is banded more leniently to match).
See the archetypes section in stock-triage-strategy.md.

## Pillar D — Earnings quality (20 points)

A low multiple on bad earnings is a high multiple in disguise.

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **Net Income positive** (5 pts) | every year | one year negative | two or more negative |
| **Free Cash Flow positive** (5 pts) | every year | one year negative | two or more negative |
| **Piotroski F-Score** (10 pts) | ≥ 7 | 4–6 | ≤ 3 |

The two stability legs count positive years across the annual statement history
(~4 periods on the underlying feed) rather than testing the sign of the latest
year. Graham's defensive investor wanted positive earnings in *each* of the past
ten years, and for good reason: a single-year snapshot scores a fortress that
took one restructuring charge identically to a chronic loss-maker, and rewards a
dollar of profit exactly like ten billion. One bad year takes half — a bad year
is not a broken business. Two is a pattern.

Where fewer than two periods carry a usable figure — a young company, or a line
the filing doesn't break out — there is no consistency to judge and the leg
falls back to the sign of the latest figure. That is the one place in this
strategy where absent data doesn't score zero: the alternative punishes a
company for a track record it has not had time to accumulate, which is a
statement about its age rather than its safety.

## Pillar E — Dividend record (15 points)

For the defensive investor the dividend is both return and discipline — a
management that pays and grows a covered dividend has fewer ways to waste the
margin of safety.

| Metric | Full points | Half points | Zero |
|---|---|---|---|
| **Dividend yield** (5 pts) | ≥ 2% | > 0% | none |
| **Consecutive years of increases** (5 pts) | ≥ 10 | ≥ 3 | < 3 |
| **Sustainability** (5 pts) | payout ≤ 60% **and** FCF coverage ≥ 1.5× | payout ≤ 75% **and** coverage ≥ 1.0× | worse |

Non-payers can still reach ~85/100 on business strength and price alone, but
the full score is reserved for names that also pay the owner while they wait.

---

## Decision bands

| Score | Verdict | Meaning |
|---|---|---|
| **≥ 70** | **Value candidate** | Cheap on multiple measures *and* strong enough to hold — deep-dive for the reason it's cheap |
| **50 – 69** | **Fair** | Reasonably priced or reasonably strong, not compellingly both |
| **< 50** | **Expensive / weak** | No margin of safety at this price, or too fragile to trust one |

The deep dive on any Value candidate must answer one question first: **why is
it cheap?** Cheapness plus deteriorating fundamentals (low strategy 1 score)
is the classic value trap; cheapness with health intact is what this screen
exists to surface.

---

## Sector adjustments

Rows are classified into the same [business-type
archetypes](stock-triage-strategy.md#business-type-archetypes) S1 uses.

**Financials (banks, insurers).** Current ratio, Debt/Equity and Altman Z are
structurally meaningless for balance-sheet businesses. Classification is by
*industry* (banks, insurance carriers, capital markets, credit services,
mortgage finance, conglomerates); fee businesses in the "Financial Services"
sector — insurance brokers, exchanges/data vendors, asset managers — score on
the standard rubric. For financials,
Pillar C is scored on ROA instead: ≥ 1.5% full (25 pts), 0.8–1.5% half.
Pillars A, B, D, E apply unchanged — P/E and P/B are, if anything, *more*
informative for banks than for industrials.

**REITs (Real Estate).** P/E, EV/EBITDA, net income and Piotroski are all
depreciation-distorted for property, so four of the five pillars are rebuilt on
**approximate NAREIT FFO** (see [REITs.md](REITs.md); GAAP-FCF fallback when no D&A):

- **Pillar A — earnings/cash yield (25):** P/FFO (the REIT earnings multiple)
  instead of P/E + P/FCF + EV/EBITDA — < 12× → 25, ≤ 16× → 15, ≤ 20× → 8.
- **Pillar B — asset backing (15):** P/B (real estate has genuine book value —
  a rough NAV proxy), banded < 1.0 → 15 / < 1.5 → 10 / ≤ 2.5 → 5. The Graham
  P/E × P/B test is dropped (it uses the distorted P/E).
- **Pillar C — financial strength (25):** REIT D/E bands (≤100% → 12, ≤200% → 6)
  + FFO coverage of the distribution (> 1.5× → 8, > 1.2× → 4) + FFO positive (5).
  The coverage bands sit above Pillar D's because this pillar is buying
  resilience, not just sustainability — and FFO is not AFFO, so it overstates
  distributable cash by the maintenance capex it never subtracts. Without FFO,
  the GAAP-FCF fallback bands at > 1.2× / > 0.8×.
- **Pillar D — earnings quality (20):** FFO positive (8) + FFO coverage
  ≥ 1.0× (7) + payout within FFO (≤ 90% → 5). Net-income sign and Piotroski
  are dropped — both mislead for REITs.
- **Pillar E — dividend record (15):** yield and increase-streak unchanged, but
  sustainability judged on the FFO payout rather than the earnings payout.

REIT grades remain directional — the FFO here approximates NAREIT FFO but is not exact, and is not AFFO.

**Mortgage REITs (industry "REIT — Mortgage").** A discount to book, backed by a
covered dividend and non-eroding book value, is genuine defensive value — so the
rubric is: discount to book (35, P/B < 0.80 → full, ≤ 0.95 → 22, ≤ 1.10 → 11),
dividend coverage (25, payout ratio), book-value-per-share trend (20), and
leverage on wide agency-appropriate bands (20, ≤ 800% / ≤ 1000%). See the mREIT
section in [stock-triage-strategy.md](stock-triage-strategy.md).

**Cyclicals** (and asset-light names) stay on the standard rubric. A
trough-of-cycle P/E can look expensive (depressed earnings) exactly when the
stock is cheapest, and vice versa — but Pillars B and C carry the signal
through the cycle; treat a strong B+C with a weak A as a name to re-score next
quarter, not to discard. There is no normalized-earnings data available to do
better, so no bespoke rubric is imposed.

---

**One-line summary:** *buy demonstrable financial strength at a price that
already assumes disappointment, insist the earnings behind the multiple are
real, and let a covered, growing dividend pay you to be patient.*
