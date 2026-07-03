#!/usr/bin/env python3
"""Stock Terminal — a self-contained stock analysis app powered by yfinance.

No web frameworks: just Python's stdlib http.server for a small JSON API plus
static file serving. Excel export uses openpyxl. All market data comes from
yfinance.

Run:
    python app.py            # serves on http://localhost:8765
    python app.py --port 9000
"""
import argparse
import datetime as _dt
import io
import json
import os
import sys
import threading
import time
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# Make the in-repo yfinance importable when run from the repo root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import yfinance as yf  # noqa: E402
import pandas as pd  # noqa: E402
from concurrent.futures import ThreadPoolExecutor  # noqa: E402

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    _HAS_OPENPYXL = True
except Exception:  # pragma: no cover
    _HAS_OPENPYXL = False

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# --------------------------------------------------------------------------- #
# Tiny TTL cache so we don't hammer Yahoo on every request                     #
# --------------------------------------------------------------------------- #
_CACHE = {}
_CACHE_LOCK = threading.Lock()


def cached(key, ttl, producer):
    now = time.time()
    with _CACHE_LOCK:
        hit = _CACHE.get(key)
        if hit and now - hit[0] < ttl:
            return hit[1]
    value = producer()  # produce outside the lock (network call)
    with _CACHE_LOCK:
        _CACHE[key] = (now, value)
    return value


def clear_cache():
    with _CACHE_LOCK:
        _CACHE.clear()


def clear_ticker_cache(tickers):
    """Evict every cached entry for the given tickers (all cache keys embed the
    ticker as a ':'-separated segment, e.g. info:AAPL, fin:AAPL:income:annual)."""
    tset = {t.upper() for t in tickers}
    with _CACHE_LOCK:
        for k in [k for k in _CACHE if tset & set(k.split(":"))]:
            del _CACHE[k]


def clear_prefix_cache(prefix):
    """Evict cached entries whose key starts with `prefix` (e.g. 'mktcal:')."""
    with _CACHE_LOCK:
        for k in [k for k in _CACHE if k.startswith(prefix)]:
            del _CACHE[k]


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #
def _num(v):
    """Coerce to a JSON-friendly float or None."""
    try:
        if v is None:
            return None
        f = float(v)
        if f != f or f in (float("inf"), float("-inf")):  # NaN / inf
            return None
        return f
    except (TypeError, ValueError):
        return None


def _epoch_to_iso(v):
    try:
        if not v:
            return None
        return _dt.datetime.fromtimestamp(int(v), _dt.timezone.utc).strftime("%Y-%m-%d")
    except (TypeError, ValueError, OSError):
        return None


def get_info(ticker):
    return cached(f"info:{ticker}", 300, lambda: yf.Ticker(ticker).info or {})


_ERP = 5.5  # Equity risk premium %, Damodaran US estimate

def get_risk_free_rate():
    """10-year US Treasury yield (%) from ^TNX, cached 1 hour."""
    def produce():
        try:
            info = yf.Ticker("^TNX").info
            return _num(info.get("regularMarketPrice") or info.get("previousClose"))
        except Exception:
            return None
    return cached("rfr:^TNX", 3600, produce)


def _compute_wacc(beta, market_cap, total_debt, interest_exp, tax_rate, rfr):
    """WACC in %. Cost of equity via CAPM; cost of debt from interest expense / total debt
    (falls back to rfr when interest expense is unavailable)."""
    if beta is None or market_cap is None or rfr is None:
        return None
    total_debt = total_debt or 0
    total_capital = market_cap + total_debt
    if total_capital <= 0:
        return None
    w_e = market_cap / total_capital
    w_d = total_debt / total_capital
    cost_of_equity = rfr + beta * _ERP
    if interest_exp and total_debt > 0:
        cost_of_debt = abs(interest_exp) / total_debt * 100
    else:
        cost_of_debt = rfr  # fallback: riskless floor when no interest data
    return w_e * cost_of_equity + w_d * cost_of_debt * (1 - tax_rate)


def _get_stmt(ticker, attr):
    def produce():
        try:
            return getattr(yf.Ticker(ticker), attr)
        except Exception:
            return None
    return cached(f"{attr}:{ticker}", 1800, produce)


def get_dividends(ticker):
    def produce():
        try:
            return yf.Ticker(ticker).dividends
        except Exception:
            return None
    return cached(f"divs:{ticker}", 1800, produce)


def get_raw_close(ticker):
    """Dividend-UNadjusted (but split-adjusted) close series for price-only
    performance. period=10y so we can cover the 10Y window."""
    def produce():
        try:
            df = yf.Ticker(ticker).history(period="10y", auto_adjust=False)
        except Exception:
            return None
        if df is None or df.empty or "Close" not in df:
            return None
        return df["Close"].dropna()
    return cached(f"rawclose:{ticker}", 1800, produce)


def _stmt_val(df, *labels, col=0):
    """Value of the first matching row at the `col`-th most-recent period."""
    if df is None or getattr(df, "empty", True):
        return None
    cols = sorted(df.columns, reverse=True)  # newest first
    if col >= len(cols):
        return None
    c = cols[col]
    for lab in labels:
        if lab in df.index:
            return _num(df.loc[lab, c])
    return None


def performance(ticker):
    """Price-only return (excludes dividends) over several windows, in %."""
    out = {"ytd": None, "1y": None, "3y": None, "5y": None, "10y": None}
    s = get_raw_close(ticker)
    if s is None or len(s) == 0:
        return out
    latest = float(s.iloc[-1])
    last_date = s.index[-1]
    span_years = (last_date - s.index[0]).days / 365.25

    def at_or_before(ts):
        sub = s[s.index <= ts]
        return float(sub.iloc[-1]) if len(sub) else None

    def pct(base):
        return ((latest / base) - 1.0) * 100.0 if base else None

    try:
        jan1 = pd.Timestamp(year=last_date.year, month=1, day=1, tz=s.index.tz)
        prev = s[s.index < jan1]
        out["ytd"] = _num(pct(float(prev.iloc[-1]) if len(prev) else None))
    except Exception:
        pass
    for label, yrs in (("1y", 1), ("3y", 3), ("5y", 5), ("10y", 10)):
        try:
            base = at_or_before(last_date - pd.DateOffset(years=yrs))
            if base is None and span_years >= yrs * 0.95:
                base = float(s.iloc[0])
            out[label] = _num(pct(base))
        except Exception:
            pass
    return out


def _downsample(vals, target=50):
    """Evenly pick ~`target` points (always including the first and last) so a
    5-year daily series compresses to a compact sparkline payload."""
    n = len(vals)
    if n <= target:
        return list(vals)
    idx = [int(k * (n - 1) / (target - 1)) for k in range(target)]
    return [vals[j] for j in idx]


def sparklines(ticker):
    """Downsampled close-price series for the 6mo / 1y / 5y screener mini-charts.
    Reuses the dividend-unadjusted close history already cached by get_raw_close
    (also used for the performance columns), so it adds no extra network calls."""
    s = get_raw_close(ticker)
    out = {"6mo": [], "1y": [], "5y": []}
    if s is None or len(s) == 0:
        return out
    last_date = s.index[-1]
    for key, off in (("6mo", pd.DateOffset(months=6)),
                     ("1y", pd.DateOffset(years=1)),
                     ("5y", pd.DateOffset(years=5))):
        try:
            sub = s[s.index >= (last_date - off)]
            vals = [round(float(v), 4) for v in sub.values if v == v]
            out[key] = _downsample(vals)
        except Exception:
            pass
    return out


