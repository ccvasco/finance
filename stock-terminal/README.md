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
| **Strategy grades** | S1 Triage, S2 Compounder, S3 Defensive, Strat Min — each stock scored 0–100 against the three long-term strategy docs (see below), color-coded by decision band — plus S1 Flags, the triage context warnings (🔺 priced for perfection, 💰 payout stress, 📉 crowded short, …) |
| **Valuation** | P/E, Forward P/E, PEG, P/B, P/S, P/C, P/FCF, EV/EBITDA, DCF Value, DCF Upside, Diluted EPS, Basic EPS |
| **Profitability** | Net Income, Profit Margin, Gross Margin, Operating Margin, EBITDA Margin, FCF, ROA, ROE, ROIC, ROCE, WACC, Revenue/Share |
| **Financial Health** | Total Cash, Total Debt, Total Equity, Debt/Equity, Debt/EBITDA, LT Debt/Equity, Current Ratio, Quick Ratio, EBITDA, EBITDA/FCF |
| **Dividend** | Yield, 5Y Avg Yield, Div Estimate, Div TTM, Payout Ratio, FCF Coverage, Div Growth 3Y/5Y CAGR, Years of consecutive increases, Ex-Dividend Date |
| **Risk** | Beta, Short Interest %, Days to Cover, Altman Z-Score, Piotroski F-Score |
| **Performance** | Price-only return (excl. dividends): YTD, 1Y, 3Y, 5Y, 10Y |

FCF Coverage is color-coded: green ≥ 1.2× · yellow 0.8–1.2× · red < 0.8×.

**DCF Value.** An inferred fair value per share from a 10-year two-stage FCFF
DCF — latest FCF grown at the company's own historical FCF CAGR (clamped
0–20%), fading linearly to 2.5% terminal growth, discounted at the row's
WACC. It sits **next to Price**, colored green when the model reads the stock
as undervalued and red when overvalued; hover the cell for the exact upside %
versus price (a small legend rides along). N/A for financials and REITs, where
an FCF model doesn't fit the business. Assumption-heavy by construction: treat
it as a screen, not a target price. Full methodology in
[METRICS.md](METRICS.md) §2.

**Strategy grades.** Every row is graded (0–100, server-side) against three
long-term investing strategies, each documented in this directory:

1. **S1 Triage** — [stock-triage-strategy.md](stock-triage-strategy.md): data
   hygiene → hard kill-switches → quality score. ≥65 Advance · 45–64 Watchlist
   · <45 Discard. N/A = quarantined (missing critical data).
2. **S2 Compounder** — [strategy-2-quality-compounder.md](strategy-2-quality-compounder.md):
   returns on capital, margin moat, discipline, compounding track record.
   ≥70 Compounder · 50–69 Quality watch · <50 Pass.
3. **S3 Defensive** — [strategy-3-defensive-value.md](strategy-3-defensive-value.md):
   Graham-style margin of safety. ≥70 Value candidate · 50–69 Fair · <50 Expensive/weak.

**Strat Min** is the minimum of the three — sort it descending to find the
stocks rated best under *every* strategy at once. **S1 Flags** carries the
triage framework's never-disqualifying context flags (priced for perfection,
suspiciously cheap, low Altman-Z, low Piotroski, divergent multiples, payout
stress, crowded short, high beta, plus data-sanity warnings) so the deep dive
starts with eyes open. The grades and flags also appear in both Excel exports
and as a **Strategy Ratings** panel in the deep dive.

**Business-type aware.** A metric that disqualifies one business model is
often meaningless for another, so every stock is classified into one of six
archetypes — capital-intensive (default), cyclical, asset-light, financial,
REIT, and mortgage REIT — and each strategy substitutes the metrics that
actually fit. Financials get an ROE/net-margin rubric instead of Altman-Z and
leverage kills; REITs get an FFO-based rubric; **mortgage REITs** (leveraged
mortgage-securities portfolios, not property owners) get their own rubric
built on dividend coverage, price-to-book, leverage, and book-value-per-share
trend — the last being the single best signal of whether an mREIT is
compounding or quietly paying its dividend out of capital. Full table:
[stock-triage-strategy.md § Business-type archetypes](stock-triage-strategy.md#business-type-archetypes).

**Hover any grade to see how it was derived** — the tooltip shows a per-pillar
breakdown (points earned / available, and the metric values behind each), so
a 48 or an N/A is never a black box. The breakdown is computed alongside the
score itself, so it can never disagree with the number. Hovering the S1 Flags
cell lists every flag in full when the cell is too narrow to show them all.

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

**Cache-first loading.** The Dashboard and Watchlists render every ticker with
cached data instantly and automatically fetch only the missing ones, with a
live "N cached · loading x/y more…" status. The row cache is persisted to
`localStorage` (survives page reloads) and rows are reused per ticker across
sets, so already-seen tickers are never re-downloaded just by navigating.
**↻ Refresh** is the only thing that re-fetches data you already have; the
Screener fetches only on **Analyze** or **↻ Refresh**.

**Failure isolation.** A ticker that errors (delisted, no Yahoo data, rate
limited) renders as an inline error row — it never blocks the rest. If a whole
batch fails (e.g. Yahoo throttling a very large set), its tickers show as
error rows and the remaining batches keep loading; the status line reports the
failed batches and **↻ Refresh** retries them. Partial results are never
cached, so a retry always re-fetches.

**↻ Refresh.** Every data view — Dashboard, Screener, a loaded watchlist,
Calendar, and the deep-dive — has a **↻ Refresh** button that bypasses both the
browser cache and the server's Yahoo cache, re-pulling fresh data in place (no
need to go back and re-Analyze). A deep-dive refresh touches **only that
ticker**: it reloads the panels, charts, statements, and calendar, and syncs
the ticker's row into the screener/dashboard/watchlist tables — the rest of
the set is untouched, so returning to a large table is instant.

