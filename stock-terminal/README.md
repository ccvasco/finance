# 📈 Stock Terminal

A self-contained stock-analysis app powered by **yfinance**, with a dark
financial-terminal UI. No heavy web frameworks — the backend is a single
Python stdlib `http.server`, and the frontend is plain HTML/CSS/JS with
hand-rolled SVG charts (no CDN, no build step).

![sidebar: Dashboard · Screener · Watchlist · Settings](doc-placeholder)

## Features

- **Multi-ticker input** — comma/space separated (e.g. `AAPL, MSFT, NVDA`).
- **Screener / compare table** — a wide, data-dense grid:
  - *Valuation*: P/E, Forward P/E, PEG, P/B, P/S, P/C, P/FCF, EV/EBITDA, EPS.
  - *Profitability*: Income, Profit Margin, FCF, ROA, ROE, ROIC.
  - *Health*: Debt/Eq, LT Debt/Eq.
  - *Dividend*: Yield, 5Y Avg Yield, Div Estimate, Div TTM, Payout Ratio,
    **FCF Coverage** (Free Cash Flow ÷ Dividends Paid), years of consecutive
    dividend increases.
  - *Performance excluding dividends* (price only): YTD, 1Y, 3Y, 5Y, 10Y.
  - Plus Market Cap and Industry.
  - **FCF Coverage is color-banded**: 🟢 green ≥ 1.2× · 🟡 yellow 0.8–1.2× ·
    🔴 red < 0.8×.
  - Sticky headers + sticky first column, click-to-sort any column, live text
    filter. Missing data shows **N/A**; loading shows spinners.

  > Some columns (ROIC, LT Debt/Eq, FCF Coverage, consecutive-increase years,
  > and the performance windows) are computed from financial statements and
  > dividend-unadjusted price history, so the first screener fetch for a fresh
  > set of tickers takes a few seconds. Tickers are fetched concurrently and
  > heavy pulls are cached for ~30 min.
- **Deep dive** (click any ticker) — Valuation, Dividend (incl. **ex-date** and
  **3Y/5Y dividend growth CAGR**), Profitability, and Financial Health panels,
  a **Revenue vs Net Income** bar chart, an interactive **price chart** with
  range tabs, an **Earnings & Splits Calendar** panel (next earnings date with
  EPS/revenue estimates, ex-dividend/dividend dates, recent earnings surprises,
  and the full split history), and full **Income Statement / Balance Sheet /
  Cash Flow** statements (annual + quarterly).
- **Calendar tab** — a market-wide upcoming-events calendar grouped by date,
  with **Earnings** (ticker, company, market cap, timing, EPS estimate vs.
  reported, surprise %) and **Stock Splits** (ratio, forward/reverse, optionable)
  sub-tabs, over a *Next 7 / 14 / 30 days* window. Click any row to open the
  deep dive.
- **Excel export** — any screener or watchlist set to `.xlsx` with one sheet per
  data type: **Metrics**, **Price History**, **Financials**.
- **Watchlist** — saved to `localStorage`, auto-saved on every add/remove, and
  hydrated into the UI immediately on load.
- **App shell** — sidebar navigation (Dashboard, Screener, Calendar, Watchlist,
  Settings), dark mode, data-dense, desktop-optimized and responsive.

## Run it

From the **repository root** (so the in-repo `yfinance` is importable):

```bash
pip install openpyxl
source /home/vc/yfinance/venv/bin/activate          
python stock-terminal/app.py
```
`kill 40918`

Then open <http://127.0.0.1:8765> in your browser.

Options:

```bash
python stock-terminal/app.py --port 9000 --host 0.0.0.0
```

> A backend is required because data comes from yfinance (Python). A pure
> `npx serve` of the `static/` folder will render the UI but can't fetch data —
> run `app.py`, which both serves the frontend and provides the JSON API.

## How it works

```
stock-terminal/
├── app.py              # stdlib HTTP server: JSON API + static files + xlsx export
├── requirements.txt
└── static/
    ├── index.html      # app shell (sidebar + topbar + view root)
    ├── css/styles.css  # dark terminal theme
    └── js/
        ├── api.js      # fetch wrappers + number/price/percent formatters
        ├── store.js    # localStorage watchlist + settings (auto-save/hydrate)
        ├── charts.js   # dependency-free SVG line + grouped-bar charts
        ├── views.js    # Screener, Watchlist, Dashboard, Calendar, Settings, Deep-dive
        └── app.js      # router, init, top-bar wiring, Excel export
```

### API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/screener?tickers=AAPL,MSFT` | comparison metrics per ticker |
| GET | `/api/deepdive?ticker=AAPL` | panels + revenue/net-income series |
| GET | `/api/history?ticker=AAPL&range=1y` | price history points |
| GET | `/api/financials?ticker=AAPL&stmt=income\|balance\|cashflow&freq=annual\|quarterly` | statement table |
| GET | `/api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=80` | market-wide upcoming earnings + stock splits |
| GET | `/api/stock_calendar?ticker=AAPL` | per-ticker next earnings/estimates, ex-div dates, earnings history, split history |
| POST | `/api/export` `{tickers:[...]}` | streams an `.xlsx` workbook |
| POST | `/api/cache/clear` | clears the server-side TTL cache |

Responses are cached in-memory with short TTLs to avoid hammering Yahoo.

## Notes & limits

- Data is from Yahoo! Finance via yfinance — for research/educational use, and
  subject to Yahoo's terms. Fields are occasionally missing; the UI renders
  those as **N/A** rather than failing.
- Dividend growth is computed as the CAGR of completed-calendar-year dividend
  totals (needs ≥ 4 years of history for 3Y, ≥ 6 for 5Y; otherwise N/A).
- The watchlist lives in your browser's `localStorage`; clearing site data
  resets it. Settings (accent color, default tickers, default range) persist the
  same way.
