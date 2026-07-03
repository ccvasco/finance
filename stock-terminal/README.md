# Stock Terminal

A self-contained stock analysis web app powered by **yfinance**. Dark
financial-terminal UI, no heavy frameworks — the backend is a single Python
`http.server`, and the frontend is plain HTML/CSS/JS with dependency-free SVG
charts (no CDN, no build step required).

---

## Features

### Screener / Compare table
Enter any comma- or space-separated list of tickers (e.g. `AAPL, MSFT, NVDA`)
to build a side-by-side comparison grid:

| Category | Metrics |
|---|---|
| **Price charts** | Inline 6-month, 1-year, and 5-year price sparklines (green = up over the window, red = down) |
| **Valuation** | P/E, Forward P/E, PEG, P/B, P/S, P/C, P/FCF, EV/EBITDA, Diluted EPS, Basic EPS |
| **Profitability** | Net Income, Profit Margin, Gross Margin, Operating Margin, EBITDA Margin, FCF, ROA, ROE, ROIC, ROCE, WACC, Revenue/Share |
| **Financial Health** | Total Cash, Total Debt, Total Equity, Debt/Equity, Debt/EBITDA, LT Debt/Equity, Current Ratio, Quick Ratio, EBITDA/FCF |
| **Dividend** | Yield, 5Y Avg Yield, Div Estimate, Div TTM, Payout Ratio, FCF Coverage, Div Growth 3Y/5Y CAGR, Years of consecutive increases, Ex-Dividend Date |
| **Risk** | Beta, Short Interest %, Days to Cover, Altman Z-Score, Piotroski F-Score |
| **Performance** | Price-only return (excl. dividends): YTD, 1Y, 3Y, 5Y, 10Y |

FCF Coverage is color-coded: green ≥ 1.2× · yellow 0.8–1.2× · red < 0.8×.

Sticky headers and first column, click-to-sort on every column, live text
filter, and spinners while data loads.

> ROIC, LT Debt/Eq, FCF Coverage, consecutive-increase years, and the
> performance windows are derived from financial statements and price history.
> The first fetch for a fresh set of tickers takes a few seconds; subsequent
> fetches are served from a ~30-minute in-memory cache.

**Large batches & caching.** There's no cap on how many tickers you can enter.
Big sets are fetched in **throttled batches** (default 20 tickers per request,
with a short pause between batches) and rows **stream into the table** as each
batch arrives, with a live progress indicator. Results are **cached per
ticker-set** in the browser, so switching tabs or closing a deep-dive reuses
them — only pressing **Analyze** re-fetches. Batch size, batch interval, and
how many sets to cache are all configurable in **Settings**.

**⟳ Refresh.** Every data view — Dashboard, Screener, a loaded watchlist,
Calendar, and the deep-dive — has a **⟳ Refresh** button that bypasses both the
browser cache and the server's Yahoo cache, re-pulling fresh data in place (no
need to go back and re-Analyze). A deep-dive refresh touches **only that
ticker**: it reloads the panels, charts, statements, and calendar, and syncs
the ticker's row into the screener/dashboard/watchlist tables — the rest of
the set is untouched, so returning to a large table is instant.

### Deep dive
Click any ticker row to open a full analysis page:

- **Metric panels** — Valuation, Dividend (incl. 3Y/5Y growth CAGR and ex-date), Profitability, Financial Health, Risk.
- **Revenue · Profit · Net Income · FCF** — 5-year bar chart with margin % on hover.
- **Growth YoY** — Revenue, EPS, and EBITDA growth bars plus an EBITDA Margin line.
- **Share Dilution** — shares outstanding/float/treasury bars with yield and payout-ratio lines.
- **Interactive price chart** — 1W / 1M / 3M / 6M / 1Y / 3Y / 5Y range tabs.
- **Earnings & Splits Calendar** — next earnings date with EPS/revenue estimates, ex-dividend / dividend dates, last 12 quarters of earnings surprises, full split history.
- **Financial statements** — Income Statement, Balance Sheet, Cash Flow (annual and quarterly), with a TTM/MRQ column prepended.
- **Excel export** — download a single-company workbook (Overview, Charts Data, and all three statements).

### Calendar tab
Market-wide upcoming events over a *Next 7 / 14 / 30 days* window:

- **Earnings** — ticker, company, market cap, timing (BMO/AMC), EPS estimate vs. reported, surprise %.
- **Stock Splits** — ratio, forward/reverse flag, optionable.

Click any row to open the deep dive.

### Watchlist
Saved to `localStorage`; auto-saved on every add/remove and hydrated on load.

### Excel export (screener)
Export any set of tickers to `.xlsx` with three sheets:
- **Metrics** — every screener column (performance columns first).
- **Price History** — 1-year close prices aligned by date across tickers.
- **Financials** — annual income statement stacked per ticker.

