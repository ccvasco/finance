/* store.js — localStorage-backed watchlist + settings + last screener set.
   Auto-saves on every mutation; hydrated synchronously on load. */
const Store = (() => {
  const KEYS = {
    wl: "st.watchlist", settings: "st.settings", last: "st.lastTickers",
    lists: "st.lists",
  };

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
    { accent: "green", defaultTickers: "AAPL, MSFT, NVDA, GOOGL, AMZN", range: "1y" },
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
    deleteList(id) { lists = lists.filter((x) => x.id !== id); write(KEYS.lists, lists); notify(); },

    // -- settings ----------------------------------------------------------
    getSettings: () => Object.assign({}, settings),
    setSetting(k, v) { settings[k] = v; write(KEYS.settings, settings); notify(); },
  };
})();
