"""
Comprehensive tests for stock-terminal/app.py.

Covers:
  - Pure helpers: _num, _epoch_to_iso, _parse_tickers, _stmt_val, _series_from_stmt
  - Business logic: consecutive_div_increases, performance, ROIC, derived ratios
  - TTL cache: hit/miss/expiry/clear, thread safety
  - HTTP API: health, screener, deepdive, history, financials, export (all via a
    real ThreadingHTTPServer started in a thread), 400/404/path-traversal guards
  - screener_row: valid ticker, invalid ticker, missing-field graceful None
  - deepdive: panel keys present, FCF coverage position, Total Equity present
  - financials: period ordering, empty result
  - Excel workbook: correct sheet names, header row, expected column count

All network calls to Yahoo are mocked with unittest.mock to keep tests fast,
deterministic, and offline-safe.
"""
import datetime
import importlib
import io
import json
import math
import os
import sys
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import MagicMock, patch
from urllib.request import urlopen
from urllib.error import HTTPError
from urllib.parse import urlencode

import pandas as pd
import numpy as np

# ---------------------------------------------------------------------------
# Make the stock-terminal package importable from the tests/ sub-directory.
# ---------------------------------------------------------------------------
TERMINAL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(TERMINAL_DIR))   # repo root → yfinance importable
sys.path.insert(0, TERMINAL_DIR)                     # stock-terminal/ → app importable

import app  # noqa: E402  (the stock-terminal app module)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _make_df(index_labels, col_dates, data):
    """Build a DataFrame that mimics a yfinance statement.

    yfinance orientation: rows = line items (index), cols = period Timestamps.
    data = {row_label: [val_col0, val_col1, ...]}
    pd.DataFrame(data, index=timestamps).T gives us rows=labels, cols=timestamps.
    """
    cols = [pd.Timestamp(d) for d in col_dates]
    df = pd.DataFrame(data, index=cols).T
    return df


def _make_div_series(year_amounts: dict):
    """Build a yfinance-style dividends Series keyed by monthly Timestamps."""
    idx, vals = [], []
    for year, total in sorted(year_amounts.items()):
        idx.append(pd.Timestamp(f"{year}-06-15"))
        vals.append(total)
    return pd.Series(vals, index=pd.DatetimeIndex(idx))


# ---------------------------------------------------------------------------
# 1. Pure helpers
# ---------------------------------------------------------------------------
class TestNum(unittest.TestCase):

    def test_normal_float(self):
        self.assertAlmostEqual(app._num(3.14), 3.14)

    def test_integer(self):
        self.assertEqual(app._num(42), 42.0)

    def test_none(self):
        self.assertIsNone(app._num(None))

    def test_nan(self):
        self.assertIsNone(app._num(float("nan")))

    def test_pos_inf(self):
        self.assertIsNone(app._num(float("inf")))

    def test_neg_inf(self):
        self.assertIsNone(app._num(float("-inf")))

    def test_string_number(self):
        self.assertAlmostEqual(app._num("2.5"), 2.5)

    def test_invalid_string(self):
        self.assertIsNone(app._num("abc"))

    def test_zero(self):
        self.assertEqual(app._num(0), 0.0)

    def test_negative(self):
        self.assertAlmostEqual(app._num(-100.5), -100.5)

    def test_numpy_nan(self):
        self.assertIsNone(app._num(np.nan))

    def test_large_int(self):
        self.assertEqual(app._num(4_000_000_000_000), 4e12)


class TestEpochToIso(unittest.TestCase):

    def test_known_epoch(self):
        # 2024-05-15 00:00:00 UTC
        epoch = int(datetime.datetime(2024, 5, 15, tzinfo=datetime.timezone.utc).timestamp())
        self.assertEqual(app._epoch_to_iso(epoch), "2024-05-15")

    def test_none(self):
        self.assertIsNone(app._epoch_to_iso(None))

    def test_zero(self):
        # falsy → None
        self.assertIsNone(app._epoch_to_iso(0))

    def test_string_epoch(self):
        epoch = int(datetime.datetime(2023, 1, 1, tzinfo=datetime.timezone.utc).timestamp())
        self.assertEqual(app._epoch_to_iso(str(epoch)), "2023-01-01")

    def test_invalid(self):
        self.assertIsNone(app._epoch_to_iso("not-a-number"))

    def test_float_epoch(self):
        epoch = datetime.datetime(2025, 3, 10, tzinfo=datetime.timezone.utc).timestamp()
        self.assertEqual(app._epoch_to_iso(epoch), "2025-03-10")


class TestParseTickers(unittest.TestCase):

    def test_comma_separated(self):
        qs = {"tickers": ["AAPL,MSFT,NVDA"]}
        self.assertEqual(app._parse_tickers(qs), ["AAPL", "MSFT", "NVDA"])

    def test_space_separated(self):
        qs = {"tickers": ["AAPL MSFT"]}
        self.assertEqual(app._parse_tickers(qs), ["AAPL", "MSFT"])

    def test_lowercased_input(self):
        qs = {"tickers": ["aapl,msft"]}
        self.assertEqual(app._parse_tickers(qs), ["AAPL", "MSFT"])

    def test_deduplication(self):
        qs = {"tickers": ["AAPL,AAPL,MSFT"]}
        self.assertEqual(app._parse_tickers(qs), ["AAPL", "MSFT"])

    def test_empty(self):
        self.assertEqual(app._parse_tickers({}), [])

    def test_ticker_fallback_key(self):
        qs = {"ticker": ["GOOGL"]}
        self.assertEqual(app._parse_tickers(qs), ["GOOGL"])

    def test_whitespace_stripped(self):
        qs = {"tickers": [" TSLA , AMZN "]}
        self.assertEqual(app._parse_tickers(qs), ["TSLA", "AMZN"])


# ---------------------------------------------------------------------------
# 2. Statement helpers
# ---------------------------------------------------------------------------
class TestStmtVal(unittest.TestCase):

    def setUp(self):
        self.df = _make_df(
            ["Total Revenue", "Net Income", "Gross Profit"],
            ["2024-12-31", "2023-12-31", "2022-12-31"],
            {
                "Total Revenue": [400e9, 380e9, 370e9],
                "Net Income":    [100e9,  90e9,  80e9],
                "Gross Profit":  [180e9, 170e9, 160e9],
            },
        )

    def test_first_label_newest_col(self):
        # col=0 → newest = 2024
        v = app._stmt_val(self.df, "Total Revenue")
        self.assertAlmostEqual(v, 400e9)

    def test_fallback_label(self):
        # "Revenue" not in df, but "Net Income" is
        v = app._stmt_val(self.df, "Revenue", "Net Income")
        self.assertAlmostEqual(v, 100e9)

    def test_older_period(self):
        v = app._stmt_val(self.df, "Total Revenue", col=1)
        self.assertAlmostEqual(v, 380e9)

    def test_oldest_period(self):
        v = app._stmt_val(self.df, "Total Revenue", col=2)
        self.assertAlmostEqual(v, 370e9)

    def test_col_out_of_range(self):
        self.assertIsNone(app._stmt_val(self.df, "Total Revenue", col=99))

    def test_label_not_found(self):
        self.assertIsNone(app._stmt_val(self.df, "EBITDA"))

    def test_none_df(self):
        self.assertIsNone(app._stmt_val(None, "Total Revenue"))

    def test_empty_df(self):
        self.assertIsNone(app._stmt_val(pd.DataFrame(), "Total Revenue"))

    def test_nan_value_returns_none(self):
        df = _make_df(["Total Revenue"], ["2024-12-31"], {"Total Revenue": [float("nan")]})
        self.assertIsNone(app._stmt_val(df, "Total Revenue"))


class TestSeriesFromStmt(unittest.TestCase):

    def setUp(self):
        self.df = _make_df(
            ["Total Revenue", "Net Income"],
            ["2022-12-31", "2023-12-31", "2024-12-31"],
            {
                "Total Revenue": [370e9, 380e9, 400e9],
                "Net Income":    [ 80e9,  90e9, 100e9],
            },
        )

    def test_returns_ascending_periods(self):
        series = app._series_from_stmt(self.df, "Total Revenue")
        periods = [s["period"] for s in series]
        self.assertEqual(periods, sorted(periods))

    def test_values_match_df(self):
        series = app._series_from_stmt(self.df, "Total Revenue")
        self.assertEqual(len(series), 3)
        self.assertAlmostEqual(series[-1]["value"], 400e9)

    def test_fallback_label(self):
        series = app._series_from_stmt(self.df, "EBIT", "Net Income")
        self.assertEqual(len(series), 3)
        self.assertAlmostEqual(series[0]["value"], 80e9)

    def test_label_missing_returns_empty(self):
        self.assertEqual(app._series_from_stmt(self.df, "EBITDA"), [])

    def test_none_df(self):
        self.assertEqual(app._series_from_stmt(None, "Total Revenue"), [])

    def test_nan_value_in_series_returns_none(self):
        df = _make_df(["Total Revenue"], ["2024-12-31"], {"Total Revenue": [float("nan")]})
        series = app._series_from_stmt(df, "Total Revenue")
        self.assertIsNone(series[0]["value"])


# ---------------------------------------------------------------------------
# 2b. _yoy — year-over-year growth keyed by period
# ---------------------------------------------------------------------------
class TestYoY(unittest.TestCase):

    @staticmethod
    def _series(*pairs):
        return [{"period": p, "value": v} for p, v in pairs]

    def test_basic_growth(self):
        s = self._series(("2022", 100.0), ("2023", 110.0), ("2024", 121.0))
        out = app._yoy(s)
        # first period has no prior year -> absent
        self.assertNotIn("2022", out)
        self.assertAlmostEqual(out["2023"], 10.0)
        self.assertAlmostEqual(out["2024"], 10.0)

    def test_negative_growth(self):
        # share count shrinking (buybacks) -> negative growth
        s = self._series(("2022", 1000.0), ("2023", 950.0))
        self.assertAlmostEqual(app._yoy(s)["2023"], -5.0)

    def test_skips_when_prior_not_positive(self):
        # prior year zero or negative -> growth undefined for that step
        s = self._series(("2022", 0.0), ("2023", 50.0), ("2024", 60.0))
        out = app._yoy(s)
        self.assertNotIn("2023", out)          # prev == 0 skipped
        self.assertAlmostEqual(out["2024"], 20.0)

    def test_skips_none_values(self):
        s = self._series(("2022", 100.0), ("2023", None), ("2024", 150.0))
        out = app._yoy(s)
        self.assertNotIn("2023", out)          # cur is None
        self.assertNotIn("2024", out)          # prev is None

    def test_empty_and_single(self):
        self.assertEqual(app._yoy([]), {})
        self.assertEqual(app._yoy(self._series(("2024", 100.0))), {})