def consecutive_div_increases(divs):
    """Number of consecutive completed years of rising annual dividends."""
    if divs is None or len(divs) == 0:
        return None
    annual = divs.groupby(divs.index.year).sum()
    annual = annual[annual.index < _dt.date.today().year]
    vals = list(annual.items())  # ascending by year
    if len(vals) < 2:
        return None
    count = 0
    for i in range(len(vals) - 1, 0, -1):
        if vals[i][1] > vals[i - 1][1] * 1.0001:
            count += 1
        else:
            break
    return count


def screener_row(ticker):
    """One row of comparison metrics. Missing values come back as None -> N/A.
    Any per-ticker failure (Yahoo rate limit, delisted symbol, parse error)
    becomes an error row, so one bad ticker can never 500 its whole batch."""
    try:
        return _screener_row(ticker)
    except Exception as e:
        return {"ticker": ticker, "error": str(e) or type(e).__name__}


def _screener_row(ticker):
    try:
        info = get_info(ticker)
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}

    if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None and not info.get("shortName"):
        return {"ticker": ticker, "error": "No data"}

    price = _num(info.get("currentPrice")) or _num(info.get("regularMarketPrice"))
    market_cap = _num(info.get("marketCap"))
    total_cash = _num(info.get("totalCash"))
    div_rate = _num(info.get("dividendRate"))            # forward annual estimate
    div_yield = (div_rate / price * 100) if (div_rate and price) else None

    # Heavier pulls (cached): statements, dividends, raw price history.
    inc = _get_stmt(ticker, "income_stmt")
    q_inc = _get_stmt(ticker, "quarterly_income_stmt")
    bal = _get_stmt(ticker, "balance_sheet")
    cf = _get_stmt(ticker, "cash_flow")
    divs = get_dividends(ticker)

    equity = _stmt_val(bal, "Stockholders Equity", "Total Stockholder Equity", "Common Stock Equity")
    lt_debt = _stmt_val(bal, "Long Term Debt", "Long Term Debt And Capital Lease Obligation")
    total_debt = _num(info.get("totalDebt")) or _stmt_val(bal, "Total Debt")
    total_assets = _stmt_val(bal, "Total Assets")
    current_liab = _stmt_val(bal, "Current Liabilities", "Total Current Liabilities")
    ebit = _stmt_val(inc, "EBIT", "Operating Income", "Operating Income Or Loss")
    pretax = _stmt_val(inc, "Pretax Income", "Income Before Tax")
    tax = _stmt_val(inc, "Tax Provision", "Income Tax Expense")
    net_income = _num(info.get("netIncomeToCommon")) or _stmt_val(inc, "Net Income", "Net Income Common Stockholders")
    fcf = _stmt_val(cf, "Free Cash Flow") or _num(info.get("freeCashflow"))
    div_paid = _stmt_val(cf, "Cash Dividends Paid", "Common Stock Dividend Paid", "Common Stock Dividends Paid")

    # Derived ratios -----------------------------------------------------
    p_c = (market_cap / total_cash) if (market_cap and total_cash) else None
    p_fcf = (market_cap / fcf) if (market_cap and fcf and fcf > 0) else None
    # Debt/Equity computed from the same Total Debt and Total Equity shown in the
    # row, so the three figures reconcile. Yahoo's own debtToEquity (most-recent
    # quarter) is surfaced separately as debt_to_equity_mrq.
    debt_eq = (total_debt / equity * 100) if (total_debt and equity and equity != 0) else None
    lt_debt_eq = (lt_debt / equity * 100) if (lt_debt and equity and equity != 0) else None
    fcf_coverage = (fcf / abs(div_paid)) if (fcf is not None and div_paid) else None
    ebitda = _num(info.get("ebitda"))
    debt_ebitda = (total_debt / ebitda) if (total_debt and ebitda and ebitda > 0) else None
    ebitda_fcf = (ebitda / fcf) if (ebitda and fcf) else None

    _q_basic = _series_from_stmt(q_inc, "Basic EPS")
    _q_basic_vals = [x["value"] for x in _q_basic[-4:] if x.get("value") is not None]
    basic_eps = sum(_q_basic_vals) if len(_q_basic_vals) == 4 else None

    tax_rate = 0.21
    if pretax and tax and pretax > 0:
        tax_rate = min(max(tax / pretax, 0.0), 0.5)

    roic = None
    if ebit and equity and total_debt is not None:
        invested = (total_debt or 0) + equity
        if invested:
            roic = ebit * (1 - tax_rate) / invested * 100

    roce = None  # EBIT / (total assets - current liabilities)
    if ebit and total_assets and current_liab is not None:
        capital_employed = total_assets - current_liab
        if capital_employed:
            roce = ebit / capital_employed * 100

    interest_exp = (_stmt_val(inc, "Interest Expense", "Interest Expense Non Operating") or
                    _stmt_val(inc, "Interest Expense", "Interest Expense Non Operating", col=1))
    wacc = _compute_wacc(_num(info.get("beta")), market_cap, total_debt,
                         interest_exp, tax_rate, get_risk_free_rate())

    dg = dividend_growth(ticker)
    perf = performance(ticker)
    spark = sparklines(ticker)

    return {
        "ticker": ticker,
        "name": info.get("shortName") or info.get("longName") or ticker,
        # mini price-chart series (dividend-unadjusted close), for the screener
        "spark_6mo": spark["6mo"],
        "spark_1y": spark["1y"],
        "spark_5y": spark["5y"],
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "currency": info.get("currency"),
        "price": price,
        "market_cap": market_cap,
        "enterprise_value": _num(info.get("enterpriseValue")),
        # valuation
        "pe": _num(info.get("trailingPE")),
        "forward_pe": _num(info.get("forwardPE")),
        "peg": _num(info.get("trailingPegRatio")) or _num(info.get("pegRatio")),
        "pb": _num(info.get("priceToBook")),
        "ps": _num(info.get("priceToSalesTrailing12Months")),
        "pc": _num(p_c),
        "p_fcf": _num(p_fcf),
        "ev_ebitda": _num(info.get("enterpriseToEbitda")),
        "eps": _num(info.get("trailingEps")),       # diluted EPS TTM
        "eps_basic": _num(basic_eps),               # basic EPS TTM
        # profitability / income
        "income": _num(net_income),
        "profit_margin": _num(info.get("profitMargins")),
        "gross_margin": _num(info.get("grossMargins")),
        "operating_margin": _num(info.get("operatingMargins")),
        "ebitda_margin": _num(info.get("ebitdaMargins")),
        "fcf": _num(fcf),
        "roa": _num(info.get("returnOnAssets")),
        "roe": _num(info.get("returnOnEquity")),
        "roic": _num(roic),
        "roce": _num(roce),
        "wacc": _num(wacc),
        "revenue_per_share": _num(info.get("revenuePerShare")),
        # financial health
        "debt_to_equity": _num(debt_eq),
        "debt_to_equity_mrq": _num(info.get("debtToEquity")),
        "debt_ebitda": _num(debt_ebitda),
        "lt_debt_to_equity": _num(lt_debt_eq),
        "current_ratio": _num(info.get("currentRatio")),
        "quick_ratio": _num(info.get("quickRatio")),
        "total_cash": _num(total_cash),
        "total_debt": _num(total_debt),
        "total_equity": _num(equity),
        "ebitda_fcf": _num(ebitda_fcf),
        # dividend
        "div_yield": _num(div_yield),
        "five_year_avg_yield": _num(info.get("fiveYearAvgDividendYield")),
        "payout_ratio": _num(info.get("payoutRatio")),
        "div_growth_3y": dg.get("cagr_3y"),
        "div_growth_5y": dg.get("cagr_5y"),
        "dividend_estimate": _num(div_rate),
        "dividend_ttm": _num(info.get("trailingAnnualDividendRate")),
        "fcf_coverage": _num(fcf_coverage),
        "years_div_increase": consecutive_div_increases(divs),
        "ex_dividend_date": _epoch_to_iso(info.get("exDividendDate")),
        # risk
        "beta": _num(info.get("beta")),
        "short_interest": _num(info.get("shortPercentOfFloat")),
        "days_to_cover": _num(info.get("shortRatio")),
        "altman_z": altman_z(inc, bal, market_cap),
        "piotroski_f": piotroski_f(inc, bal, cf),
        # performance (price only, excludes dividends), %
        "perf_ytd": perf["ytd"],
        "perf_1y": perf["1y"],
        "perf_3y": perf["3y"],
        "perf_5y": perf["5y"],
        "perf_10y": perf["10y"],
    }


