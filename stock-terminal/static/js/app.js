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
    Views.screener(root(), tickers, { refresh: true });   // Analyze = explicit refresh
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

  /* Styled modal with a checklist of options plus an optional "add new" row.
     `items`: [{ id, label, checked }]. Resolves with the final item state
     ([{ id, label, checked, isNew }]) — new items carry id:null and isNew:true —
     or null if cancelled/escaped. */
  function modalChecklist({ title = "", label = "", items = [], confirmText = "Save",
                           allowNew = true, newPlaceholder = "New watchlist name" } = {}) {
    return new Promise((resolve) => {
      const rootEl = document.getElementById("modal-root");
      const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      const rowHTML = (it, i) => `
        <label class="modal-check">
          <input type="checkbox" data-i="${i}"${it.checked ? " checked" : ""}>
          <span class="modal-check-label">${esc(it.label)}</span>
        </label>`;

      rootEl.innerHTML = `
        <div class="modal-overlay">
          <div class="modal" role="dialog" aria-modal="true">
            <div class="modal-head">${esc(title)}</div>
            <div class="modal-body">
              ${label ? `<div class="modal-label">${esc(label)}</div>` : ""}
              <div class="modal-checks" id="modal-checks">
                ${items.map((it, i) => rowHTML(it, i)).join("")}
              </div>
              ${allowNew ? `
              <div class="modal-newrow">
                <input class="modal-input" id="modal-new" type="text" autocomplete="off"
                       spellcheck="false" placeholder="${esc(newPlaceholder)}">
                <button class="btn btn-sm btn-ghost" id="modal-add" type="button">＋ Add</button>
              </div>` : ""}
              <div class="modal-err" id="modal-err"></div>
            </div>
            <div class="modal-foot">
              <button class="btn btn-sm btn-ghost" id="modal-cancel">Cancel</button>
              <button class="btn btn-sm btn-primary" id="modal-ok">${esc(confirmText)}</button>
            </div>
          </div>
        </div>`;
      rootEl.classList.remove("hidden");

      const checksEl = document.getElementById("modal-checks");
      const newInput = document.getElementById("modal-new");
      const errEl = document.getElementById("modal-err");
      // Mirror of the rendered rows; checkbox state is synced from the DOM on save.
      const state = items.map((it) => ({ id: it.id, label: it.label, checked: !!it.checked, isNew: false }));

      function addNew() {
        const name = (newInput.value || "").trim();
        if (!name) { newInput.focus(); return; }
        if (state.some((s) => s.label.toLowerCase() === name.toLowerCase())) {
          errEl.textContent = `"${name}" is already listed.`; newInput.select(); return;
        }
        errEl.textContent = "";
        const i = state.length;
        state.push({ id: null, label: name, checked: true, isNew: true });
        const wrap = document.createElement("div");
        wrap.innerHTML = rowHTML({ label: name, checked: true }, i);
        checksEl.appendChild(wrap.firstElementChild);
        newInput.value = "";
        newInput.focus();
      }

      function done(val) {
        rootEl.classList.add("hidden");
        rootEl.innerHTML = "";
        document.removeEventListener("keydown", onKey);
        resolve(val);
      }
      function submit() {
        checksEl.querySelectorAll("input[type=checkbox]").forEach((cb) => {
          const i = Number(cb.dataset.i);
          if (state[i]) state[i].checked = cb.checked;
        });
        done(state);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); done(null); }
        else if (e.key === "Enter") {
          e.preventDefault();
          if (newInput && document.activeElement === newInput && newInput.value.trim()) addNew();
          else submit();
        }
      }
      if (newInput) document.getElementById("modal-add").addEventListener("click", addNew);
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

  // ---- sidebar collapse (toggled by clicking the logo, persisted) --------
  function applySidebarCollapse() {
    const collapsed = !!Store.getSettings().sidebarCollapsed;
    document.getElementById("app").classList.toggle("sidebar-collapsed", collapsed);
    const brand = document.getElementById("sidebar-collapse");
    if (brand) {
      // data-tip (the app's own styled bubble), not `title` — avoids
      // stacking the browser's native tooltip on top of ours.
      const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
      brand.setAttribute("data-tip", label);
      brand.setAttribute("aria-label", label);
    }
    // labels are hidden when collapsed, so surface them as hover tooltips
    document.querySelectorAll(".nav-item").forEach((n) => {
      if (collapsed) n.setAttribute("data-tip", n.querySelector(".nav-label").textContent);
      else n.removeAttribute("data-tip");
    });
  }
  function toggleSidebar() {
    Store.setSetting("sidebarCollapsed", !Store.getSettings().sidebarCollapsed);
    applySidebarCollapse();
  }

  // ---- whole-app UI zoom (browser-style, persisted) ---------------------
  const ZOOM_MIN = 50, ZOOM_MAX = 200, ZOOM_STEP = 10;
  function currentZoom() {
    const z = Number(Store.getSettings().zoom) || 100;
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  }
  function applyZoom() {
    const z = currentZoom();
    document.documentElement.style.zoom = z / 100;
    const lbl = document.getElementById("zoom-level");
    if (lbl) lbl.textContent = z + "%";
  }
  function setZoom(z) {
    z = Math.round(z / ZOOM_STEP) * ZOOM_STEP;
    z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    Store.setSetting("zoom", z);
    applyZoom();
  }
  function nudgeZoom(dir) { setZoom(currentZoom() + dir * ZOOM_STEP); }

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
    // Position the (already-populated) bubble against its anchor. Prefers
    // above; flips below when there isn't room.
    function place(target) {
      const b = bubble;
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
    function show(target) {
      const text = target.getAttribute("data-tip");
      if (!text) return;
      const b = ensure();
      b.classList.remove("rich");
      b.textContent = text;
      place(target);
    }
    // Rich variant: caller supplies a trusted HTML string (built from our own
    // data, never user input). Used for the strategy-grade derivation tables.
    function showHTML(target, html) {
      if (!html) return;
      const b = ensure();
      b.classList.add("rich");
      b.innerHTML = html;
      place(target);
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
    return { init, showHTML, hide };
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

  async function init() {
    // Pull the server's shared watchlists/settings before the first paint, so
    // we don't render this browser's stale localStorage copy and then swap it.
    await Store.hydrate();
    applyAccent();
    applyZoom();
    applySidebarCollapse();
    document.getElementById("sidebar-collapse").addEventListener("click", toggleSidebar);
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

    // zoom controls + keyboard shortcuts (Ctrl/⌘ +/- , Ctrl/⌘ 0 to reset)
    document.getElementById("zoom-in").addEventListener("click", () => nudgeZoom(1));
    document.getElementById("zoom-out").addEventListener("click", () => nudgeZoom(-1));
    document.getElementById("zoom-level").addEventListener("click", () => setZoom(100));
    document.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key === "=" || e.key === "+") { e.preventDefault(); nudgeZoom(1); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); nudgeZoom(-1); }
      else if (e.key === "0") { e.preventDefault(); setZoom(100); }
    });

    // keep nav badge + any open list in sync when watchlist changes
    Store.onChange(() => updateWatchCount());

    Tooltip.init();
    updateWatchCount();
    setActiveNav();
    refreshCurrent();
    checkConn();
  }

  const tip = { html: (t, h) => Tooltip.showHTML(t, h), hide: () => Tooltip.hide() };
  return { go, refreshCurrent, toast, applyAccent, setExportTickers, modalPrompt, modalChecklist, parseTickers, tip, init };
})();

document.addEventListener("DOMContentLoaded", App.init);