# ---------------------------------------------------------------------------
# 3. Dividend helpers
# ---------------------------------------------------------------------------
class TestConsecutiveDivIncreases(unittest.TestCase):

    def test_no_dividends(self):
        self.assertIsNone(app.consecutive_div_increases(None))
        self.assertIsNone(app.consecutive_div_increases(pd.Series([], dtype=float)))

    def test_single_year(self):
        divs = _make_div_series({2020: 1.0})
        # Need ≥ 2 completed years to count
        with patch("app._dt") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 6, 1)
            self.assertIsNone(app.consecutive_div_increases(divs))

    def test_five_consecutive_increases(self):
        divs = _make_div_series({2019: 1.0, 2020: 1.1, 2021: 1.2, 2022: 1.3, 2023: 1.4, 2024: 1.5})
        with patch("app._dt") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 1, 1)
            count = app.consecutive_div_increases(divs)
        self.assertEqual(count, 5)

    def test_streak_broken(self):
        # 2021 < 2020 → streak resets; 2022, 2023 are increases = streak of 2
        divs = _make_div_series({2019: 1.0, 2020: 1.2, 2021: 1.0, 2022: 1.1, 2023: 1.2})
        with patch("app._dt") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 1, 1)
            count = app.consecutive_div_increases(divs)
        self.assertEqual(count, 2)

    def test_zero_streak(self):
        # Last year was a cut
        divs = _make_div_series({2022: 1.5, 2023: 1.4, 2024: 1.3})
        with patch("app._dt") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 1, 1)
            count = app.consecutive_div_increases(divs)
        self.assertEqual(count, 0)

    def test_flat_dividend_not_counted(self):
        # Exactly equal (within 0.01% threshold) → not an increase
        divs = _make_div_series({2022: 1.0, 2023: 1.0, 2024: 1.0})
        with patch("app._dt") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 1, 1)
            count = app.consecutive_div_increases(divs)
        self.assertEqual(count, 0)

    def test_current_year_excluded(self):
        # 2025 is the current year → should not be counted
        divs = _make_div_series({2023: 1.0, 2024: 1.1, 2025: 1.2})
        with patch("app._dt") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2025, 6, 1)
            count = app.consecutive_div_increases(divs)
        # Only 2023→2024 increase is countable
        self.assertEqual(count, 1)


# ---------------------------------------------------------------------------
# 4. Performance calculation
# ---------------------------------------------------------------------------
class TestPerformance(unittest.TestCase):

    def _price_series(self, start="2015-01-02", end="2025-06-25", start_val=100.0, end_val=300.0):
        dates = pd.date_range(start, end, freq="B", tz="America/New_York")
        vals = np.linspace(start_val, end_val, len(dates))
        return pd.Series(vals, index=dates)

    def test_all_nones_on_empty(self):
        with patch("app.get_raw_close", return_value=None):
            p = app.performance("FAKE")
        for k in ("ytd", "1y", "3y", "5y", "10y"):
            self.assertIsNone(p[k])

    def test_ytd_positive(self):
        s = self._price_series(start="2024-01-02", end="2025-06-25",
                               start_val=100.0, end_val=130.0)
        with patch("app.get_raw_close", return_value=s):
            p = app.performance("X")
        # Last close is 130, last-of-2024 close is somewhere ~115, so YTD should be positive
        self.assertIsNotNone(p["ytd"])
        self.assertGreater(p["ytd"], 0)

    def test_1y_return(self):
        # Build series where price exactly doubled over 2 years
        dates = pd.date_range("2023-01-02", "2025-01-02", freq="B", tz="UTC")
        vals = np.linspace(100.0, 200.0, len(dates))
        s = pd.Series(vals, index=dates)
        with patch("app.get_raw_close", return_value=s):
            p = app.performance("X")
        # 1Y return: ~100% over 2 years → ~50% in 1 year (linear)
        self.assertIsNotNone(p["1y"])
        self.assertGreater(p["1y"], 0)

    def test_10y_fallback_uses_earliest_close(self):
        # Series spans ~10 years but doesn't reach exactly 10 years before today
        s = self._price_series(start="2016-01-04", end="2025-12-31",
                               start_val=50.0, end_val=200.0)
        with patch("app.get_raw_close", return_value=s):
            p = app.performance("X")
        # span ≈ 9.99y ≥ 10*0.95 → should use first close as fallback
        self.assertIsNotNone(p["10y"])
        self.assertGreater(p["10y"], 0)

    def test_short_series_no_10y(self):
        # Only 2 years of data → 10Y should be None
        s = self._price_series(start="2023-01-02", end="2025-01-02",
                               start_val=100.0, end_val=120.0)
        with patch("app.get_raw_close", return_value=s):
            p = app.performance("X")
        self.assertIsNone(p["10y"])

    def test_pct_calculation(self):
        # 100 → 150 = exactly 50% return
        dates = pd.date_range("2024-01-02", "2025-06-25", freq="B", tz="UTC")
        vals = np.concatenate([np.full(len(dates) - 1, 100.0), [150.0]])
        s = pd.Series(vals, index=dates)
        with patch("app.get_raw_close", return_value=s):
            p = app.performance("X")
        self.assertIsNotNone(p["1y"])
        # Within a tolerance (not exactly 50% since base isn't 100)
        self.assertGreater(p["1y"], 0)


# ---------------------------------------------------------------------------
# 5. Derived-ratio logic (inline, no network)
# ---------------------------------------------------------------------------
class TestDerivedRatios(unittest.TestCase):

    def test_roic_normal(self):
        """ROIC = EBIT*(1-tax) / (debt+equity)*100"""
        ebit, tax_rate, debt, equity = 10e9, 0.21, 20e9, 30e9
        roic = ebit * (1 - tax_rate) / (debt + equity) * 100
        self.assertAlmostEqual(roic, 15.8, places=1)

    def test_roic_zero_invested(self):
        # equity=0, debt=0 → division by zero guard → None
        # Replicate the guard: invested = 0+0=0 → skip
        ebit, equity, total_debt = 10e9, 0, 0
        invested = total_debt + equity
        result = None if not invested else ebit / invested
        self.assertIsNone(result)

    def test_fcf_coverage_above_threshold(self):
        coverage = 10e9 / abs(-5e9)   # FCF / dividends_paid
        self.assertAlmostEqual(coverage, 2.0)
        self.assertGreater(coverage, 1.2)   # green band

    def test_fcf_coverage_yellow_band(self):
        coverage = 9e9 / abs(-9e9)
        self.assertAlmostEqual(coverage, 1.0)
        self.assertGreaterEqual(coverage, 0.8)
        self.assertLess(coverage, 1.2)

    def test_fcf_coverage_red_band(self):
        coverage = 5e9 / abs(-10e9)
        self.assertAlmostEqual(coverage, 0.5)
        self.assertLess(coverage, 0.8)

    def test_fcf_coverage_no_dividend(self):
        # div_paid = 0 or None → coverage = None
        div_paid = 0
        result = (100e9 / abs(div_paid)) if div_paid else None
        self.assertIsNone(result)

    def test_lt_debt_eq(self):
        lt_debt, equity = 30e9, 40e9
        lt_debt_eq = lt_debt / equity * 100
        self.assertAlmostEqual(lt_debt_eq, 75.0)

    def test_lt_debt_eq_negative_equity(self):
        # Negative equity → result is negative (leverage ratio can be negative)
        lt_debt, equity = 30e9, -10e9
        lt_debt_eq = lt_debt / equity * 100
        self.assertLess(lt_debt_eq, 0)

    def test_p_fcf_positive_fcf(self):
        mktcap, fcf = 100e9, 5e9
        self.assertAlmostEqual(mktcap / fcf, 20.0)

    def test_p_fcf_negative_fcf_returns_none(self):
        fcf = -1e9
        result = (100e9 / fcf) if (fcf and fcf > 0) else None
        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# 6. TTL cache
# ---------------------------------------------------------------------------
class TestCache(unittest.TestCase):

    def setUp(self):
        app.clear_cache()

    def tearDown(self):
        app.clear_cache()

    def test_cache_miss_calls_producer(self):
        calls = []
        def prod():
            calls.append(1)
            return "result"
        app.cached("key1", 60, prod)
        self.assertEqual(len(calls), 1)

    def test_cache_hit_skips_producer(self):
        calls = []
        def prod():
            calls.append(1)
            return "result"
        app.cached("key2", 60, prod)
        app.cached("key2", 60, prod)
        self.assertEqual(len(calls), 1)

    def test_cache_expiry(self):
        calls = []
        def prod():
            calls.append(1)
            return "result"
        app.cached("key3", 0.05, prod)   # 50ms TTL
        time.sleep(0.1)
        app.cached("key3", 0.05, prod)
        self.assertEqual(len(calls), 2)

    def test_clear_cache_forces_refetch(self):
        calls = []
        def prod():
            calls.append(1)
            return "value"
        app.cached("key4", 60, prod)
        app.clear_cache()
        app.cached("key4", 60, prod)
        self.assertEqual(len(calls), 2)

    def test_different_keys_independent(self):
        a_calls, b_calls = [], []
        app.cached("ka", 60, lambda: a_calls.append(1) or "a")
        app.cached("kb", 60, lambda: b_calls.append(1) or "b")
        app.cached("ka", 60, lambda: a_calls.append(1) or "a")
        self.assertEqual(len(a_calls), 1)
        self.assertEqual(len(b_calls), 1)

    def test_cache_returns_value(self):
        val = app.cached("kv", 60, lambda: {"x": 42})
        self.assertEqual(val, {"x": 42})

    def test_cache_thread_safety(self):
        results = []
        def produce():
            time.sleep(0.01)
            return 99
        def worker():
            results.append(app.cached("tkey", 60, produce))
        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads: t.start()
        for t in threads: t.join()
        self.assertEqual(len(results), 10)
        self.assertTrue(all(r == 99 for r in results))


