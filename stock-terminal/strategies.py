"""Strategy graders — score a screener row against the three long-term
investing strategies documented in this directory:

  Strategy 1 — Triage            (stock-triage-strategy.md)        bands 65/45
  Strategy 2 — Quality Compounder (strategy-2-quality-compounder.md) bands 70/50
  Strategy 3 — Defensive Value   (strategy-3-defensive-value.md)   bands 70/50

Each grader is a pure function of the screener_row dict (missing values are
tolerated everywhere and score 0 — "missing data should never help a stock").
`grade_row` returns the keys merged into every screener row:

    strategy_1 / strategy_2 / strategy_3   int 0-100, or None (S1 quarantine)
    strategy_1_verdict / _2_ / _3_         human-readable verdict string
    strategy_1_flags                       Stage 0 sanity + Stage 3 valuation
                                           context flags, " · "-joined string
                                           ("" when clean or quarantined)
    strategy_min                           min of the three (the "good under
                                           every lens" sort key), None if any
                                           strategy is ungradable

Unit conventions of screener_row (see SCREENER_COLUMNS.md):
  fractions          profit_margin, gross_margin, operating_margin, roe, roa,
                     payout_ratio, ffo_payout
  percentage points  roic, roce, wacc, div_yield, debt_to_equity, perf_*
  plain ratios       pe, pb, peg, p_fcf, ev_ebitda, debt_ebitda, current_ratio,
                     quick_ratio, fcf_coverage, ebitda_fcf, p_ffo, ffo_coverage,
                     interest_coverage
  scores             altman_z (classic, carries a market-cap term),
                     altman_z_prime (price-free, its own 2.9/1.23 bands —
                     never read one on the other's bands), piotroski_f
  absolute currency  ffo (Net Income + D&A − property-sale gains + impairments
                     — equity-REIT-only; see _grade_triage's reit branch)
  period counts      ni_positive_years / ni_years, fcf_positive_years /
                     fcf_years — positive annual periods out of those with a
                     usable figure (~4 on Yahoo's feed); None when the line has
                     no history rather than 0

Every row is also classified into a business-type archetype (_business_type)
that changes which kill-switches and pillar weights apply — see its docstring.
"""

import math

# Row keys that are not judgeable metrics, excluded from the Stage 0
# completeness check.
_NON_METRIC_KEYS = {
    "ticker", "name", "summary", "sector", "industry", "currency",
    "financial_currency", "error",
    "spark_6mo", "spark_1y", "spark_5y", "ex_dividend_date",
    "strategy_1", "strategy_2", "strategy_3", "strategy_min",
    "strategy_1_verdict", "strategy_2_verdict", "strategy_3_verdict",
    "strategy_1_flags",
    "strategy_1_detail", "strategy_2_detail", "strategy_3_detail",
    # Conditional/derived fields — only meaningful for some business types, so
    # their absence must not count toward the Stage-0 "row too empty" quarantine
    # (a mortgage REIT legitimately has no FFO; a young company no BVPS trend
    # and no multi-year positive-year counts; financials and REITs are
    # deliberately blanked on the FCFF DCF fields).
    "ffo", "p_ffo", "ffo_payout", "ffo_coverage", "bvps_growth", "rps_growth",
    "dcf_value", "dcf_upside",
    "ni_positive_years", "ni_years", "fcf_positive_years", "fcf_years",
}

# Stage 0 critical fields (triage doc): a row missing any of these can't be
# scored. Exception: a blank Total Debt alongside cash on hand is treated as
# zero debt rather than missing — low-leverage companies often have the field
# blank precisely because there is nothing to report, and punishing a clean
# balance sheet as "unknown" is backwards.
_CRITICAL = ("income", "fcf", "total_debt", "total_equity")


# Balance-sheet financials — businesses whose raw material is the balance
# sheet itself, making Altman Z, Debt/Equity, current ratio and EV/EBITDA
# structurally meaningless. Matched on *industry*, because Yahoo's "Financial
# Services" sector also contains fee businesses (insurance brokers, exchanges
# and data vendors, asset managers) with perfectly ordinary balance sheets
# that belong on the standard rubric. "Credit Services" stays in the
# balance-sheet bucket: it mixes real lenders (Amex, Capital One) with fee
# networks (Visa, Mastercard) and the industry string cannot separate them —
# misrouting a lender onto the industrial rubric (no EBITDA, no current
# ratio, D/E in the hundreds) is far more damaging than grading a payment
# network on ROE/net margin, which it aces anyway.
_FEE_INDUSTRIES = ("insurance brokers", "financial data", "stock exchanges",
                   "asset management")
_BS_INDUSTRIES = ("bank", "insurance", "capital markets", "credit services",
                  "mortgage", "financial conglomerates")


def _is_financial(row):
    ind = (row.get("industry") or "").lower()
    if ind:
        if any(p in ind for p in _FEE_INDUSTRIES):
            return False
        return any(p in ind for p in _BS_INDUSTRIES)
    # No industry available — fall back to the coarser sector match.
    return "financial" in (row.get("sector") or "").lower()


def _business_type(row):
    """Classify a row into one of five archetypes so the grader can apply the
    right rubric — a metric that disqualifies one business model is often
    meaningless for another (Altman-Z is a manufacturer model; ROIC/WACC breaks
    down for asset-light and property businesses; REITs are levered by design).

      financial          balance-sheet businesses (banks, insurers, lenders).
                         Own ROE/net-margin rubric; Altman/leverage/ROIC-WACC
                         all inapplicable. (delegates to _is_financial)
      reit               property businesses (Real Estate sector). Structurally
                         high leverage, thin current ratios, ROIC understated —
                         graded on cash flow / distribution / valuation instead.
      asset_light        Technology, Communication Services, Healthcare. Invested
                         capital omits the real (intangible/human) capital base,
                         so ROIC is inflated and its spread over a noisy high-beta
                         WACC is de-weighted; Altman is a soft flag, not a kill.
      cyclical           Energy, Basic Materials. Earnings and ROIC swing with the
                         commodity cycle, so a single-year spread or a low Altman
                         is softened rather than disqualifying.
      mreit              mortgage REITs (industry "REIT — Mortgage"). Leveraged
                         securities portfolios in a REIT wrapper — not operating
                         businesses, so neither the equity-REIT FFO rubric (they
                         own no depreciating buildings) nor the bank rubric fits
                         (net margin is an income-statement artifact). Graded on
                         dividend coverage, price vs book, leverage and book-value
                         trend instead.
      capital_intensive  Industrials, Utilities, Consumer, and anything unknown —
                         the asset-heavy, manufacturer-like default the classic
                         Altman-Z and ROIC/WACC gate were calibrated on. Unchanged.
    """
    ind = (row.get("industry") or "").lower()
    # Mortgage REITs are caught before the financial check (their "mortgage"
    # industry string would otherwise route them to the bank rubric). Requires
    # *both* "reit" and "mortgage" so mortgage *originators* (industry "Mortgage
    # Finance", no "reit") stay on the financial rubric as the lenders they are.
    if "reit" in ind and "mortgage" in ind:
        return "mreit"
    if _is_financial(row):
        return "financial"
    # Industry overrides — the few cases where the sector label genuinely
    # misroutes. Semiconductors ("Semiconductors", "Semiconductor Equipment &
    # Materials") sit in Technology but a fab is the opposite of asset-light:
    # tens of billions in plant, classic Altman/ROIC territory (this also moves
    # fabless designers — an accepted cost of a string match). Telecoms
    # ("Telecom Services") sit in Communication Services beside content
    # businesses, but towers, spectrum and fibre are as capital-heavy as any
    # industrial. Keep this list short and defensible — it is not a taxonomy.
    if any(p in ind for p in ("semiconductor", "telecom")):
        return "capital_intensive"
    sector = (row.get("sector") or "").lower()
    if "real estate" in sector:
        return "reit"
    if any(s in sector for s in ("technology", "communication", "health")):
        return "asset_light"
    if any(s in sector for s in ("energy", "basic material")):
        return "cyclical"
    return "capital_intensive"


def _is_utility(row):
    """Regulated utilities stay on the capital-intensive rubric, but two of its
    kill-switches misfire on them: Altman himself excluded utilities from his
    sample, and their leverage-heavy, low-asset-turnover balance sheets put a
    healthy utility's Z routinely below the 1.8 'distress' line; likewise a
    normal regulated utility runs Debt/EBITDA at 4.5–5.5×, so the generic 6×
    kill leaves no headroom for an ordinary capex year. Both switches are
    softened for this sector (see _grade_triage / the S2 solvency guard)."""
    return "utilit" in (row.get("sector") or "").lower()


def _neg_equity(row):
    """True when reported shareholders' equity is zero or negative (common in
    buyback-heavy names). Leverage ratios built on negative equity flip sign —
    a negative D/E would otherwise beat every 'low leverage' band — and ROE
    becomes arithmetic noise, so both are scored at the worst band instead."""
    eq = row.get("total_equity")
    return eq is not None and eq <= 0


