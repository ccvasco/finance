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
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${"─".repeat(50)}`);
console.log(`Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failures.length) {
  console.error("\nFailed tests:");
  for (const f of failures) console.error(`  ✗  ${f.name}: ${f.msg}`);
  process.exit(1);
}