def dividend_growth(ticker):
    def produce():
        try:
            divs = yf.Ticker(ticker).dividends
        except Exception:
            return {"cagr_3y": None, "cagr_5y": None, "annual": []}
        out = {"cagr_3y": None, "cagr_5y": None, "annual": []}
        if divs is None or len(divs) == 0:
            return out
        annual = divs.groupby(divs.index.year).sum()
        cur_year = _dt.date.today().year
        annual = annual[annual.index < cur_year]  # only completed years
        out["annual"] = [{"year": int(y), "value": _num(v)} for y, v in annual.items()][-8:]

        def cagr(n):
            if len(annual) < n + 1:
                return None
            end = float(annual.iloc[-1])
            start = float(annual.iloc[-1 - n])
            if start <= 0 or end <= 0:
                return None
            return ((end / start) ** (1.0 / n) - 1.0) * 100.0

        out["cagr_3y"] = _num(cagr(3))
        out["cagr_5y"] = _num(cagr(5))
        return out

    return cached(f"divgrowth:{ticker}", 1800, produce)


def _series_from_stmt(df, *labels):
    """Pull the first matching row from a statement df -> oldest->newest series."""
    if df is None or getattr(df, "empty", True):
        return []
    for label in labels:
        if label in df.index:
            row = df.loc[label]
            cols = sorted(df.columns)  # period timestamps ascending
            return [
                {"period": str(getattr(c, "date", lambda: c)()), "value": _num(row[c])}
                for c in cols
            ]
    return []


def _yoy(series):
    """Year-over-year growth (%) keyed by period, from an oldest->newest series
    of {period, value}. A period only appears when the prior year is positive."""
    out = {}
    for i in range(1, len(series)):
        prev = series[i - 1].get("value")
        cur = series[i].get("value")
        per = series[i].get("period")
        if prev is not None and cur is not None and prev > 0:
            out[per] = (cur / prev - 1.0) * 100.0
    return out


def altman_z(income, balance, market_cap):
    """Altman Z-Score (public-company form). Higher = safer: >2.99 'safe',
    1.81-2.99 'grey', <1.81 'distress'. None when inputs are unavailable.
        Z = 1.2*WC/TA + 1.4*RE/TA + 3.3*EBIT/TA + 0.6*MktCap/TL + 1.0*Sales/TA
    """
    ta = _stmt_val(balance, "Total Assets")
    ca = _stmt_val(balance, "Current Assets", "Total Current Assets")
    cl = _stmt_val(balance, "Current Liabilities", "Total Current Liabilities")
    tl = _stmt_val(balance, "Total Liabilities Net Minority Interest", "Total Liabilities")
    re = _stmt_val(balance, "Retained Earnings")
    rev = _stmt_val(income, "Total Revenue")
    ebit = _stmt_val(income, "EBIT", "Operating Income", "Operating Income Or Loss")
    if not ta or not tl or not market_cap or None in (ca, cl, re, rev, ebit):
        return None
    wc = ca - cl
    z = (1.2 * wc / ta + 1.4 * re / ta + 3.3 * ebit / ta
         + 0.6 * market_cap / tl + 1.0 * rev / ta)
    return _num(z)


def piotroski_f(income, balance, cashflow):
    """Piotroski F-Score (0-9): higher = stronger fundamentals, scored across 9
    profitability, leverage/liquidity and efficiency tests (1 point each).
    Needs a prior year; None when current/prior core figures are missing."""
    def cur(df, *l):
        return _stmt_val(df, *l, col=0)

    def prev(df, *l):
        return _stmt_val(df, *l, col=1)

    ni = cur(income, "Net Income", "Net Income Common Stockholders")
    ni_p = prev(income, "Net Income", "Net Income Common Stockholders")
    ta = cur(balance, "Total Assets")
    ta_p = prev(balance, "Total Assets")
    if None in (ni, ni_p, ta, ta_p) or not ta or not ta_p:
        return None

    cfo = cur(cashflow, "Operating Cash Flow",
              "Cash Flow From Continuing Operating Activities",
              "Total Cash From Operating Activities")
    ca, ca_p = (cur(balance, "Current Assets", "Total Current Assets"),
                prev(balance, "Current Assets", "Total Current Assets"))
    cl, cl_p = (cur(balance, "Current Liabilities", "Total Current Liabilities"),
                prev(balance, "Current Liabilities", "Total Current Liabilities"))
    ltd, ltd_p = (cur(balance, "Long Term Debt", "Long Term Debt And Capital Lease Obligation"),
                  prev(balance, "Long Term Debt", "Long Term Debt And Capital Lease Obligation"))
    gp, gp_p = cur(income, "Gross Profit"), prev(income, "Gross Profit")
    rev, rev_p = cur(income, "Total Revenue"), prev(income, "Total Revenue")
    sh = cur(income, "Diluted Average Shares", "Basic Average Shares")
    sh_p = prev(income, "Diluted Average Shares", "Basic Average Shares")
    if sh is None:
        sh = cur(balance, "Ordinary Shares Number", "Share Issued")
        sh_p = prev(balance, "Ordinary Shares Number", "Share Issued")

    score = 0
    # Profitability
    if ni > 0:
        score += 1
    if cfo is not None and cfo > 0:
        score += 1
    if (ni / ta) > (ni_p / ta_p):                       # ROA improving
        score += 1
    if cfo is not None and cfo > ni:                    # earnings backed by cash
        score += 1
    # Leverage, liquidity, dilution
    if None not in (ltd, ltd_p) and (ltd / ta) < (ltd_p / ta_p):
        score += 1
    if None not in (ca, cl, ca_p, cl_p) and cl and cl_p and (ca / cl) > (ca_p / cl_p):
        score += 1
    if None not in (sh, sh_p) and sh <= sh_p:           # no share dilution
        score += 1
    # Operating efficiency
    if None not in (gp, gp_p, rev, rev_p) and rev and rev_p and (gp / rev) > (gp_p / rev_p):
        score += 1
    if None not in (rev, rev_p) and (rev / ta) > (rev_p / ta_p):
        score += 1
    return score


def _dividend_yields(divs, prices):
    """{calendar_year: dividend yield %} = calendar-year dividends / year-end
    close. Empty dict when dividends or prices are unavailable."""
    out = {}
    if divs is None or len(divs) == 0 or prices is None or len(prices) == 0:
        return out
    try:
        ann = divs.groupby(divs.index.year).sum()
        yc = {int(y): float(p)
              for y, p in prices.groupby(prices.index.year).last().items()}
    except Exception:
        return out
    for y, d in ann.items():
        px = yc.get(int(y))
        if px and d:
            out[int(y)] = float(d) / px * 100.0
    return out