# ---------------------------------------------------------------------------
# 7. screener_row (with mocked yfinance)
# ---------------------------------------------------------------------------
_BASE_INFO = {
    "shortName": "Test Corp",
    "currentPrice": 100.0,
    "regularMarketChangePercent": 1.5,
    "marketCap": 1e12,
    "trailingPE": 20.0,
    "forwardPE": 18.0,
    "trailingPegRatio": 1.5,
    "priceToBook": 3.0,
    "priceToSalesTrailing12Months": 5.0,
    "totalCash": 10e9,
    "enterpriseToEbitda": 12.0,
    "trailingEps": 5.0,
    "netIncomeToCommon": 50e9,
    "profitMargins": 0.25,
    "freeCashflow": 40e9,
    "returnOnAssets": 0.10,
    "returnOnEquity": 0.20,
    "debtToEquity": 50.0,
    "totalDebt": 30e9,
    "dividendRate": 2.0,
    "trailingAnnualDividendRate": 1.9,
    "payoutRatio": 0.40,
    "fiveYearAvgDividendYield": 2.5,
    "sector": "Technology",
    "industry": "Software",
    "currency": "USD",
}

_INCOME_DF = _make_df(
    ["Total Revenue", "Net Income", "Gross Profit", "EBIT", "Pretax Income", "Tax Provision"],
    ["2024-12-31", "2023-12-31"],
    {
        "Total Revenue":  [400e9, 370e9],
        "Net Income":     [100e9,  90e9],
        "Gross Profit":   [180e9, 165e9],
        "EBIT":           [ 80e9,  75e9],
        "Pretax Income":  [ 78e9,  73e9],
        "Tax Provision":  [ 16e9,  15e9],
    },
)

_BAL_DF = _make_df(
    ["Stockholders Equity", "Long Term Debt", "Total Debt"],
    ["2024-12-31", "2023-12-31"],
    {
        "Stockholders Equity": [50e9, 45e9],
        "Long Term Debt":      [25e9, 22e9],
        "Total Debt":          [30e9, 27e9],
    },
)

_CF_DF = _make_df(
    ["Free Cash Flow", "Cash Dividends Paid"],
    ["2024-12-31", "2023-12-31"],
    {
        "Free Cash Flow":      [40e9, 38e9],
        "Cash Dividends Paid": [-8e9, -7e9],
    },
)

_DIVS = _make_div_series({2019: 1.5, 2020: 1.6, 2021: 1.7, 2022: 1.8, 2023: 1.9, 2024: 2.0})

_CLOSE_SERIES = pd.Series(
    np.linspace(50.0, 100.0, 2500),
    index=pd.date_range("2015-06-01", periods=2500, freq="B", tz="UTC"),
)


def _patch_all(ticker="TST"):
    """Return a context-manager stack that mocks all external data calls."""
    import contextlib
    @contextlib.contextmanager
    def ctx():
        app.clear_cache()
        with patch("app.get_info", return_value=_BASE_INFO), \
             patch("app._get_stmt", side_effect=lambda t, attr: {
                 "income_stmt": _INCOME_DF, "balance_sheet": _BAL_DF,
                 "cash_flow": _CF_DF,
             }.get(attr, None)), \
             patch("app.get_dividends", return_value=_DIVS), \
             patch("app.get_raw_close", return_value=_CLOSE_SERIES), \
             patch("app.performance", return_value={
                 "ytd": 5.0, "1y": 12.0, "3y": 30.0, "5y": 60.0, "10y": 100.0}):
            yield
    return ctx()


class TestScreenerRow(unittest.TestCase):

    def setUp(self):
        app.clear_cache()

    def test_required_keys_present(self):
        with _patch_all():
            row = app.screener_row("TST")
        required = ["ticker", "name", "price", "market_cap", "pe", "forward_pe", "peg",
                    "pb", "ps", "pc", "p_fcf", "ev_ebitda", "eps",
                    "income", "profit_margin", "fcf", "roa", "roe", "roic",
                    "debt_to_equity", "lt_debt_to_equity",
                    "div_yield", "five_year_avg_yield", "dividend_estimate", "dividend_ttm",
                    "payout_ratio", "fcf_coverage", "years_div_increase",
                    "perf_ytd", "perf_1y", "perf_3y", "perf_5y", "perf_10y"]
        for k in required:
            self.assertIn(k, row, f"Missing key: {k}")

    def test_price_resolved(self):
        with _patch_all():
            row = app.screener_row("TST")
        self.assertAlmostEqual(row["price"], 100.0)

    def test_div_yield_computed(self):
        with _patch_all():
            row = app.screener_row("TST")
        # div_rate=2.0, price=100 → yield = 2.0%
        self.assertAlmostEqual(row["div_yield"], 2.0)

    def test_p_c_computed(self):
        with _patch_all():
            row = app.screener_row("TST")
        # marketCap=1e12, totalCash=10e9 → 100
        self.assertAlmostEqual(row["pc"], 100.0)

    def test_p_fcf_computed(self):
        with _patch_all():
            row = app.screener_row("TST")
        # marketCap=1e12, fcf=40e9 → 25
        self.assertAlmostEqual(row["p_fcf"], 25.0)

    def test_lt_debt_eq_computed(self):
        with _patch_all():
            row = app.screener_row("TST")
        # lt_debt=25e9, equity=50e9 → 50%
        self.assertAlmostEqual(row["lt_debt_to_equity"], 50.0)

    def test_fcf_coverage_computed(self):
        with _patch_all():
            row = app.screener_row("TST")
        # fcf=40e9, div_paid=-8e9 → 5.0
        self.assertAlmostEqual(row["fcf_coverage"], 5.0)

    def test_roic_computed(self):
        with _patch_all():
            row = app.screener_row("TST")
        # ebit=80e9, tax_rate=16/78≈0.205, debt=30e9, equity=50e9 → invested=80e9
        self.assertIsNotNone(row["roic"])
        self.assertGreater(row["roic"], 0)

    def test_roic_effective_tax_rate_capped(self):
        # Tax rate > 50% → capped at 0.5
        high_tax_info = {**_BASE_INFO}
        income = _make_df(
            ["EBIT", "Pretax Income", "Tax Provision", "Total Revenue", "Net Income", "Gross Profit"],
            ["2024-12-31"],
            {
                "EBIT": [10e9], "Pretax Income": [10e9], "Tax Provision": [8e9],  # 80% → capped at 50%
                "Total Revenue": [100e9], "Net Income": [2e9], "Gross Profit": [40e9],
            },
        )
        app.clear_cache()
        with patch("app.get_info", return_value=high_tax_info), \
             patch("app._get_stmt", side_effect=lambda t, attr: {
                 "income_stmt": income, "balance_sheet": _BAL_DF, "cash_flow": _CF_DF}.get(attr)), \
             patch("app.get_dividends", return_value=_DIVS), \
             patch("app.get_raw_close", return_value=_CLOSE_SERIES), \
             patch("app.performance", return_value={"ytd": 1.0, "1y": 1.0, "3y": 1.0, "5y": 1.0, "10y": 1.0}):
            row = app.screener_row("TST")
        roic_capped = 10e9 * (1 - 0.5) / (30e9 + 50e9) * 100
        self.assertAlmostEqual(row["roic"], roic_capped, places=0)

    def test_perf_fields_from_performance(self):
        with _patch_all():
            row = app.screener_row("TST")
        self.assertAlmostEqual(row["perf_ytd"], 5.0)
        self.assertAlmostEqual(row["perf_10y"], 100.0)

    def test_invalid_ticker_returns_error(self):
        app.clear_cache()
        with patch("app.get_info", return_value={}):
            row = app.screener_row("ZZZINVALID")
        self.assertIn("error", row)
        self.assertEqual(row["ticker"], "ZZZINVALID")

    def test_missing_optional_fields_return_none(self):
        sparse_info = {"shortName": "Sparse", "currentPrice": 50.0}
        app.clear_cache()
        with patch("app.get_info", return_value=sparse_info), \
             patch("app._get_stmt", return_value=None), \
             patch("app.get_dividends", return_value=None), \
             patch("app.get_raw_close", return_value=None), \
             patch("app.performance", return_value={"ytd": None, "1y": None, "3y": None, "5y": None, "10y": None}):
            row = app.screener_row("SPARSE")
        for k in ("pe", "forward_pe", "peg", "div_yield", "roic", "fcf_coverage",
                  "lt_debt_to_equity", "perf_10y"):
            self.assertIsNone(row[k], f"Expected None for {k}, got {row[k]}")


# ---------------------------------------------------------------------------
# 7b. Risk metrics — Altman Z-Score & Piotroski F-Score
# ---------------------------------------------------------------------------
class TestAltmanZ(unittest.TestCase):

    def _income(self):
        return _make_df(["Total Revenue", "EBIT"], ["2024-12-31"],
                        {"Total Revenue": [1200.0], "EBIT": [150.0]})

    def _balance(self, **overrides):
        base = {
            "Total Assets": [1000.0], "Current Assets": [400.0],
            "Current Liabilities": [200.0],
            "Total Liabilities Net Minority Interest": [500.0],
            "Retained Earnings": [300.0],
        }
        base.update(overrides)
        return _make_df(list(base), ["2024-12-31"], base)

    def test_known_value(self):
        # WC=200; Z = 1.2*.2 + 1.4*.3 + 3.3*.15 + 0.6*(2000/500) + 1.0*1.2 = 4.755
        z = app.altman_z(self._income(), self._balance(), 2000.0)
        self.assertAlmostEqual(z, 4.755, places=3)

    def test_none_without_market_cap(self):
        self.assertIsNone(app.altman_z(self._income(), self._balance(), None))

    def test_none_when_balance_missing_total_assets(self):
        bal = _make_df(["Current Assets"], ["2024-12-31"], {"Current Assets": [400.0]})
        self.assertIsNone(app.altman_z(self._income(), bal, 2000.0))


class TestPiotroskiF(unittest.TestCase):

    # Two-year fixtures engineered so all 9 criteria pass -> score 9.
    _INC = _make_df(
        ["Net Income", "Total Revenue", "Gross Profit", "Diluted Average Shares"],
        ["2024-12-31", "2023-12-31"],
        {
            "Net Income":             [100.0, 80.0],
            "Total Revenue":          [1200.0, 1100.0],
            "Gross Profit":           [600.0, 520.0],
            "Diluted Average Shares": [1000.0, 1010.0],
        },
    )
    _BAL = _make_df(
        ["Total Assets", "Current Assets", "Current Liabilities", "Long Term Debt"],
        ["2024-12-31", "2023-12-31"],
        {
            "Total Assets":        [1000.0, 1000.0],
            "Current Assets":      [400.0, 360.0],
            "Current Liabilities": [200.0, 200.0],
            "Long Term Debt":      [200.0, 250.0],
        },
    )
    _CF = _make_df(["Operating Cash Flow"], ["2024-12-31", "2023-12-31"],
                   {"Operating Cash Flow": [120.0, 90.0]})

    def test_perfect_score(self):
        self.assertEqual(app.piotroski_f(self._INC, self._BAL, self._CF), 9)

    def test_score_in_range(self):
        s = app.piotroski_f(self._INC, self._BAL, self._CF)
        self.assertIsInstance(s, int)
        self.assertTrue(0 <= s <= 9)

    def test_none_without_prior_year(self):
        one_yr_inc = _make_df(["Net Income"], ["2024-12-31"], {"Net Income": [100.0]})
        one_yr_bal = _make_df(["Total Assets"], ["2024-12-31"], {"Total Assets": [1000.0]})
        self.assertIsNone(app.piotroski_f(one_yr_inc, one_yr_bal, self._CF))

    def test_loss_making_lowers_score(self):
        # Flip net income negative in both years -> several criteria fail
        inc = _make_df(
            ["Net Income", "Total Revenue", "Gross Profit"],
            ["2024-12-31", "2023-12-31"],
            {"Net Income": [-50.0, -30.0], "Total Revenue": [1000.0, 1100.0],
             "Gross Profit": [400.0, 480.0]},
        )
        s = app.piotroski_f(inc, self._BAL, self._CF)
        self.assertLess(s, 9)