def _round_score(x):
    """Round half UP. Python's round() is banker's rounding: it would send a
    64.5 to 64 (below the Advance band) but a 63.5 to 64 — with half-point
    bands, *.5 totals are common enough that band edges must be predictable."""
    return int(math.floor(x + 0.5))


# --------------------------------------------------------------------------- #
# Derivation breakdown — the per-pillar detail shown in the hover tooltip.     #
# Each grader records its pillars as it scores, so the explanation is a        #
# by-product of the real computation and can never drift from the number.     #
# --------------------------------------------------------------------------- #
def _pct(v, nd=0):
    """A percentage-point value as text ('25%'); '—' when missing."""
    return "—" if v is None else f"{v:.{nd}f}%"


def _r(v, nd=1, suffix=""):
    """A plain ratio as text; '—' when missing."""
    return "—" if v is None else f"{v:.{nd}f}{suffix}"


def _pill(k, p, m, d):
    """One breakdown row: k label, p points earned, m points available, d the
    metric values behind it. p is rounded to 1 dp so the tooltip stays tidy."""
    return {"k": k, "p": round(float(p), 1), "m": m, "d": d}


def _effective_debt(row):
    """Total debt, with the blank-but-cash-rich carve-out resolving to 0."""
    debt = row.get("total_debt")
    if debt is None and (row.get("total_cash") or 0) > 0:
        return 0.0
    return debt


def _band(v, full_at, half_at, pts, reverse=False):
    """Score v against two thresholds. reverse=False: higher is better
    (v > full_at -> pts, v > half_at -> pts/2). reverse=True: lower is better
    (v < full_at -> pts, v < half_at -> pts/2). None -> 0."""
    if v is None:
        return 0.0
    if reverse:
        if v < full_at:
            return float(pts)
        if v < half_at:
            return pts / 2.0
    else:
        if v > full_at:
            return float(pts)
        if v > half_at:
            return pts / 2.0
    return 0.0


def _positive_years(row, pos_key, yrs_key, latest, pts):
    """(points, detail text) for an earnings or cash-flow line scored on how
    many of its annual periods were positive rather than on the sign of the
    latest one. Graham's defensive test was consistency across a decade: a
    single-year snapshot scores a fortress that took one restructuring charge
    identically to a chronic loss-maker, and rewards $1 of profit exactly like
    $10bn. Yahoo's ~4 annual periods are the longest window this data affords.

    One negative year takes half — a bad year is not a broken business. Two or
    more takes zero. Below two usable periods there is no consistency to judge,
    so it falls back to the latest value's sign (the old behaviour) rather than
    scoring a young company zero for a track record it cannot yet have."""
    pos, yrs = row.get(pos_key), row.get(yrs_key)
    if not yrs or yrs < 2 or pos is None:
        return (float(pts) if (latest is not None and latest > 0) else 0.0,
                "+" if (latest is not None and latest > 0) else "−")
    neg = yrs - pos
    p = float(pts) if neg == 0 else (pts / 2.0 if neg == 1 else 0.0)
    return p, f"{pos}/{yrs} yrs +"


def _strong_returns(row, neg_eq):
    """True when returns on capital are strong enough to vouch for a thin-margin
    business model. Absolute margin bands read a great grocer or distributor —
    2% net margin, high turnover — as low-quality, when DuPont says the quality
    shows up as margin × turnover, a product ROIC/ROE already capture. The
    margin pillars use this as an escape hatch: margins that miss the bands
    still earn half the pillar when ROIC ≥ 12, or ROE ≥ 15 on real (positive)
    equity without the leverage that would make ROE an artifact (D/E ≤ 100%,
    or debt-free). Half, not full — the escape can't inflate a weak business,
    only stop the bands taxing a business model."""
    if _gt(row.get("roic"), 12):                    # pct points; capital-structure-aware
        return True
    roe = row.get("roe")                            # fraction
    if neg_eq or roe is None or roe * 100 < 15:
        return False
    d_eq = row.get("debt_to_equity")                # pct points
    return (d_eq is not None and d_eq <= 100) or _effective_debt(row) == 0


def _cagr_pct(total_return_pct, years):
    """Annualized % from a cumulative price return in percentage points."""
    if total_return_pct is None:
        return None
    base = 1.0 + total_return_pct / 100.0
    if base <= 0:
        return -100.0
    return (base ** (1.0 / years) - 1.0) * 100.0


# --------------------------------------------------------------------------- #
# Mortgage-REIT (mreit) scoring fractions. mREITs are leveraged securities    #
# portfolios in a REIT wrapper — their safety is about whether the dividend   #
# is covered (i.e. book value is preserved, not paid away), where the price   #
# sits vs book, how much leverage backs it, and whether book value per share  #
# is holding or eroding. Each returns 1.0 / 0.5 / 0.0 for a pillar to scale.  #
# --------------------------------------------------------------------------- #
def _mreit_coverage_frac(payout):
    """Dividend coverage from the payout ratio (dividends ÷ earnings). ≤100%
    covered by earnings; ≤120% a modest shortfall; above that (or missing) the
    dividend is being funded out of book value — the core mREIT failure mode."""
    if payout is None:
        return 0.0
    return 1.0 if payout <= 1.0 else (0.5 if payout <= 1.2 else 0.0)


def _mreit_pb_frac(pb):
    """Price vs book. mREITs trade around book, so ≤0.90 is a real discount,
    ≤1.10 fair, a premium above that is expensive for a bond portfolio."""
    if pb is None or pb <= 0:
        return 0.0
    return 1.0 if pb <= 0.90 else (0.5 if pb <= 1.10 else 0.0)


def _mreit_leverage_frac(d_eq):
    """Leverage (Debt/Equity, pct points). Agency mREITs run high by design on
    government-guaranteed collateral, so the bands are wide: ≤800% (≈8×) normal,
    ≤1000% elevated, above 1000% genuinely excessive."""
    if d_eq is None or d_eq < 0:      # negative D/E = negative equity, worst case
        return 0.0
    return 1.0 if d_eq <= 800 else (0.5 if d_eq <= 1000 else 0.0)


def _mreit_bvps_frac(g):
    """Book value per share trend (annualized %). The headline mREIT quality
    signal: >0% is preserving/growing book value; a mild ≥−5%/yr slide is the
    common norm; steeper erosion is capital destruction."""
    if g is None:
        return 0.0
    return 1.0 if g > 0 else (0.5 if g >= -5 else 0.0)


def _mreit_payout_txt(payout):
    return _pct(payout * 100, 0) if payout is not None else "—"


def _mreit_compounder(row, neg_eq):
    """Strategy 2 for mortgage REITs. They aren't operating compounders, so the
    question becomes: does it *preserve book value while paying a sustainable
    distribution?* Book-value preservation and dividend coverage dominate; a
    mREIT can only reach the Compounder band by genuinely holding book value
    and covering its payout — which is rare, and correct."""
    payout, pb = row.get("payout_ratio"), row.get("pb")
    bvps_g, dy, yrs = row.get("bvps_growth"), row.get("div_yield"), row.get("years_div_increase")
    P = []
    a = _mreit_bvps_frac(bvps_g) * 35                    # book value preservation
    P.append(_pill("Book value preservation", a, 35, f"BVPS {_r(bvps_g, 1, '%/yr')}"))
    b = _mreit_coverage_frac(payout) * 30                # dividend sustainability
    P.append(_pill("Dividend sustainability", b, 30,
                   f"payout {_mreit_payout_txt(payout)} (div ÷ earnings)"))
    c = 0.0                                              # distribution record (20)
    if dy is not None and dy > 0:
        c += 10 if dy >= 8 else 5
    if yrs is not None:
        c += 10 if yrs >= 5 else (5 if yrs >= 2 else 0)
    P.append(_pill("Distribution record", c, 20, f"yield {_pct(dy, 1)}, {_r(yrs, 0)} yrs ↑"))
    d = 0.0 if (neg_eq or pb is None or pb <= 0) else (  # valuation sanity (15)
        15 if pb <= 1.0 else (7.5 if pb <= 1.2 else 0))
    P.append(_pill("Valuation sanity", d, 15,
                   f"P/B {_r(pb, 2)}" + (" · neg equity → 0" if neg_eq else "")))
    score = _round_score(a + b + c + d)
    verdict = "Compounder" if score >= 70 else ("Quality watch" if score >= 50 else "Pass")
    return score, verdict, P