def share_dilution(income, balance, cashflow, ticker, info):
    """Last-5y share-count breakdown (outstanding / float / treasury) plus the
    dividend-yield and payout-ratio lines. Float shares are only available as a
    current snapshot, so they populate the latest year only."""
    shares = [s for s in _series_from_stmt(balance, "Ordinary Shares Number", "Share Issued")
              if s["value"] is not None]
    if not shares:
        return []
    treasury = {t["period"]: t["value"]
                for t in _series_from_stmt(balance, "Treasury Shares Number")}
    ni = {n["period"]: n["value"]
          for n in _series_from_stmt(income, "Net Income", "Net Income Common Stockholders")}
    dp = {d["period"]: d["value"]
          for d in _series_from_stmt(cashflow, "Cash Dividends Paid",
                                     "Common Stock Dividend Paid", "Common Stock Dividends Paid")}
    yields = _dividend_yields(get_dividends(ticker), get_raw_close(ticker))
    float_shares = _num(info.get("floatShares"))

    sel = shares[-5:]
    last_period = sel[-1]["period"] if sel else None
    rows = []
    for s in sel:
        p = s["period"]
        yr = int(p[:4]) if p[:4].isdigit() else None
        net, paid = ni.get(p), dp.get(p)
        payout = (abs(paid) / net * 100) if (paid and net and net > 0) else None
        rows.append({
            "period": p[:4],
            "shares_outstanding": _num(s["value"]),
            "float_shares": float_shares if p == last_period else None,
            "treasury_shares": _num(treasury.get(p)),
            "div_yield": _num(yields.get(yr)) if yr is not None else None,
            "payout_ratio": _num(payout),
        })
    return rows


def deepdive(ticker):
    def produce():
        tk = yf.Ticker(ticker)
        info = get_info(ticker)
        try:
            income = tk.income_stmt
        except Exception:
            income = None
        try:
            q_income = tk.quarterly_income_stmt
        except Exception:
            q_income = None
        try:
            cashflow = tk.cash_flow
        except Exception:
            cashflow = None
        try:
            balance = tk.balance_sheet
        except Exception:
            balance = None

        price = _num(info.get("currentPrice")) or _num(info.get("regularMarketPrice"))
        div_rate = _num(info.get("dividendRate"))
        div_yield = (div_rate / price * 100) if (div_rate and price) else None
        growth = dividend_growth(ticker)

        revenue = _series_from_stmt(income, "Total Revenue", "TotalRevenue")
        gross = _series_from_stmt(income, "Gross Profit", "GrossProfit")
        op_income = _series_from_stmt(income, "Operating Income", "Operating Income Or Loss",
                                      "Total Operating Income As Reported", "OperatingIncome")
        net_income = _series_from_stmt(income, "Net Income", "NetIncome",
                                       "Net Income Common Stockholders")
        fcf = _series_from_stmt(cashflow, "Free Cash Flow", "FreeCashFlow")
        # align all series on the income-statement periods
        periods = ([r["period"] for r in revenue]
                   or [n["period"] for n in net_income]
                   or [g["period"] for g in gross])
        rev_map = {r["period"]: r["value"] for r in revenue}
        gp_map = {g["period"]: g["value"] for g in gross}
        oi_map = {o["period"]: o["value"] for o in op_income}
        ni_map = {n["period"]: n["value"] for n in net_income}
        fcf_map = {f["period"]: f["value"] for f in fcf}

        def _margin(num, den):
            return (num / den * 100) if (num is not None and den) else None

        rev_ni = [
            {"period": p[:4], "revenue": rev_map.get(p), "gross_profit": gp_map.get(p),
             "operating_income": oi_map.get(p),
             "net_income": ni_map.get(p), "fcf": fcf_map.get(p),
             "gross_margin": _margin(gp_map.get(p), rev_map.get(p)),
             "operating_margin": _margin(oi_map.get(p), rev_map.get(p)),
             "net_margin": _margin(ni_map.get(p), rev_map.get(p))}
            for p in periods[-5:]   # 5-year scope
        ]

        # FCF dividend coverage = free cash flow / dividends paid (latest year)
        fcf_latest = _stmt_val(cashflow, "Free Cash Flow") or _num(info.get("freeCashflow"))
        div_paid = _stmt_val(cashflow, "Cash Dividends Paid", "Common Stock Dividend Paid",
                             "Common Stock Dividends Paid")
        fcf_coverage = (fcf_latest / abs(div_paid)) if (fcf_latest is not None and div_paid) else None
        total_equity = _stmt_val(balance, "Stockholders Equity", "Total Stockholder Equity",
                                 "Common Stock Equity")

        # Profitability ratios that need statement figures ------------------
        ebit_latest = _stmt_val(income, "EBIT", "Operating Income", "Operating Income Or Loss")
        pretax = _stmt_val(income, "Pretax Income", "Income Before Tax")
        tax = _stmt_val(income, "Tax Provision", "Income Tax Expense")
        total_debt = _num(info.get("totalDebt")) or _stmt_val(balance, "Total Debt")
        total_assets = _stmt_val(balance, "Total Assets")
        current_liab = _stmt_val(balance, "Current Liabilities", "Total Current Liabilities")

        tax_rate = 0.21
        if pretax and tax and pretax > 0:
            tax_rate = min(max(tax / pretax, 0.0), 0.5)

        roic = None  # NOPAT / (debt + equity)
        if ebit_latest and total_equity and total_debt is not None:
            invested = (total_debt or 0) + total_equity
            if invested:
                roic = ebit_latest * (1 - tax_rate) / invested * 100

        roce = None  # EBIT / (total assets - current liabilities)
        if ebit_latest and total_assets and current_liab is not None:
            capital_employed = total_assets - current_liab
            if capital_employed:
                roce = ebit_latest / capital_employed * 100

        interest_exp = (
            _stmt_val(income, "Interest Expense", "Interest Expense Non Operating") or
            _stmt_val(income, "Interest Expense", "Interest Expense Non Operating", col=1)
        )
        market_cap = _num(info.get("marketCap"))
        wacc = _compute_wacc(_num(info.get("beta")), market_cap, total_debt,
                             interest_exp, tax_rate, get_risk_free_rate())

        # Debt/Equity from the same Total Debt and Total Equity shown in the
        # panel, so the three figures reconcile. Yahoo's debtToEquity (computed
        # from the most-recent quarter) is shown alongside as "Debt/Equity (MRQ)".
        debt_eq = (total_debt / total_equity * 100) \
            if (total_debt and total_equity) else None

        ebitda_margin = _num(info.get("ebitdaMargins") and info["ebitdaMargins"] * 100)

        # Leverage / cash-conversion ratios built on EBITDA.
        ebitda = _num(info.get("ebitda"))
        debt_ebitda = (total_debt / ebitda) if (total_debt and ebitda and ebitda > 0) else None
        ebitda_fcf = (ebitda / fcf_latest) if (ebitda and fcf_latest) else None

        # Valuation / leverage / dividend metrics also shown in the screener (market_cap already set above).
        total_cash = _num(info.get("totalCash"))
        p_c = (market_cap / total_cash) if (market_cap and total_cash) else None
        p_fcf = (market_cap / fcf_latest) if (market_cap and fcf_latest and fcf_latest > 0) else None
        lt_debt = _stmt_val(balance, "Long Term Debt",
                            "Long Term Debt And Capital Lease Obligation")
        lt_debt_eq = (lt_debt / total_equity * 100) if (lt_debt and total_equity) else None
        years_div_inc = consecutive_div_increases(get_dividends(ticker))

        # Year-over-year growth per period (bars for the last 5 years) --------
        eps_series = _series_from_stmt(income, "Diluted EPS", "Basic EPS")
        ebitda_series = _series_from_stmt(income, "EBITDA", "Normalized EBITDA")
        ebitda_map = {e["period"]: e["value"] for e in ebitda_series}
        rev_g = _yoy(revenue)
        eps_g = _yoy(eps_series)
        ebitda_g = _yoy(ebitda_series)
        growth_periods = sorted(set(rev_g) | set(eps_g) | set(ebitda_g))
        growth_rows = [
            {"period": p[:4],
             "revenue_growth": _num(rev_g.get(p)),
             "eps_growth": _num(eps_g.get(p)),
             "ebitda_growth": _num(ebitda_g.get(p)),
             # EBITDA margin per fiscal year, drawn as a line on the growth panel
             "ebitda_margin": _margin(ebitda_map.get(p), rev_map.get(p))}
            for p in growth_periods[-5:]
        ]

        dilution_rows = share_dilution(income, balance, cashflow, ticker, info)

        # Basic EPS TTM = sum of last 4 quarters; Diluted EPS TTM from yfinance info
        _q_basic = _series_from_stmt(q_income, "Basic EPS")
        _q_basic_vals = [x["value"] for x in _q_basic[-4:] if x.get("value") is not None]
        basic_eps = sum(_q_basic_vals) if len(_q_basic_vals) == 4 else None

        return {
            "ticker": ticker,
            "name": info.get("shortName") or info.get("longName") or ticker,
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "currency": info.get("currency"),
            "exchange": info.get("fullExchangeName") or info.get("exchange"),
            "summary": info.get("longBusinessSummary"),
            "website": info.get("website"),
            "price": price,
            "change_pct": _num(info.get("regularMarketChangePercent")),
            "panels": {
                "valuation": {
                    "Market Cap": _num(info.get("marketCap")),
                    "Enterprise Value": _num(info.get("enterpriseValue")),
                    "Trailing P/E": _num(info.get("trailingPE")),
                    "Forward P/E": _num(info.get("forwardPE")),
                    "PEG Ratio": _num(info.get("trailingPegRatio")) or _num(info.get("pegRatio")),
                    "Price/Book": _num(info.get("priceToBook")),
                    "Price/Sales": _num(info.get("priceToSalesTrailing12Months")),
                    "Price/Cash": _num(p_c),
                    "Price/FCF": _num(p_fcf),
                    "EV/EBITDA": _num(info.get("enterpriseToEbitda")),
                    "Diluted EPS": _num(info.get("trailingEps")),
                    "Basic EPS": _num(basic_eps),
                },
                "dividend": {
                    "Dividend Rate": _num(div_rate),
                    "Dividend TTM": _num(info.get("trailingAnnualDividendRate")),
                    "Dividend Yield %": _num(div_yield),
                    "Payout Ratio %": _num(info.get("payoutRatio") and info["payoutRatio"] * 100),
                    "FCF Coverage": _num(fcf_coverage),
                    "Ex-Dividend Date": _epoch_to_iso(info.get("exDividendDate")),
                    "5Y Avg Yield %": _num(info.get("fiveYearAvgDividendYield")),
                    "Div Growth 3Y %": growth["cagr_3y"],
                    "Div Growth 5Y %": growth["cagr_5y"],
                    "Years ▲ Dividend": years_div_inc,
                },
                "profitability": {
                    "Gross Margin %": _num(info.get("grossMargins") and info["grossMargins"] * 100),
                    "Operating Margin %": _num(info.get("operatingMargins") and info["operatingMargins"] * 100),
                    "EBITDA Margin %": ebitda_margin,
                    "Profit Margin %": _num(info.get("profitMargins") and info["profitMargins"] * 100),
                    "ROE %": _num(info.get("returnOnEquity") and info["returnOnEquity"] * 100),
                    "ROA %": _num(info.get("returnOnAssets") and info["returnOnAssets"] * 100),
                    "ROIC %": _num(roic),
                    "ROCE %": _num(roce),
                    "WACC %": _num(wacc),
                    "Revenue/Share": _num(info.get("revenuePerShare")),
                    "Net Income": _num(info.get("netIncomeToCommon")),
                },
                "health": {
                    "Total Cash": _num(info.get("totalCash")),
                    "Total Debt": _num(info.get("totalDebt")),
                    "Total Equity": _num(total_equity),
                    "Debt/Equity": _num(debt_eq),
                    "Debt/Equity (MRQ)": _num(info.get("debtToEquity")),
                    "Debt/EBITDA": _num(debt_ebitda),
                    "LT Debt/Equity": _num(lt_debt_eq),
                    "Current Ratio": _num(info.get("currentRatio")),
                    "Quick Ratio": _num(info.get("quickRatio")),
                    "Free Cash Flow": _num(fcf_latest),
                    "EBITDA": _num(ebitda),
                    "EBITDA/FCF": _num(ebitda_fcf),
                },
                "risk": {
                    "Beta": _num(info.get("beta")),
                    "Short Interest %": _num(info.get("shortPercentOfFloat")
                                             and info["shortPercentOfFloat"] * 100),
                    "Days to Cover": _num(info.get("shortRatio")),
                    "Altman Z-Score": altman_z(income, balance, _num(info.get("marketCap"))),
                    "Piotroski F-Score": piotroski_f(income, balance, cashflow),
                },
            },
            "dividend_growth": growth,
            "revenue_net_income": rev_ni,
            "growth": growth_rows,
            "share_dilution": dilution_rows,
        }

    return cached(f"deepdive:{ticker}", 600, produce)


