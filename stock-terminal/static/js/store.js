/* store.js — localStorage-backed watchlist + settings + last screener set.
   Auto-saves on every mutation; hydrated synchronously on load. */
const Store = (() => {
  const KEYS = { wl: "st.watchlist", settings: "st.settings", last: "st.lastTickers" };

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

    // -- settings ----------------------------------------------------------
    getSettings: () => Object.assign({}, settings),
    setSetting(k, v) { settings[k] = v; write(KEYS.settings, settings); notify(); },
  };
})();
