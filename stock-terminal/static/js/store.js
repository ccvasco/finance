/* store.js — watchlist + settings + last screener set, persisted server-side
   (GET/POST /api/state) with localStorage as a synchronous local cache.

   Why both: localStorage alone is scoped per browser origin and storage
   partition, so the VSCode Simple Browser webview, Chrome, and localhost vs
   127.0.0.1 each kept a *separate* set of watchlists. The server file is the
   shared source of truth; localStorage still hydrates the UI instantly on load
   and keeps it working if the server is unreachable.

   Auto-saves on every mutation: writes hit localStorage synchronously and are
   pushed to the server on a short debounce. With two clients open, the last
   write of a given key wins — there's no merge. */
const Store = (() => {
  const KEYS = {
    wl: "st.watchlist", settings: "st.settings", last: "st.lastTickers",
    lists: "st.lists", rows: "st.rowsCache", chat: "st.chatHistory",
    colw: "st.colWidths", colorder: "st.colOrder",
  };
  const CHAT_MAX = 60;   // keep the last N messages (agent context is capped too)

  // Keys mirrored to the server. Everything durable syncs; the screener row
  // cache does not — it's megabytes of refetchable data whose whole job is to
  // make *this* browser's reloads fast.
  const SYNCED = new Set([
    KEYS.wl, KEYS.settings, KEYS.last, KEYS.lists, KEYS.chat,
    KEYS.colw, KEYS.colorder,
  ]);
  const PUSH_DEBOUNCE = 400;   // ms

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
    if (SYNCED.has(key)) markDirty(key, val);
  }

  // -- server sync ---------------------------------------------------------
  const pending = new Map();   // storage key → latest value awaiting a push
  let pushTimer = null;

  function markDirty(key, val) {
    pending.set(key, val);
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, PUSH_DEBOUNCE);
  }

  async function push() {
    if (!pending.size) return;
    const batch = Object.fromEntries(pending);
    pending.clear();
    try {
      await API.putState(batch);
    } catch {
      // Server unreachable — keep the values queued (without clobbering any
      // newer write that landed meanwhile) so the next mutation retries them.
      Object.entries(batch).forEach(([k, v]) => { if (!pending.has(k)) pending.set(k, v); });
    }
  }
  // Don't lose the last few hundred ms of edits when the tab closes.
  window.addEventListener("pagehide", () => {
    if (!pending.size) return;
    const body = JSON.stringify({ state: Object.fromEntries(pending) });
    navigator.sendBeacon("/api/state", new Blob([body], { type: "application/json" }));
    pending.clear();
  });

  // hydrate immediately
  let watchlist = read(KEYS.wl, []);
  let settings = Object.assign(
    {
      accent: "green", defaultTickers: "AAPL, MSFT, NVDA, GOOGL, AMZN", range: "1y",
      zoom: 100,          // whole-app UI zoom, percent (Ctrl +/- or topbar controls)
      // screener fetch tuning
      batchSize: 20,      // tickers per request when analyzing many at once
      batchDelay: 400,    // ms pause between batches
      cacheSets: 25,      // how many analyzed ticker-sets to keep cached
    },
    read(KEYS.settings, {})
  );
  let lastTickers = read(KEYS.last, []);
  // Screener/watchlist column widths in px, keyed by COLS key: { pe: 90, ... }.
  // Empty until the user first drags a header edge, which freezes every
  // column's then-current width at once (see Views' column-resize wiring).
  let colWidths = read(KEYS.colw, {});
  // Screener/watchlist column order as a list of COLS keys: ["ticker", "pe", ...].
  // Empty until the user first drags a header, and never authoritative on its
  // own — Views reconciles it against COLS, which may have gained or dropped
  // columns since it was saved.
  let colOrder = read(KEYS.colorder, []);
  // Named watchlists: [{ id, name, tickers:[...], createdAt, updatedAt }]
  let lists = read(KEYS.lists, []);

  const genId = () => "wl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const cloneList = (l) => ({ ...l, tickers: l.tickers.slice() });

  const listeners = [];
  const notify = () => listeners.forEach((fn) => fn());

  // Adopt a {storageKey: value} map from the server into memory + localStorage.
  function applyState(state) {
    const has = (k) => Object.prototype.hasOwnProperty.call(state, k);
    if (has(KEYS.wl)) watchlist = state[KEYS.wl] || [];
    if (has(KEYS.lists)) lists = state[KEYS.lists] || [];
    if (has(KEYS.last)) lastTickers = state[KEYS.last] || [];
    if (has(KEYS.colw)) colWidths = state[KEYS.colw] || {};
    if (has(KEYS.colorder)) colOrder = state[KEYS.colorder] || [];
    if (has(KEYS.settings)) settings = Object.assign(settings, state[KEYS.settings] || {});
    // Mirror into localStorage so a later offline load still has it, but skip
    // write() — these values came *from* the server, pushing them back is noise.
    Object.entries(state).forEach(([k, v]) => {
      if (!SYNCED.has(k)) return;
      try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
    });
  }

  /* Pull shared state from the server. Call once before the first render.

     Server wins when it has anything: it's the one view every browser shares.
     When it's empty (first run after this feature landed) we push whatever
     this browser already had in localStorage, which migrates an existing
     VSCode-webview or single-browser setup up to the server instead of
     silently dropping it. */
  async function hydrate() {
    let state;
    try {
      state = await API.getState();
    } catch {
      return;   // server down — carry on with the localStorage hydration
    }
    if (Object.keys(state).length) {
      applyState(state);
    } else {
      const local = {};
      SYNCED.forEach((k) => {
        const v = read(k, null);
        if (v != null) local[k] = v;
      });
      if (Object.keys(local).length) {
        try { await API.putState(local); } catch {}
      }
    }
    notify();
  }

  return {
    hydrate,
    onChange(fn) { listeners.push(fn); },

    // -- watchlist ---------------------------------------------------------
    getWatchlist: () => watchlist.slice(),
    inWatchlist: (t) => watchlist.includes(t.toUpperCase()),
    // True if the ticker sits in ANY list — the flat ★ Starred set or any
    // named watchlist. Drives whether the row's star renders filled.
    inAnyList: (t) => {
      t = t.toUpperCase();
      return watchlist.includes(t) || lists.some((l) => l.tickers.includes(t));
    },
    toggleWatch(t) {
      t = t.toUpperCase();
      const i = watchlist.indexOf(t);
      if (i >= 0) watchlist.splice(i, 1);
      else watchlist.push(t);
      write(KEYS.wl, watchlist);   // auto-save on every add/remove
      notify();
      return watchlist.includes(t);
    },
    removeWatch(t) {
      t = t.toUpperCase();
      watchlist = watchlist.filter((x) => x !== t);
      write(KEYS.wl, watchlist);
      notify();
    },
    clearWatchlist() { watchlist = []; write(KEYS.wl, watchlist); notify(); },

    // -- last analyzed tickers --------------------------------------------
    getLastTickers: () => lastTickers.slice(),
    setLastTickers(arr) { lastTickers = arr.slice(); write(KEYS.last, lastTickers); },

    // -- named watchlists --------------------------------------------------
    getLists: () => lists.map(cloneList),
    getList: (id) => { const l = lists.find((x) => x.id === id); return l ? cloneList(l) : null; },
    findListByName: (name) => {
      const n = (name || "").trim().toLowerCase();
      const l = lists.find((x) => x.name.toLowerCase() === n);
      return l ? cloneList(l) : null;
    },
    // Create, or overwrite the same-named list. Returns the saved list.
    saveList(name, tickers) {
      name = (name || "").trim();
      const existing = lists.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.tickers = tickers.slice();
        existing.updatedAt = Date.now();
        write(KEYS.lists, lists); notify();
        return cloneList(existing);
      }
      const l = { id: genId(), name, tickers: tickers.slice(), createdAt: Date.now() };
      lists.push(l);
      write(KEYS.lists, lists); notify();
      return cloneList(l);
    },
    renameList(id, name) {
      const l = lists.find((x) => x.id === id);
      if (l) { l.name = (name || "").trim(); l.updatedAt = Date.now(); write(KEYS.lists, lists); notify(); }
    },
    // Append tickers (deduplicated, uppercased) to a list. Returns the updated
    // list, or null if the id doesn't exist.
    addToList(id, tickers) {
      const l = lists.find((x) => x.id === id);
      if (!l) return null;
      const seen = new Set(l.tickers);
      (tickers || []).forEach((t) => {
        t = String(t).trim().toUpperCase();
        if (t && !seen.has(t)) { seen.add(t); l.tickers.push(t); }
      });
      l.updatedAt = Date.now();
      write(KEYS.lists, lists); notify();
      return cloneList(l);
    },
    // Remove tickers from a list. Returns the updated list, or null if the id
    // doesn't exist.
    removeFromList(id, tickers) {
      const l = lists.find((x) => x.id === id);
      if (!l) return null;
      const drop = new Set((tickers || []).map((t) => String(t).trim().toUpperCase()));
      l.tickers = l.tickers.filter((t) => !drop.has(t));
      l.updatedAt = Date.now();
      write(KEYS.lists, lists); notify();
      return cloneList(l);
    },
    deleteList(id) { lists = lists.filter((x) => x.id !== id); write(KEYS.lists, lists); notify(); },

    // -- persisted screener rows (so cached tables survive page reloads) ----
    // entries: [[setKey, rows], ...] in oldest→newest order.
    getRowsCache: () => read(KEYS.rows, []),
    setRowsCache(entries) {
      try {
        localStorage.setItem(KEYS.rows, JSON.stringify(entries));
      } catch {
        // Quota exceeded — retry with only the newest few sets, else drop.
        try {
          localStorage.setItem(KEYS.rows, JSON.stringify(entries.slice(-5)));
        } catch {
          try { localStorage.removeItem(KEYS.rows); } catch {}
        }
      }
    },

    // -- analyst-chat history (survives reloads; capped) -------------------
    getChatHistory() {
      const h = read(KEYS.chat, []);
      return Array.isArray(h) ? h : [];
    },
    setChatHistory(history) {
      write(KEYS.chat, (history || []).slice(-CHAT_MAX));
    },

    // -- column widths -----------------------------------------------------
    getColWidths: () => Object.assign({}, colWidths),
    // Merge `widths` ({key: px}) over the stored map. Callers pass only what
    // changed; a null value drops a column back to auto sizing.
    setColWidths(widths) {
      Object.entries(widths).forEach(([k, v]) => {
        if (v == null) delete colWidths[k];
        else colWidths[k] = Math.round(v);
      });
      write(KEYS.colw, colWidths);
      notify();
    },
    resetColWidths() { colWidths = {}; write(KEYS.colw, colWidths); notify(); },

    // -- column order ------------------------------------------------------
    getColOrder: () => colOrder.slice(),
    setColOrder(keys) { colOrder = keys.slice(); write(KEYS.colorder, colOrder); notify(); },
    resetColOrder() { colOrder = []; write(KEYS.colorder, colOrder); notify(); },

    // -- settings ----------------------------------------------------------
    getSettings: () => Object.assign({}, settings),
    setSetting(k, v) { settings[k] = v; write(KEYS.settings, settings); notify(); },
  };
})();