def history(ticker, rng="1y"):
    def produce():
        try:
            df = yf.Ticker(ticker).history(period=rng, auto_adjust=True)
        except Exception:
            return {"ticker": ticker, "points": []}
        if df is None or df.empty:
            return {"ticker": ticker, "points": []}
        pts = [
            {"date": idx.strftime("%Y-%m-%d"), "close": _num(row["Close"]),
             "volume": _num(row.get("Volume"))}
            for idx, row in df.iterrows()
        ]
        return {"ticker": ticker, "range": rng, "points": pts}

    return cached(f"hist:{ticker}:{rng}", 600, produce)


_STMT_ATTR = {
    "income": ("income_stmt", "quarterly_income_stmt"),
    "balance": ("balance_sheet", "quarterly_balance_sheet"),
    "cashflow": ("cash_flow", "quarterly_cash_flow"),
}


_QSTMT_ATTR = {
    "income": "quarterly_income_stmt",
    "balance": "quarterly_balance_sheet",
    "cashflow": "quarterly_cash_flow",
}


def _ttm_column(ticker, stmt, labels):
    """Trailing-twelve-month column for a statement table.

    Income statement and cash flow are flows, so TTM = sum of the 4 most-recent
    quarters (only when a full year of quarters exists and the row is present in
    all four). The balance sheet is a point-in-time snapshot, so a sum is
    meaningless — its "trailing" column is the most-recent quarter, labelled MRQ.
    Returns (column_label, {row_label: value}); ("", {}) when unavailable.
    """
    attr = _QSTMT_ATTR.get(stmt, "quarterly_income_stmt")
    try:
        q = getattr(yf.Ticker(ticker), attr)
    except Exception:
        return "", {}
    if q is None or getattr(q, "empty", True):
        return "", {}
    cols = sorted(q.columns, reverse=True)  # newest first
    if stmt == "balance":
        sel, col_label = cols[:1], "MRQ"
    else:
        if len(cols) < 4:
            return "", {}
        sel, col_label = cols[:4], "TTM"
    out = {}
    for label in labels:
        if label not in q.index:
            continue
        vals = [_num(q.loc[label, c]) for c in sel]
        if stmt == "balance":
            out[label] = vals[0]
        elif all(v is not None for v in vals):
            out[label] = sum(vals)
    return col_label, out