def _mreit_defensive(row, neg_eq):
    """Strategy 3 for mortgage REITs: a discount to book, backed by a covered
    dividend, non-eroding book value and non-excessive leverage, is genuine
    defensive value — and the discount is weighted most heavily."""
    payout, pb = row.get("payout_ratio"), row.get("pb")
    d_eq, bvps_g = row.get("debt_to_equity"), row.get("bvps_growth")
    P = []
    if neg_eq or pb is None or pb <= 0:                  # discount to book (35)
        a = 0.0
    elif pb < 0.80:
        a = 35.0
    elif pb <= 0.95:
        a = 22.0
    elif pb <= 1.10:
        a = 11.0
    else:
        a = 0.0
    P.append(_pill("Discount to book", a, 35,
                   f"P/B {_r(pb, 2)}" + (" · neg equity → 0" if neg_eq else "")))
    b = _mreit_coverage_frac(payout) * 25                # dividend coverage
    P.append(_pill("Dividend coverage", b, 25,
                   f"payout {_mreit_payout_txt(payout)} (div ÷ earnings)"))
    c = _mreit_bvps_frac(bvps_g) * 20                    # book value trend
    P.append(_pill("Book value trend", c, 20, f"BVPS {_r(bvps_g, 1, '%/yr')}"))
    d = 0.0 if neg_eq else _mreit_leverage_frac(d_eq) * 20   # leverage
    P.append(_pill("Leverage (mREIT)", d, 20,
                   f"D/E {_pct(d_eq)}" + (" · neg equity → 0" if neg_eq else "")
                   + " (agency bands ≤800% / ≤1000%)"))
    score = _round_score(a + b + c + d)
    verdict = "Value candidate" if score >= 70 else ("Fair" if score >= 50 else "Expensive/weak")
    return score, verdict, P


# --------------------------------------------------------------------------- #
# Strategy 1 — Triage                                                          #
# --------------------------------------------------------------------------- #
def grade_triage(row):
    """(score 0-100 or None, verdict). See _grade_triage for the full result."""
    s, v, _ = _grade_triage(row)
    return s, v


