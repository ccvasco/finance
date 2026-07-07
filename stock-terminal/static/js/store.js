/* store.js — localStorage-backed watchlist + settings + last screener set.
   Auto-saves on every mutation; hydrated synchronously on load. */
const Store = (() => {
  const KEYS = {
    wl: "st.watchlist", settings: "st.settings", last: "st.lastTickers",
    lists: "st.lists", rows: "st.rowsCache", chat: "st.chatHistory",
  };
  const CHAT_MAX = 60;   // keep the last N messages (agent context is capped too)

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
  }

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
  // Named watchlists: [{ id, name, tickers:[...], createdAt, updatedAt }]
  let lists = read(KEYS.lists, []);

  const genId = () => "wl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const cloneList = (l) => ({ ...l, tickers: l.tickers.slice() });

  const listeners = [];
  const notify = () => listeners.forEach((fn) => fn());

  return {
    onChange(fn) { listeners.push(fn); },

    // -- watchlist ---------------------------------------------------------
    getWatchlist: () => watchlist.slice(),
    inWatchlist: (t) => watchlist.includes(t.toUpperCase()),
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
      const trimmed = (history || []).slice(-CHAT_MAX);
      try { localStorage.setItem(KEYS.chat, JSON.stringify(trimmed)); }
      catch { try { localStorage.removeItem(KEYS.chat); } catch {} }
    },

    // -- settings ----------------------------------------------------------
    getSettings: () => Object.assign({}, settings),
    setSetting(k, v) { settings[k] = v; write(KEYS.settings, settings); notify(); },
  };
})();
