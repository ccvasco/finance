---
name: verify
description: Build, launch and drive Bibes Terminal (stock-terminal) to observe a change at its real surface — the browser UI and the HTTP API.
---

# Verifying stock-terminal changes

The app is a stdlib `ThreadingHTTPServer` (`app.py`) serving a JSON API plus a
static vanilla-JS frontend (`static/js/{app,views,store,api,charts}.js`). No
build step, no bundler — edit a file, reload the page.

## Launch

```bash
cd stock-terminal
python3 app.py --port 8791 > /tmp/server.log 2>&1 &
curl -s http://127.0.0.1:8791/api/health      # readiness gate
```

Pick a non-default port (not 8765) so you don't collide with the user's own
running instance. `openpyxl` and `playwright` are both installed in the venv.

## Drive the API

Every endpoint is POST-with-JSON except `/api/health`:

```bash
curl -s -X POST http://127.0.0.1:8791/api/export \
  -H 'Content-Type: application/json' \
  -d '{"tickers":["AAPL","MSFT"]}' -o out.xlsx
```

`/api/screener`, `/api/deepdive`, `/api/export`, `/api/export_deepdive`,
`/api/export_dcf`, `/api/cache/clear`. Live calls hit Yahoo — a 3-ticker
export takes ~10-30s cold, seconds once `app.py`'s process cache is warm.

## Drive the UI

Playwright + chromium works headless. The frontend keeps **all** its state in
localStorage, so you can put the app in any state without clicking through it:

| Key | Holds |
|---|---|
| `st.watchlist` | starred tickers — the dashboard shows these when non-empty |
| `st.lastTickers` | last Analyze set — dashboard falls back to it ("Recently analyzed") |
| `st.colOrder` | user's dragged column order (list of COLS keys) |
| `st.colWidths`, `st.rowsCache`, `st.lists`, `st.settings` | see `store.js` |

Set them, then `page.reload()` — `App.init` hydrates from storage on
DOMContentLoaded:

```python
page.goto("http://127.0.0.1:8791")
page.evaluate("""() => localStorage.setItem("st.watchlist",
                   JSON.stringify(["AAPL","MSFT","NVDA"]))""")
page.reload()
page.wait_for_selector("#dash-table")
page.wait_for_timeout(2500)          # rows paint async, cache-first then fetch
page.click('.nav-item[data-view="screener"]')   # nav: dashboard|screener|calendar|watchlist|settings
```

Useful hooks: `#export-btn`, `#dash-refresh`, `#dash-table`, `#view-root thead th`,
`.nav-item[data-view=…]`, `.panel-head`, `.view-title`.

To assert on what the UI *sends* without waiting on Yahoo, intercept the route
and stub the reply — this is the cheapest way to check export/analyze payloads:

```python
page.route("**/api/export", lambda r: (
    captured.append(json.loads(r.request.post_data)),
    r.fulfill(status=200, content_type="application/json", body='{"error":"stub"}')))
```

## Gotchas

- **Table `<th>` carry no `data-key`** — only the uppercased COLS label text,
  with a `▼`/`▲` sort arrow appended on the active sort column. Map back to keys
  via the `label` fields in views.js `COLS`; don't compare labels to keys.
- **Rows render sorted** (default Mkt Cap desc), so on-screen row order is not
  the ticker order the frontend posts to `/api/export`.
- The dashboard renders **cache-first**: it paints `loading…` rows, then fills
  in. Wait for real values before asserting on cell text; `↻ Refresh` forces a
  full re-fetch.
- `_METRIC_COLS` (app.py) is meant to mirror `COLS` (views.js) — the export is
  server-side and receives only `{tickers}`, so it cannot follow `st.colOrder`.
