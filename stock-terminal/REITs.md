# REITs and FFO: Why Use FFO Instead of Free Cash Flow?

## What is a REIT?

A **Real Estate Investment Trust (REIT)** is a company that owns, operates, or finances income-producing real estate. Instead of purchasing properties directly, investors can buy shares of a REIT and gain exposure to a diversified portfolio of real estate assets.

Common REIT property types include:

- Apartments
- Office buildings
- Shopping centers
- Warehouses and logistics facilities
- Data centers
- Cell towers
- Hotels
- Healthcare facilities

REITs are typically focused on generating rental income and distributing a large portion of their earnings as dividends to shareholders.

**A note on scope.** Everything below — FFO, AFFO, P/FFO — describes **equity REITs**, the kind that own physical property. **Mortgage REITs (mREITs)** are a structurally different business (they own mortgage securities, not buildings) and none of this applies to them. See [Mortgage REITs (mREITs): A Different Business Entirely](#mortgage-reits-mreits-a-different-business-entirely) near the end of this document.

---

## Why Traditional Metrics Don't Work Well

For most companies, common valuation and performance metrics include:

- Net Income
- Earnings Per Share (EPS)
- Free Cash Flow (FCF)

These metrics are less suitable for REITs because of **accounting depreciation**.

Real estate assets often maintain or increase their market value over time, but accounting rules require buildings to be depreciated every year. This depreciation reduces reported net income even though it does not represent an actual cash outflow.

As a result:

- Net Income tends to understate the operating performance of REITs.
- Free Cash Flow can also be misleading due to the nature of real estate investments and recurring capital expenditures.

---

## Full FFO

To address this issue, the real estate industry primarily uses **Funds From Operations (FFO)**. The official (NAREIT) definition generally starts with:

```text
FFO = Net Income
    + Depreciation & Amortization
    - Gains from Property Sales
    + Losses from Property Sales
    + Impairments of depreciable property
```

Adding back depreciation produces a metric that reflects the recurring earnings the properties generate. Removing gains and losses from property sales ensures one-time transactions don't distort that picture — without it, a REIT could flatter its payout ratio simply by selling a building, even though the sale shrinks the portfolio the *next* dividend has to come from. Impairments are excluded for the mirror-image reason: a write-down is a non-cash revaluation, not a shortfall in what the buildings earned.

---

## Approximate NAREIT FFO (as computed here)

The rubric computes the full definition above, to the precision the source data allows:

```text
FFO = Net Income
    + Depreciation & Amortization        ("Depreciation And Amortization")
    + Operating Gains Losses             (cash flow reconciliation, signed to add)
    + Asset Impairment Charge
```

The last two come off the cash flow statement's operating section, where each is already signed for addition — a gain backed out of net income appears negative, an added-back loss or impairment positive — so the lines are summed as reported. Where a line is absent it contributes 0; the D&A add-back, by contrast, is required (no D&A line, no FFO — see the fallback note below).

It remains an **approximation**, for two reasons worth knowing:

- `Operating Gains Losses` is a general non-cash gain/loss adjustment. For an equity REIT it is dominated by property disposals, but it can carry other items (debt extinguishment, derivative marks).
- NAREIT adds back only *real estate* depreciation, whereas the D&A line also includes amortization of intangibles and deferred financing costs — so the add-back is slightly generous.

**Treat REIT grades as directional, not precise.** They are for ruling out clearly over-levered or under-covered names, not for fine-ranking REIT against REIT.

### Why the adjustments are not optional

They are not a rounding detail. Backing out disposal gains moved Prologis's (PLD) FFO payout from a comfortable-looking 61% to its true 76%, and Federal Realty's (FRT) from 49% to 60% — both cross a scoring band. The impairment add-back moves the other way: Realty Income's (O) 81% (an apparent breach of the ≤80% comfortable band, caused by a $471M write-down) is really 74%.

---

## AFFO (Adjusted Funds From Operations)

**Adjusted Funds From Operations (AFFO)** goes one step further by estimating the recurring cash flow actually available to shareholders.

AFFO typically adjusts FFO by accounting for:

- Maintenance capital expenditures
- Straight-line rent adjustments
- Other recurring non-cash accounting items

AFFO is generally considered the best measure of a REIT's sustainable cash generation, but it requires more detailed financial data and is therefore more difficult to calculate automatically.

---

## REIT-Specific Valuation Metrics

Instead of using generic Free Cash Flow metrics, REITs are commonly evaluated using:

### FFO Payout Ratio

Measures how much of the REIT's FFO is distributed as dividends.

```text
FFO Payout Ratio = Dividends / FFO
```

This helps assess dividend sustainability.

---

### Price-to-FFO (P/FFO)

The REIT equivalent of the Price-to-Earnings (P/E) ratio.

```text
P/FFO = Share Price / FFO per Share
```

This is one of the most widely used valuation metrics for REITs.

---

## Why This Is a Better Approach

Using **FFO** instead of Free Cash Flow makes the evaluation much closer to how professional investors analyze REITs because it:

- Removes the distortion caused by accounting depreciation.
- Better reflects the recurring operating performance of real estate assets.
- Enables industry-standard valuation metrics such as **P/FFO**.
- Allows dividend sustainability to be measured using the **FFO payout ratio**.
- Aligns the screening methodology with common REIT analysis practices.

Although **AFFO** remains the most complete cash-flow metric — and stays out of reach, since splitting capex into maintenance vs. growth isn't in any structured statement — approximating NAREIT FFO provides a significant improvement over GAAP- or FCF-based proxies while remaining computable from standard financial statements.

---

# Relationship to ROIC and WACC

## Does FFO Replace ROIC?

No. **FFO/AFFO** and **ROIC-WACC** measure different aspects of a business.

| Metric | Purpose | Primary Use |
|---------|---------|-------------|
| **FFO / AFFO** | Measures recurring operating cash generation. | Earnings quality, dividend sustainability, valuation. |
| **ROIC vs WACC** | Measures whether the company generates returns above its cost of capital. | Capital allocation and economic value creation. |

While both are useful financial metrics, they answer different questions.

---

## Why ROIC Is Less Useful for REITs

ROIC (Return on Invested Capital) is designed for operating businesses and is generally calculated using:

```text
ROIC = NOPAT / Invested Capital
```

For REITs, this metric becomes less meaningful for several reasons:

### 1. Depreciation Distorts Operating Profit

Buildings are depreciated under GAAP even though they often maintain or increase their market value.

This reduces Net Operating Profit After Taxes (NOPAT), making ROIC appear artificially low.

---

### 2. Book Value Does Not Reflect Economic Value

ROIC relies heavily on accounting book values.

Real estate, however, frequently appreciates while its accounting value decreases because of depreciation.

As a result, the denominator (invested capital) and numerator (operating profit) both become less representative of the property's true economics.

---

### 3. REIT Capital Structures Are Different

REITs intentionally operate with significant leverage and continuously acquire income-producing properties.

Their objective is to maximize long-term rental income and shareholder distributions rather than optimizing ROIC in the way industrial or technology companies do.

---

## What REIT Investors Use Instead

Professional REIT analysis typically focuses on metrics specifically designed for real estate businesses, including:

- FFO
- AFFO
- Price-to-FFO (P/FFO)
- FFO or AFFO payout ratio
- Net Asset Value (NAV)
- Net Operating Income (NOI) growth
- Occupancy rates
- Debt and leverage metrics

These metrics provide a more accurate picture of operating performance, valuation, and dividend sustainability than ROIC.

---

## Implications for a REIT Rubric

Replacing Free Cash Flow-based metrics with **FFO** is an important improvement, but the **ROIC-WACC** pillar should also be reconsidered.

A practical framework is:

### Standard Operating Companies

- ROIC vs WACC
- Free Cash Flow Yield
- Price-to-Earnings (P/E)
- EV/EBIT

### REITs

- Price-to-FFO (P/FFO)
- FFO or AFFO payout ratio
- Net Asset Value (NAV)
- Debt and leverage metrics
- Occupancy and NOI growth

In other words, REITs benefit from a dedicated evaluation framework rather than adapting metrics designed for traditional operating companies. While FFO does not replace ROIC conceptually, it is a much more appropriate foundation for assessing the recurring operating performance of real estate businesses.

---

# Mortgage REITs (mREITs): A Different Business Entirely

## Why Mortgage REITs Need Their Own Framework

Everything above — FFO, AFFO, P/FFO — is built on one premise: the REIT owns **physical property** that GAAP depreciates but doesn't actually lose value. That premise doesn't hold for a **mortgage REIT (mREIT)**.

A mortgage REIT doesn't own buildings. It owns a portfolio of mortgage-backed securities and related debt instruments, typically financed with substantial short-term leverage (repo borrowing), and earns the spread between what it collects on its securities and what it pays to finance them. It is, in substance, a leveraged fixed-income fund wrapped in REIT form for tax purposes (the same "distribute ~90% of taxable income" rule that applies to equity REITs).

This means **neither framework in this document fits an mREIT**:

- **FFO doesn't apply.** FFO's entire purpose is adding back property depreciation. An mREIT holds securities, not depreciable property, so the add-back degenerates to `FFO ≈ Net Income` and the gain backout would strip *securities* gains — which are the business itself, not a one-off distortion of it. The whole FFO family is therefore left empty for mREITs **by business type**, not by waiting for the D&A line to be absent: some mREITs (NLY) do report one, and inferring the type from the data would quietly route them onto the equity-REIT rubric. Dividend coverage uses the earnings payout ratio instead — the right denominator for a business with no depreciation.
- **The bank/financial rubric misleads.** A balance-sheet-lender rubric (ROE, net margin, Piotroski) looks like the natural fallback — mREITs are, after all, leveraged financial businesses. But an mREIT's net margin is typically extreme (interest income minus a thin financing cost, with almost no other operating expense), so a metric like "net margin" rewards a structural artifact of the business model rather than telling you anything about quality. A mREIT paying out more than it earns and steadily eroding book value can still show an outstanding net margin.

## What Actually Determines an mREIT's Quality

Since neither FFO nor bank metrics apply, mREIT analysis centers on four questions instead:

### 1. Is the dividend covered by earnings?

```text
Payout Ratio = Dividends / Earnings
```

An mREIT paying out more than it earns isn't distributing profit — it's returning investors' own capital, or borrowing to fund the dividend. `≤100%` is covered; `100–120%` is a modest, watchable shortfall; above `120%` the dividend is structurally unsustainable at the current earnings run-rate.

### 2. Where does the price sit relative to book value?

mREITs hold securities that are marked (or close) to market value, so **Price-to-Book (P/B)** — not P/E or P/FFO — is the primary valuation anchor, much like a bank or an insurer. A mortgage REIT trading meaningfully below book (`P/B < 0.90`) is priced at a discount to its own portfolio; a premium above book (`P/B > 1.10`) is expensive for what is, in substance, a levered bond fund.

### 3. How much leverage backs the portfolio?

mREITs run leverage far beyond what would be prudent for an operating company — and that is by design, not distress, provided the collateral quality supports it. **Agency mREITs** (portfolios of government-agency-guaranteed MBS, e.g. Fannie Mae/Freddie Mac paper) can safely run leverage around **8× Debt/Equity (≈800%)**; anything beyond roughly **10× (≈1000%)** is genuinely excessive even for agency collateral. Non-agency (credit-risk) mREITs would warrant materially tighter bands, though this app does not currently distinguish agency from non-agency within the mREIT bucket.

### 4. Is book value per share holding, growing, or eroding?

```text
BVPS Growth = Annualized change in (Shareholders' Equity / Shares Outstanding)
```

This is **the single most important mREIT quality signal**. An mREIT that holds or grows book value per share while paying its dividend is compounding value; one whose book value steadily declines is funding its distribution out of capital — destroying the very asset base the dividend is supposed to come from, regardless of how attractive the headline yield looks. A mild decline (roughly `−5%/yr` or better) is common enough in this sector to not be alarming on its own; a steeper, sustained slide is the real warning sign.

## The mREIT Rubric Used in This App

| Pillar | Metric | Weight | Full credit | Half credit |
| --- | --- | --- | --- | --- |
| Dividend coverage | Payout ratio | 35 | ≤ 100% | ≤ 120% |
| Price vs. book | P/B | 25 | ≤ 0.90 | ≤ 1.10 |
| Leverage | Debt/Equity | 20 | ≤ 800% | ≤ 1000% |
| Book-value trend | Annualized BVPS growth | 20 | > 0% | ≥ −5%/yr |

Full detail, including how this differs across the three strategies (Triage, Compounder, Defensive Value), is in [stock-triage-strategy.md](stock-triage-strategy.md#business-type-archetypes).

## A Caveat on Precision

As with equity-REIT FFO, treat mREIT grades as **directional, not exact**:

- **Coverage uses GAAP net income**, which for an mREIT includes volatile mark-to-market swings on its securities and hedges — not the "core"/"distributable" earnings figure the REIT itself typically highlights to justify its dividend. A single quarter's coverage ratio can look far worse (or better) than the underlying earnings power due to one-off valuation moves; read the trend across several quarters, not one data point.
- **Book-value trend is computed from a handful of annual balance-sheet snapshots** (shareholders' equity ÷ shares outstanding), not a smoothed or adjusted series.
- **This app does not distinguish agency from non-agency (credit) mREITs.** The leverage bands above are calibrated for agency-collateral portfolios; a non-agency-focused mREIT running similar leverage carries meaningfully more risk than these bands would suggest.