def financials(ticker, stmt="income", freq="annual"):
    def produce():
        attr_annual, attr_quarter = _STMT_ATTR.get(stmt, _STMT_ATTR["income"])
        attr = attr_annual if freq == "annual" else attr_quarter
        try:
            df = getattr(yf.Ticker(ticker), attr)
        except Exception as e:
            return {"ticker": ticker, "stmt": stmt, "freq": freq, "periods": [],
                    "rows": [], "error": str(e)}
        if df is None or df.empty:
            return {"ticker": ticker, "stmt": stmt, "freq": freq, "periods": [], "rows": []}
        cols = sorted(df.columns, reverse=True)  # newest first
        periods = [str(getattr(c, "date", lambda: c)()) for c in cols]
        rows = []
        for label in df.index:
            rows.append({
                "label": str(label),
                "values": [_num(df.loc[label, c]) for c in cols],
            })
        # Prepend a trailing-twelve-month (or MRQ for the balance sheet) column.
        ttm_label, ttm = _ttm_column(ticker, stmt, list(df.index))
        if ttm_label and ttm:
            periods = [ttm_label] + periods
            for row in rows:
                row["values"] = [ttm.get(row["label"])] + row["values"]
        # Surface Yahoo's own TTM EBITDA (the figure behind EBITDA Margin) next to
        # the statement's EBITDA line, so the two are visible side by side. It's a
        # single TTM scalar, so it populates the TTM column only.
        if stmt == "income" and ttm_label == "TTM":
            try:
                y_ebitda = _num(get_info(ticker).get("ebitda"))
            except Exception:
                y_ebitda = None
            if y_ebitda is not None:
                yahoo_row = {"label": "EBITDA (Yahoo TTM)",
                             "values": [y_ebitda] + [None] * (len(periods) - 1)}
                idx = next((i for i, r in enumerate(rows)
                            if "EBITDA" in r["label"]), None)
                rows.insert(idx + 1, yahoo_row) if idx is not None else rows.append(yahoo_row)
        return {"ticker": ticker, "stmt": stmt, "freq": freq,
                "periods": periods, "rows": rows}

    return cached(f"fin:{ticker}:{stmt}:{freq}", 1800, produce)


# --------------------------------------------------------------------------- #
# Calendars — earnings & stock splits                                          #
# --------------------------------------------------------------------------- #
def _ts_to_iso(ts):
    """pandas Timestamp / datetime -> 'YYYY-MM-DD' (None when missing/NaT)."""
    try:
        if ts is None or pd.isna(ts):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return pd.Timestamp(ts).strftime("%Y-%m-%d")
    except Exception:
        try:
            return ts.isoformat()
        except Exception:
            return None


def market_calendar(start=None, end=None, limit=80):
    """Market-wide upcoming earnings + stock splits over a date window."""
    def produce():
        out = {"start": start, "end": end, "earnings": [], "splits": []}
        try:
            cals = yf.Calendars(start=start or None, end=end or None)
        except Exception as e:
            out["error"] = str(e)
            return out

        try:
            edf = cals.get_earnings_calendar(limit=limit)
            if edf is not None and not edf.empty:
                for sym, row in edf.iterrows():
                    out["earnings"].append({
                        "ticker": str(sym),
                        "name": row.get("Company"),
                        "market_cap": _num(row.get("Marketcap")),
                        "event": row.get("Event Name"),
                        "date": _ts_to_iso(row.get("Event Start Date")),
                        "timing": row.get("Timing"),
                        "eps_estimate": _num(row.get("EPS Estimate")),
                        "eps_actual": _num(row.get("Reported EPS")),
                        "surprise_pct": _num(row.get("Surprise(%)")),
                    })
        except Exception as e:
            out["earnings_error"] = str(e)

        try:
            sdf = cals.get_splits_calendar(limit=limit)
            if sdf is not None and not sdf.empty:
                for sym, row in sdf.iterrows():
                    out["splits"].append({
                        "ticker": str(sym),
                        "name": row.get("Company"),
                        "date": _ts_to_iso(row.get("Payable On")),
                        "old_share_worth": _num(row.get("Old Share Worth")),
                        "share_worth": _num(row.get("Share Worth")),
                        "optionable": bool(row.get("Optionable")),
                    })
        except Exception as e:
            out["splits_error"] = str(e)

        return out

    return cached(f"mktcal:{start}:{end}:{limit}", 900, produce)


def stock_calendar(ticker):
    """Per-ticker calendar: next earnings + estimates, ex-dividend / dividend
    dates, past earnings (with surprises) and the full stock-split history."""
    def produce():
        tk = yf.Ticker(ticker)
        out = {
            "ticker": ticker,
            "upcoming": {},
            "earnings_history": [],
            "splits": [],
        }

        try:
            cal = tk.calendar or {}
        except Exception:
            cal = {}
        ed = cal.get("Earnings Date") or []
        out["upcoming"] = {
            "earnings_dates": [_ts_to_iso(d) for d in ed if d is not None],
            "eps_low": _num(cal.get("Earnings Low")),
            "eps_high": _num(cal.get("Earnings High")),
            "eps_avg": _num(cal.get("Earnings Average")),
            "revenue_low": _num(cal.get("Revenue Low")),
            "revenue_high": _num(cal.get("Revenue High")),
            "revenue_avg": _num(cal.get("Revenue Average")),
            "ex_dividend_date": _ts_to_iso(cal.get("Ex-Dividend Date")),
            "dividend_date": _ts_to_iso(cal.get("Dividend Date")),
        }

        # Past earnings with estimate/actual/surprise (needs lxml; degrade ok).
        try:
            df = tk.get_earnings_dates(limit=12)
            if df is not None and not df.empty:
                for idx, row in df.iterrows():
                    out["earnings_history"].append({
                        "date": _ts_to_iso(idx),
                        "eps_estimate": _num(row.get("EPS Estimate")),
                        "eps_actual": _num(row.get("Reported EPS")),
                        "surprise_pct": _num(row.get("Surprise(%)")),
                    })
        except Exception as e:
            out["earnings_history_error"] = str(e)

        # Stock-split history (newest first).
        try:
            sp = tk.splits
            if sp is not None and len(sp):
                rows = [{"date": _ts_to_iso(idx), "ratio": _num(r)}
                        for idx, r in sp.items()]
                out["splits"] = list(reversed(rows))
        except Exception as e:
            out["splits_error"] = str(e)

        return out

    return cached(f"stockcal:{ticker}", 600, produce)


# --------------------------------------------------------------------------- #
# Excel export                                                                 #
# --------------------------------------------------------------------------- #
_METRIC_COLS = [
    ("ticker", "Ticker"), ("name", "Name"), ("sector", "Sector"),
    ("industry", "Industry"),
    # performance (price only) — right after Industry so returns read first,
    # longest window (10Y) leftmost down to YTD
    ("perf_10y", "Perf 10Y"), ("perf_5y", "Perf 5Y"),
    ("perf_3y", "Perf 3Y"), ("perf_1y", "Perf 1Y"), ("perf_ytd", "Perf YTD"),
    ("price", "Price"), ("market_cap", "Market Cap"),
    ("enterprise_value", "Enterprise Value"),
    # valuation
    ("pe", "P/E"), ("forward_pe", "Forward P/E"), ("peg", "PEG"),
    ("ps", "P/S"), ("pb", "P/B"), ("ev_ebitda", "EV/EBITDA"),
    ("p_fcf", "P/FCF"), ("pc", "P/C"), ("eps", "Diluted EPS"), ("eps_basic", "Basic EPS"),
    # profitability
    ("profit_margin", "Net Margin"), ("gross_margin", "Gross Margin"),
    ("operating_margin", "Operating Margin"), ("ebitda_margin", "EBITDA Margin"),
    ("roe", "ROE"), ("roa", "ROA"), ("roic", "ROIC"), ("roce", "ROCE"), ("wacc", "WACC"),
    ("revenue_per_share", "Revenue/Share"), ("income", "Net Income"), ("fcf", "FCF"),
    # financial health
    ("debt_to_equity", "Debt/Eq"), ("debt_to_equity_mrq", "Debt/Eq (MRQ)"),
    ("debt_ebitda", "Debt/EBITDA"), ("lt_debt_to_equity", "LT Debt/Eq"),
    ("current_ratio", "Current Ratio"), ("quick_ratio", "Quick Ratio"),
    ("total_cash", "Total Cash"), ("total_debt", "Total Debt"),
    ("total_equity", "Total Equity"), ("ebitda_fcf", "EBITDA/FCF"),
    # dividend
    ("div_yield", "Yield"), ("five_year_avg_yield", "5Y Avg Yield"),
    ("payout_ratio", "Payout Ratio"), ("div_growth_3y", "Div Growth 3Y"),
    ("div_growth_5y", "Div Growth 5Y"), ("dividend_estimate", "Div Estimate"),
    ("dividend_ttm", "Div TTM"), ("fcf_coverage", "FCF Coverage"),
    ("years_div_increase", "Yrs Div Increase"), ("ex_dividend_date", "Ex-Dividend Date"),
    # risk
    ("beta", "Beta"), ("short_interest", "Short Interest"),
    ("days_to_cover", "Days to Cover"), ("altman_z", "Altman Z-Score"),
    ("piotroski_f", "Piotroski F-Score"),
]