def _grade_triage(row):
    """(score, verdict, pillars). Implements stock-triage-strategy.md:
    Stage 0 quarantine -> (None, 'Quarantine…', []); Stage 1 kill-switch ->
    (0, 'Discard · …', pillars) — the score is forced to 0 but the Stage 2
    breakdown is still computed and returned, capped by a 'Disqualified'
    adjustment row, so the tooltip can show the underlying values; otherwise the
    Stage 2 quality score, its band, and the per-pillar breakdown. `pillars` is
    empty only on quarantine, where critical data is missing and nothing can be
    computed — the verdict string names the reason there."""
    bt = _business_type(row)
    fin = bt == "financial"
    reit = bt == "reit"
    mreit = bt == "mreit"
    debt = _effective_debt(row)
    neg_eq = _neg_equity(row)

    # ---- Stage 0: data hygiene ------------------------------------------- #
    critical = {"income": row.get("income"), "fcf": row.get("fcf"),
                "total_debt": debt, "total_equity": row.get("total_equity")}
    missing = [k for k, v in critical.items() if v is None]
    if missing:
        return None, "Quarantine — missing " + ", ".join(missing), []
    metric_keys = [k for k in row if k not in _NON_METRIC_KEYS]
    if metric_keys:
        empty = sum(1 for k in metric_keys if row.get(k) is None)
        if empty / len(metric_keys) > 0.40:
            return None, "Quarantine — row >40% empty", []

    # ---- Stage 1: hard disqualifiers -------------------------------------- #
    ni, fcf = row.get("income"), row.get("fcf")
    z, f = row.get("altman_z"), row.get("piotroski_f")
    de_ratio = row.get("debt_ebitda")
    cr, qr = row.get("current_ratio"), row.get("quick_ratio")
    roic = row.get("roic")                                   # pct points
    opm = row.get("operating_margin")                        # fraction
    kills = []
    # Altman-Z is the 1968 manufacturer model, so it only disqualifies the
    # asset-heavy businesses it was calibrated on. Asset-light, cyclical and
    # utility names instead get a non-disqualifying "low Altman-Z" context flag
    # (see TRIAGE_FLAGS 'low_altman'); REITs and financials ignore it entirely.
    # Utilities are exempt even though they grade capital_intensive: Altman
    # excluded them from his sample, and a healthy regulated utility's Z sits
    # below 1.8 as a matter of course (see _is_utility).
    util = _is_utility(row)
    if bt == "capital_intensive" and not util and z is not None and z < 1.8:
        kills.append("Altman Z distress")
    # Two of the 9 Piotroski tests (leverage decreasing, current-ratio
    # improving) are structurally biased against financials and REITs: a
    # bank's balance sheet isn't scored on "current assets/liabilities" the way
    # an industrial's is, and both financials and REITs run intentionally high,
    # stable leverage that the "leverage decreasing" test would punish as
    # deterioration. A low score there is a soft caution (see TRIAGE_FLAGS
    # 'low_piotroski'), not the kill it is for the other archetypes.
    if bt not in ("financial", "reit", "mreit") and f is not None and f <= 3:
        kills.append("Piotroski ≤ 3")
    if ni is not None and fcf is not None and ni < 0 and fcf < 0:
        kills.append("twin-negative NI+FCF")
    # Leverage / liquidity switches are business-agnostic, but REITs (equity and
    # mortgage) are structurally debt-funded and run thin current ratios by
    # design, so they are exempt; financials have their own rubric.
    levered_rubric = bt not in ("financial", "reit", "mreit")
    # Regulated utilities run 4.5–5.5× in the normal course, so the generic 6×
    # line would kill a healthy utility after one ordinary capex year; their
    # kill fires at 7× instead (see _is_utility).
    de_kill_at = 7 if util else 6
    if levered_rubric and de_ratio is not None and de_ratio > de_kill_at:
        kills.append(f"Debt/EBITDA > {de_kill_at}")
    # Companion to the Debt/EBITDA kill: when EBITDA is negative the ratio is
    # undefined (screener stores None), which would let a heavily indebted
    # company with negative EBITDA slip past the leverage switch entirely.
    # Net debt (debt beyond cash on hand) plus negative EBITDA is strictly
    # worse than any ratio above 6.
    ebitda = row.get("ebitda")
    if levered_rubric and ebitda is not None and ebitda <= 0 \
            and (debt or 0) > (row.get("total_cash") or 0):
        kills.append("negative EBITDA with net debt")
    if levered_rubric and cr is not None and qr is not None and cr < 1.0 and qr < 0.5:
        kills.append("liquidity crunch")
    # Value destruction (negative return on capital AND negative operating
    # margin) genuinely disqualifies an established business, but a cyclical at
    # a cycle trough is not broken, and ROIC understates a REIT's property
    # returns — so it fires only for capital-intensive and asset-light names.
    if bt in ("capital_intensive", "asset_light") \
            and roic is not None and opm is not None and roic < 0 and opm < 0:
        kills.append("value destruction")
    # A Stage 1 kill forces the score to 0, but we still compute the Stage 2
    # breakdown below so the tooltip shows the underlying metric values (like a
    # disqualified athlete's splits). The disqualification is applied as a
    # visible adjustment row at the end, mirroring strategies 2/3, which cap
    # rather than short-circuit. Data is present here (Stage 0 passed), so the
    # breakdown is always computable — unlike a quarantine.
    kill_reason = "; ".join(kills) if kills else None

    # ---- Stage 2: quality score ------------------------------------------- #
    P = []
    roe_pct = None if row.get("roe") is None else row["roe"] * 100
    gm = None if row.get("gross_margin") is None else row["gross_margin"] * 100
    if fin:
        # Financials: ROE / net margin / Piotroski only (sector adjustment).
        nm_pct = None if row.get("profit_margin") is None else row["profit_margin"] * 100
        roe_p = 0.0 if neg_eq else _band(roe_pct, 15, 8, 40)
        nm_p = _band(nm_pct, 15, 5, 30)
        f_p = _band(f, 6.5, 3.5, 30)                # ≥7 full, 4–6 half
        P.append(_pill("ROE", roe_p, 40,
                       f"ROE {_pct(roe_pct)}" + (" · neg equity → 0" if neg_eq else "")))
        P.append(_pill("Net margin", nm_p, 30, f"net margin {_pct(nm_pct)}"))
        P.append(_pill("Piotroski", f_p, 30, f"F-score {_r(f, 0)}"))
        score = roe_p + nm_p + f_p
    elif reit:
        # REITs: no FFO/AFFO from yfinance, so this is an approximation built on
        # the REIT-relevant fields we do have — cash generation, distribution
        # quality, leverage judged in a REIT-appropriate range, and valuation.
        # ROIC/WACC, Altman-Z and Debt/EBITDA are omitted as structurally
        # inapplicable to a property business.
        # FFO (Net Income + D&A − property-sale gains + impairments) is the
        # REIT-standard cash-generation measure — used where available (needs a
        # D&A line from the cash flow statement); falls back to the GAAP-FCF
        # proxy otherwise, since GAAP FCF understates a REIT's true distributable
        # cash (capex isn't split into maintenance vs. growth). It approximates
        # NAREIT FFO without matching it exactly (see app.py) — so treat REIT
        # grades as directional, not precise.
        ffo = row.get("ffo")
        has_ffo = ffo is not None
        cov = row.get("ffo_coverage") if has_ffo else row.get("fcf_coverage")
        payout = row.get("ffo_payout")
        cash_basis = "FFO" if has_ffo else "FCF"
        cash_val = ffo if has_ffo else fcf
        d_eq = row.get("debt_to_equity")            # pct points
        # Pillar A — cash generation (30)
        a = (12 if (cash_val is not None and cash_val > 0) else 0)
        a += 10 if _gt(cov, 1.0) else (5 if _gt(cov, 0.7) else 0)
        a += _band(f, 6.5, 3.5, 8)
        P.append(_pill("Cash generation", a, 30,
                       f"{cash_basis} {'+' if (cash_val or 0) > 0 else '−'}, "
                       f"{cash_basis} cover {_r(cov, 2, '×')}, F-score {_r(f, 0)}"))
        # Pillar B — distribution (25). REITs must pay out ~90% of taxable
        # income by law, so ≤80% of FFO is a comfortable cushion, ≤100% is the
        # sustainable norm, and above 100% means paying out more than the
        # business generates — a real red flag, not merely "high payout."
        b = 0.0
        dy = row.get("div_yield")                   # pct points
        if dy is not None and dy > 0:
            b += 10 if dy >= 4 else 5
        yrs = row.get("years_div_increase")
        if yrs is not None:
            b += 8 if yrs >= 10 else (4 if yrs >= 3 else 0)
        if has_ffo and payout is not None:
            b += 7 if payout <= 0.80 else (3.5 if payout <= 1.00 else 0)
            payout_txt = f"FFO payout {_pct(payout * 100, 0)}"
        elif cov is not None:
            b += 7 if cov >= 1.0 else (3.5 if cov >= 0.8 else 0)
            payout_txt = f"FCF cover {_r(cov, 2, '×')}"
        else:
            payout_txt = "payout —"
        P.append(_pill("Distribution", b, 25,
                       f"yield {_pct(dy, 1)}, {_r(yrs, 0)} yrs ↑, {payout_txt}"))
        # Pillar C — leverage in REIT context (20). REIT D/E runs high by design;
        # ≤100% is conservative, ≤200% typical, above that is aggressive.
        if neg_eq:
            c = 0.0
        elif d_eq is None:
            c = 6.0
        else:
            c = 20 if d_eq <= 100 else (10 if d_eq <= 200 else 0)
        P.append(_pill("Leverage (REIT)", c, 20,
                       f"D/E {('neg equity → 0' if neg_eq else _pct(d_eq))} "
                       f"(REIT bands ≤100% / ≤200%)"))
        # Pillar D — valuation (25). P/FFO is the REIT-standard multiple (mirrors
        # P/E) where FFO is available; P/B backs it up as an asset-backing check.
        # Falls back to lenient P/FCF when FFO is missing.
        d = 0.0
        p_ffo = row.get("p_ffo")
        pb = row.get("pb")
        if has_ffo and p_ffo is not None and p_ffo > 0:
            d += 15 if p_ffo < 12 else (7 if p_ffo <= 18 else 0)
            val_txt = f"P/FFO {_r(p_ffo, 1)}"
        else:
            p_fcf = row.get("p_fcf")
            if p_fcf is not None and p_fcf > 0:
                d += 15 if p_fcf < 15 else (7 if p_fcf <= 25 else 0)
            val_txt = f"P/FCF {_r(row.get('p_fcf'), 1)} (no FFO data)"
        if pb is not None and pb > 0:
            d += 10 if pb < 1.5 else (5 if pb <= 2.5 else 0)
        P.append(_pill("Valuation", d, 25, f"{val_txt}, P/B {_r(pb, 2)}"))
        score = a + b + c + d
    elif mreit:
        # Mortgage REITs: leveraged securities portfolios in a REIT wrapper —
        # not property owners (no FFO) and not operating banks (net margin is an
        # income-statement artifact for them). Graded on the four things that
        # actually determine a mREIT's safety: is the dividend covered by
        # earnings (or funded out of book value?), where is the price vs book,
        # how much leverage backs it, and — the headline quality signal — is
        # book value per share holding or eroding? See REITs.md / triage doc.
        payout = row.get("payout_ratio")            # fraction, dividends ÷ earnings
        pb = row.get("pb")
        d_eq = row.get("debt_to_equity")            # pct points
        bvps_g = row.get("bvps_growth")             # annualized %
        a = _mreit_coverage_frac(payout) * 35
        b = 0.0 if neg_eq else _mreit_pb_frac(pb) * 25
        c = 0.0 if neg_eq else _mreit_leverage_frac(d_eq) * 20
        e = _mreit_bvps_frac(bvps_g) * 20
        payout_txt = _pct(payout * 100, 0) if payout is not None else "—"
        P.append(_pill("Dividend coverage", a, 35, f"payout {payout_txt} (div ÷ earnings)"))
        P.append(_pill("Price vs book", b, 25,
                       f"P/B {_r(pb, 2)}" + (" · neg equity → 0" if neg_eq else "")))
        P.append(_pill("Leverage (mREIT)", c, 20,
                       f"D/E {_pct(d_eq)}" + (" · neg equity → 0" if neg_eq else "")
                       + " (agency bands ≤800% / ≤1000%)"))
        P.append(_pill("Book value trend", e, 20, f"BVPS {_r(bvps_g, 1, '%/yr')}"))
        score = a + b + c + e
    else:
        wacc = row.get("wacc")
        spread = (roic - wacc) if (roic is not None and wacc is not None) else None
        d_eq = row.get("debt_to_equity")            # pct points
        roe_pts = _band(roe_pct, 15, 8, 10)
        if neg_eq:                                  # ROE on negative equity is noise
            roe_pts = 0.0
        elif d_eq is not None and d_eq > 150:       # leverage artifact: cap at half
            roe_pts = min(roe_pts, 5)
        # Pillar A — value creation (30)
        if bt == "asset_light":
            # ROIC is inflated for asset-light firms (invested capital omits the
            # intangible/human capital base) and CAPM WACC is noisy for their
            # high betas, so the economic spread is de-weighted (max 10) and the
            # freed points go to a gross-margin / positive-FCF quality signal
            # that better reflects these businesses.
            spread_p = 0.0
            if spread is not None:
                spread_p = 10 if spread > 3 else (5 if spread >= -2 else 0)
            ql = _band(gm, 60, 40, 6) + (4 if (fcf is not None and fcf > 0) else 0)
            a = spread_p + ql + roe_pts
            P.append(_pill("Value creation", a, 30,
                           f"ROIC−WACC {_r(spread, 1, ' pts')} (+{spread_p:g}, de-weighted); "
                           f"gross/FCF (+{ql:g}); ROE {_pct(roe_pct)} (+{roe_pts:g})"
                           + (" · neg equity" if neg_eq else "")))
        else:
            spread_p = 0.0
            if spread is not None:
                spread_p = 20 if spread > 3 else (10 if spread >= -2 else 0)
            a = spread_p + roe_pts
            P.append(_pill("Value creation", a, 30,
                           f"ROIC−WACC {_r(spread, 1, ' pts')} (+{spread_p:g}); "
                           f"ROE {_pct(roe_pct)} (+{roe_pts:g})"
                           + (" · neg equity" if neg_eq else "")))
        # Pillar B — profitability (25). Thin-margin escape hatch: high-turnover
        # models (grocers, distributors) fail absolute margin bands however good
        # they are, so strong returns on capital floor the pillar at half — see
        # _strong_returns.
        nm = None if row.get("profit_margin") is None else row["profit_margin"] * 100
        om = None if opm is None else opm * 100
        b = _band(nm, 15, 5, 10) + _band(om, 20, 8, 10) + _band(gm, 40, 25, 5)
        b_note = ""
        if b < 12.5 and _strong_returns(row, neg_eq):
            b, b_note = 12.5, " · thin margins, strong returns → floored at half"
        P.append(_pill("Profitability", b, 25,
                       f"net {_pct(nm)}, op {_pct(om)}, gross {_pct(gm)}" + b_note))
        # Pillar C — balance sheet (25)
        debt_free = debt == 0
        c = float(10) if (debt_free and de_ratio is None) else _band(de_ratio, 1.5, 3.0, 10, reverse=True)
        c += 0.0 if neg_eq else (8 if debt_free else _band(d_eq, 50, 100, 8, reverse=True))
        if cr is not None:
            c += 7 if 1.5 <= cr <= 4.0 else (3.5 if (1.0 <= cr < 1.5 or cr > 4.0) else 0)
        de_txt = (_r(de_ratio, 1, "×") if de_ratio is not None
                  else ("0 (debt-free)" if debt_free else "—"))
        deq_txt = ("neg equity → 0" if neg_eq else _pct(d_eq))
        P.append(_pill("Balance sheet", c, 25,
                       f"Debt/EBITDA {de_txt}, D/E {deq_txt}, CR {_r(cr, 1)}"))
        # Pillar D — cash conversion (20)
        d = 0.0
        fcf_ni = "—"
        if ni is not None and ni > 0 and fcf is not None:
            r = fcf / ni
            d += 12 if 0.8 <= r <= 1.5 else (6 if (0.5 <= r < 0.8 or r > 1.5) else 0)
            fcf_ni = _r(r, 2, "×")
        ef = row.get("ebitda_fcf")
        if ef is not None:
            d += 8 if 1.0 <= ef <= 2.5 else (4 if 2.5 < ef <= 4.0 else 0)
        P.append(_pill("Cash conversion", d, 20,
                       f"FCF/NI {fcf_ni}, EBITDA/FCF {_r(ef, 2, '×')}"))
        raw = a + b + c + d
        score = raw
        # Secondary gate: a genuinely negative ROIC-WACC spread means the
        # business destroys value on its invested capital, however strong the
        # other pillars look — cap below the Advance band regardless. For
        # capital-intensive names any negative spread caps; for cyclical and
        # asset-light names only a deeply negative spread does, since a cycle
        # trough or a noisy high-beta CAPM WACC shouldn't disqualify on its own.
        cap_at = 0 if bt == "capital_intensive" else -5
        if spread is not None and spread < cap_at:
            score = min(raw, 55)
            if score != raw:
                P.append(_pill("Neg-spread cap", score - raw, 0,
                               f"ROIC below WACC (spread {spread:.1f}) → capped at 55"))

    # Stage 1 disqualification: keep the breakdown, zero the score with a
    # signed adjustment row so the pillars still re-sum to the reported score.
    if kill_reason:
        if score:
            P.append(_pill("Disqualified", -score, 0,
                           "kill-switch: " + kill_reason + " → score forced to 0"))
        return 0, "Discard · " + kill_reason, P

    score = _round_score(score)
    verdict = "Advance" if score >= 65 else ("Watchlist" if score >= 45 else "Discard")
    # Growth-phase routing (triage doc, lifecycle adjustments): a 40-44 scorer
    # whose weakness is margins-while-investing — evidenced by a strong gross
    # margin and positive FCF — goes to the Watchlist for a quarterly re-look
    # instead of the bin. (45-55 already lands on the Watchlist by score.)
    # Operating companies only — the concept doesn't apply to financials or
    # REITs (whose "gross margin" isn't a growth-investment signal).
    if (bt in ("capital_intensive", "asset_light", "cyclical")
            and 40 <= score < 45 and gm is not None and gm > 60
            and fcf is not None and fcf > 0):
        verdict = "Watchlist"
    return score, verdict, P