# ---------------------------------------------------------------------------
# 8. deepdive (panel structure + new fields)
# ---------------------------------------------------------------------------
class TestDeepdive(unittest.TestCase):

    def setUp(self):
        app.clear_cache()

    def _run(self, ticker="TST"):
        div_info = {
            **_BASE_INFO,
            "exDividendDate": int(datetime.datetime(2026, 5, 11,
                tzinfo=datetime.timezone.utc).timestamp()),
        }
        mock_tk = MagicMock()
        mock_tk.income_stmt = _INCOME_DF
        mock_tk.cash_flow = _CF_DF
        mock_tk.balance_sheet = _BAL_DF
        app.clear_cache()
        with patch("app.get_info", return_value=div_info), \
             patch("app.yf.Ticker", return_value=mock_tk), \
             patch("app.dividend_growth", return_value={
                 "cagr_3y": 5.0, "cagr_5y": 4.0, "annual": []}):
            return app.deepdive(ticker)

    def test_top_level_keys(self):
        d = self._run()
        for k in ("ticker", "name", "price", "panels", "revenue_net_income", "dividend_growth"):
            self.assertIn(k, d)

    def test_panel_names(self):
        d = self._run()
        self.assertEqual(set(d["panels"].keys()),
                         {"valuation", "dividend", "profitability", "health", "risk"})

    def test_valuation_keys(self):
        d = self._run()
        v = d["panels"]["valuation"]
        for k in ("Market Cap", "Enterprise Value", "Trailing P/E", "Forward P/E",
                  "PEG Ratio", "Price/Book", "Price/Sales", "EV/EBITDA"):
            self.assertIn(k, v, f"Valuation panel missing: {k}")

    def test_dividend_panel_order(self):
        d = self._run()
        keys = list(d["panels"]["dividend"].keys())
        pr_idx = keys.index("Payout Ratio %")
        fcf_idx = keys.index("FCF Coverage")
        # FCF Coverage must appear immediately after Payout Ratio %
        self.assertEqual(fcf_idx, pr_idx + 1,
                         f"FCF Coverage at {fcf_idx}, Payout Ratio at {pr_idx}")

    def test_dividend_fcf_coverage_value(self):
        d = self._run()
        # FCF=40e9, Cash Dividends Paid=-8e9 → coverage = 5.0
        self.assertAlmostEqual(d["panels"]["dividend"]["FCF Coverage"], 5.0)

    def test_health_panel_has_total_equity(self):
        d = self._run()
        h = d["panels"]["health"]
        self.assertIn("Total Equity", h)
        self.assertAlmostEqual(h["Total Equity"], 50e9)

    def test_health_panel_order_equity_after_debt(self):
        d = self._run()
        keys = list(d["panels"]["health"].keys())
        self.assertLess(keys.index("Total Debt"), keys.index("Total Equity"),
                        "Total Equity should appear after Total Debt")
        self.assertLess(keys.index("Total Equity"), keys.index("Debt/Equity"),
                        "Total Equity should appear before Debt/Equity")

    def test_revenue_net_income_has_four_series(self):
        d = self._run()
        row = d["revenue_net_income"][0]
        for k in ("revenue", "gross_profit", "net_income", "fcf"):
            self.assertIn(k, row, f"Chart series missing: {k}")

    def test_ex_dividend_date_formatted(self):
        d = self._run()
        ex_date = d["panels"]["dividend"].get("Ex-Dividend Date")
        self.assertEqual(ex_date, "2026-05-11")

    def test_profitability_panel_keys(self):
        d = self._run()
        p = d["panels"]["profitability"]
        for k in ("Gross Margin %", "Operating Margin %", "Profit Margin %", "ROE %", "ROA %"):
            self.assertIn(k, p)

    def test_caching_reuses_result(self):
        # Call twice; second call should return cached dict (same object)
        d1 = self._run("CACHE_TST")
        d2 = app.deepdive("CACHE_TST")   # hits cache
        self.assertIs(d1, d2)

    def test_profitability_has_new_ratios(self):
        d = self._run()
        p = d["panels"]["profitability"]
        for k in ("EBITDA Margin %", "ROIC %", "ROCE %"):
            self.assertIn(k, p, f"Profitability panel missing: {k}")

    def test_revenue_net_income_has_margins(self):
        d = self._run()
        row = d["revenue_net_income"][0]
        for k in ("gross_margin", "operating_margin", "net_margin"):
            self.assertIn(k, row, f"Margin series missing: {k}")
        # Gross margin 2024 = 180e9 / 400e9 * 100 = 45.0
        latest = d["revenue_net_income"][-1]
        self.assertAlmostEqual(latest["gross_margin"], 45.0)

    def test_revenue_net_income_has_operating_income_bar(self):
        # Operating Margin is rendered as a $ bar -> needs an absolute amount.
        d = self._run()
        self.assertIn("operating_income", d["revenue_net_income"][0])

    def test_growth_present_and_is_list(self):
        d = self._run()
        self.assertIn("growth", d)
        self.assertIsInstance(d["growth"], list)

    def test_risk_panel_keys(self):
        d = self._run()
        r = d["panels"]["risk"]
        for k in ("Beta", "Short Interest %", "Days to Cover",
                  "Altman Z-Score", "Piotroski F-Score"):
            self.assertIn(k, r, f"Risk panel missing: {k}")

    def test_beta_moved_from_health_to_risk(self):
        d = self._run()
        self.assertNotIn("Beta", d["panels"]["health"])
        self.assertIn("Beta", d["panels"]["risk"])


# ---------------------------------------------------------------------------
# 8b. deepdive growth panel — YoY bars over the last 3 years
# ---------------------------------------------------------------------------
_GROWTH_INCOME_DF = _make_df(
    ["Total Revenue", "Net Income", "Gross Profit", "Operating Income",
     "EBITDA", "Diluted EPS", "Diluted Average Shares"],
    ["2025-12-31", "2024-12-31", "2023-12-31", "2022-12-31"],
    {
        # newest -> oldest (yfinance column order); _series_from_stmt re-sorts ascending
        "Total Revenue":          [400e9, 360e9, 330e9, 300e9],
        "Net Income":             [100e9,  90e9,  80e9,  70e9],
        "Gross Profit":           [180e9, 160e9, 145e9, 130e9],
        "Operating Income":       [ 90e9,  80e9,  72e9,  64e9],
        "EBITDA":                 [120e9, 110e9, 100e9,  90e9],
        "Diluted EPS":            [  8.0,   7.0,   6.0,   5.0],
        "Diluted Average Shares": [970e6, 980e6, 990e6, 1000e6],
    },
)


class TestDeepdiveGrowth(unittest.TestCase):

    def setUp(self):
        app.clear_cache()

    def _run(self, ticker="GRW"):
        mock_tk = MagicMock()
        mock_tk.income_stmt = _GROWTH_INCOME_DF
        mock_tk.cash_flow = _CF_DF
        mock_tk.balance_sheet = _BAL_DF
        with patch("app.get_info", return_value=_BASE_INFO), \
             patch("app.yf.Ticker", return_value=mock_tk), \
             patch("app.dividend_growth", return_value={
                 "cagr_3y": 5.0, "cagr_5y": 4.0, "annual": []}):
            return app.deepdive(ticker)

    def test_last_three_years_only(self):
        rows = self._run()["growth"]
        # 4 statement years -> 3 YoY periods (2023, 2024, 2025)
        self.assertEqual([r["period"] for r in rows], ["2023", "2024", "2025"])

    def test_each_row_has_all_series(self):
        rows = self._run()["growth"]
        for r in rows:
            for k in ("revenue_growth", "eps_growth", "ebitda_growth"):
                self.assertIn(k, r, f"Growth row missing: {k}")

    def test_shares_growth_removed_from_growth(self):
        # Shares now live in the Share Dilution panel, not the growth panel.
        for r in self._run()["growth"]:
            self.assertNotIn("shares_growth", r)

    def test_revenue_growth_value(self):
        rows = self._run()["growth"]
        by_year = {r["period"]: r for r in rows}
        # 2025: 400/360 - 1 = 11.11%
        self.assertAlmostEqual(by_year["2025"]["revenue_growth"], (400 / 360 - 1) * 100)
        # 2024: 360/330 - 1 = 9.09%
        self.assertAlmostEqual(by_year["2024"]["revenue_growth"], (360 / 330 - 1) * 100)

    def test_eps_growth_value(self):
        rows = self._run()["growth"]
        by_year = {r["period"]: r for r in rows}
        # EPS 7.0 -> 8.0 in 2025 => 14.29%
        self.assertAlmostEqual(by_year["2025"]["eps_growth"], (8.0 / 7.0 - 1) * 100)

    def test_operating_income_bar_amount_and_margin(self):
        # Operating Margin bar = operating income $; tooltip % from operating_margin.
        latest = self._run()["revenue_net_income"][-1]   # 2025
        self.assertAlmostEqual(latest["operating_income"], 90e9)
        self.assertAlmostEqual(latest["operating_margin"], 90e9 / 400e9 * 100)
        self.assertAlmostEqual(latest["gross_margin"], 180e9 / 400e9 * 100)

    def test_growth_empty_when_single_year(self):
        one_year = _make_df(
            ["Total Revenue"], ["2024-12-31"], {"Total Revenue": [400e9]})
        mock_tk = MagicMock()
        mock_tk.income_stmt = one_year
        mock_tk.cash_flow = _CF_DF
        mock_tk.balance_sheet = _BAL_DF
        with patch("app.get_info", return_value=_BASE_INFO), \
             patch("app.yf.Ticker", return_value=mock_tk), \
             patch("app.dividend_growth", return_value={
                 "cagr_3y": None, "cagr_5y": None, "annual": []}):
            d = app.deepdive("ONEYR")
        # no prior year -> no YoY rows
        self.assertEqual(d["growth"], [])