### Deep dive
Click any ticker row to open a full analysis page:

- **Metric panels** — Valuation, Dividend (incl. 3Y/5Y growth CAGR and ex-date), Profitability, Financial Health, Risk, and **Strategy Ratings** (the three strategy grades + min, with verdicts and the S1 context flags).
- **Company Profile** — what the company is and does (Yahoo business summary), headquarters, website, employees, sector/industry, exchange. In the screener and watchlist tables the same blurb appears when hovering a ticker cell.
- **Ethics & Controversies** — the controversy/criticism-type sections of the company's Wikipedia article (labor practices, environmental record, lawsuits, human-rights concerns, …) with a link to the full article. Community-written content — verify independently. Empty when the article has no such sections.
- **Revenue · Profit · Net Income · FCF** — 5-year bar chart with margin % on hover.
- **Growth YoY** — Revenue, EPS, and EBITDA growth bars plus an EBITDA Margin line.
- **Share Dilution** — shares outstanding/float/treasury bars with yield and payout-ratio lines.
- **Interactive price chart** — 1W / 1M / 3M / 6M / 1Y / 3Y / 5Y range tabs.
- **Earnings & Splits Calendar** — next earnings date with EPS/revenue estimates, ex-dividend / dividend dates, last 12 quarters of earnings surprises, full split history.
- **Financial statements** — Income Statement, Balance Sheet, Cash Flow (annual and quarterly), with a TTM/MRQ column prepended.
- **Excel export** — download a single-company workbook (Overview, Charts Data, and all three statements).
- **DCF export** — a second, DCF-specific workbook (`TICKER-DCF-*.xlsx`) that is a **live spreadsheet model** of the screener's DCF Value: inputs as values, and every downstream cell (growth fade, projected cash flows, discount factors, present values, terminal value, WACC composition, and the enterprise → equity → per-share bridge) as an actual Excel formula — so you can trace each number and tweak an assumption to watch it recompute. The button appears only for stocks that get a DCF (not financials/REITs).

### Calendar tab
Market-wide upcoming events over a *Next 7 / 14 / 30 days* window:

- **Earnings** — ticker, company, market cap, timing (BMO/AMC), EPS estimate vs. reported, surprise %.
- **Stock Splits** — ratio, forward/reverse flag, optionable.

Click any row to open the deep dive.

### Watchlist
Saved to `localStorage`; auto-saved on every add/remove and hydrated on load.
Selecting a list is **cache-first**: every ticker with data anywhere in the
cache renders instantly, and only the missing ones are fetched (with a live
"N cached · loading x/y more…" status). **↻ Refresh** is only needed for
up-to-date data — it re-fetches the whole list fresh from Yahoo.
The header also has an inline editor: type one or more tickers (comma or
space separated) and hit **+ Add** or **− Remove** to bulk-edit the list in
place — Enter adds. Works for named lists and the ★ Starred list alike;
newly added tickers are fetched automatically.

### Analyst Chat
A chat agent (Claude, via the official `anthropic` SDK) that analyses **your**
data, available as a **floating ✦ bubble on every tab** (bottom-right) rather
than a page of its own. Whatever tab you're on — Screener, a Watchlist, the
Dashboard — the rows currently shown there are attached to the conversation as
context (toggleable), so you can ask things like *"rank these by
quality-at-a-reasonable-price and flag the risks"* and get answers grounded in
the exact rows on screen, strategy grades and flags included. Replies stream in
live, with markdown (tables, bold, code) rendered in the bubble.

- **Follows you across tabs.** The bubble is mounted once and the conversation
  persists as you navigate; each message is answered against the *current*
  tab's snapshot (the agent is told which tab it's looking at, so it handles a
  mid-conversation context switch cleanly). History is saved to `localStorage`,
  so it also survives a reload — **🗑 Clear** starts fresh.
- Needs credentials on the **server**: set the `ANTHROPIC_API_KEY` environment
  variable before starting `app.py`. Without it the chat shows a clear error
  and everything else keeps working.