# Tiny null-tolerant comparison helpers for the flag predicates below — a
# missing value never fires a flag.
def _gt(v, t):
    return v is not None and v > t


def _lt(v, t):
    return v is not None and v < t


def _between(v, lo, hi):
    return v is not None and lo < v < hi


def _divergent(pe, fpe):
    """Forward P/E sitting below half of trailing P/E (both positive)."""
    return pe is not None and pe > 0 and fpe is not None and 0 < fpe < 0.5 * pe


def _payout_stress(row):
    """Is the dividend straining what the business earns? Judged on the payout
    measure that means something for the business type — the same one the graders
    score on, so a name can't be flagged and praised for the same dividend.

    An equity REIT's earnings payout is structurally enormous (depreciation
    crushes the denominator) and its GAAP FCF understates distributable cash, so
    on the generic test every healthy REIT fires and the flag says nothing. FFO is
    the honest denominator: >90% clears the graders' comfortable band and nears
    the 100% line where the distribution exceeds what the portfolio produces.
    Mortgage REITs hold securities, not buildings — no depreciation, so earnings
    are the right denominator, but they distribute ~all of them by design and only
    a payout above 100% means the dividend is eating book value.

    The FCF leg is dropped for both balance-sheet archetypes. GAAP free cash flow
    is an artifact for a business whose lending *is* its operations: a bank's loan
    originations run through operating cash flow, so a year of book growth prints
    a deeply negative FCF (JPM: −$148B) that says nothing about dividend safety.
    It fired on JPM, WFC, C and GS — each paying a conservative ~26% of earnings —
    while sparing BAC, purely on which way the loan book moved that year."""
    bt = _business_type(row)
    if bt == "reit":
        if row.get("ffo_payout") is not None or row.get("ffo_coverage") is not None:
            # Reciprocals for positive FFO; coverage also catches negative FFO,
            # where payout is undefined.
            return _gt(row.get("ffo_payout"), 0.90) or _lt(row.get("ffo_coverage"), 1.0)
        return _lt(row.get("fcf_coverage"), 1.2)      # no FFO — same fallback the graders use
    if bt == "mreit":
        return _gt(row.get("payout_ratio"), 1.00)
    if bt == "financial":
        # 60% matches the band the financial grader's own capital-discipline
        # pillar rewards paying under.
        return _gt(row.get("payout_ratio"), 0.60)
    return _gt(row.get("payout_ratio"), 0.60) or _lt(row.get("fcf_coverage"), 1.2)


# --------------------------------------------------------------------------- #
# Triage flag catalogue — the single source of truth for the S1 context flags. #
# Each entry pairs the predicate that fires the flag with the metadata the UI   #
# legend shows (icon, name, numeric trigger, and *why it matters*), so the      #
# frontend legend is generated from the very definitions the grader runs and    #
# the two can never drift. `test(row, score)` returns True when the flag fires; #
# the order here is the order flags appear in the cell. Flags are context only  #
# — they describe the price you'd pay and data quality, never the grade — which #
# is why a top-rated and a bottom-rated stock can carry the same flag.          #
# --------------------------------------------------------------------------- #
TRIAGE_FLAGS = [
    {
        "id": "pb_artifact",
        "icon": "⚠",
        "name": "P/B > 40 — possible data artifact",
        "threshold": "",
        "why": "A price-to-book this extreme usually means a tiny or negative "
               "book value (often a reporting glitch), so treat any book-based "
               "metric for this name with suspicion.",
        "test": lambda r, s: _gt(r.get("pb"), 40),
    },
    {
        "id": "evebitda_artifact",
        "icon": "⚠",
        "name": "EV/EBITDA > 150 — possible data artifact",
        "threshold": "",
        "why": "EBITDA near zero makes this ratio explode; the figure is likely "
               "noise rather than a real valuation signal.",
        "test": lambda r, s: _gt(r.get("ev_ebitda"), 150),
    },
    {
        "id": "neg_ev",
        "icon": "⚠",
        "name": "negative EV — check cash/debt data",
        "threshold": "",
        "why": "A negative enterprise value implies reported cash exceeds market "
               "cap plus debt — almost always stale or missing balance-sheet data.",
        "test": lambda r, s: _lt(r.get("enterprise_value"), 0),
    },
    {
        "id": "priced_for_perfection",
        "icon": "🔺",
        "name": "Priced for perfection",
        "threshold": "PEG > 3, P/FCF > 40, or EV/EBITDA > 30",
        "why": "The price already bakes in years of flawless growth: little upside "
               "left if all goes well, and steep downside on any stumble. Fires on "
               "the valuation alone, however strong the business scores.",
        "test": lambda r, s: (_gt(r.get("peg"), 3) or _gt(r.get("p_fcf"), 40)
                              or _gt(r.get("ev_ebitda"), 30)),
    },
    {
        "id": "suspiciously_cheap",
        "icon": "🔻",
        "name": "Suspiciously cheap",
        "threshold": "P/E < 8 or EV/EBITDA < 5, on a grade ≤ 60",
        "why": "A rock-bottom multiple on a weak quality grade usually flags a "
               "value trap or broken thesis, not a bargain — find out why the "
               "market gave up before buying in.",
        "test": lambda r, s: s <= 60 and (_between(r.get("pe"), 0, 8)
                                         or _between(r.get("ev_ebitda"), 0, 5)),
    },
    {
        "id": "low_altman",
        "icon": "⚠",
        "name": "Low Altman-Z (non-manufacturer)",
        "threshold": "Altman-Z < 1.8 for an asset-light, cyclical or utility "
                     "business",
        "why": "The Altman Z-score is calibrated on manufacturers, so a low "
               "reading for an asset-light, commodity or utility business is a "
               "soft caution to check leverage and cash flow — not the "
               "automatic disqualifier it is for a capital-intensive name. "
               "(Altman excluded utilities from his sample; a healthy regulated "
               "utility's Z sits below 1.8 as a matter of course.)",
        "test": lambda r, s: ((_business_type(r) in ("asset_light", "cyclical")
                               or _is_utility(r))
                              and _lt(r.get("altman_z"), 1.8)),
    },
    {
        "id": "low_piotroski",
        "icon": "⚠",
        "name": "Low Piotroski F-Score (bank/REIT)",
        "threshold": "Piotroski F-Score ≤ 3 for a financial or REIT",
        "why": "Two of the Piotroski F-Score's 9 tests (falling leverage, "
               "rising current ratio) are structurally biased against banks "
               "and REITs, which run intentionally high, stable leverage and "
               "don't have an industrial-style current ratio — so a low score "
               "here is a soft caution, not the disqualifier it is elsewhere.",
        "test": lambda r, s: (_business_type(r) in ("financial", "reit", "mreit")
                              and r.get("piotroski_f") is not None
                              and r.get("piotroski_f") <= 3),
    },
    {
        "id": "divergent_multiples",
        "icon": "⚠",
        "name": "Divergent multiples",
        "threshold": "forward P/E below half of trailing P/E",
        "why": "Analysts expect earnings to jump sharply. That can be a genuine "
               "inflection — or optimistic estimates setting the stock up for a miss.",
        "test": lambda r, s: _divergent(r.get("pe"), r.get("forward_pe")),
    },
    {
        "id": "payout_stress",
        "icon": "💰",
        "name": "Payout stress",
        "threshold": "payout > 60% or FCF coverage < 1.2× · REIT: FFO payout > 90% "
                     "· mortgage REIT: payout > 100% · bank: payout > 60%",
        "why": "The dividend consumes most of what the business earns or isn't "
               "comfortably covered by free cash flow, raising the odds of a future "
               "cut. Measured against the payout the business type actually lives "
               "on: FFO for an equity REIT (whose earnings payout is meaningless "
               "under depreciation), earnings for a mortgage REIT (which has none, "
               "and distributes nearly all of them by design). Banks and mortgage "
               "REITs skip the free-cash-flow test entirely — lending runs through "
               "operating cash flow, so GAAP FCF tracks the loan book rather than "
               "the dividend's safety.",
        "test": lambda r, s: _payout_stress(r),
    },
    {
        "id": "crowded_short",
        "icon": "📉",
        "name": "Crowded short",
        "threshold": "short interest > 15% of float",
        "why": "An unusually large bet against the stock signals bearish "
               "conviction — though heavy shorting can also fuel a squeeze.",
        "test": lambda r, s: _gt(r.get("short_interest"), 0.15),
    },
    {
        "id": "high_beta",
        "icon": "🌀",
        "name": "High beta",
        "threshold": "beta > 1.7",
        "why": "The stock swings far more than the market — amplified gains and "
               "losses, and a rougher ride in downturns.",
        "test": lambda r, s: _gt(r.get("beta"), 1.7),
    },
]