# ---------------------------------------------------------------------------
# 8c. _dividend_yields & share_dilution
# ---------------------------------------------------------------------------
class TestDividendYields(unittest.TestCase):

    def test_yield_per_year(self):
        divs = pd.Series(
            [0.5, 0.5, 0.6, 0.6],
            index=pd.DatetimeIndex(["2023-03-01", "2023-09-01",
                                    "2024-03-01", "2024-09-01"]),
        )
        prices = pd.Series(
            [90.0, 100.0, 110.0, 120.0],
            index=pd.DatetimeIndex(["2023-06-01", "2023-12-31",
                                    "2024-06-01", "2024-12-31"]),
        )
        out = app._dividend_yields(divs, prices)
        # 2023: 1.0 div / 100 year-end = 1.0% ; 2024: 1.2 / 120 = 1.0%
        self.assertAlmostEqual(out[2023], 1.0)
        self.assertAlmostEqual(out[2024], 1.0)

    def test_empty_inputs(self):
        self.assertEqual(app._dividend_yields(None, None), {})
        self.assertEqual(app._dividend_yields(pd.Series([], dtype=float),
                                              pd.Series([], dtype=float)), {})


_DIL_BAL = _make_df(
    ["Ordinary Shares Number", "Treasury Shares Number", "Total Assets"],
    ["2024-12-31", "2023-12-31"],
    {
        "Ordinary Shares Number":  [1000.0, 1050.0],   # shrinking -> buybacks
        "Treasury Shares Number":  [200.0, 150.0],
        "Total Assets":            [5000.0, 4800.0],
    },
)
_DIL_INC = _make_df(
    ["Net Income"], ["2024-12-31", "2023-12-31"], {"Net Income": [500.0, 400.0]})
_DIL_CF = _make_df(
    ["Cash Dividends Paid"], ["2024-12-31", "2023-12-31"],
    {"Cash Dividends Paid": [-100.0, -80.0]})


class TestShareDilution(unittest.TestCase):

    def _run(self, info=None):
        info = info if info is not None else {"floatShares": 800.0}
        with patch("app.get_dividends", return_value=None), \
             patch("app.get_raw_close", return_value=None):
            return app.share_dilution(_DIL_INC, _DIL_BAL, _DIL_CF, "TST", info)

    def test_returns_rows_with_all_series(self):
        rows = self._run()
        self.assertTrue(rows)
        for k in ("period", "shares_outstanding", "float_shares",
                  "treasury_shares", "div_yield", "payout_ratio"):
            self.assertIn(k, rows[0])

    def test_shares_and_treasury_values(self):
        by_year = {r["period"]: r for r in self._run()}
        self.assertAlmostEqual(by_year["2024"]["shares_outstanding"], 1000.0)
        self.assertAlmostEqual(by_year["2024"]["treasury_shares"], 200.0)

    def test_float_only_on_latest_year(self):
        rows = self._run()
        by_year = {r["period"]: r for r in rows}
        self.assertAlmostEqual(by_year["2024"]["float_shares"], 800.0)   # latest
        self.assertIsNone(by_year["2023"]["float_shares"])               # earlier

    def test_payout_ratio_computed(self):
        by_year = {r["period"]: r for r in self._run()}
        # |−100| / 500 = 20% ; |−80| / 400 = 20%
        self.assertAlmostEqual(by_year["2024"]["payout_ratio"], 20.0)
        self.assertAlmostEqual(by_year["2023"]["payout_ratio"], 20.0)

    def test_empty_when_no_share_rows(self):
        bal = _make_df(["Total Assets"], ["2024-12-31"], {"Total Assets": [1.0]})
        with patch("app.get_dividends", return_value=None), \
             patch("app.get_raw_close", return_value=None):
            self.assertEqual(
                app.share_dilution(_DIL_INC, bal, _DIL_CF, "TST", {}), [])


# ---------------------------------------------------------------------------
# 8d. 5-year scope for revenue_net_income & growth panels
# ---------------------------------------------------------------------------
class TestFiveYearScope(unittest.TestCase):

    # 6 fiscal years so the [-5:] cap is actually exercised.
    _INC6 = _make_df(
        ["Total Revenue", "Net Income", "Gross Profit"],
        ["2025-12-31", "2024-12-31", "2023-12-31",
         "2022-12-31", "2021-12-31", "2020-12-31"],
        {
            "Total Revenue": [600e9, 550e9, 500e9, 450e9, 400e9, 360e9],
            "Net Income":    [150e9, 130e9, 120e9, 100e9, 90e9, 80e9],
            "Gross Profit":  [300e9, 270e9, 250e9, 220e9, 200e9, 180e9],
        },
    )

    def _run(self):
        mock_tk = MagicMock()
        mock_tk.income_stmt = self._INC6
        mock_tk.cash_flow = _CF_DF
        mock_tk.balance_sheet = _BAL_DF
        with patch("app.get_info", return_value=_BASE_INFO), \
             patch("app.yf.Ticker", return_value=mock_tk), \
             patch("app.dividend_growth", return_value={
                 "cagr_3y": None, "cagr_5y": None, "annual": []}):
            return app.deepdive("SIXYR")

    def test_revenue_net_income_capped_at_5(self):
        rows = self._run()["revenue_net_income"]
        self.assertEqual(len(rows), 5)
        self.assertEqual([r["period"] for r in rows],
                         ["2021", "2022", "2023", "2024", "2025"])

    def test_growth_capped_at_5(self):
        rows = self._run()["growth"]
        # 6 years -> 5 YoY periods, all kept by the [-5:] cap
        self.assertEqual(len(rows), 5)
        self.assertEqual([r["period"] for r in rows],
                         ["2021", "2022", "2023", "2024", "2025"])

    def test_share_dilution_key_present(self):
        self.assertIn("share_dilution", self._run())


# ---------------------------------------------------------------------------
# 9. financials()
# ---------------------------------------------------------------------------
class TestFinancials(unittest.TestCase):

    def setUp(self):
        app.clear_cache()

    def test_income_annual_structure(self):
        mock_tk = MagicMock()
        mock_tk.income_stmt = _INCOME_DF
        with patch("app.yf.Ticker", return_value=mock_tk):
            result = app.financials("TST", "income", "annual")
        self.assertEqual(result["stmt"], "income")
        self.assertEqual(result["freq"], "annual")
        # Periods should be newest-first (2024 before 2023)
        self.assertGreater(result["periods"][0], result["periods"][1])
        self.assertGreater(len(result["rows"]), 0)
        # Each row has label + values list
        row = result["rows"][0]
        self.assertIn("label", row)
        self.assertIn("values", row)
        self.assertEqual(len(row["values"]), len(result["periods"]))

    def test_empty_df_returns_empty_rows(self):
        mock_tk = MagicMock()
        mock_tk.balance_sheet = pd.DataFrame()
        with patch("app.yf.Ticker", return_value=mock_tk):
            result = app.financials("TST", "balance", "annual")
        self.assertEqual(result["rows"], [])
        self.assertEqual(result["periods"], [])

    def test_cashflow_quarterly(self):
        mock_tk = MagicMock()
        mock_tk.quarterly_cash_flow = _CF_DF
        with patch("app.yf.Ticker", return_value=mock_tk):
            result = app.financials("TST", "cashflow", "quarterly")
        self.assertEqual(result["freq"], "quarterly")
        self.assertGreater(len(result["rows"]), 0)

    def test_nan_values_become_none(self):
        nan_df = _make_df(["Total Revenue"], ["2024-12-31"], {"Total Revenue": [float("nan")]})
        mock_tk = MagicMock()
        mock_tk.income_stmt = nan_df
        with patch("app.yf.Ticker", return_value=mock_tk):
            result = app.financials("TST", "income", "annual")
        self.assertIsNone(result["rows"][0]["values"][0])


# ---------------------------------------------------------------------------
# 10. Excel workbook
# ---------------------------------------------------------------------------
@unittest.skipUnless(app._HAS_OPENPYXL, "openpyxl not installed")
class TestWorkbook(unittest.TestCase):

    def setUp(self):
        app.clear_cache()

    def _build(self, tickers=("TST", "TST2")):
        mock_tk = MagicMock()
        mock_tk.income_stmt = _INCOME_DF
        mock_tk.cash_flow = _CF_DF
        mock_tk.balance_sheet = _BAL_DF
        close = pd.Series([100.0, 105.0], index=pd.DatetimeIndex(["2025-01-02", "2025-01-03"]))
        hist_df = pd.DataFrame({"Close": close, "Volume": [1e6, 1e6]})
        mock_tk.history.return_value = hist_df
        with patch("app.get_info", return_value=_BASE_INFO), \
             patch("app._get_stmt", side_effect=lambda t, attr: {
                 "income_stmt": _INCOME_DF, "balance_sheet": _BAL_DF,
                 "cash_flow": _CF_DF}.get(attr)), \
             patch("app.get_dividends", return_value=_DIVS), \
             patch("app.get_raw_close", return_value=_CLOSE_SERIES), \
             patch("app.performance", return_value={"ytd": 1.0, "1y": 2.0, "3y": 3.0, "5y": 4.0, "10y": 5.0}), \
             patch("app.yf.Ticker", return_value=mock_tk):
            raw = app.build_workbook(list(tickers))
        from openpyxl import load_workbook
        return load_workbook(io.BytesIO(raw))

    def test_sheet_names(self):
        wb = self._build()
        self.assertEqual(wb.sheetnames, ["Metrics", "Price History", "Financials"])

    def test_metrics_header_count(self):
        wb = self._build()
        ws = wb["Metrics"]
        headers = [c.value for c in ws[1]]
        self.assertEqual(len(headers), len(app._METRIC_COLS))

    def test_metrics_has_data_rows(self):
        wb = self._build(("TST",))
        ws = wb["Metrics"]
        self.assertEqual(ws.max_row, 2)   # 1 header + 1 data row

    def test_metrics_ticker_column(self):
        wb = self._build(("TST",))
        ws = wb["Metrics"]
        self.assertEqual(ws.cell(row=2, column=1).value, "TST")

    def test_price_history_header(self):
        wb = self._build(("TST", "TST2"))
        ws = wb["Price History"]
        headers = [c.value for c in ws[1]]
        self.assertEqual(headers[0], "Date")
        self.assertIn("TST", headers)
        self.assertIn("TST2", headers)

    def test_financials_sheet_has_content(self):
        wb = self._build(("TST",))
        ws = wb["Financials"]
        self.assertGreater(ws.max_row, 2)

    def test_frozen_panes_metrics(self):
        wb = self._build()
        self.assertEqual(wb["Metrics"].freeze_panes, "A2")

    def test_frozen_panes_price_history(self):
        wb = self._build()
        self.assertEqual(wb["Price History"].freeze_panes, "B2")