### Settings
- **Accent color**, **default tickers**, and **default price-chart range**.
- **Batch size** — tickers fetched per request when analyzing many at once (default 20).
- **Batch interval** — pause between batches in milliseconds (default 400); raise it to be gentler on the server/Yahoo.
- **Cached result sets** — how many analyzed ticker-sets to keep in memory (default 25); *each set caches all of its tickers*, so a 500-ticker analysis is one fully-cached set.
- **Clear cache** — clears both the server-side Yahoo cache and this browser's cached results.
All settings persist in `localStorage`.

---

## Quick start

```bash
source /home/vc/yfinance/venv/bin/activat
# 1. Install dependencies (from the repo root)
pip install yfinance openpyxl lxml

# 2. Run the server
python stock-terminal/app.py

# 3. Open in your browser
#    http://127.0.0.1:8765
```

Options:

```bash
python stock-terminal/app.py --port 9000 --host 0.0.0.0
```

> The backend serves both the static frontend **and** the JSON API. Opening
> the `static/` folder directly (e.g. with `npx serve`) will render the UI
> but won't fetch any data — always run `app.py`.

---

## Running inside the yfinance repo

The server automatically adds the repository root to `sys.path`, so the
in-repo `yfinance` takes precedence over any installed version:

```bash
# From the repo root
python stock-terminal/app.py
```

---

## Project layout

```
stock-terminal/
├── app.py                  # stdlib HTTP server: JSON API + static serving + xlsx export
├── requirements.txt
├── METRICS.md              # plain-language guide to every metric and how to read it
├── SCREENER_COLUMNS.md     # column reference for the screener table
└── static/
    ├── index.html          # app shell (sidebar + topbar + view root)
    ├── css/
    │   └── styles.css      # dark terminal theme
    └── js/
        ├── api.js          # fetch wrappers + number/price/percent formatters
        ├── store.js        # localStorage watchlist + settings (auto-save / hydrate)
        ├── charts.js       # dependency-free SVG line and grouped-bar charts
        ├── views.js        # Screener, Watchlist, Dashboard, Calendar, Settings, Deep-dive
        └── app.js          # router, init, top-bar wiring, Excel export
```

---

## API reference

All endpoints are served by `app.py` on the same port as the frontend.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/screener?tickers=AAPL,MSFT` | Comparison metrics for one or more tickers |
| `GET` | `/api/deepdive?ticker=AAPL` | Full metric panels + chart series for one ticker |
| `GET` | `/api/history?ticker=AAPL&range=1y` | Price history points (close + volume) |
| `GET` | `/api/financials?ticker=AAPL&stmt=income\|balance\|cashflow&freq=annual\|quarterly` | Financial statement table with TTM/MRQ column |
| `GET` | `/api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=80` | Market-wide upcoming earnings and stock splits |
| `GET` | `/api/stock_calendar?ticker=AAPL` | Per-ticker: next earnings + estimates, ex-div dates, earnings history, split history |
| `POST` | `/api/export` `{"tickers": [...]}` | Streams a multi-ticker `.xlsx` workbook |
| `POST` | `/api/export_deepdive` `{"ticker": "AAPL"}` | Streams a single-company `.xlsx` workbook |
| `POST` | `/api/cache/clear` | Clears the server-side TTL cache |

Responses are cached in memory (screener rows: 30 min; deep-dive: 10 min;
price history: 10 min; financials: 30 min; dividends: 30 min) to avoid
hammering Yahoo Finance on every request.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `yfinance >= 1.4.1` | All market data |
| `pandas` | Data manipulation (pulled in by yfinance) |
| `openpyxl >= 3.1.0` | Excel `.xlsx` export |
| `lxml >= 4.9.0` | Parses the per-ticker earnings-history table (Calendar tab) |

The frontend has **zero JavaScript dependencies** — no npm, no build step.

---

## Notes

- **Data source** — all data comes from Yahoo Finance via `yfinance`, intended
  for research and educational use. Fields are occasionally missing or delayed;
  the UI renders those as **N/A** rather than failing.
- **WACC** — cost of equity uses CAPM (10-year US Treasury yield + Beta × 5.5%
  ERP); cost of debt is derived from interest expense ÷ total debt and falls
  back to the risk-free rate when interest expense is unavailable.
- **Dividend growth** — computed as the CAGR of completed-calendar-year
  dividend totals (requires ≥ 4 years of history for 3Y CAGR, ≥ 6 for 5Y;
  otherwise N/A).
- **Performance** — price-only returns (split-adjusted, dividend-unadjusted).
  Total return for dividend payers is higher than shown.
- **Watchlist and settings** — stored in your browser's `localStorage`.
  Clearing site data resets them.
- **Altman Z-Score** — designed for manufacturers; unreliable for banks and
  financials (shown as N/A when inputs do not fit the model).