# screener_row keys whose value is in percentage points. Excel exports normalize
# every rate/margin/return to a decimal fraction (value / 100) so a single
# convention holds across both workbooks; the already-fraction keys (margins,
# ROE/ROA, payout ratio, short interest) pass through unchanged.
_PCT_KEYS = {
    "roic", "roce", "div_yield", "five_year_avg_yield",
    "div_growth_3y", "div_growth_5y", "debt_to_equity", "debt_to_equity_mrq",
    "lt_debt_to_equity", "perf_ytd", "perf_1y", "perf_3y", "perf_5y", "perf_10y",
}

# Export columns rendered with an Excel percent number format, so they display as
# a percentage (e.g. 41.72% / -25.00%) rather than the stored decimal fraction.
_PCT_FORMAT_KEYS = {"perf_ytd", "perf_1y", "perf_3y", "perf_5y", "perf_10y"}


def _export_val(key, value):
    """Normalize a screener_row value for export: percentage-point fields become
    decimal fractions; everything else passes through."""
    if value is not None and key in _PCT_KEYS:
        return value / 100.0
    return value


def build_workbook(tickers):
    wb = Workbook()
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1F2933")

    def style_header(ws, ncols):
        for c in range(1, ncols + 1):
            cell = ws.cell(row=1, column=c)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="left")

    # Sheet 1: Metrics
    ws = wb.active
    ws.title = "Metrics"
    ws.append([label for _, label in _METRIC_COLS])
    for tk in tickers:
        row = screener_row(tk)
        ws.append([_export_val(key, row.get(key)) for key, _ in _METRIC_COLS])
    style_header(ws, len(_METRIC_COLS))
    ws.freeze_panes = "A2"
    # Show the performance columns as percentages (values are stored as fractions).
    pct_cols = [i + 1 for i, (key, _) in enumerate(_METRIC_COLS) if key in _PCT_FORMAT_KEYS]
    for col in pct_cols:
        for r in range(2, len(tickers) + 2):
            ws.cell(row=r, column=col).number_format = "0.00%"

    # Sheet 2: Price History (aligned by date across tickers)
    ws2 = wb.create_sheet("Price History")
    series = {tk: {p["date"]: p["close"] for p in history(tk, "1y")["points"]}
              for tk in tickers}
    all_dates = sorted({d for s in series.values() for d in s})
    ws2.append(["Date"] + list(tickers))
    for d in all_dates:
        ws2.append([d] + [series[tk].get(d) for tk in tickers])
    style_header(ws2, len(tickers) + 1)
    ws2.freeze_panes = "B2"

    # Sheet 3: Financials (income statement, annual, stacked per ticker)
    ws3 = wb.create_sheet("Financials")
    bold = Font(bold=True)
    r = 1
    for tk in tickers:
        fin = financials(tk, "income", "annual")
        cell = ws3.cell(row=r, column=1, value=f"{tk} — Income Statement (Annual)")
        cell.font = bold
        r += 1
        ws3.cell(row=r, column=1, value="Line Item").font = header_font
        ws3.cell(row=r, column=1).fill = header_fill
        for j, p in enumerate(fin["periods"]):
            c = ws3.cell(row=r, column=2 + j, value=p)
            c.font = header_font
            c.fill = header_fill
        r += 1
        for row in fin["rows"]:
            ws3.cell(row=r, column=1, value=row["label"])
            for j, v in enumerate(row["values"]):
                ws3.cell(row=r, column=2 + j, value=v)
            r += 1
        r += 2  # gap between tickers

    for sheet in wb.worksheets:
        sheet.column_dimensions["A"].width = 34
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# Panels rendered on the deep-dive view, in display order, for the export.
_PANEL_ORDER = [
    ("valuation", "Valuation"), ("profitability", "Profitability"),
    ("health", "Financial Health"), ("dividend", "Dividend"), ("risk", "Risk"),
]

# Deep-dive panel metrics stored in percentage points but without a trailing
# "%" in their label; the export divides them by 100 like the "… %" metrics so
# the workbook is uniformly fraction-based (matching the screener export).
_DD_PCT_LABELS = {"Debt/Equity", "Debt/Equity (MRQ)", "LT Debt/Equity"}


def _dd_metric(label, value):
    """Map an Overview (label, value) pair for export: percentage-point metrics
    become decimal fractions and shed any trailing ' %' from the label."""
    is_pct = label.endswith(" %") or label in _DD_PCT_LABELS
    out_label = label[:-2] if label.endswith(" %") else label
    if is_pct and isinstance(value, (int, float)) and not isinstance(value, bool):
        return out_label, value / 100.0
    return out_label, value