# ---------------------------------------------------------------------------
# 11. HTTP server integration tests
# ---------------------------------------------------------------------------
def _start_server():
    """Start a real ThreadingHTTPServer on an ephemeral port. Returns (httpd, url)."""
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, f"http://127.0.0.1:{port}"


def _get(url):
    with urlopen(url, timeout=10) as r:
        return r.status, r.read(), r.headers.get("Content-Type", "")


def _post(url, body_dict):
    data = json.dumps(body_dict).encode()
    import urllib.request
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=10) as r:
        return r.status, r.read(), r.headers.get("Content-Type", "")


class TestHTTPServer(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        app.clear_cache()
        cls.httpd, cls.base = _start_server()
        # Patch all network calls once for the entire server lifecycle
        cls._patches = [
            patch("app.get_info", return_value=_BASE_INFO),
            patch("app._get_stmt", side_effect=lambda t, attr: {
                "income_stmt": _INCOME_DF, "balance_sheet": _BAL_DF,
                "cash_flow": _CF_DF}.get(attr)),
            patch("app.get_dividends", return_value=_DIVS),
            patch("app.get_raw_close", return_value=_CLOSE_SERIES),
            patch("app.performance", return_value={"1m": 0.5, "3m": 1.5, "6m": 3.0, "ytd": 1.0, "1y": 2.0, "3y": 3.0, "5y": 4.0, "10y": 5.0}),
        ]
        for p in cls._patches:
            p.start()
        # Also patch deepdive/history/financials yf.Ticker for those endpoints
        mock_tk = MagicMock()
        mock_tk.income_stmt = _INCOME_DF
        mock_tk.cash_flow = _CF_DF
        mock_tk.balance_sheet = _BAL_DF
        hist_df = pd.DataFrame(
            {"Close": [100.0, 101.0, 102.0], "Volume": [1e6, 1e6, 1e6]},
            index=pd.DatetimeIndex(["2025-06-01", "2025-06-02", "2025-06-03"]),
        )
        mock_tk.history.return_value = hist_df
        mock_tk.dividends = _DIVS
        mock_tk.quarterly_income_stmt = _INCOME_DF
        mock_tk.quarterly_balance_sheet = _BAL_DF
        mock_tk.quarterly_cash_flow = _CF_DF
        cls._yf_patch = patch("app.yf.Ticker", return_value=mock_tk)
        cls._yf_patch.start()
        cls._ddgrowth_patch = patch("app.dividend_growth", return_value={
            "cagr_3y": 5.0, "cagr_5y": 4.0, "annual": []})
        cls._ddgrowth_patch.start()

    @classmethod
    def tearDownClass(cls):
        for p in cls._patches:
            p.stop()
        cls._yf_patch.stop()
        cls._ddgrowth_patch.stop()
        cls.httpd.shutdown()

    def setUp(self):
        app.clear_cache()

    # -- health -------------------------------------------------------
    def test_health_200(self):
        status, body, ct = _get(f"{self.base}/api/health")
        self.assertEqual(status, 200)
        self.assertIn("application/json", ct)
        self.assertEqual(json.loads(body), {"ok": True})

    # -- calendar endpoints -------------------------------------------
    def test_calendar_endpoint(self):
        fake = {"start": None, "end": None,
                "earnings": [{"ticker": "NKE", "date": "2026-06-30"}],
                "splits": []}
        with patch("app.market_calendar", return_value=fake) as m:
            status, body, ct = _get(f"{self.base}/api/calendar?limit=50")
        self.assertEqual(status, 200)
        self.assertIn("application/json", ct)
        self.assertEqual(json.loads(body)["earnings"][0]["ticker"], "NKE")
        # limit parsed and clamped into range
        self.assertEqual(m.call_args.args[2], 50)

    def test_calendar_bad_limit_defaults(self):
        with patch("app.market_calendar", return_value={}) as m:
            _get(f"{self.base}/api/calendar?limit=notanumber")
        self.assertEqual(m.call_args.args[2], 80)

    def test_stock_calendar_endpoint(self):
        fake = {"ticker": "AAPL", "upcoming": {}, "earnings_history": [], "splits": []}
        with patch("app.stock_calendar", return_value=fake) as m:
            status, body, ct = _get(f"{self.base}/api/stock_calendar?ticker=aapl")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["ticker"], "AAPL")
        m.assert_called_once_with("AAPL")   # uppercased by _parse_tickers

    def test_stock_calendar_requires_ticker(self):
        try:
            status, _, _ = _get(f"{self.base}/api/stock_calendar")
            self.assertEqual(status, 400)
        except HTTPError as e:
            self.assertEqual(e.code, 400)

    # -- static serving -----------------------------------------------
    def test_index_html_served(self):
        status, body, ct = _get(f"{self.base}/")
        self.assertEqual(status, 200)
        self.assertIn("text/html", ct)
        self.assertIn(b"<!DOCTYPE html>", body)

    def test_js_file_served(self):
        status, body, ct = _get(f"{self.base}/js/api.js")
        self.assertEqual(status, 200)
        self.assertIn("javascript", ct)

    def test_css_file_served(self):
        status, body, ct = _get(f"{self.base}/css/styles.css")
        self.assertEqual(status, 200)
        self.assertIn("text/css", ct)

    def test_path_traversal_blocked(self):
        # Attempt to escape STATIC_DIR
        try:
            status, _, _ = _get(f"{self.base}/../app.py")
            self.assertEqual(status, 404)
        except HTTPError as e:
            self.assertEqual(e.code, 404)

    def test_unknown_static_404(self):
        try:
            _get(f"{self.base}/does-not-exist.txt")
            self.fail("Expected 404")
        except HTTPError as e:
            self.assertEqual(e.code, 404)

    # -- screener -----------------------------------------------------
    def test_screener_returns_rows(self):
        status, body, _ = _get(f"{self.base}/api/screener?tickers=TST")
        self.assertEqual(status, 200)
        d = json.loads(body)
        self.assertIn("rows", d)
        self.assertEqual(len(d["rows"]), 1)

    def test_screener_multiple_tickers(self):
        status, body, _ = _get(f"{self.base}/api/screener?tickers=TST,TST2,TST3")
        d = json.loads(body)
        self.assertEqual(len(d["rows"]), 3)

    def test_screener_empty_returns_empty(self):
        status, body, _ = _get(f"{self.base}/api/screener")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"rows": []})

    def test_screener_deduplicates_tickers(self):
        status, body, _ = _get(f"{self.base}/api/screener?tickers=TST,TST,TST")
        d = json.loads(body)
        self.assertEqual(len(d["rows"]), 1)

    def test_screener_row_has_all_fields(self):
        _, body, _ = _get(f"{self.base}/api/screener?tickers=TST")
        row = json.loads(body)["rows"][0]
        for field in ("pe", "forward_pe", "peg", "pb", "ps", "pc", "p_fcf", "ev_ebitda",
                      "eps", "income", "profit_margin", "fcf", "roa", "roe", "roic",
                      "debt_to_equity", "lt_debt_to_equity", "div_yield", "five_year_avg_yield",
                      "dividend_estimate", "dividend_ttm", "payout_ratio", "fcf_coverage",
                      "years_div_increase", "perf_ytd", "perf_1y", "perf_3y", "perf_5y", "perf_10y"):
            self.assertIn(field, row, f"Screener row missing: {field}")

    def test_screener_industry_field(self):
        _, body, _ = _get(f"{self.base}/api/screener?tickers=TST")
        row = json.loads(body)["rows"][0]
        self.assertEqual(row["industry"], "Software")

    # -- deepdive -----------------------------------------------------
    def test_deepdive_200(self):
        status, body, _ = _get(f"{self.base}/api/deepdive?ticker=TST")
        self.assertEqual(status, 200)
        d = json.loads(body)
        self.assertIn("panels", d)

    def test_deepdive_no_ticker_400(self):
        try:
            _get(f"{self.base}/api/deepdive")
            self.fail("Expected 400")
        except HTTPError as e:
            self.assertEqual(e.code, 400)

    def test_deepdive_health_panel_has_total_equity(self):
        _, body, _ = _get(f"{self.base}/api/deepdive?ticker=TST")
        d = json.loads(body)
        self.assertIn("Total Equity", d["panels"]["health"])

    def test_deepdive_dividend_fcf_coverage_position(self):
        _, body, _ = _get(f"{self.base}/api/deepdive?ticker=TST")
        d = json.loads(body)
        keys = list(d["panels"]["dividend"].keys())
        self.assertEqual(keys.index("FCF Coverage"), keys.index("Payout Ratio %") + 1)

    def test_deepdive_revenue_net_income_four_series(self):
        _, body, _ = _get(f"{self.base}/api/deepdive?ticker=TST")
        d = json.loads(body)
        row = d["revenue_net_income"][0]
        for k in ("revenue", "gross_profit", "net_income", "fcf"):
            self.assertIn(k, row)

    # -- history ------------------------------------------------------
    def test_history_200(self):
        status, body, _ = _get(f"{self.base}/api/history?ticker=TST&range=1mo")
        self.assertEqual(status, 200)
        d = json.loads(body)
        self.assertIn("points", d)
        self.assertGreater(len(d["points"]), 0)

    def test_history_no_ticker_400(self):
        try:
            _get(f"{self.base}/api/history")
            self.fail("Expected 400")
        except HTTPError as e:
            self.assertEqual(e.code, 400)

    def test_history_point_schema(self):
        _, body, _ = _get(f"{self.base}/api/history?ticker=TST&range=1mo")
        point = json.loads(body)["points"][0]
        self.assertIn("date", point)
        self.assertIn("close", point)
        self.assertIn("volume", point)

    # -- financials ---------------------------------------------------
    def test_financials_income_200(self):
        status, body, _ = _get(f"{self.base}/api/financials?ticker=TST&stmt=income&freq=annual")
        self.assertEqual(status, 200)
        d = json.loads(body)
        self.assertGreater(len(d["rows"]), 0)

    def test_financials_no_ticker_400(self):
        try:
            _get(f"{self.base}/api/financials?stmt=income")
            self.fail("Expected 400")
        except HTTPError as e:
            self.assertEqual(e.code, 400)

    def test_financials_balance_quarterly(self):
        _, body, _ = _get(f"{self.base}/api/financials?ticker=TST&stmt=balance&freq=quarterly")
        d = json.loads(body)
        self.assertEqual(d["stmt"], "balance")
        self.assertEqual(d["freq"], "quarterly")

    def test_financials_periods_newest_first(self):
        _, body, _ = _get(f"{self.base}/api/financials?ticker=TST&stmt=income&freq=annual")
        d = json.loads(body)
        self.assertGreater(d["periods"][0], d["periods"][1])

    # -- cache clear --------------------------------------------------
    def test_cache_clear_post(self):
        status, body, _ = _post(f"{self.base}/api/cache/clear", {})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"ok": True})

    # -- export -------------------------------------------------------
    @unittest.skipUnless(app._HAS_OPENPYXL, "openpyxl not installed")
    def test_export_returns_xlsx(self):
        status, body, ct = _post(f"{self.base}/api/export", {"tickers": ["TST"]})
        self.assertEqual(status, 200)
        self.assertIn("spreadsheetml", ct)
        self.assertTrue(len(body) > 1000)

    @unittest.skipUnless(app._HAS_OPENPYXL, "openpyxl not installed")
    def test_export_xlsx_three_sheets(self):
        from openpyxl import load_workbook
        _, body, _ = _post(f"{self.base}/api/export", {"tickers": ["TST"]})
        wb = load_workbook(io.BytesIO(body))
        self.assertEqual(wb.sheetnames, ["Metrics", "Price History", "Financials"])

    def test_export_empty_tickers_400(self):
        try:
            _post(f"{self.base}/api/export", {"tickers": []})
            self.fail("Expected 400")
        except HTTPError as e:
            self.assertEqual(e.code, 400)

    def test_unknown_post_endpoint_404(self):
        try:
            _post(f"{self.base}/api/unknown", {})
            self.fail("Expected 404")
        except HTTPError as e:
            self.assertEqual(e.code, 404)


