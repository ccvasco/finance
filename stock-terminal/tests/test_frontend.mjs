/**
 * Frontend unit tests for Fmt (api.js) and Store (store.js).
 * Runs with: node --experimental-vm-modules tests/test_frontend.mjs
 *
 * Covers:
 *   Fmt.isNull, Fmt.num, Fmt.price, Fmt.pct, Fmt.ratioPct, Fmt.big, Fmt.curSym, Fmt.cell
 *   Store: watchlist add/remove/toggle/clear, auto-save, hydration, listeners
 *   Store: settings read/write, lastTickers
 *   covClass (FCF coverage thresholds)
 */

import { strict as assert } from "node:assert";

// ---------------------------------------------------------------------------
// Shim: globalThis.localStorage (in-memory) so Store can self-init
// ---------------------------------------------------------------------------
const _ls = {};
globalThis.localStorage = {
  getItem: (k) => _ls[k] ?? null,
  setItem: (k, v) => { _ls[k] = v; },
  removeItem: (k) => { delete _ls[k]; },
  clear: () => { for (const k of Object.keys(_ls)) delete _ls[k]; },
};

// ---------------------------------------------------------------------------
// Load modules via dynamic import (they use const at top level)
// ---------------------------------------------------------------------------
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.join(__dirname, "../static/js");

// Execute file text in a context that has globalThis (including our localStorage).
// We use Function() since the files use plain var/const without export.
function loadJS(filename) {
  let src = readFileSync(path.join(staticDir, filename), "utf8");
  // Top-level `const Foo = …` / `let Foo = …` are scoped to the Function body
  // and don't reach globalThis.  Re-write unindented declarations (no leading
  // whitespace) so they land on globalThis — indented inner declarations are
  // untouched because their lines don't start with `const`/`let`.
  src = src.replace(/^(const|let)\s+(\w+)\s*=/gm, "globalThis.$2 =");
  // eslint-disable-next-line no-new-func
  new Function("globalThis", "localStorage", src)(globalThis, globalThis.localStorage);
}

loadJS("api.js");    // defines globalThis.Fmt
loadJS("store.js");  // defines globalThis.Store (reads localStorage on load)

// Inline the covClass helper (views.js is large; extract the pure function).
function covClass(v) {
  if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) return "";
  if (v >= 1.2)  return "cov-green";
  if (v >= 0.8)  return "cov-yellow";
  return "cov-red";
}

