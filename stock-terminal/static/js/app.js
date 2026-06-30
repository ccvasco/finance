/* app.js — router, init, top-bar wiring. Hydrates UI from Store on load. */
const App = (() => {
  let view = "dashboard";
  let exportTickers = [];

  const root = () => document.getElementById("view-root");

  function setActiveNav() {
    document.querySelectorAll(".nav-item").forEach((n) =>
      n.classList.toggle("active", n.dataset.view === view));
  }

  function go(v) {
    view = v;
    setActiveNav();
    refreshCurrent();
  }

  function currentTickers() {
    return parseTickers(document.getElementById("ticker-input").value);
  }

  function refreshCurrent() {
    const r = root();
    if (view === "dashboard") Views.dashboard(r);
    else if (view === "screener") Views.screener(r, Store.getLastTickers());
    else if (view === "calendar") Views.calendar(r);
    else if (view === "watchlist") Views.watchlist(r);
    else if (view === "settings") Views.settings(r);
    updateWatchCount();
  }

  function parseTickers(str) {
    const out = [], seen = new Set();
    (str || "").replace(/\s+/g, ",").split(",").forEach((t) => {
      t = t.trim().toUpperCase();
      if (t && !seen.has(t)) { seen.add(t); out.push(t); }
    });
    return out;
  }

  function analyze() {
    const tickers = currentTickers();
    if (!tickers.length) { toast("Enter at least one ticker", "err"); return; }
    Store.setLastTickers(tickers);
    setExportTickers(tickers);
    view = "screener";
    setActiveNav();
    Views.screener(root(), tickers);
  }

  function setExportTickers(t) { exportTickers = t.slice(); }

  async function doExport() {
    let t = exportTickers;
    if (!t.length) t = view === "watchlist" ? Store.getWatchlist() : Store.getLastTickers();
    if (!t.length) { toast("Nothing to export — analyze some tickers first", "err"); return; }
    const btn = document.getElementById("export-btn");
    const old = btn.textContent;
    btn.disabled = true; btn.innerHTML = `<span class="spinner" style="width:13px;height:13px"></span> Exporting…`;
    try { await API.exportXlsx(t); toast(`Exported ${t.length} tickers to .xlsx`, "ok"); }
    catch (e) { toast(e.message, "err"); }
    finally { btn.disabled = false; btn.textContent = old; }
  }

  /* Styled modal prompt for a single line of text. Resolves with the trimmed
     value, or null if cancelled/escaped. */
  function modalPrompt({ title = "", label = "", value = "", placeholder = "", confirmText = "Save" } = {}) {
    return new Promise((resolve) => {
      const rootEl = document.getElementById("modal-root");
      const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      rootEl.innerHTML = `
        <div class="modal-overlay">
          <div class="modal" role="dialog" aria-modal="true">
            <div class="modal-head">${esc(title)}</div>
            <div class="modal-body">
              ${label ? `<label class="modal-label" for="modal-input">${esc(label)}</label>` : ""}
              <input class="modal-input" id="modal-input" type="text" autocomplete="off"
                     spellcheck="false" placeholder="${esc(placeholder)}" value="${esc(value)}">
              <div class="modal-err" id="modal-err"></div>
            </div>
            <div class="modal-foot">
              <button class="btn btn-sm btn-ghost" id="modal-cancel">Cancel</button>
              <button class="btn btn-sm btn-primary" id="modal-ok">${esc(confirmText)}</button>
            </div>
          </div>
        </div>`;
      rootEl.classList.remove("hidden");
      const input = document.getElementById("modal-input");
      const errEl = document.getElementById("modal-err");
      input.focus(); input.select();

      function done(val) {
        rootEl.classList.add("hidden");
        rootEl.innerHTML = "";
        document.removeEventListener("keydown", onKey);
        resolve(val);
      }
      function submit() {
        const v = input.value.trim();
        if (!v) { errEl.textContent = "Please enter a name."; input.focus(); return; }
        done(v);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); done(null); }
        else if (e.key === "Enter") { e.preventDefault(); submit(); }
      }
      document.getElementById("modal-ok").addEventListener("click", submit);
      document.getElementById("modal-cancel").addEventListener("click", () => done(null));
      rootEl.querySelector(".modal-overlay").addEventListener("click", (e) => {
        if (e.target.classList.contains("modal-overlay")) done(null);
      });
      document.addEventListener("keydown", onKey);
    });
  }

  let toastTimer;
  function toast(msg, kind = "") {
    const el = document.getElementById("toast");
    el.className = `toast ${kind}`;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  function applyAccent() {
    document.documentElement.setAttribute("data-accent", Store.getSettings().accent || "green");
  }

  /* Floating description bubble for any element carrying [data-tip].
     Appended to <body> so the table's overflow can't clip it. */
  const Tooltip = (() => {
    let bubble;
    function ensure() {
      if (!bubble) {
        bubble = document.createElement("div");
        bubble.className = "tooltip-bubble hidden";
        document.body.appendChild(bubble);
      }
      return bubble;
    }
    function show(target) {
      const text = target.getAttribute("data-tip");
      if (!text) return;
      const b = ensure();
      b.textContent = text;
      b.classList.remove("hidden");
      const r = target.getBoundingClientRect();
      const bw = b.offsetWidth, bh = b.offsetHeight;
      let left = r.left + r.width / 2 - bw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
      let top = r.top - bh - 9;          // prefer above
      b.classList.toggle("below", top < 8);
      if (top < 8) top = r.bottom + 9;   // flip below if no room
      b.style.left = left + "px";
      b.style.top = top + "px";
      b.style.setProperty("--arrow-x", (r.left + r.width / 2 - left) + "px");
    }
    function hide() { if (bubble) bubble.classList.add("hidden"); }
    function init() {
      document.addEventListener("mouseover", (e) => {
        const t = e.target.closest("[data-tip]");
        if (t) show(t);
      });
      document.addEventListener("mouseout", (e) => {
        if (e.target.closest("[data-tip]")) hide();
      });
      document.addEventListener("click", hide, true);  // dismiss on sort-clicks
      window.addEventListener("scroll", hide, true);
    }
    return { init };
  })();

  function updateWatchCount() {
    const n = Store.getWatchlist().length;
    document.getElementById("wl-count").textContent = n || "";
  }

  async function checkConn() {
    const dot = document.getElementById("conn-dot");
    const txt = document.getElementById("conn-text");
    try { await API.health(); dot.className = "status-dot online"; txt.textContent = "yfinance · live"; }
    catch { dot.className = "status-dot offline"; txt.textContent = "server offline"; }
  }

  function init() {
    applyAccent();
    // hydrate input from settings/last session
    const last = Store.getLastTickers();
    document.getElementById("ticker-input").value =
      last.length ? last.join(", ") : Store.getSettings().defaultTickers;

    // nav
    document.querySelectorAll(".nav-item").forEach((n) =>
      n.addEventListener("click", () => go(n.dataset.view)));
    // topbar
    document.getElementById("analyze-btn").addEventListener("click", analyze);
    document.getElementById("ticker-input").addEventListener("keydown", (e) => { if (e.key === "Enter") analyze(); });
    document.getElementById("export-btn").addEventListener("click", doExport);

    // keep nav badge + any open list in sync when watchlist changes
    Store.onChange(() => updateWatchCount());

    Tooltip.init();
    updateWatchCount();
    setActiveNav();
    refreshCurrent();
    checkConn();
  }

  return { go, refreshCurrent, toast, applyAccent, setExportTickers, modalPrompt, init };
})();

document.addEventListener("DOMContentLoaded", App.init);