# ---------------------------------------------------------------------------
# 12. Calendars — earnings & stock splits
# ---------------------------------------------------------------------------
class TestTsToIso(unittest.TestCase):
    def test_none(self):
        self.assertIsNone(app._ts_to_iso(None))

    def test_nat(self):
        self.assertIsNone(app._ts_to_iso(pd.NaT))

    def test_timestamp(self):
        self.assertEqual(app._ts_to_iso(pd.Timestamp("2026-07-30 20:00:00+0000")),
                         "2026-07-30")

    def test_date(self):
        self.assertEqual(app._ts_to_iso(datetime.date(2026, 5, 11)), "2026-05-11")


_EARN_CAL_DF = pd.DataFrame(
    {
        "Company": ["NIKE, Inc."],
        "Marketcap": [6.03e10],
        "Event Name": ["Q4 2026 Earnings Announcement"],
        "Event Start Date": [pd.Timestamp("2026-06-30 20:00:00+0000")],
        "Timing": ["AMC"],
        "EPS Estimate": [0.12],
        "Reported EPS": [np.nan],
        "Surprise(%)": [np.nan],
    },
    index=pd.Index(["NKE"], name="Symbol"),
)

_SPLIT_CAL_DF = pd.DataFrame(
    {
        "Company": ["Dhautoware Co Ltd"],
        "Payable On": [pd.Timestamp("2026-07-03 04:00:00+0000")],
        "Optionable": [False],
        "Old Share Worth": [5],
        "Share Worth": [1],
    },
    index=pd.Index(["025440.KQ"], name="Symbol"),
)


class TestMarketCalendar(unittest.TestCase):
    def setUp(self):
        app.clear_cache()

    def _mock_calendars(self):
        m = MagicMock()
        m.get_earnings_calendar.return_value = _EARN_CAL_DF
        m.get_splits_calendar.return_value = _SPLIT_CAL_DF
        return m

    def test_shapes_and_values(self):
        with patch("app.yf.Calendars", return_value=self._mock_calendars()):
            out = app.market_calendar("2026-06-26", "2026-07-10", 80)
        self.assertEqual(len(out["earnings"]), 1)
        self.assertEqual(len(out["splits"]), 1)
        e = out["earnings"][0]
        self.assertEqual(e["ticker"], "NKE")
        self.assertEqual(e["date"], "2026-06-30")
        self.assertEqual(e["timing"], "AMC")
        self.assertEqual(e["eps_estimate"], 0.12)
        self.assertIsNone(e["eps_actual"])   # NaN -> None
        s = out["splits"][0]
        self.assertEqual(s["ticker"], "025440.KQ")
        self.assertEqual(s["date"], "2026-07-03")
        self.assertEqual(s["old_share_worth"], 5)
        self.assertEqual(s["share_worth"], 1)
        self.assertFalse(s["optionable"])

    def test_json_serializable(self):
        with patch("app.yf.Calendars", return_value=self._mock_calendars()):
            out = app.market_calendar(None, None, 80)
        json.dumps(out)  # must not raise

    def test_earnings_error_isolated(self):
        m = MagicMock()
        m.get_earnings_calendar.side_effect = RuntimeError("boom")
        m.get_splits_calendar.return_value = _SPLIT_CAL_DF
        with patch("app.yf.Calendars", return_value=m):
            out = app.market_calendar(None, None, 80)
        self.assertIn("earnings_error", out)
        self.assertEqual(out["earnings"], [])
        self.assertEqual(len(out["splits"]), 1)   # splits still returned

    def test_constructor_error(self):
        with patch("app.yf.Calendars", side_effect=RuntimeError("no net")):
            out = app.market_calendar(None, None, 80)
        self.assertIn("error", out)
        self.assertEqual(out["earnings"], [])


class TestStockCalendar(unittest.TestCase):
    def setUp(self):
        app.clear_cache()

    def _mock_ticker(self, with_history=True):
        tk = MagicMock()
        tk.calendar = {
            "Dividend Date": datetime.date(2026, 5, 14),
            "Ex-Dividend Date": datetime.date(2026, 5, 11),
            "Earnings Date": [datetime.date(2026, 7, 30)],
            "Earnings High": 1.99, "Earnings Low": 1.83, "Earnings Average": 1.89,
            "Revenue High": 1.12e11, "Revenue Low": 1.07e11, "Revenue Average": 1.08e11,
        }
        if with_history:
            tk.get_earnings_dates.return_value = pd.DataFrame(
                {"EPS Estimate": [2.97, 1.73], "Reported EPS": [np.nan, 1.54],
                 "Surprise(%)": [np.nan, -10.88]},
                index=pd.DatetimeIndex(["2026-10-30", "2025-07-22"], name="Date"),
            )
        else:
            tk.get_earnings_dates.side_effect = ImportError("lxml missing")
        tk.splits = pd.Series(
            [7.0, 4.0],
            index=pd.DatetimeIndex(["2014-06-09", "2020-08-31"]),
            name="Stock Splits",
        )
        return tk

    def test_upcoming_and_splits(self):
        with patch("app.yf.Ticker", return_value=self._mock_ticker()):
            out = app.stock_calendar("AAPL")
        u = out["upcoming"]
        self.assertEqual(u["earnings_dates"], ["2026-07-30"])
        self.assertEqual(u["eps_avg"], 1.89)
        self.assertEqual(u["ex_dividend_date"], "2026-05-11")
        self.assertEqual(u["dividend_date"], "2026-05-14")
        # splits newest-first
        self.assertEqual([s["date"] for s in out["splits"]],
                         ["2020-08-31", "2014-06-09"])
        self.assertEqual(out["splits"][0]["ratio"], 4.0)

    def test_earnings_history(self):
        with patch("app.yf.Ticker", return_value=self._mock_ticker()):
            out = app.stock_calendar("AAPL")
        self.assertEqual(len(out["earnings_history"]), 2)
        self.assertEqual(out["earnings_history"][0]["eps_estimate"], 2.97)
        self.assertIsNone(out["earnings_history"][0]["eps_actual"])

    def test_earnings_history_degrades(self):
        with patch("app.yf.Ticker", return_value=self._mock_ticker(with_history=False)):
            out = app.stock_calendar("AAPL")
        self.assertEqual(out["earnings_history"], [])
        self.assertIn("earnings_history_error", out)
        # rest of payload still present
        self.assertEqual(out["upcoming"]["earnings_dates"], ["2026-07-30"])

    def test_json_serializable(self):
        with patch("app.yf.Ticker", return_value=self._mock_ticker()):
            out = app.stock_calendar("AAPL")
        json.dumps(out)


# ---------------------------------------------------------------------------
# 16. Expanded screener_row fields
# ---------------------------------------------------------------------------
class TestScreenerRowNewFields(unittest.TestCase):

    def setUp(self):
        app.clear_cache()

    def _row(self):
        with _patch_all():
            return app.screener_row("TST")

    def test_new_keys_present(self):
        row = self._row()
        for k in ("enterprise_value", "gross_margin", "operating_margin",
                  "ebitda_margin", "roce", "revenue_per_share", "current_ratio",
                  "quick_ratio", "total_cash", "total_debt", "total_equity",
                  "div_growth_3y", "div_growth_5y", "ex_dividend_date",
                  "debt_to_equity_mrq",
                  "short_interest", "days_to_cover", "altman_z", "piotroski_f"):
            self.assertIn(k, row)

    def test_totals_from_info_and_statements(self):
        row = self._row()
        self.assertEqual(row["total_cash"], 10e9)     # _BASE_INFO totalCash
        self.assertEqual(row["total_debt"], 30e9)     # _BASE_INFO totalDebt
        self.assertEqual(row["total_equity"], 50e9)   # Stockholders Equity (newest)

    def test_profit_margin_is_fraction(self):
        # screener_row keeps yfinance's native fraction for margins
        self.assertAlmostEqual(self._row()["profit_margin"], 0.25)


# ---------------------------------------------------------------------------
# 17. Export unit normalization → decimal fractions
# ---------------------------------------------------------------------------
class TestExportValHelper(unittest.TestCase):

    def test_pct_keys_divided_by_100(self):
        self.assertAlmostEqual(app._export_val("roic", 79.5), 0.795)
        self.assertAlmostEqual(app._export_val("perf_1y", 12.0), 0.12)
        self.assertAlmostEqual(app._export_val("div_yield", 2.0), 0.02)
        self.assertAlmostEqual(app._export_val("debt_to_equity", 50.0), 0.50)

    def test_fraction_keys_pass_through(self):
        self.assertEqual(app._export_val("profit_margin", 0.25), 0.25)
        self.assertEqual(app._export_val("roe", 0.20), 0.20)
        self.assertEqual(app._export_val("payout_ratio", 0.40), 0.40)
        self.assertEqual(app._export_val("short_interest", 0.01), 0.01)

    def test_currency_and_multiples_pass_through(self):
        self.assertEqual(app._export_val("market_cap", 1e12), 1e12)
        self.assertEqual(app._export_val("pe", 20.0), 20.0)

    def test_none_stays_none(self):
        self.assertIsNone(app._export_val("roic", None))
        self.assertIsNone(app._export_val("market_cap", None))