def triage_flags(row, score):
    """Stage 0 sanity flags + Stage 3 valuation-context flags (triage doc).
    Informational only — never disqualifying. `score` is the Stage 2 result;
    a quarantined row (score None) gets no flags: it can't be read at all.
    Driven by TRIAGE_FLAGS so the emitted flags and the UI legend can never
    disagree."""
    if score is None:
        return []
    return [f"{f['icon']} {f['name']}"
            for f in TRIAGE_FLAGS if f["test"](row, score)]


def flag_legend():
    """UI-facing metadata for every S1 flag (predicates stripped) — served to
    the frontend so the legend is generated from the same catalogue the grader
    uses. See TRIAGE_FLAGS."""
    return [{k: f[k] for k in ("id", "icon", "name", "threshold", "why")}
            for f in TRIAGE_FLAGS]


# --------------------------------------------------------------------------- #
# Strategy 2 — Quality Compounder                                              #
# --------------------------------------------------------------------------- #
def grade_compounder(row):
    """(score 0-100, verdict). See _grade_compounder for the full result."""
    s, v, _ = _grade_compounder(row)
    return s, v


def _grade_compounder(row):
    """(score, verdict, pillars). See strategy-2-quality-compounder.md."""
    bt = _business_type(row)
    fin = bt == "financial"
    reit = bt == "reit"
    neg_eq = _neg_equity(row)
    if bt == "mreit":
        return _mreit_compounder(row, neg_eq)
    debt = _effective_debt(row)
    ni, fcf = row.get("income"), row.get("fcf")
    roe_pct = None if row.get("roe") is None else row["roe"] * 100
    om_pct = None if row.get("operating_margin") is None else row["operating_margin"] * 100
    gm_pct = None if row.get("gross_margin") is None else row["gross_margin"] * 100
    nm_pct = None if row.get("profit_margin") is None else row["profit_margin"] * 100
    de_ratio = row.get("debt_ebitda")
    d_eq = row.get("debt_to_equity")                # pct points
    P = []

    # Pillar A — returns on capital (30)
    if fin:
        a = 0.0 if neg_eq else _band(roe_pct, 15, 10, 30)
        P.append(_pill("Returns on capital", a, 30,
                       f"ROE {_pct(roe_pct)}" + (" · neg equity → 0" if neg_eq else "")))
    elif reit:
        # ROIC/ROCE are depreciation-understated for property, so returns are
        # measured on FFO over invested capital (debt + equity) — a REIT's real
        # cash yield on the capital deployed — plus a lighter ROE band.
        ffo = row.get("ffo")
        ic = (row.get("total_debt") or 0) + (row.get("total_equity") or 0)
        ffo_ric = (ffo / ic * 100) if (ffo is not None and ic > 0) else None
        roe_r = 0.0 if neg_eq else _band(roe_pct, 10, 6, 10)
        a = _band(ffo_ric, 7, 4, 20) + roe_r
        P.append(_pill("Returns on capital", a, 30,
                       f"FFO/IC {_pct(ffo_ric, 1)}, ROE {_pct(roe_pct)}"
                       + (" · neg equity" if neg_eq else "")))
    else:
        roe_pts = _band(roe_pct, 15, 10, 10)
        if neg_eq:                                  # ROE on negative equity is noise
            roe_pts = 0.0
        elif d_eq is not None and d_eq > 100:       # D/E > 1: leverage cap
            roe_pts = min(roe_pts, 5)
        a = _band(row.get("roic"), 15, 8, 12) + _band(row.get("roce"), 15, 8, 8) + roe_pts
        P.append(_pill("Returns on capital", a, 30,
                       f"ROIC {_pct(row.get('roic'))}, ROCE {_pct(row.get('roce'))}, "
                       f"ROE {_pct(roe_pct)} (+{roe_pts:g})"
                       + (" · neg equity" if neg_eq else "")))

    # Pillar B — margin moat (20)
    if fin:
        b = _band(nm_pct, 20, 10, 20)
        P.append(_pill("Margin moat", b, 20, f"net margin {_pct(nm_pct)}"))
    elif reit:
        # Gross margin isn't a meaningful line for a rental business; the moat
        # is portfolio quality, best proxied by operating (NOI-style) margin.
        b = _band(om_pct, 25, 15, 20)
        P.append(_pill("Margin moat", b, 20, f"op margin {_pct(om_pct)}"))
    else:
        # Thin-margin escape hatch, as in S1's profitability pillar: a moat can
        # be margin × turnover, not margin alone — strong returns on capital
        # floor the pillar at half (see _strong_returns).
        b = _band(om_pct, 15, 8, 12) + _band(gm_pct, 40, 25, 8)
        b_note = ""
        if b < 10 and _strong_returns(row, neg_eq):
            b, b_note = 10, " · thin margins, strong returns → floored at half"
        P.append(_pill("Margin moat", b, 20,
                       f"op margin {_pct(om_pct)}, gross {_pct(gm_pct)}" + b_note))

    # Pillar C — capital discipline (20)
    if fin:
        payout = row.get("payout_ratio")            # fraction
        c = (10 if (payout is not None and 0 <= payout < 0.6) else 0) \
            + _band(row.get("piotroski_f"), 6.5, 3.5, 10)
        pct_txt = "—" if payout is None else _pct(payout * 100)
        P.append(_pill("Capital discipline", c, 20,
                       f"payout {pct_txt}, F-score {_r(row.get('piotroski_f'), 0)}"))
    elif reit:
        # Debt/EBITDA runs high for REITs by design; judge leverage on REIT D/E
        # bands and discipline on whether the distribution stays inside FFO
        # (paying out more than FFO is the real red flag, not a high ratio).
        d_eq = row.get("debt_to_equity")            # pct points
        if neg_eq:
            lev = 0.0
        elif d_eq is None:
            lev = 6.0
        else:
            lev = 10 if d_eq <= 100 else (5 if d_eq <= 200 else 0)
        fp, cov = row.get("ffo_payout"), row.get("ffo_coverage")
        if fp is not None:
            disc = 10 if fp <= 0.90 else (5 if fp <= 1.0 else 0)
            disc_txt = f"FFO payout {_pct(fp * 100, 0)}"
        else:                                       # no FFO -> fall back to FCF cover
            disc = 10 if _gt(cov, 1.0) else (5 if _gt(cov, 0.8) else 0)
            disc_txt = f"FCF cover {_r(row.get('fcf_coverage'), 2, '×')}"
        c = lev + disc
        P.append(_pill("Capital discipline", c, 20,
                       f"D/E {('neg equity → 0' if neg_eq else _pct(d_eq))} "
                       f"(REIT bands), {disc_txt}"))
    else:
        debt_free = debt == 0
        c = float(10) if (debt_free and de_ratio is None) else _band(de_ratio, 1.5, 3.0, 10, reverse=True)
        fcf_ni = "—"
        if ni is not None and ni > 0 and fcf is not None and fcf > 0:
            r = fcf / ni
            c += 10 if r >= 0.8 else (5 if r >= 0.5 else 0)
            fcf_ni = _r(r, 2, "×")
        de_txt = (_r(de_ratio, 1, "×") if de_ratio is not None
                  else ("0 (debt-free)" if debt_free else "—"))
        P.append(_pill("Capital discipline", c, 20,
                       f"Debt/EBITDA {de_txt}, FCF/NI {fcf_ni}"))

    # Pillar D — compounding track record (20). Fundamental growth first: price
    # CAGR embeds valuation swings and momentum ("the stock went up" is not
    # "the business compounded"), so where the statement history is deep enough
    # to show a real trend (≥3 fiscal years — rps_growth is None below that),
    # the pillar scores revenue-per-share growth (per-share, so dilution can't
    # fake it and buybacks rightly count) with 5Y price CAGR as confirmation.
    # Shorter histories fall back to the price-only legs, so a name never
    # scores worse for having statements.
    cagr5 = _cagr_pct(row.get("perf_5y"), 5)
    cagr10 = _cagr_pct(row.get("perf_10y"), 10)
    rps_g = row.get("rps_growth")
    if rps_g is not None:
        d = _band(rps_g, 10, 5, 12) + _band(cagr5, 12, 6, 8)
        d_txt = f"RPS {_r(rps_g, 1, '%/yr')}, 5Y price {_pct(cagr5, 1)}/yr"
    else:
        d = _band(cagr5, 12, 6, 10) + _band(cagr10, 12, 6, 10)
        d_txt = (f"5Y CAGR {_pct(cagr5, 1)}/yr, 10Y {_pct(cagr10, 1)}/yr "
                 f"(no revenue/share history)")
    P.append(_pill("Track record", d, 20, d_txt))

    # Pillar E — valuation sanity (10)
    peg, p_fcf = row.get("peg"), row.get("p_fcf")
    if reit:
        # P/FFO is the REIT P/E; PEG and P/FCF are both earnings-distorted here.
        p_ffo = row.get("p_ffo")
        if p_ffo is not None and p_ffo > 0:
            e = 10 if p_ffo < 15 else (5 if p_ffo <= 22 else 0)
            e_txt = f"P/FFO {_r(p_ffo, 1)}"
        else:                                       # no FFO -> lenient P/FCF
            e = 10 if (p_fcf is not None and 0 < p_fcf < 20) else \
                (5 if (p_fcf is not None and 0 < p_fcf < 35) else 0)
            e_txt = f"P/FCF {_r(p_fcf, 1)} (no FFO data)"
        P.append(_pill("Valuation sanity", e, 10, e_txt))
    else:
        if (peg is not None and 0 < peg < 1.5) or (p_fcf is not None and 0 < p_fcf < 25):
            e = 10
        elif (peg is not None and 0 < peg < 2.5) or (p_fcf is not None and 0 < p_fcf < 40):
            e = 5
        else:
            e = 0
        P.append(_pill("Valuation sanity", e, 10,
                       f"PEG {_r(peg, 2)}, P/FCF {_r(p_fcf, 1)}"))

    score = a + b + c + d + e
    # Solvency guard: a compounder must survive. The Altman-Z leg fires only for
    # capital-intensive names (the manufacturers the score was built for) and
    # spares utilities, whose healthy Z sits below 1.8 by construction (see
    # _is_utility); the twin-negative-earnings leg is business-agnostic and
    # applies to all.
    z = row.get("altman_z")
    guard_reasons = []
    if (bt == "capital_intensive" and not _is_utility(row)
            and z is not None and z < 1.8):
        guard_reasons.append(f"Altman Z {_r(z, 2)} < 1.8")
    if ni is not None and fcf is not None and ni < 0 and fcf < 0:
        guard_reasons.append("negative NI and FCF")
    if guard_reasons:
        capped = min(score, 35)
        if capped != score:
            P.append(_pill("Solvency guard", capped - score, 0,
                           " · ".join(guard_reasons) + " → capped at 35"))
        score = capped

    score = _round_score(score)
    verdict = "Compounder" if score >= 70 else ("Quality watch" if score >= 50 else "Pass")
    return score, verdict, P