- Model: `claude-opus-4-8` by default; override with the
  `STOCK_TERMINAL_CHAT_MODEL` environment variable.
- Context is capped at 100 stocks per turn (the largest sets get expensive);
  the agent is told when rows were truncated. Static instructions and the row
  snapshot are prompt-cached, so follow-up turns on the same tab are cheap.

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
- **Download backup** — saves every watchlist, starred ticker, setting and column
  layout to a JSON file. Contents come from the server, so the file matches what
  every browser sees, not just the tab you clicked in.
- **Restore from backup** — loads such a file back, replacing what's in the app.
  The file is validated before anything changes (a non-backup is rejected with an
  explanation and no side effects), you're shown what it holds and asked to
  confirm, and the state being replaced is snapshotted to `state-backups/` first —
  so restoring the wrong file is itself undoable.

Settings persist server-side in `state.json`, cached in `localStorage`.

---

## Quick start

```bash
source /home/vc/yfinance/venv/bin/activate
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

Server already in use:
```bash
sudo ss -ltnp | grep ':8765'
sudo kill <PID>
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
├── strategies.py           # strategy graders (pure functions over screener rows)
├── chat.py                 # Analyst Chat agent (/api/chat, anthropic SDK)
├── requirements.txt
├── METRICS.md              # plain-language guide to every metric and how to read it
├── SCREENER_COLUMNS.md     # column reference for the screener table
├── stock-triage-strategy.md          # Strategy 1 — Triage
├── strategy-2-quality-compounder.md  # Strategy 2 — Quality Compounder
├── strategy-3-defensive-value.md     # Strategy 3 — Defensive Value
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
| `POST` | `/api/export_dcf` `{"ticker": "AAPL"}` | Streams the DCF-valuation `.xlsx` workbook (all inputs + projection + bridge) |
| `POST` | `/api/cache/clear` | Clears the server-side TTL cache |
| `POST` | `/api/chat` `{"messages": [...], "rows": [...], "context_label": "Screener"}` | Analyst Chat — streams the agent's reply as Server-Sent Events (`{"text": …}` chunks, then `{"done": …}` or `{"error": …}`); `rows`/`context_label` are the current tab's snapshot |

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
| `anthropic >= 0.116.0` | Analyst Chat (`/api/chat`); needs `ANTHROPIC_API_KEY` at runtime |

The frontend has **zero JavaScript dependencies** — no npm, no build step.

---

## Notes

- **Data source** — all data comes from Yahoo Finance via `yfinance`, intended
  for research and educational use. Fields are occasionally missing or delayed;
  the UI renders those as **N/A** rather than failing.
- **WACC** — cost of equity uses CAPM (10-year US Treasury yield + Beta × 5.5%
  ERP); cost of debt is derived from interest expense ÷ total debt and falls
  back to the risk-free rate when interest expense is unavailable. The 5.5%
  ERP is a fixed US-market estimate (Damodaran), applied to every ticker
  regardless of domicile — it understates the true cost of equity for foreign
  (especially emerging-market) names. The deep dive's "ROIC vs Cost of
  Capital" chart shows WACC **historically**, reconstructing every input except
  beta (frozen at today's value) per fiscal year, rather than repeating today's
  WACC as a flat line. See [METRICS.md](METRICS.md) §3 and §8.
- **Foreign-reporting tickers (ADRs)** — a stock like WIT trades in USD but
  reports its financials in INR. Price/Market Cap/Diluted EPS show in the
  trading currency; Enterprise Value, Revenue, Cash, Debt, Equity, EBITDA, Net
  Income, FCF, Basic EPS and Dividend TTM show in the reporting currency, and
  every ratio that combines the two (EV/EBITDA, P/S, P/Cash, P/FCF, WACC,
  Altman Z) is computed from a currency-converted market cap rather than
  Yahoo's own (frequently broken, for these tickers) cross-currency fields.
  See [METRICS.md](METRICS.md) §11.
- **Dividend growth** — computed as the CAGR of completed-calendar-year
  dividend totals (requires ≥ 4 years of history for 3Y CAGR, ≥ 6 for 5Y;
  otherwise N/A).
- **Performance** — price-only returns (split-adjusted, dividend-unadjusted).
  Total return for dividend payers is higher than shown.
- **Watchlist and settings** — the server's `state.json` is the shared source of
  truth, mirrored into each browser's `localStorage` as a cache. Every write
  snapshots the previous state into `state-backups/` (newest 20). Both paths are
  gitignored and live on one disk, so use **Settings → Download backup** for
  anything you'd hate to lose.
- **Altman Z-Score** — designed for manufacturers; ignored entirely for
  financials, REITs and mortgage REITs (structurally meaningless for
  balance-sheet businesses), and softened to an advisory flag rather than a
  hard kill for asset-light and cyclical names. See [business-type
  archetypes](stock-triage-strategy.md#business-type-archetypes).