def build_deepdive_workbook(ticker):
    """Single-company workbook mirroring the deep-dive view: an Overview sheet
    with every metric panel, a Charts Data sheet with the revenue/growth/share-
    dilution series, and one sheet per financial statement (annual)."""
    d = deepdive(ticker)
    wb = Workbook()
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1F2933")
    section_fill = PatternFill("solid", fgColor="3E4C59")
    bold = Font(bold=True)

    def header_row(ws, row, labels):
        for j, lab in enumerate(labels, start=1):
            cell = ws.cell(row=row, column=j, value=lab)
            cell.font = header_font
            cell.fill = header_fill

    # ---- Sheet 1: Overview -------------------------------------------------- #
    ws = wb.active
    ws.title = "Overview"
    ws.cell(row=1, column=1, value=f"{d['ticker']} — {d.get('name') or ''}").font = \
        Font(bold=True, size=13)
    chg = d.get("change_pct")
    r = 2
    for k, v in [("Sector", d.get("sector")), ("Industry", d.get("industry")),
                 ("Exchange", d.get("exchange")), ("Currency", d.get("currency")),
                 ("Price", d.get("price")),
                 ("Change", chg / 100.0 if isinstance(chg, (int, float)) else chg)]:
        ws.cell(row=r, column=1, value=k).font = bold
        ws.cell(row=r, column=2, value=v)
        r += 1
    r += 1
    for key, label in _PANEL_ORDER:
        sc = ws.cell(row=r, column=1, value=label)
        sc.font = header_font
        sc.fill = section_fill
        ws.cell(row=r, column=2).fill = section_fill
        r += 1
        for metric, value in (d["panels"].get(key) or {}).items():
            out_label, out_value = _dd_metric(metric, value)
            ws.cell(row=r, column=1, value=out_label)
            ws.cell(row=r, column=2, value=out_value)
            r += 1
        r += 1
    ws.column_dimensions["A"].width = 26
    ws.column_dimensions["B"].width = 22

    # ---- Sheet 2: Charts Data ----------------------------------------------- #
    ws2 = wb.create_sheet("Charts Data")
    r = 1

    def write_table(title, rows, cols, pct=()):
        nonlocal r
        ws2.cell(row=r, column=1, value=title).font = bold
        r += 1
        header_row(ws2, r, [lab for _, lab in cols])
        r += 1
        for row in rows:
            for j, (k, _) in enumerate(cols, start=1):
                v = row.get(k)
                if k in pct and isinstance(v, (int, float)) and not isinstance(v, bool):
                    v = v / 100.0  # percentage points -> decimal fraction
                ws2.cell(row=r, column=j, value=v)
            r += 1
        r += 2

    write_table("Revenue · Profit · Net Income · FCF", d.get("revenue_net_income", []), [
        ("period", "Year"), ("revenue", "Revenue"), ("gross_profit", "Gross Profit"),
        ("operating_income", "Operating Income"), ("net_income", "Net Income"),
        ("fcf", "FCF"), ("gross_margin", "Gross Margin"),
        ("operating_margin", "Operating Margin"), ("net_margin", "Net Margin")],
        pct={"gross_margin", "operating_margin", "net_margin"})
    write_table("Growth · YoY", d.get("growth", []), [
        ("period", "Year"), ("revenue_growth", "Revenue Growth"),
        ("eps_growth", "EPS Growth"), ("ebitda_growth", "EBITDA Growth"),
        ("ebitda_margin", "EBITDA Margin")],
        pct={"revenue_growth", "eps_growth", "ebitda_growth", "ebitda_margin"})
    write_table("Share Dilution", d.get("share_dilution", []), [
        ("period", "Year"), ("shares_outstanding", "Shares Outstanding"),
        ("float_shares", "Float Shares"), ("treasury_shares", "Treasury Shares"),
        ("div_yield", "Dividend Yield"), ("payout_ratio", "Payout Ratio")],
        pct={"div_yield", "payout_ratio"})
    ws2.column_dimensions["A"].width = 30

    # ---- Sheets 3-5: Financial statements (annual) -------------------------- #
    for stmt_key, sheet_name in (("income", "Income Statement"),
                                 ("balance", "Balance Sheet"),
                                 ("cashflow", "Cash Flow")):
        fin = financials(ticker, stmt_key, "annual")
        wss = wb.create_sheet(sheet_name)
        header_row(wss, 1, ["Line Item"] + list(fin["periods"]))
        rr = 2
        for row in fin["rows"]:
            wss.cell(row=rr, column=1, value=row["label"])
            for j, v in enumerate(row["values"]):
                wss.cell(row=rr, column=2 + j, value=v)
            rr += 1
        wss.freeze_panes = "B2"
        wss.column_dimensions["A"].width = 34

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# --------------------------------------------------------------------------- #
# HTTP handler                                                                 #
# --------------------------------------------------------------------------- #
def _parse_tickers(qs):
    raw = (qs.get("tickers", [""])[0] or qs.get("ticker", [""])[0] or "")
    out, seen = [], set()
    for t in raw.replace(" ", ",").split(","):
        t = t.strip().upper()
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


class Handler(BaseHTTPRequestHandler):
    server_version = "StockTerminal/1.0"

    def log_message(self, fmt, *args):  # quieter logs
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    # -- helpers ----------------------------------------------------------- #
    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, data, content_type, filename=None, status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        if filename:
            self.send_header("Content-Disposition",
                             f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(data)

    def _serve_static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        rel = path.lstrip("/")
        full = os.path.normpath(os.path.join(STATIC_DIR, rel))
        if not full.startswith(STATIC_DIR) or not os.path.isfile(full):
            self.send_error(404, "Not found")
            return
        ctype = {
            ".html": "text/html", ".js": "application/javascript",
            ".css": "text/css", ".svg": "image/svg+xml",
            ".json": "application/json", ".ico": "image/x-icon",
        }.get(os.path.splitext(full)[1], "application/octet-stream")
        with open(full, "rb") as f:
            data = f.read()
        self._send_bytes(data, ctype + ("; charset=utf-8" if ctype.startswith("text") or ctype.endswith("javascript") else ""))

    # -- routing ----------------------------------------------------------- #
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        # refresh=1 evicts the server cache for the request's scope first, so
        # the response is rebuilt from fresh Yahoo data.
        refresh = qs.get("refresh", ["0"])[0] == "1"
        try:
            if path == "/api/health":
                return self._send_json({"ok": True})
            if path == "/api/screener":
                tickers = _parse_tickers(qs)
                if not tickers:
                    return self._send_json({"rows": []})
                if refresh:
                    clear_ticker_cache(tickers)
                with ThreadPoolExecutor(max_workers=min(8, len(tickers))) as ex:
                    rows = list(ex.map(screener_row, tickers))
                return self._send_json({"rows": rows})
            if path == "/api/deepdive":
                t = _parse_tickers(qs)
                if not t:
                    return self._send_json({"error": "ticker required"}, 400)
                if refresh:
                    clear_ticker_cache(t[:1])
                return self._send_json(deepdive(t[0]))
            if path == "/api/history":
                t = _parse_tickers(qs)
                rng = qs.get("range", ["1y"])[0]
                if not t:
                    return self._send_json({"error": "ticker required"}, 400)
                return self._send_json(history(t[0], rng))
            if path == "/api/financials":
                t = _parse_tickers(qs)
                stmt = qs.get("stmt", ["income"])[0]
                freq = qs.get("freq", ["annual"])[0]
                if not t:
                    return self._send_json({"error": "ticker required"}, 400)
                return self._send_json(financials(t[0], stmt, freq))
            if path == "/api/calendar":
                start = qs.get("start", [None])[0] or None
                end = qs.get("end", [None])[0] or None
                try:
                    limit = max(1, min(int(qs.get("limit", ["80"])[0]), 100))
                except ValueError:
                    limit = 80
                if refresh:
                    clear_prefix_cache("mktcal:")
                return self._send_json(market_calendar(start, end, limit))
            if path == "/api/stock_calendar":
                t = _parse_tickers(qs)
                if not t:
                    return self._send_json({"error": "ticker required"}, 400)
                return self._send_json(stock_calendar(t[0]))
            return self._serve_static(path)
        except BrokenPipeError:
            pass
        except Exception as e:  # never crash the server on one bad request
            self._send_json({"error": str(e)}, 500)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            payload = {}
        try:
            if path == "/api/export":
                if not _HAS_OPENPYXL:
                    return self._send_json(
                        {"error": "openpyxl not installed. Run: pip install openpyxl"}, 500)
                tickers = [t.strip().upper() for t in payload.get("tickers", []) if t.strip()]
                if not tickers:
                    return self._send_json({"error": "no tickers"}, 400)
                data = build_workbook(tickers)
                stamp = _dt.date.today().strftime("%Y%m%d")
                return self._send_bytes(
                    data,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    filename=f"stock-terminal-{stamp}.xlsx")
            if path == "/api/export_deepdive":
                if not _HAS_OPENPYXL:
                    return self._send_json(
                        {"error": "openpyxl not installed. Run: pip install openpyxl"}, 500)
                raw_t = payload.get("ticker") or (payload.get("tickers") or [None])[0]
                tk = (raw_t or "").strip().upper()
                if not tk:
                    return self._send_json({"error": "ticker required"}, 400)
                data = build_deepdive_workbook(tk)
                stamp = _dt.date.today().strftime("%Y%m%d")
                return self._send_bytes(
                    data,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    filename=f"{tk}-{stamp}.xlsx")
            if path == "/api/cache/clear":
                clear_cache()
                return self._send_json({"ok": True})
            return self._send_json({"error": "unknown endpoint"}, 404)
        except BrokenPipeError:
            pass
        except Exception as e:
            self._send_json({"error": str(e)}, 500)


def main():
    ap = argparse.ArgumentParser(description="Stock Terminal server")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    url = f"http://{args.host}:{args.port}"
    print(f"\n  📈  Stock Terminal running at  {url}")
    print(f"      openpyxl export: {'enabled' if _HAS_OPENPYXL else 'DISABLED (pip install openpyxl)'}")
    print("      Press Ctrl+C to stop.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Bye.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