class TestDdMetricHelper(unittest.TestCase):

    def test_percent_suffix_label_to_fraction(self):
        self.assertEqual(app._dd_metric("ROE %", 20.0), ("ROE", 0.20))
        self.assertEqual(app._dd_metric("Gross Margin %", 45.0), ("Gross Margin", 0.45))

    def test_debt_equity_special_cased(self):
        self.assertEqual(app._dd_metric("Debt/Equity", 50.0), ("Debt/Equity", 0.50))

    def test_non_rate_pass_through(self):
        self.assertEqual(app._dd_metric("Market Cap", 1e12), ("Market Cap", 1e12))
        self.assertEqual(app._dd_metric("FCF Coverage", 5.0), ("FCF Coverage", 5.0))
        self.assertEqual(app._dd_metric("Ex-Dividend Date", "2026-05-11"),
                         ("Ex-Dividend Date", "2026-05-11"))

    def test_none_value_keeps_relabel(self):
        self.assertEqual(app._dd_metric("ROE %", None), ("ROE", None))


class TestMetricColsExpanded(unittest.TestCase):

    def test_new_keys_present(self):
        keys = {k for k, _ in app._METRIC_COLS}
        for k in ("enterprise_value", "gross_margin", "operating_margin",
                  "ebitda_margin", "roce", "revenue_per_share", "current_ratio",
                  "quick_ratio", "total_cash", "total_debt", "total_equity",
                  "div_growth_3y", "div_growth_5y", "ex_dividend_date",
                  "debt_to_equity_mrq",
                  "short_interest", "days_to_cover", "altman_z", "piotroski_f"):
            self.assertIn(k, keys)

    def test_ticker_is_first_column(self):
        self.assertEqual(app._METRIC_COLS[0][0], "ticker")

    def test_no_percent_in_any_label(self):
        for _, label in app._METRIC_COLS:
            self.assertFalse(label.endswith("%"), f"{label!r} carries a % suffix")


@unittest.skipUnless(app._HAS_OPENPYXL, "openpyxl not installed")
class TestScreenerExportFractions(unittest.TestCase):

    def setUp(self):
        app.clear_cache()

    def _build_and_row(self):
        mock_tk = MagicMock()
        mock_tk.income_stmt = _INCOME_DF
        mock_tk.cash_flow = _CF_DF
        mock_tk.balance_sheet = _BAL_DF
        close = pd.Series([100.0, 105.0],
                          index=pd.DatetimeIndex(["2025-01-02", "2025-01-03"]))
        mock_tk.history.return_value = pd.DataFrame({"Close": close, "Volume": [1e6, 1e6]})
        with patch("app.get_info", return_value=_BASE_INFO), \
             patch("app._get_stmt", side_effect=lambda t, attr: {
                 "income_stmt": _INCOME_DF, "balance_sheet": _BAL_DF,
                 "cash_flow": _CF_DF}.get(attr)), \
             patch("app.get_dividends", return_value=_DIVS), \
             patch("app.get_raw_close", return_value=_CLOSE_SERIES), \
             patch("app.performance", return_value={
                 "ytd": 5.0, "1y": 12.0, "3y": 30.0, "5y": 60.0, "10y": 100.0}), \
             patch("app.yf.Ticker", return_value=mock_tk):
            raw = app.build_workbook(["TST"])
            row = app.screener_row("TST")
        from openpyxl import load_workbook
        return load_workbook(io.BytesIO(raw)), row

    def _cells(self, wb):
        ws = wb["Metrics"]
        headers = [c.value for c in ws[1]]
        values = [c.value for c in ws[2]]
        label_for = {k: lab for k, lab in app._METRIC_COLS}
        return dict(zip(headers, values)), label_for

    def test_pct_columns_become_fractions(self):
        wb, row = self._build_and_row()
        cell, label_for = self._cells(wb)
        self.assertAlmostEqual(cell[label_for["perf_1y"]], row["perf_1y"] / 100.0)
        self.assertAlmostEqual(cell[label_for["perf_1y"]], 0.12)
        self.assertAlmostEqual(cell[label_for["roic"]], row["roic"] / 100.0)
        # debt_to_equity is now annual (totalDebt 30e9 / equity 50e9 = 60% -> 0.60)
        self.assertAlmostEqual(cell[label_for["debt_to_equity"]], 0.60)
        # debt_to_equity_mrq is Yahoo's value (50.0% -> 0.50)
        self.assertAlmostEqual(cell[label_for["debt_to_equity_mrq"]], 0.50)

    def test_fraction_columns_unchanged(self):
        wb, row = self._build_and_row()
        cell, label_for = self._cells(wb)
        self.assertEqual(cell[label_for["profit_margin"]], 0.25)
        self.assertEqual(cell[label_for["payout_ratio"]], 0.40)

    def test_currency_columns_unchanged(self):
        wb, _ = self._build_and_row()
        cell, label_for = self._cells(wb)
        self.assertEqual(cell[label_for["market_cap"]], 1e12)

    def test_no_percent_headers(self):
        wb, _ = self._build_and_row()
        headers = [c.value for c in wb["Metrics"][1]]
        self.assertFalse(any(str(h).endswith("%") for h in headers))


@unittest.skipUnless(app._HAS_OPENPYXL, "openpyxl not installed")
class TestDeepdiveExportFractions(unittest.TestCase):

    def setUp(self):
        app.clear_cache()

    def _build(self):
        div_info = {**_BASE_INFO, "exDividendDate": int(datetime.datetime(
            2026, 5, 11, tzinfo=datetime.timezone.utc).timestamp())}
        mock_tk = MagicMock()
        mock_tk.income_stmt = _INCOME_DF
        mock_tk.cash_flow = _CF_DF
        mock_tk.balance_sheet = _BAL_DF
        with patch("app.get_info", return_value=div_info), \
             patch("app.yf.Ticker", return_value=mock_tk), \
             patch("app.dividend_growth", return_value={
                 "cagr_3y": 5.0, "cagr_5y": 4.0, "annual": []}):
            raw = app.build_deepdive_workbook("TST")
        from openpyxl import load_workbook
        return load_workbook(io.BytesIO(raw))

    def _overview(self, wb):
        out = {}
        for row in wb["Overview"].iter_rows(values_only=True):
            if row[0] and row[1] is not None:
                out[row[0]] = row[1]
        return out

    def test_sheet_names(self):
        wb = self._build()
        self.assertEqual(wb.sheetnames, ["Overview", "Charts Data",
            "Income Statement", "Balance Sheet", "Cash Flow"])

    def test_overview_rates_are_fractions(self):
        ov = self._overview(self._build())
        self.assertAlmostEqual(ov["Profit Margin"], 0.25)
        self.assertAlmostEqual(ov["ROE"], 0.20)
        self.assertAlmostEqual(ov["ROA"], 0.10)
        # annual Debt/Equity (totalDebt 30e9 / equity 50e9 = 60% -> 0.60)
        self.assertAlmostEqual(ov["Debt/Equity"], 0.60)
        # Yahoo's MRQ measure, surfaced separately (50.0% -> 0.50)
        self.assertAlmostEqual(ov["Debt/Equity (MRQ)"], 0.50)

    def test_overview_currency_unchanged(self):
        ov = self._overview(self._build())
        self.assertEqual(ov["Market Cap"], 1e12)

    def test_overview_no_percent_labels(self):
        for row in self._build()["Overview"].iter_rows(values_only=True):
            if isinstance(row[0], str):
                self.assertFalse(row[0].endswith("%"), f"{row[0]!r}")

    def test_charts_margins_are_fractions(self):
        rows = list(self._build()["Charts Data"].iter_rows(values_only=True))
        hi = next(i for i, r in enumerate(rows) if r and r[0] == "Year")
        headers = [c for c in rows[hi] if c]
        self.assertIn("Gross Margin", headers)
        self.assertNotIn("Gross Margin %", headers)
        gm = rows[hi].index("Gross Margin")
        vals = [r[gm] for r in rows[hi + 1:hi + 3]
                if isinstance(r[gm], (int, float))]
        self.assertTrue(vals)
        # 2024 gross margin = 180e9 / 400e9 = 0.45 (fraction, not 45%)
        self.assertTrue(any(abs(v - 0.45) < 1e-6 for v in vals))
        self.assertTrue(all(abs(v) < 1.5 for v in vals))

    def test_consistent_with_screener_export(self):
        # Net/Profit margin reads identically (0.25) in both workbooks.
        ov = self._overview(self._build())
        self.assertAlmostEqual(ov["Profit Margin"], 0.25)


class TestDebtEquityReconciliation(unittest.TestCase):

    def setUp(self):
        app.clear_cache()

    def test_screener_debt_equity_reconciles(self):
        with _patch_all():
            row = app.screener_row("TST")
        # annual basis: totalDebt 30e9 / equity 50e9 * 100 = 60.0
        self.assertAlmostEqual(row["debt_to_equity"], 60.0)
        self.assertAlmostEqual(row["debt_to_equity"],
                               row["total_debt"] / row["total_equity"] * 100)

    def test_screener_debt_equity_mrq_is_yahoo_value(self):
        with _patch_all():
            row = app.screener_row("TST")
        self.assertAlmostEqual(row["debt_to_equity_mrq"], 50.0)  # _BASE_INFO debtToEquity

    def test_deepdive_debt_equity_reconciles(self):
        mock_tk = MagicMock()
        mock_tk.income_stmt = _INCOME_DF
        mock_tk.cash_flow = _CF_DF
        mock_tk.balance_sheet = _BAL_DF
        with patch("app.get_info", return_value=_BASE_INFO), \
             patch("app.yf.Ticker", return_value=mock_tk), \
             patch("app.dividend_growth", return_value={
                 "cagr_3y": None, "cagr_5y": None, "annual": []}):
            d = app.deepdive("TST")
        h = d["panels"]["health"]
        self.assertAlmostEqual(h["Debt/Equity"],
                               h["Total Debt"] / h["Total Equity"] * 100)
        self.assertAlmostEqual(h["Debt/Equity"], 60.0)
        self.assertAlmostEqual(h["Debt/Equity (MRQ)"], 50.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