// ---------------------------------------------------------------------------
// Tiny test runner
// ---------------------------------------------------------------------------
let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${e.message}`);
    failures.push({ name, msg: e.message });
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
}

// ---------------------------------------------------------------------------
// Fmt.isNull
// ---------------------------------------------------------------------------
section("Fmt.isNull");

test("null → true",      () => assert(Fmt.isNull(null)));
test("undefined → true", () => assert(Fmt.isNull(undefined)));
test("NaN → true",       () => assert(Fmt.isNull(NaN)));
test("0 → false",        () => assert(!Fmt.isNull(0)));
test("empty str → false",() => assert(!Fmt.isNull("")));
test("false → false",    () => assert(!Fmt.isNull(false)));

// ---------------------------------------------------------------------------
// Fmt.num
// ---------------------------------------------------------------------------
section("Fmt.num");

test("null → null",             () => assert.equal(Fmt.num(null), null));
test("undefined → null",        () => assert.equal(Fmt.num(undefined), null));
test("NaN → null",              () => assert.equal(Fmt.num(NaN), null));
test("integer 2 decimals",      () => assert.match(Fmt.num(42), /42\.00/));
test("float rounded",           () => assert.match(Fmt.num(3.14159, 2), /3\.14/));
test("0 decimals",              () => assert.match(Fmt.num(1234, 0), /1,?234/));
test("negative",                () => assert.match(Fmt.num(-5.5), /-5\.50/));

// ---------------------------------------------------------------------------
// Fmt.price
// ---------------------------------------------------------------------------
section("Fmt.price");

test("null → null",             () => assert.equal(Fmt.price(null), null));
test("USD prefix",              () => assert.equal(Fmt.price(100, "USD"), "$100.00"));
test("EUR prefix",              () => assert.equal(Fmt.price(99.9, "EUR"), "€99.90"));
test("GBP prefix",              () => assert.equal(Fmt.price(50, "GBP"), "£50.00"));
test("unknown currency no sym", () => assert.match(Fmt.price(10, "XYZ"), /^10\.00$/));
test("zero with USD",           () => assert.equal(Fmt.price(0, "USD"), "$0.00"));
test("no currency arg",         () => assert.match(Fmt.price(42.5), /42\.50/));

// ---------------------------------------------------------------------------
// Fmt.pct
// ---------------------------------------------------------------------------
section("Fmt.pct");

test("null → null",     () => assert.equal(Fmt.pct(null), null));
test("basic pct",       () => assert.equal(Fmt.pct(5.25), "5.25%"));
test("negative pct",    () => assert.equal(Fmt.pct(-3.5), "-3.50%"));
test("zero pct",        () => assert.equal(Fmt.pct(0), "0.00%"));
test("custom decimals", () => assert.equal(Fmt.pct(2.5, 1), "2.5%"));
test("large value",     () => assert.equal(Fmt.pct(150, 0), "150%"));

// ---------------------------------------------------------------------------
// Fmt.ratioPct  (e.g. 0.27 → "27.00%")
// ---------------------------------------------------------------------------
section("Fmt.ratioPct");

test("null → null",         () => assert.equal(Fmt.ratioPct(null), null));
test("0.25 → 25.00%",       () => assert.equal(Fmt.ratioPct(0.25), "25.00%"));
test("1.0 → 100.00%",       () => assert.equal(Fmt.ratioPct(1.0), "100.00%"));
test("negative ratio",       () => assert.equal(Fmt.ratioPct(-0.05), "-5.00%"));
test("custom decimal",       () => assert.equal(Fmt.ratioPct(0.333, 1), "33.3%"));

// ---------------------------------------------------------------------------
// Fmt.big
// ---------------------------------------------------------------------------
section("Fmt.big");

test("null → null",          () => assert.equal(Fmt.big(null), null));
test("trillions",            () => assert.equal(Fmt.big(4e12, "USD"), "$4.00T"));
test("billions",             () => assert.equal(Fmt.big(2.5e9, "USD"), "$2.50B"));
test("millions",             () => assert.equal(Fmt.big(750e6), "750.00M"));
test("thousands",            () => assert.equal(Fmt.big(5000), "5.00K"));
test("small value",          () => assert.equal(Fmt.big(42), "42"));
test("negative billions",    () => assert.equal(Fmt.big(-1e9, "USD"), "-$1.00B"));
test("zero",                 () => assert.equal(Fmt.big(0), "0"));
test("EUR trillions",        () => assert.equal(Fmt.big(1e12, "EUR"), "€1.00T"));
test("INR rupee symbol",     () => assert.equal(Fmt.big(1e9, "INR"), "₹1.00B"));
test("HKD symbol",           () => assert.equal(Fmt.big(1e9, "HKD"), "HK$1.00B"));
test("JPY yen symbol",       () => assert.equal(Fmt.big(1e12, "JPY"), "¥1.00T"));

// ---------------------------------------------------------------------------
// Fmt.curSym
// ---------------------------------------------------------------------------
section("Fmt.curSym");

test("USD → $",    () => assert.equal(Fmt.curSym("USD"), "$"));
test("EUR → €",    () => assert.equal(Fmt.curSym("EUR"), "€"));
test("GBP → £",    () => assert.equal(Fmt.curSym("GBP"), "£"));
test("unknown → ''",() => assert.equal(Fmt.curSym("ZZZ"), ""));
test("empty → ''", () => assert.equal(Fmt.curSym(""), ""));

// ---------------------------------------------------------------------------
// Fmt.cell
// ---------------------------------------------------------------------------
section("Fmt.cell");

test("valid value returns formatted string", () =>
  assert.equal(Fmt.cell(100, (v) => "$" + v.toFixed(2)), "$100.00"));
test("null value returns N/A span",          () =>
  assert.match(Fmt.cell(null, () => null), /N\/A/));
test("formatter returning null → N/A",       () =>
  assert.match(Fmt.cell(NaN, (v) => Fmt.num(v)), /N\/A/));

// ---------------------------------------------------------------------------
// covClass — FCF coverage threshold coloring
// ---------------------------------------------------------------------------
section("covClass (FCF coverage)");

test("1.2 → cov-green",  () => assert.equal(covClass(1.2), "cov-green"));
test("2.5 → cov-green",  () => assert.equal(covClass(2.5), "cov-green"));
test("1.19 → cov-yellow",() => assert.equal(covClass(1.19), "cov-yellow"));
test("1.0 → cov-yellow", () => assert.equal(covClass(1.0), "cov-yellow"));
test("0.8 → cov-yellow", () => assert.equal(covClass(0.8), "cov-yellow"));
test("0.79 → cov-red",   () => assert.equal(covClass(0.79), "cov-red"));
test("0.0 → cov-red",    () => assert.equal(covClass(0.0), "cov-red"));
test("null → ''",         () => assert.equal(covClass(null), ""));
test("NaN → ''",          () => assert.equal(covClass(NaN), ""));

// ---------------------------------------------------------------------------
// Store — watchlist
// ---------------------------------------------------------------------------
section("Store — watchlist");

// Reset to clean state before watchlist tests
localStorage.clear();
// Re-initialize Store by reloading (simulate fresh page load)
loadJS("store.js");

test("watchlist starts empty (clean storage)", () =>
  assert.equal(Store.getWatchlist().length, 0));

test("toggleWatch adds ticker", () => {
  Store.clearWatchlist();
  const added = Store.toggleWatch("AAPL");
  assert(added);
  assert(Store.inWatchlist("AAPL"));
});

test("toggleWatch normalizes to uppercase", () => {
  Store.clearWatchlist();
  Store.toggleWatch("aapl");
  assert(Store.inWatchlist("AAPL"));
});

test("toggleWatch removes existing ticker", () => {
  Store.clearWatchlist();
  Store.toggleWatch("MSFT");
  const removed = Store.toggleWatch("MSFT");
  assert(!removed);
  assert(!Store.inWatchlist("MSFT"));
});

test("removeWatch removes specific ticker", () => {
  Store.clearWatchlist();
  Store.toggleWatch("NVDA");
  Store.toggleWatch("TSLA");
  Store.removeWatch("NVDA");
  assert(!Store.inWatchlist("NVDA"));
  assert(Store.inWatchlist("TSLA"));
});

test("clearWatchlist empties all", () => {
  Store.toggleWatch("A");
  Store.toggleWatch("B");
  Store.clearWatchlist();
  assert.equal(Store.getWatchlist().length, 0);
});

test("getWatchlist returns a copy (mutation-safe)", () => {
  Store.clearWatchlist();
  Store.toggleWatch("COPY");
  const list = Store.getWatchlist();
  list.push("INJECTED");
  assert(!Store.inWatchlist("INJECTED"));
});

test("auto-saves to localStorage on toggle", () => {
  Store.clearWatchlist();
  Store.toggleWatch("SAVE");
  const stored = JSON.parse(localStorage.getItem("st.watchlist"));
  assert(stored.includes("SAVE"));
});

test("auto-saves on remove", () => {
  Store.clearWatchlist();
  Store.toggleWatch("REM");
  Store.removeWatch("REM");
  const stored = JSON.parse(localStorage.getItem("st.watchlist"));
  assert(!stored.includes("REM"));
});

test("hydrates from localStorage on load", () => {
  localStorage.setItem("st.watchlist", JSON.stringify(["HYDRATE"]));
  loadJS("store.js");   // re-init reads storage
  assert(Store.inWatchlist("HYDRATE"));
  localStorage.removeItem("st.watchlist");
  loadJS("store.js");   // restore clean state
});

// ---------------------------------------------------------------------------
// Store — onChange listener
// ---------------------------------------------------------------------------
section("Store — onChange listener");

test("listener fires on toggleWatch", () => {
  Store.clearWatchlist();
  let fired = 0;
  // Note: listeners accumulate across reloads in this test run; count relative fires.
  const before = fired;
  Store.onChange(() => fired++);
  Store.toggleWatch("LISTEN");
  assert(fired > before);
});

test("listener fires on clearWatchlist", () => {
  let fired = 0;
  Store.onChange(() => fired++);
  Store.clearWatchlist();
  assert(fired > 0);
});

test("listener fires on setSetting", () => {
  let fired = 0;
  Store.onChange(() => fired++);
  Store.setSetting("accent", "blue");
});

// ---------------------------------------------------------------------------
// Store — settings
// ---------------------------------------------------------------------------
section("Store — settings");

test("default accent is green", () => {
  localStorage.clear();
  loadJS("store.js");
  assert.equal(Store.getSettings().accent, "green");
});

test("setSetting persists to localStorage", () => {
  Store.setSetting("accent", "violet");
  const stored = JSON.parse(localStorage.getItem("st.settings"));
  assert.equal(stored.accent, "violet");
});

test("getSettings returns a copy (mutation-safe)", () => {
  const s = Store.getSettings();
  s.accent = "INJECTED";
  assert.notEqual(Store.getSettings().accent, "INJECTED");
});

test("default defaultTickers is not empty", () => {
  localStorage.clear();
  loadJS("store.js");
  assert(Store.getSettings().defaultTickers.length > 0);
});

test("default fetch-tuning settings", () => {
  localStorage.clear();
  loadJS("store.js");
  const s = Store.getSettings();
  assert.equal(s.batchSize, 20);
  assert.equal(s.batchDelay, 400);
  assert.equal(s.cacheSets, 25);
});

test("fetch-tuning settings persist", () => {
  Store.setSetting("batchSize", 50);
  Store.setSetting("cacheSets", 100);
  const stored = JSON.parse(localStorage.getItem("st.settings"));
  assert.equal(stored.batchSize, 50);
  assert.equal(stored.cacheSets, 100);
});

// ---------------------------------------------------------------------------
// Store — lastTickers
// ---------------------------------------------------------------------------
section("Store — lastTickers");

test("getLastTickers returns empty by default", () => {
  localStorage.clear();
  loadJS("store.js");
  assert.equal(Store.getLastTickers().length, 0);
});

test("setLastTickers persists", () => {
  Store.setLastTickers(["AAPL", "MSFT"]);
  assert.deepEqual(Store.getLastTickers(), ["AAPL", "MSFT"]);
  const stored = JSON.parse(localStorage.getItem("st.lastTickers"));
  assert.deepEqual(stored, ["AAPL", "MSFT"]);
});

test("setLastTickers returns a copy", () => {
  const arr = ["X"];
  Store.setLastTickers(arr);
  arr.push("Y");
  assert.equal(Store.getLastTickers().length, 1);
});

// ---------------------------------------------------------------------------
// Store — named watchlists
// ---------------------------------------------------------------------------
section("Store — named watchlists");

test("getLists empty by default", () => {
  localStorage.clear();
  loadJS("store.js");
  assert.equal(Store.getLists().length, 0);
});

test("saveList creates a named list", () => {
  const l = Store.saveList("Tech", ["AAPL", "MSFT"]);
  assert.equal(l.name, "Tech");
  assert.deepEqual(l.tickers, ["AAPL", "MSFT"]);
  assert.equal(Store.getLists().length, 1);
});

test("saveList persists to localStorage", () => {
  const stored = JSON.parse(localStorage.getItem("st.lists"));
  assert.equal(stored[0].name, "Tech");
});

test("saveList overwrites same name (case-insensitive)", () => {
  Store.saveList("tech", ["NVDA"]);
  assert.equal(Store.getLists().length, 1);
  assert.deepEqual(Store.findListByName("TECH").tickers, ["NVDA"]);
});

test("findListByName returns null when absent", () =>
  assert.equal(Store.findListByName("nope"), null));

test("getList returns a copy (mutation-safe)", () => {
  const id = Store.getLists()[0].id;
  const l = Store.getList(id);
  l.tickers.push("INJECTED");
  assert.equal(Store.getList(id).tickers.includes("INJECTED"), false);
});

test("renameList updates the name", () => {
  const id = Store.getLists()[0].id;
  Store.renameList(id, "Semis");
  assert.equal(Store.getList(id).name, "Semis");
});

test("deleteList removes it", () => {
  const id = Store.getLists()[0].id;
  Store.deleteList(id);
  assert.equal(Store.getLists().length, 0);
});

test("named lists are independent of the star watchlist", () => {
  localStorage.clear();
  loadJS("store.js");
  Store.toggleWatch("AAPL");
  Store.saveList("L1", ["MSFT", "NVDA"]);
  assert.deepEqual(Store.getWatchlist(), ["AAPL"]);
  assert.deepEqual(Store.getLists()[0].tickers, ["MSFT", "NVDA"]);
});

test("addToList appends, dedupes and uppercases", () => {
  const id = Store.getLists()[0].id;
  const l = Store.addToList(id, ["amd", "MSFT", "TSM", "amd"]);
  assert.deepEqual(l.tickers, ["MSFT", "NVDA", "AMD", "TSM"]);
});

test("addToList persists to localStorage", () => {
  const stored = JSON.parse(localStorage.getItem("st.lists"));
  assert.deepEqual(stored[0].tickers, ["MSFT", "NVDA", "AMD", "TSM"]);
});

test("removeFromList drops multiple tickers", () => {
  const id = Store.getLists()[0].id;
  const l = Store.removeFromList(id, ["nvda", "TSM", "NOTIN"]);
  assert.deepEqual(l.tickers, ["MSFT", "AMD"]);
});

test("addToList/removeFromList return null for unknown id", () => {
  assert.equal(Store.addToList("nope", ["AAPL"]), null);
  assert.equal(Store.removeFromList("nope", ["AAPL"]), null);
});

test("removeFromList can empty a list without deleting it", () => {
  const id = Store.getLists()[0].id;
  const l = Store.removeFromList(id, ["MSFT", "AMD"]);
  assert.deepEqual(l.tickers, []);
  assert.equal(Store.getLists().length, 1);
});

// ---------------------------------------------------------------------------
// Store — persisted rows cache (survives page reloads)
// ---------------------------------------------------------------------------
section("Store — persisted rows cache");

test("rows cache empty by default", () => {
  localStorage.clear();
  loadJS("store.js");
  assert.deepEqual(Store.getRowsCache(), []);
});

test("setRowsCache round-trips entries", () => {
  const entries = [["AAPL,MSFT", [{ ticker: "AAPL" }, { ticker: "MSFT" }]]];
  Store.setRowsCache(entries);
  assert.deepEqual(Store.getRowsCache(), entries);
});

test("quota failure falls back to newest 5 sets", () => {
  const entries = [];
  for (let i = 0; i < 8; i++) entries.push([`SET${i}`, [{ ticker: `T${i}` }]]);
  const realSet = localStorage.setItem;
  let calls = 0;
  localStorage.setItem = (k, v) => {
    calls++;
    if (calls === 1) throw new Error("QuotaExceededError");
    realSet(k, v);
  };
  Store.setRowsCache(entries);
  localStorage.setItem = realSet;
  const kept = Store.getRowsCache();
  assert.equal(kept.length, 5);
  assert.equal(kept[0][0], "SET3");   // oldest three dropped
  assert.equal(kept[4][0], "SET7");
});

test("total quota failure drops the persisted cache without throwing", () => {
  const realSet = localStorage.setItem;
  localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  Store.setRowsCache([["K", [{ ticker: "A" }]]]);
  localStorage.setItem = realSet;
  assert.deepEqual(Store.getRowsCache(), []);
});

// ---------------------------------------------------------------------------
// Fmt.date / Fmt.weekday  (Calendar tab)
// ---------------------------------------------------------------------------
section("Fmt.date / weekday");

test("date null → null",        () => assert.equal(Fmt.date(null), null));
test("date empty → null",       () => assert.equal(Fmt.date(""), null));
test("date formats ISO",        () => assert.match(Fmt.date("2026-07-30"), /2026/));
test("date includes month",     () => assert.match(Fmt.date("2026-01-15"), /Jan/));
test("weekday of known date",   () => assert.equal(Fmt.weekday("2026-06-26"), "Fri"));
test("weekday empty → ''",      () => assert.equal(Fmt.weekday(""), ""));

// ---------------------------------------------------------------------------
// Fmt.splitRatio (old/new worth) and Fmt.splitFromRatio (factor)
// ---------------------------------------------------------------------------
section("Fmt.splitRatio / splitFromRatio");

test("forward 1→4 → 4:1",       () => assert.equal(Fmt.splitRatio(1, 4), "4:1"));
test("reverse 5→1 → 1:5",       () => assert.equal(Fmt.splitRatio(5, 1), "1:5"));
test("ratio null worth → null", () => assert.equal(Fmt.splitRatio(0, 1), null));
test("factor 4 → 4:1",          () => assert.equal(Fmt.splitFromRatio(4), "4:1"));
test("factor 0.2 → 1:5",        () => assert.equal(Fmt.splitFromRatio(0.2), "1:5"));
test("factor null → null",      () => assert.equal(Fmt.splitFromRatio(null), null));
test("factor 0 → null",         () => assert.equal(Fmt.splitFromRatio(0), null));

// ---------------------------------------------------------------------------
// API refresh param (URL construction, fetch stubbed)
// ---------------------------------------------------------------------------
section("API — refresh param");

{
  let lastUrl = null;
  globalThis.fetch = (url) => {
    lastUrl = url;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  };
  const call = (fn) => { fn().catch(() => {}); return lastUrl; };

  test("screener without refresh omits param", () =>
    assert.ok(!call(() => API.screener(["AAPL", "MSFT"])).includes("refresh")));
  test("screener with refresh appends refresh=1", () =>
    assert.match(call(() => API.screener(["AAPL"], true)), /refresh=1/));
  test("deepdive without refresh omits param", () =>
    assert.ok(!call(() => API.deepdive("AAPL")).includes("refresh")));
  test("deepdive with refresh appends refresh=1", () =>
    assert.match(call(() => API.deepdive("AAPL", true)), /refresh=1/));
  test("deepdive refresh keeps ticker param", () =>
    assert.match(call(() => API.deepdive("AAPL", true)), /ticker=AAPL/));
  test("calendar with refresh appends refresh=1", () =>
    assert.match(call(() => API.calendar({ start: "2026-07-03", refresh: true })), /refresh=1/));
  test("calendar without refresh omits param", () =>
    assert.ok(!call(() => API.calendar({ start: "2026-07-03" })).includes("refresh")));

  delete globalThis.fetch;
}

// ---------------------------------------------------------------------------
// Strategy-grade derivation tooltip (mirrors views.js gradeTipHTML/gradePayload
// /fmtPts — views.js is a DOM-coupled IIFE that can't be loaded here, so these
// pure helpers are inlined the same way covClass is above).
// ---------------------------------------------------------------------------
section("Strategy tooltip — fmtPts / gradePayload / gradeTipHTML");

const escHTML = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtPts = (v) => String(parseFloat(v.toFixed(1))).replace("-", "−");
const GRADE_FULL = { "1": "S1 · Triage", "2": "S2 · Compounder", "3": "S3 · Defensive Value" };

function gradePayload(which, r) {
  if (which === "min") {
    const s = [r.strategy_1, r.strategy_2, r.strategy_3];
    if (s.every((v) => v == null) && r.strategy_min == null) return null;
    return { kind: "min", s, min: r.strategy_min };
  }
  return {
    kind: "s", label: GRADE_FULL[which], score: r["strategy_" + which],
    verdict: r["strategy_" + which + "_verdict"],
    pillars: r["strategy_" + which + "_detail"],   // undefined on pre-feature rows
  };
}

function gradeTipHTML(d) {
  if (d.kind === "min") {
    const names = ["S1 Triage", "S2 Compounder", "S3 Defensive"];
    const body = d.s.map((v, i) => {
      const isMin = v != null && v === d.min;
      return `<tr class="${isMin ? "tip-min" : ""}"><td>${names[i]}</td>` +
        `<td class="tip-p">${v == null ? "—" : v}</td></tr>`;
    }).join("");
    return `<div class="tip-h">Strat Min · ${d.min == null ? "N/A" : d.min + " / 100"}</div>` +
      `<div class="tip-sub">the lowest of the three — a name ranks high here only when it holds up under every lens</div>` +
      `<table class="tip-tbl">${body}</table>`;
  }
  const head = `<div class="tip-h">${escHTML(d.label)} · ` +
    `${d.score == null ? "N/A" : d.score + " / 100"}` +
    `${d.verdict ? " — " + escHTML(d.verdict) : ""}</div>`;
  if (d.pillars === undefined) {
    return head + `<div class="tip-sub">Breakdown not loaded for this row — press ↻ Refresh to compute it.</div>`;
  }
  if (!d.pillars.length) {
    return head + `<div class="tip-sub">${d.score == null
      ? "Not scored — reason above." : "Disqualified before scoring — reason above."}</div>`;
  }
  const body = d.pillars.map((p) => {
    const adj = p.m === 0;
    const pts = adj
      ? `<span class="tip-adj">${p.p > 0 ? "+" : ""}${fmtPts(p.p)}</span>`
      : `${fmtPts(p.p)}<span class="tip-max">/${p.m}</span>`;
    return `<tr><td>${escHTML(p.k)}</td><td class="tip-p">${pts}</td>` +
      `<td class="tip-d">${escHTML(p.d)}</td></tr>`;
  }).join("");
  return head + `<table class="tip-tbl">${body}</table>`;
}

test("fmtPts drops trailing .0", () => assert.equal(fmtPts(25.0), "25"));
test("fmtPts keeps a half point", () => assert.equal(fmtPts(12.5), "12.5"));
test("fmtPts uses a real minus sign", () => assert.equal(fmtPts(-17), "−17"));

test("gradePayload returns pillars for a scored strategy", () => {
  const r = { strategy_1: 72, strategy_1_verdict: "Advance",
    strategy_1_detail: [{ k: "Value creation", p: 30, m: 30, d: "x" }] };
  const p = gradePayload("1", r);
  assert.equal(p.kind, "s");
  assert.equal(p.score, 72);
  assert.equal(p.pillars.length, 1);
});

test("gradePayload for min flags the binding strategy", () => {
  const p = gradePayload("min", { strategy_1: 72, strategy_2: 55, strategy_3: 40, strategy_min: 40 });
  assert.equal(p.kind, "min");
  assert.equal(p.min, 40);
});

test("gradePayload null on a fully blank row", () =>
  assert.equal(gradePayload("min", {}), null));

test("gradeTipHTML renders a pillar row with points/max", () => {
  const html = gradeTipHTML(gradePayload("1", {
    strategy_1: 100, strategy_1_verdict: "Advance",
    strategy_1_detail: [{ k: "Value creation", p: 30, m: 30, d: "ROIC−WACC +9" }],
  }));
  assert.match(html, /S1 · Triage · 100 \/ 100 — Advance/);
  assert.match(html, /Value creation/);
  assert.match(html, /30<span class="tip-max">\/30<\/span>/);
});

test("gradeTipHTML shows an adjustment (cap) row signed", () => {
  const html = gradeTipHTML({ kind: "s", label: "S1 · Triage", score: 55, verdict: "Watchlist",
    pillars: [{ k: "Neg-spread cap", p: -17, m: 0, d: "capped at 55" }] });
  assert.match(html, /tip-adj">−17</);
});

test("gradeTipHTML: a scored row missing its detail says to refresh, not 'disqualified'", () => {
  // Regression: rows cached before the breakdown feature carry no detail field.
  const html = gradeTipHTML(gradePayload("2",
    { strategy_2: 95, strategy_2_verdict: "Compounder" }));   // no strategy_2_detail
  assert.match(html, /95 \/ 100 — Compounder/);
  assert.match(html, /Breakdown not loaded/);
  assert.ok(!html.includes("Disqualified"));
});

test("gradeTipHTML quarantine (no pillars) explains instead of tabling", () => {
  const html = gradeTipHTML({ kind: "s", label: "S1 · Triage", score: null,
    verdict: "Quarantine — missing total_equity", pillars: [] });
  assert.match(html, /N\/A/);
  assert.match(html, /Not scored/);
  assert.ok(!html.includes("tip-tbl"));
});

test("gradeTipHTML min table highlights the minimum strategy", () => {
  const html = gradeTipHTML(gradePayload("min",
    { strategy_1: 72, strategy_2: 55, strategy_3: 40, strategy_min: 40 }));
  assert.match(html, /class="tip-min"><td>S3 Defensive/);
  assert.ok(!/class="tip-min"><td>S1 Triage/.test(html));
});

test("gradeTipHTML escapes pillar detail text", () => {
  const html = gradeTipHTML({ kind: "s", label: "S1 · Triage", score: 50, verdict: "x",
    pillars: [{ k: "A", p: 1, m: 2, d: "a<b>&c" }] });
  assert.match(html, /a&lt;b&gt;&amp;c/);
});

// ---------------------------------------------------------------------------
// Fmt.md — markdown-lite renderer for chat replies (api.js)
// ---------------------------------------------------------------------------
section("Fmt.md — chat markdown");

test("plain text becomes a paragraph", () =>
  assert.equal(Fmt.md("hello"), "<p>hello</p>"));

test("escapes HTML before rendering", () => {
  const html = Fmt.md('<script>alert("x")</script>');
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
});

test("bold, italic and inline code", () => {
  const html = Fmt.md("**AAPL** is *maybe* `cheap`");
  assert.match(html, /<strong>AAPL<\/strong>/);
  assert.match(html, /<em>maybe<\/em>/);
  assert.match(html, /<code>cheap<\/code>/);
});

test("code fences are verbatim (no markdown inside)", () => {
  const html = Fmt.md("```\n**not bold** <b>\n```");
  assert.match(html, /<pre><code>\*\*not bold\*\* &lt;b&gt;<\/code><\/pre>/);
});

test("unordered and ordered lists", () => {
  const ul = Fmt.md("- one\n- two");
  assert.match(ul, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  const ol = Fmt.md("1. one\n2. two");
  assert.match(ol, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
});

test("markdown table renders with header row", () => {
  const html = Fmt.md("| Ticker | P/E |\n|---|---|\n| AAPL | 30 |");
  assert.match(html, /<table><tr><th>Ticker<\/th><th>P\/E<\/th><\/tr><tr><td>AAPL<\/td><td>30<\/td><\/tr><\/table>/);
});

test("headings map to h4", () =>
  assert.match(Fmt.md("### Risks"), /<h4>Risks<\/h4>/));

test("null/undefined render as empty", () => {
  assert.equal(Fmt.md(null), "");
  assert.equal(Fmt.md(undefined), "");
});

// ---------------------------------------------------------------------------
// API.chat — SSE stream parsing (fetch stubbed with a fake body reader)
// ---------------------------------------------------------------------------
section("API.chat — SSE parsing");

function fakeStreamResponse(chunks, ok = true) {
  const enc = new TextEncoder();
  let i = 0;
  return {
    ok,
    status: ok ? 200 : 500,
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { done: false, value: enc.encode(chunks[i++]) }
            : { done: true, value: undefined },
      }),
    },
  };
}

await (async () => {
  // Events split mid-frame across network chunks must still parse.
  globalThis.fetch = async () => fakeStreamResponse([
    'data: {"text": "Hel',
    'lo"}\n\ndata: {"text": " world"}\n\ndata: {"do',
    'ne": true}\n\n',
  ]);
  const events = [];
  await API.chat({ messages: [], rows: [] }, (e) => events.push(e));
  test("chat reassembles frames split across chunks", () => {
    assert.deepEqual(events, [{ text: "Hello" }, { text: " world" }, { done: true }]);
  });

  globalThis.fetch = async () => fakeStreamResponse([], false);
  const errEvents = [];
  await API.chat({ messages: [], rows: [] }, (e) => errEvents.push(e));
  test("chat surfaces HTTP failure as an error event", () => {
    assert.deepEqual(errEvents, [{ error: "HTTP 500" }]);
  });

  // Body must forward messages, rows and the tab's context_label.
  let sentBody = null;
  globalThis.fetch = async (_url, opts) => {
    sentBody = JSON.parse(opts.body);
    return fakeStreamResponse(['data: {"done": true}\n\n']);
  };
  await API.chat({ messages: [{ role: "user", content: "hi" }],
                  rows: [{ ticker: "AAPL" }], context_label: "Dashboard" },
                 () => {});
  test("chat forwards messages, rows and context_label in the body", () => {
    assert.deepEqual(sentBody, {
      messages: [{ role: "user", content: "hi" }],
      rows: [{ ticker: "AAPL" }],
      context_label: "Dashboard",
    });
  });

  delete globalThis.fetch;
})();

// ---------------------------------------------------------------------------
// Store.getChatHistory / setChatHistory — persistent chat across reloads
// ---------------------------------------------------------------------------
section("Store — chat history");

test("chat history round-trips through localStorage", () => {
  const h = [{ role: "user", content: "hi" }, { role: "assistant", content: "yo" }];
  Store.setChatHistory(h);
  assert.deepEqual(Store.getChatHistory(), h);
});

test("chat history caps at 60 messages (keeps the newest)", () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ role: "user", content: `m${i}` }));
  Store.setChatHistory(many);
  const out = Store.getChatHistory();
  assert.equal(out.length, 60);
  assert.equal(out[0].content, "m20");
  assert.equal(out[59].content, "m79");
});

test("chat history tolerates junk / empty", () => {
  localStorage.setItem("st.chatHistory", "{not json");
  assert.deepEqual(Store.getChatHistory(), []);
  Store.setChatHistory([]);
  assert.deepEqual(Store.getChatHistory(), []);
});

section("Store — column widths");

test("column widths start empty and round-trip through localStorage", () => {
  localStorage.removeItem("st.colWidths");
  Store.resetColWidths();
  assert.deepEqual(Store.getColWidths(), {});
  Store.setColWidths({ pe: 90, price: 120 });
  assert.deepEqual(Store.getColWidths(), { pe: 90, price: 120 });
  assert.deepEqual(JSON.parse(localStorage.getItem("st.colWidths")), { pe: 90, price: 120 });
});

test("column widths merge rather than replace, and round to whole px", () => {
  Store.resetColWidths();
  Store.setColWidths({ pe: 90, price: 120 });
  Store.setColWidths({ price: 133.7 });
  assert.deepEqual(Store.getColWidths(), { pe: 90, price: 134 });
});

test("a null width drops the column back to auto", () => {
  Store.resetColWidths();
  Store.setColWidths({ pe: 90, price: 120 });
  Store.setColWidths({ pe: null });
  assert.deepEqual(Store.getColWidths(), { price: 120 });
});

test("getColWidths hands back a copy — mutating it can't corrupt the store", () => {
  Store.resetColWidths();
  Store.setColWidths({ pe: 90 });
  const got = Store.getColWidths();
  got.pe = 999;
  delete got.pe;
  assert.deepEqual(Store.getColWidths(), { pe: 90 });
});

test("resetColWidths clears everything", () => {
  Store.setColWidths({ pe: 90, price: 120 });
  Store.resetColWidths();
  assert.deepEqual(Store.getColWidths(), {});
  assert.deepEqual(JSON.parse(localStorage.getItem("st.colWidths")), {});
});

test("column widths tolerate junk in localStorage", () => {
  localStorage.setItem("st.colWidths", "{not json");
  loadJS("store.js");   // Store hydrates on load — re-run that read path
  assert.deepEqual(Store.getColWidths(), {});
});

section("Store — column order");

test("column order starts empty and round-trips through localStorage", () => {
  localStorage.removeItem("st.colOrder");
  Store.resetColOrder();
  assert.deepEqual(Store.getColOrder(), []);
  Store.setColOrder(["star", "ticker", "pe", "price"]);
  assert.deepEqual(Store.getColOrder(), ["star", "ticker", "pe", "price"]);
  assert.deepEqual(JSON.parse(localStorage.getItem("st.colOrder")),
                   ["star", "ticker", "pe", "price"]);
});

test("setColOrder replaces the order outright — it is a sequence, not a merge", () => {
  Store.setColOrder(["star", "ticker", "pe", "price"]);
  Store.setColOrder(["star", "ticker", "price"]);
  assert.deepEqual(Store.getColOrder(), ["star", "ticker", "price"]);
});

test("getColOrder hands back a copy — mutating it can't corrupt the store", () => {
  Store.setColOrder(["star", "ticker", "pe"]);
  const got = Store.getColOrder();
  got.push("price");
  got[0] = "nope";
  assert.deepEqual(Store.getColOrder(), ["star", "ticker", "pe"]);
});

test("setColOrder snapshots the caller's array rather than aliasing it", () => {
  const keys = ["star", "ticker", "pe"];
  Store.setColOrder(keys);
  keys.push("price");
  assert.deepEqual(Store.getColOrder(), ["star", "ticker", "pe"]);
});

test("resetColOrder clears everything", () => {
  Store.setColOrder(["star", "ticker", "pe"]);
  Store.resetColOrder();
  assert.deepEqual(Store.getColOrder(), []);
  assert.deepEqual(JSON.parse(localStorage.getItem("st.colOrder")), []);
});

test("column order tolerates junk in localStorage", () => {
  localStorage.setItem("st.colOrder", "[not json");
  loadJS("store.js");   // Store hydrates on load — re-run that read path
  assert.deepEqual(Store.getColOrder(), []);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${"─".repeat(50)}`);
console.log(`Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failures.length) {
  console.error("\nFailed tests:");
  for (const f of failures) console.error(`  ✗  ${f.name}: ${f.msg}`);
  process.exit(1);
}