# --------------------------------------------------------------------------- #
# Strategy 3 — Defensive Value                                                 #
# --------------------------------------------------------------------------- #
def grade_defensive(row):
    """(score 0-100, verdict). See _grade_defensive for the full result."""
    s, v, _ = _grade_defensive(row)
    return s, v


def _grade_defensive(row):
    """(score, verdict, pillars). See strategy-3-defensive-value.md."""
    bt = _business_type(row)
    fin = bt == "financial"
    reit = bt == "reit"
    neg_eq = _neg_equity(row)
    if bt == "mreit":
        return _mreit_defensive(row, neg_eq)
    debt = _effective_debt(row)
    pe, pb = row.get("pe"), row.get("pb")
    P = []

    # Pillar A — earnings and cash yield (25)
    p_fcf = row.get("p_fcf")
    if reit:
        # P/E and EV/EBITDA are depreciation-distorted for property; the REIT
        # earnings yield is 1 / (P/FFO), so cheapness is judged on P/FFO.
        p_ffo = row.get("p_ffo")
        if p_ffo is not None and p_ffo > 0:
            a = 25 if p_ffo < 12 else (15 if p_ffo <= 16 else (8 if p_ffo <= 20 else 0))
            a_txt = f"P/FFO {_r(p_ffo, 1)}"
        else:                                       # no FFO -> lenient P/FCF
            a = 25 if (p_fcf is not None and 0 < p_fcf < 15) else \
                (12 if (p_fcf is not None and 0 < p_fcf <= 25) else 0)
            a_txt = f"P/FCF {_r(p_fcf, 1)} (no FFO data)"
        P.append(_pill("Earnings/cash yield", a, 25, a_txt))
    elif fin:
        # Balance-sheet financials: P/FCF and EV/EBITDA are artifacts here — a
        # bank's loan originations run through operating cash flow, so FCF
        # tracks the loan book, and there is no meaningful EBITDA line above
        # interest for a business whose raw material is interest. Cheapness is
        # P/E plus price-to-book read against the ROE that justifies it: a bank
        # below book *earning a real return* on that book is cheap; below book
        # because it earns nothing is a value trap, so the P/B leg requires
        # ROE ≥ 8% to pay at all.
        roe_pct = None if row.get("roe") is None else row["roe"] * 100
        a = 0.0
        if pe is not None and pe > 0:
            a += 15 if pe < 15 else (7.5 if pe <= 25 else 0)
        if not neg_eq and pb is not None and pb > 0 \
                and roe_pct is not None and roe_pct >= 8:
            a += 10 if pb < 1.0 else (5 if pb <= 1.5 else 0)
        P.append(_pill("Earnings/cash yield", a, 25,
                       f"P/E {_r(pe, 1)}, P/B {_r(pb, 2)} vs ROE {_pct(roe_pct)}"
                       + (" · neg equity" if neg_eq else "")))
    else:
        a = 0.0
        if pe is not None and pe > 0:
            a += 10 if pe < 15 else (5 if pe <= 25 else 0)
        if p_fcf is not None and p_fcf > 0:
            a += 10 if p_fcf < 15 else (5 if p_fcf <= 25 else 0)
        ev_eb = row.get("ev_ebitda")
        if ev_eb is not None and ev_eb > 0:
            a += 5 if ev_eb < 10 else (2.5 if ev_eb <= 14 else 0)
        P.append(_pill("Earnings/cash yield", a, 25,
                       f"P/E {_r(pe, 1)}, P/FCF {_r(p_fcf, 1)}, EV/EBITDA {_r(ev_eb, 1)}"))

    # Pillar B — asset backing (15)
    if reit:
        # Real estate has genuine book value, so P/B is meaningful (a rough NAV
        # proxy); the Graham P/E×P/B test uses the distorted P/E, so it's
        # dropped. Trading below book is a strong discount-to-assets signal.
        b = 0.0
        if pb is not None and pb > 0:
            b = 15 if pb < 1.0 else (10 if pb < 1.5 else (5 if pb <= 2.5 else 0))
        P.append(_pill("Asset backing", b, 15,
                       f"P/B {_r(pb, 2)} (below book = discount to assets)"))
    else:
        b = 0.0
        if pb is not None and pb > 0:
            b += 8 if pb < 1.5 else (4 if pb <= 3.0 else 0)
        graham = pe is not None and pb is not None and pe > 0 and pb > 0 and pe * pb <= 22.5
        if graham:
            b += 7
        graham_txt = ("—" if pe is None or pb is None else _r(pe * pb, 1))
        P.append(_pill("Asset backing", b, 15,
                       f"P/B {_r(pb, 2)}, Graham P/E×P/B {graham_txt}"
                       f" {'≤' if graham else '>'} 22.5"))

    # Pillar C — financial strength (25)
    if fin:
        roa_pct = None if row.get("roa") is None else row["roa"] * 100
        c = _band(roa_pct, 1.5, 0.8, 25)
        P.append(_pill("Financial strength", c, 25, f"ROA {_pct(roa_pct, 1)}"))
    elif reit:
        # REITs carry high leverage by design and Altman-Z / current ratio don't
        # apply, so strength is judged on REIT-appropriate D/E bands plus how
        # well the REIT's cash generation covers the (mandatory, high)
        # distribution.
        d_eq = row.get("debt_to_equity")            # pct points
        if neg_eq:
            c = 0.0
        elif d_eq is None:
            c = 6.0
        else:
            c = 12 if d_eq <= 100 else (6 if d_eq <= 200 else 0)
        # Coverage is judged on FFO where available, matching S1/S2 — GAAP FCF
        # understates a REIT's distributable cash (capex isn't split into
        # maintenance vs. growth), so a REIT in a development phase reads as
        # cash-negative while perfectly healthy. The FFO bands are tighter than
        # the FCF fallback's on purpose: FFO adds back all D&A and never
        # subtracts capex, so it runs structurally above FCF and is not AFFO —
        # the same coverage multiple represents less real cash.
        ffo = row.get("ffo")
        has_ffo = ffo is not None
        if has_ffo:
            cov = row.get("ffo_coverage")
            c += 8 if _gt(cov, 1.5) else (4 if _gt(cov, 1.2) else 0)
            c += 5 if ffo > 0 else 0
        else:
            cov = row.get("fcf_coverage")
            c += 8 if _gt(cov, 1.2) else (4 if _gt(cov, 0.8) else 0)
            c += 5 if (row.get("fcf") or 0) > 0 else 0
        P.append(_pill("Financial strength", c, 25,
                       f"D/E {('neg equity → 0' if neg_eq else _pct(d_eq))} "
                       f"(REIT bands), {'FFO' if has_ffo else 'FCF'} cover "
                       f"{_r(cov, 2, '×')}"))
    else:
        debt_free = debt == 0
        # Interest coverage (8) — can it pay the coupon out of operating
        # earnings? Nothing else in this pillar asks, and a missed coupon is
        # what actually ends a company; a high D/E on its own never did.
        ic = row.get("interest_coverage")
        c = 8.0 if debt_free else _band(ic, 8.0, 4.0, 8)
        ic_txt = "n/a (debt-free)" if debt_free else _r(ic, 1, "×")
        # FCF / net debt (7) — how fast could it repay out of the cash it
        # actually keeps? Replaces D/E: it nets off the cash pile, it stands on
        # cash rather than the book equity a bad decade writes down (and that
        # buybacks distort), and it is sign-safe where net-debt/FCF would not
        # be — negative FCF gives a negative ratio that fails every band rather
        # than flipping a cash-burner into looking unlevered.
        cash = row.get("total_cash") or 0
        fcf_v = row.get("fcf")
        if debt is None or (fcf_v is None and debt - cash > 0):
            nd, nd_txt = 0.0, "—"
        elif debt - cash <= 0:
            nd, nd_txt = 7.0, "net cash"
        else:
            ratio = fcf_v / (debt - cash)
            nd = 7.0 if ratio > 0.25 else (3.5 if ratio > 0.10 else 0.0)
            nd_txt = _r(ratio, 2, "×")
        c += nd
        # Near-term liquidity (5) — Graham's own test, kept but demoted: it
        # catches what a cash-flow ratio misses, though a high current ratio is
        # also bloated inventory, so it no longer anchors the pillar.
        #
        # Banded at 1.5/1.0, not Graham's 2.0/1.5. He calibrated on 1949
        # balance sheets carrying heavy inventory and receivables; a modern
        # large cap runs working capital lean, and the median across a 118-name
        # check is 1.10. On the old bands 80% of the universe scored zero here
        # — a leg the whole population fails is a flat tax, not a measurement,
        # and it read hardest against businesses whose model simply has no
        # inventory. These bands restore a spread (20% full / 37% half).
        cr = row.get("current_ratio")
        c += _band(cr, 1.5, 1.0, 5)
        # Altman Z' (5) — a validated composite, demoted to a cross-check
        # because this strategy already scores most of what goes into it:
        # working capital right here, profitability in Pillar D, and its X5 is
        # asset turnover, which is not a solvency measure at all. Z' rather than
        # Z so the pillar carries no price term (see app.altman_z_prime), and on
        # Z's own bands the reading would be wrong — Z' has its own (2.9/1.23).
        zp = row.get("altman_z_prime")
        if zp is not None:
            c += 5 if zp >= 2.9 else (2.5 if zp >= 1.23 else 0)
        P.append(_pill("Financial strength", c, 25,
                       f"int cover {ic_txt}, FCF/net debt {nd_txt}, "
                       f"CR {_r(cr, 1)}, Altman Z′ {_r(zp, 2)}"))

    # Pillar D — earnings quality (20)
    ni, fcf = row.get("income"), row.get("fcf")
    if reit:
        # Net income is depreciation-depressed (often near zero for a healthy
        # REIT) and Piotroski's tests are biased against REIT leverage, so
        # quality is measured on FFO: positive, well-covered, and paid out
        # within itself.
        ffo, cov, fp = row.get("ffo"), row.get("ffo_coverage"), row.get("ffo_payout")
        d = (8 if (ffo is not None and ffo > 0) else 0)
        d += 7 if _gt(cov, 1.0) else (3.5 if _gt(cov, 0.8) else 0)
        d += 5 if (fp is not None and fp <= 0.90) else (2.5 if (fp is not None and fp <= 1.0) else 0)
        P.append(_pill("Earnings quality", d, 20,
                       f"FFO {'+' if (ffo or 0) > 0 else '−'}, cover {_r(cov, 2, '×')}, "
                       f"payout {_pct(fp * 100, 0) if fp is not None else '—'}"))
    else:
        # Scored on consistency across the statement history, not the sign of
        # the latest year — see _positive_years.
        ni_p, ni_txt = _positive_years(row, "ni_positive_years", "ni_years", ni, 5)
        fcf_p, fcf_txt = _positive_years(row, "fcf_positive_years", "fcf_years", fcf, 5)
        d = ni_p + fcf_p + _band(row.get("piotroski_f"), 6.5, 3.5, 10)
        P.append(_pill("Earnings quality", d, 20,
                       f"NI {ni_txt}, FCF {fcf_txt}, "
                       f"F-score {_r(row.get('piotroski_f'), 0)}"))

    # Pillar E — dividend record (15)
    e = 0.0
    dy = row.get("div_yield")                       # pct points
    if dy is not None and dy > 0:
        e += 5 if dy >= 2 else 2.5
    yrs = row.get("years_div_increase")
    if yrs is not None:
        e += 5 if yrs >= 10 else (2.5 if yrs >= 3 else 0)
    if reit:
        # Sustainability judged on the FFO payout (earnings payout is distorted).
        fp, cov = row.get("ffo_payout"), row.get("ffo_coverage")
        if fp is not None:
            e += 5 if (fp <= 0.80 and _gt(cov, 1.0)) else (2.5 if fp <= 1.0 else 0)
    else:
        payout, cov = row.get("payout_ratio"), row.get("fcf_coverage")
        if payout is not None and cov is not None and payout > 0:
            if payout <= 0.60 and cov >= 1.5:
                e += 5
            elif payout <= 0.75 and cov >= 1.0:
                e += 2.5
    P.append(_pill("Dividend record", e, 15,
                   f"yield {_pct(dy, 1)}, {_r(yrs, 0)} yrs of increases"))

    score = _round_score(a + b + c + d + e)
    verdict = "Value candidate" if score >= 70 else ("Fair" if score >= 50 else "Expensive/weak")
    return score, verdict, P


# --------------------------------------------------------------------------- #
# Combined                                                                     #
# --------------------------------------------------------------------------- #
def grade_row(row):
    """All three strategy grades for a screener row, plus the min-of-all
    composite (sort by it to find names that hold up under every lens)."""
    s1, v1, p1 = _grade_triage(row)
    s2, v2, p2 = _grade_compounder(row)
    s3, v3, p3 = _grade_defensive(row)
    scores = (s1, s2, s3)
    return {
        "strategy_1": s1, "strategy_1_verdict": v1, "strategy_1_detail": p1,
        "strategy_1_flags": " · ".join(triage_flags(row, s1)),
        "strategy_2": s2, "strategy_2_verdict": v2, "strategy_2_detail": p2,
        "strategy_3": s3, "strategy_3_verdict": v3, "strategy_3_detail": p3,
        "strategy_min": min(scores) if all(s is not None for s in scores) else None,
    }
