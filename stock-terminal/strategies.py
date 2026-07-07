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
                     payout_ratio
  percentage points  roic, roce, wacc, div_yield, debt_to_equity, perf_*
  plain ratios       pe, pb, peg, p_fcf, ev_ebitda, debt_ebitda, current_ratio,
                     quick_ratio, fcf_coverage, ebitda_fcf
"""

import math

# Row keys that are not judgeable metrics, excluded from the Stage 0
# completeness check.
_NON_METRIC_KEYS = {
    "ticker", "name", "sector", "industry", "currency", "error",
    "spark_6mo", "spark_1y", "spark_5y", "ex_dividend_date",
    "strategy_1", "strategy_2", "strategy_3", "strategy_min",
    "strategy_1_verdict", "strategy_2_verdict", "strategy_3_verdict",
    "strategy_1_flags",
    "strategy_1_detail", "strategy_2_detail", "strategy_3_detail",
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


def _cagr_pct(total_return_pct, years):
    """Annualized % from a cumulative price return in percentage points."""
    if total_return_pct is None:
        return None
    base = 1.0 + total_return_pct / 100.0
    if base <= 0:
        return -100.0
    return (base ** (1.0 / years) - 1.0) * 100.0


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
    (0, 'Discard · …', []); otherwise the Stage 2 quality score, its band, and
    the per-pillar breakdown. `pillars` is empty on quarantine/kill — the
    verdict string already names the reason there."""
    fin = _is_financial(row)
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
    if not fin and z is not None and z < 1.8:
        kills.append("Altman Z distress")
    if f is not None and f <= 3:
        kills.append("Piotroski ≤ 3")
    if ni is not None and fcf is not None and ni < 0 and fcf < 0:
        kills.append("twin-negative NI+FCF")
    if not fin and de_ratio is not None and de_ratio > 6:
        kills.append("Debt/EBITDA > 6")
    # Companion to the Debt/EBITDA kill: when EBITDA is negative the ratio is
    # undefined (screener stores None), which would let a heavily indebted
    # company with negative EBITDA slip past the leverage switch entirely.
    # Net debt (debt beyond cash on hand) plus negative EBITDA is strictly
    # worse than any ratio above 6.
    ebitda = row.get("ebitda")
    if not fin and ebitda is not None and ebitda <= 0 \
            and (debt or 0) > (row.get("total_cash") or 0):
        kills.append("negative EBITDA with net debt")
    if not fin and cr is not None and qr is not None and cr < 1.0 and qr < 0.5:
        kills.append("liquidity crunch")
    if roic is not None and opm is not None and roic < 0 and opm < 0:
        kills.append("value destruction")
    if kills:
        return 0, "Discard · " + "; ".join(kills), []

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
    else:
        wacc = row.get("wacc")
        spread = (roic - wacc) if (roic is not None and wacc is not None) else None
        # Pillar A — value creation (30)
        spread_p = 0.0
        if spread is not None:
            spread_p = 20 if spread > 3 else (10 if spread >= -2 else 0)
        roe_pts = _band(roe_pct, 15, 8, 10)
        d_eq = row.get("debt_to_equity")            # pct points
        if neg_eq:                                  # ROE on negative equity is noise
            roe_pts = 0.0
        elif d_eq is not None and d_eq > 150:       # leverage artifact: cap at half
            roe_pts = min(roe_pts, 5)
        a = spread_p + roe_pts
        P.append(_pill("Value creation", a, 30,
                       f"ROIC−WACC {_r(spread, 1, ' pts')} (+{spread_p:g}); "
                       f"ROE {_pct(roe_pct)} (+{roe_pts:g})"
                       + (" · neg equity" if neg_eq else "")))
        # Pillar B — profitability (25)
        nm = None if row.get("profit_margin") is None else row["profit_margin"] * 100
        om = None if opm is None else opm * 100
        b = _band(nm, 15, 5, 10) + _band(om, 20, 8, 10) + _band(gm, 40, 25, 5)
        P.append(_pill("Profitability", b, 25,
                       f"net {_pct(nm)}, op {_pct(om)}, gross {_pct(gm)}"))
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
        # other pillars look — cap below the Advance band regardless. Gates
        # only on a negative spread (not merely thin) since WACC is a noisy
        # CAPM estimate and shouldn't decide borderline cases on its own.
        if spread is not None and spread < 0:
            score = min(raw, 55)
            if score != raw:
                P.append(_pill("Neg-spread cap", score - raw, 0,
                               "ROIC below WACC → capped at 55"))

    score = _round_score(score)
    verdict = "Advance" if score >= 65 else ("Watchlist" if score >= 45 else "Discard")
    # Growth-phase routing (triage doc, lifecycle adjustments): a 40-44 scorer
    # whose weakness is margins-while-investing — evidenced by a strong gross
    # margin and positive FCF — goes to the Watchlist for a quarterly re-look
    # instead of the bin. (45-55 already lands on the Watchlist by score.)
    if (not fin and 40 <= score < 45 and gm is not None and gm > 60
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
        "threshold": "P/E < 8 or EV/EBITDA < 5, on a grade < 60",
        "why": "A rock-bottom multiple on a weak quality grade usually flags a "
               "value trap or broken thesis, not a bargain — find out why the "
               "market gave up before buying in.",
        "test": lambda r, s: s < 60 and (_between(r.get("pe"), 0, 8)
                                         or _between(r.get("ev_ebitda"), 0, 5)),
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
        "threshold": "payout > 70% or FCF coverage < 1.5×",
        "why": "The dividend consumes most of earnings or isn't comfortably "
               "covered by free cash flow, raising the odds of a future cut.",
        "test": lambda r, s: (_gt(r.get("payout_ratio"), 0.70)
                              or _lt(r.get("fcf_coverage"), 1.5)),
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
    fin = _is_financial(row)
    debt = _effective_debt(row)
    neg_eq = _neg_equity(row)
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
    else:
        b = _band(om_pct, 15, 8, 12) + _band(gm_pct, 40, 25, 8)
        P.append(_pill("Margin moat", b, 20,
                       f"op margin {_pct(om_pct)}, gross {_pct(gm_pct)}"))

    # Pillar C — capital discipline (20)
    if fin:
        payout = row.get("payout_ratio")            # fraction
        c = (10 if (payout is not None and 0 <= payout < 0.6) else 0) \
            + _band(row.get("piotroski_f"), 6.5, 3.5, 10)
        pct_txt = "—" if payout is None else _pct(payout * 100)
        P.append(_pill("Capital discipline", c, 20,
                       f"payout {pct_txt}, F-score {_r(row.get('piotroski_f'), 0)}"))
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

    # Pillar D — compounding track record (20)
    cagr5 = _cagr_pct(row.get("perf_5y"), 5)
    cagr10 = _cagr_pct(row.get("perf_10y"), 10)
    d = _band(cagr5, 12, 6, 10) + _band(cagr10, 12, 6, 10)
    P.append(_pill("Track record", d, 20,
                   f"5Y CAGR {_pct(cagr5, 1)}/yr, 10Y {_pct(cagr10, 1)}/yr"))

    # Pillar E — valuation sanity (10)
    peg, p_fcf = row.get("peg"), row.get("p_fcf")
    if (peg is not None and 0 < peg < 1.5) or (p_fcf is not None and 0 < p_fcf < 25):
        e = 10
    elif (peg is not None and 0 < peg < 2.5) or (p_fcf is not None and 0 < p_fcf < 40):
        e = 5
    else:
        e = 0
    P.append(_pill("Valuation sanity", e, 10,
                   f"PEG {_r(peg, 2)}, P/FCF {_r(p_fcf, 1)}"))

    score = a + b + c + d + e
    # Solvency guard: a compounder must survive.
    z = row.get("altman_z")
    if (not fin and z is not None and z < 1.8) or \
       (ni is not None and fcf is not None and ni < 0 and fcf < 0):
        capped = min(score, 35)
        if capped != score:
            P.append(_pill("Solvency guard", capped - score, 0,
                           "distress / twin-negative earnings → capped at 35"))
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
    fin = _is_financial(row)
    debt = _effective_debt(row)
    neg_eq = _neg_equity(row)
    pe, pb = row.get("pe"), row.get("pb")
    P = []

    # Pillar A — earnings and cash yield (25)
    a = 0.0
    if pe is not None and pe > 0:
        a += 10 if pe < 15 else (5 if pe <= 25 else 0)
    p_fcf = row.get("p_fcf")
    if p_fcf is not None and p_fcf > 0:
        a += 10 if p_fcf < 15 else (5 if p_fcf <= 25 else 0)
    ev_eb = row.get("ev_ebitda")
    if ev_eb is not None and ev_eb > 0:
        a += 5 if ev_eb < 10 else (2.5 if ev_eb <= 14 else 0)
    P.append(_pill("Earnings/cash yield", a, 25,
                   f"P/E {_r(pe, 1)}, P/FCF {_r(p_fcf, 1)}, EV/EBITDA {_r(ev_eb, 1)}"))

    # Pillar B — asset backing (15)
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
    else:
        cr = row.get("current_ratio")
        c = _band(cr, 2.0, 1.5, 8)
        debt_free = debt == 0
        d_eq = row.get("debt_to_equity")            # pct points
        c += 0.0 if neg_eq else (9 if debt_free else _band(d_eq, 50, 100, 9, reverse=True))
        z = row.get("altman_z")
        if z is not None:
            c += 8 if z >= 3.0 else (4 if z >= 1.81 else 0)
        deq_txt = ("neg equity → 0" if neg_eq
                   else ("0 (debt-free)" if debt_free else _pct(d_eq)))
        P.append(_pill("Financial strength", c, 25,
                       f"CR {_r(cr, 1)}, D/E {deq_txt}, Altman Z {_r(z, 1)}"))

    # Pillar D — earnings quality (20)
    ni, fcf = row.get("income"), row.get("fcf")
    d = (5 if (ni is not None and ni > 0) else 0) \
        + (5 if (fcf is not None and fcf > 0) else 0) \
        + _band(row.get("piotroski_f"), 6.5, 3.5, 10)
    P.append(_pill("Earnings quality", d, 20,
                   f"NI {'+' if (ni or 0) > 0 else '−'}, FCF {'+' if (fcf or 0) > 0 else '−'}, "
                   f"F-score {_r(row.get('piotroski_f'), 0)}"))

    # Pillar E — dividend record (15)
    e = 0.0
    dy = row.get("div_yield")                       # pct points
    if dy is not None and dy > 0:
        e += 5 if dy >= 2 else 2.5
    yrs = row.get("years_div_increase")
    if yrs is not None:
        e += 5 if yrs >= 10 else (2.5 if yrs >= 3 else 0)
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
