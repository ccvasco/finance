/* charts.js — dependency-free SVG charts (line + grouped bars) */
const Charts = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1fd1a0";

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function fmtAxis(v) {
    const a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(1) + "T";
    if (a >= 1e9) return (v / 1e9).toFixed(1) + "B";
    if (a >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(1) + "K";
    return Number.isInteger(v) ? "" + v : v.toFixed(1);
  }

  /* Line chart for price history. points: [{date, close}] */
  function line(container, points, opts = {}) {
    container.innerHTML = "";
    const W = container.clientWidth || 760, H = opts.height || 260;
    const m = { t: 14, r: 14, b: 24, l: 52 };
    const xs = points.map((p) => p.close).filter((v) => v != null);
    if (xs.length < 2) { container.innerHTML = '<div class="empty"><div class="hint">No price data</div></div>'; return; }
    let lo = Math.min(...xs), hi = Math.max(...xs);
    const pad = (hi - lo) * 0.08 || hi * 0.05; lo -= pad; hi += pad;
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const X = (i) => m.l + (i / (points.length - 1)) * iw;
    const Y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
    const col = accent();

    const svg = el("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", height: H });
    // gridlines + y labels
    for (let g = 0; g <= 4; g++) {
      const yv = lo + (g / 4) * (hi - lo), y = Y(yv);
      svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: "#1a232e", "stroke-width": 1 }));
      const tx = el("text", { x: m.l - 8, y: y + 3, fill: "#566272", "text-anchor": "end", "font-size": 10, "font-family": "monospace" });
      tx.textContent = fmtAxis(yv); svg.appendChild(tx);
    }
    // x labels (first / mid / last)
    [0, Math.floor(points.length / 2), points.length - 1].forEach((i) => {
      const t = el("text", { x: X(i), y: H - 6, fill: "#566272", "text-anchor": "middle", "font-size": 10, "font-family": "monospace" });
      t.textContent = points[i].date.slice(0, 7); svg.appendChild(t);
    });
    // area + line
    let d = "", area = `M ${X(0)} ${Y(points[0].close)}`;
    points.forEach((p, i) => { const cmd = i === 0 ? "M" : "L"; d += `${cmd} ${X(i)} ${Y(p.close)} `; if (i) area += ` L ${X(i)} ${Y(p.close)}`; });
    area += ` L ${X(points.length - 1)} ${Y(lo)} L ${X(0)} ${Y(lo)} Z`;
    const grad = el("linearGradient", { id: "areaGrad", x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(el("stop", { offset: "0%", "stop-color": col, "stop-opacity": .28 }));
    grad.appendChild(el("stop", { offset: "100%", "stop-color": col, "stop-opacity": 0 }));
    const defs = el("defs", {}); defs.appendChild(grad); svg.appendChild(defs);
    svg.appendChild(el("path", { d: area, fill: "url(#areaGrad)" }));
    svg.appendChild(el("path", { d: d.trim(), fill: "none", stroke: col, "stroke-width": 1.6 }));
    container.appendChild(svg);

    // hover crosshair
    const tip = document.createElement("div");
    tip.style.cssText = "position:absolute;pointer-events:none;background:#0d141c;border:1px solid #28333f;border-radius:6px;padding:5px 8px;font:11px monospace;color:#d7e0ea;display:none;z-index:9;white-space:nowrap";
    container.style.position = "relative"; container.appendChild(tip);
    const vline = el("line", { y1: m.t, y2: m.t + ih, stroke: "#3a4756", "stroke-width": 1, visibility: "hidden" });
    const dot = el("circle", { r: 3.5, fill: col, visibility: "hidden" });
    svg.appendChild(vline); svg.appendChild(dot);
    svg.addEventListener("mousemove", (e) => {
      // Convert the mouse's screen position into the SVG's own user-space
      // (viewBox) coordinates via its live screen CTM, rather than re-deriving
      // the scale from getBoundingClientRect().width. The two disagree under
      // the app's CSS `zoom` UI-scaling feature (client rect and mouse-event
      // coordinates can be reported in different pixel spaces at non-100%
      // zoom) — that mismatch is exactly what made the crosshair drift away
      // from the actual cursor position. getScreenCTM() reflects whatever
      // transform the browser truly applied, so inverting it is always exact.
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      let pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      pt = pt.matrixTransform(ctm.inverse());
      let i = Math.round(((pt.x - m.l) / iw) * (points.length - 1));
      i = Math.max(0, Math.min(points.length - 1, i));
      const x = X(i), y = Y(points[i].close);
      vline.setAttribute("x1", x); vline.setAttribute("x2", x); vline.setAttribute("visibility", "visible");
      dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("visibility", "visible");
      tip.style.display = "block";
      tip.innerHTML = `${points[i].date}<br><b>${points[i].close.toFixed(2)}</b>`;
      // Tooltip is a plain HTML div (not SVG), positioned relative to
      // `container` in real CSS pixels — map the same point forward through
      // the CTM to screen space, then into container-relative coordinates.
      let tipPt = svg.createSVGPoint();
      tipPt.x = x; tipPt.y = y;
      tipPt = tipPt.matrixTransform(ctm);
      const containerRect = container.getBoundingClientRect();
      const left = Math.min(tipPt.x - containerRect.left + 12, container.clientWidth - 110);
      const top = tipPt.y - containerRect.top - 10;
      tip.style.left = left + "px"; tip.style.top = top + "px";
    });
    svg.addEventListener("mouseleave", () => { vline.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tip.style.display = "none"; });
  }

  /* Grouped bars over N series, with optional line series on a 2nd (right) axis.
     data:   [{period, <key>: value, ...}]
     series: [{key, label, color}]  (color "accent" -> theme accent)
     opts.lines:  [{key, label, color}] drawn as lines on a right-hand axis.
       A line may set `indep:true` to plot on its own private scale (different
       unit from the other lines — e.g. a $ line among % lines; no axis label)
       and `fmt:(v)=>str` for its own tooltip formatting.
     opts.yFmt / opts.y2Fmt: axis label formatters (default fmtAxis) */
  function bars(container, data, series, opts = {}) {
    container.innerHTML = "";
    const lines = opts.lines || [];
    // sharedAxis: line series plot on the SAME scale as the bars, instead of
    // an independently-scaled right axis — for series that are the same unit
    // as the bars (e.g. a % reference line against % bars) where the two need
    // to be directly, visually comparable rather than each auto-fit to its
    // own range.
    const shared = !!opts.sharedAxis;
    const yFmt = opts.yFmt || fmtAxis, y2Fmt = opts.y2Fmt || fmtAxis;
    const keys = series.map((s) => s.key);
    const lkeys = lines.map((s) => s.key);
    data = data.filter((d) => keys.some((k) => d[k] != null) || lkeys.some((k) => d[k] != null));
    if (!data.length) { container.innerHTML = '<div class="empty"><div class="hint">No statement data</div></div>'; return; }
    const W = container.clientWidth || 760, H = opts.height || 260;
    const m = { t: 14, r: (lines.some((s) => !s.indep) && !shared) ? 46 : 14, b: 26, l: 54 };
    const valKeys = shared ? keys.concat(lkeys) : keys;
    const vals = data.flatMap((d) => valKeys.map((k) => d[k])).filter((v) => v != null);
    let hi = Math.max(...vals, 0), lo = Math.min(...vals, 0);
    const pad = (hi - lo) * 0.1 || 1; hi += pad; if (lo < 0) lo -= pad;
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const Y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
    const group = iw / data.length;
    const n = series.length;
    const slot = Math.min((group * 0.78) / n, 30);   // per-bar width
    const bw = Math.max(slot - 1.5, 2);              // leave a hairline gap
    const totalW = slot * n;
    const colorOf = (s) => (s.color === "accent" ? accent() : s.color);

    // secondary (right) axis scale for line series — skipped when sharedAxis,
    // where LY just reuses the bars' own Y().
    // A line flagged `indep` is a different unit from the other lines (e.g. an
    // EPS $ line among % lines): it gets its OWN private scale, fit to its own
    // range, so it doesn't distort the shared right axis and isn't drawn on the
    // axis labels. Its value still shows in the tooltip via the series' `fmt`.
    const pooledLines = lines.filter((s) => !s.indep);
    const indepLines = lines.filter((s) => s.indep);
    const pkeys = pooledLines.map((s) => s.key);
    let lLo = 0, lHi = 1;
    if (pooledLines.length && !shared) {
      const lv = data.flatMap((d) => pkeys.map((k) => d[k])).filter((v) => v != null);
      if (lv.length) {
        lHi = Math.max(...lv, 0); lLo = Math.min(...lv, 0);
        const lp = (lHi - lLo) * 0.12 || 1; lHi += lp; if (lLo < 0) lLo -= lp;
      }
    }
    const LY = shared ? Y : (v) => m.t + ih - ((v - lLo) / (lHi - lLo)) * ih;
    // per-series independent mapping for `indep` lines, fit tightly to their
    // own [min,max] (no forced zero) so a modestly-moving line still reads.
    const indepY = {};
    indepLines.forEach((s) => {
      const iv = data.map((d) => d[s.key]).filter((v) => v != null);
      if (!iv.length) return;
      let iLo = Math.min(...iv), iHi = Math.max(...iv);
      if (iLo === iHi) { iLo -= 1; iHi += 1; }
      const ip = (iHi - iLo) * 0.12; iHi += ip; iLo -= ip;
      indepY[s.key] = (v) => m.t + ih - ((v - iLo) / (iHi - iLo)) * ih;
    });

    const svg = el("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, height: H });
    for (let g = 0; g <= 4; g++) {
      const yv = lo + (g / 4) * (hi - lo), y = Y(yv);
      svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: "#1a232e" }));
      const tx = el("text", { x: m.l - 8, y: y + 3, fill: "#566272", "text-anchor": "end", "font-size": 10, "font-family": "monospace" });
      tx.textContent = yFmt(yv); svg.appendChild(tx);
      if (pooledLines.length && !shared) {
        const lv2 = lLo + (g / 4) * (lHi - lLo);
        const rx = el("text", { x: W - m.r + 8, y: y + 3, fill: "#566272", "text-anchor": "start", "font-size": 10, "font-family": "monospace" });
        rx.textContent = y2Fmt(lv2); svg.appendChild(rx);
      }
    }
    const zero = Y(0);
    // Faint band highlighting the hovered year's column, drawn under the bars.
    const band = el("rect", { y: m.t, width: group, height: ih, fill: "#ffffff", opacity: 0.05, visibility: "hidden" });
    svg.appendChild(band);
    data.forEach((d, i) => {
      const cx = m.l + group * i + group / 2;
      const start = cx - totalW / 2;
      series.forEach((s, si) => {
        const v = d[s.key];
        if (v == null) return;
        const y = Y(v);
        svg.appendChild(el("rect", { x: start + si * slot, y: Math.min(y, zero), width: bw, height: Math.abs(zero - y), fill: colorOf(s), rx: 1.5 }));
      });
      const t = el("text", { x: cx, y: H - 8, fill: "#566272", "text-anchor": "middle", "font-size": 10, "font-family": "monospace" });
      t.textContent = d.period; svg.appendChild(t);
    });
    // line series on the secondary axis (drawn over the bars)
    lines.forEach((s) => {
      const col = colorOf(s);
      const map = s.indep ? (indepY[s.key] || LY) : LY;
      const pts = [];
      data.forEach((d, i) => {
        const v = d[s.key];
        if (v == null) return;
        pts.push({ x: m.l + group * i + group / 2, y: map(v), v, period: d.period });
      });
      if (!pts.length) return;
      if (pts.length > 1) {
        let path = "";
        pts.forEach((p, i) => { path += `${i ? "L" : "M"} ${p.x} ${p.y} `; });
        svg.appendChild(el("path", { d: path.trim(), fill: "none", stroke: col, "stroke-width": 1.8 }));
      }
      pts.forEach((p) => svg.appendChild(el("circle", { cx: p.x, cy: p.y, r: 2.8, fill: col })));
    });

    // ---- unified per-year hover tooltip -------------------------------------
    // One transparent zone spans each year's whole column, so the mouse never
    // has to land on a specific bar or line point. The tooltip lists every
    // series' value for that year at once, appearing instantly (no native
    // <title> hover delay).
    const tip = document.createElement("div");
    tip.style.cssText = "position:absolute;pointer-events:none;background:#0d141c;border:1px solid #28333f;" +
      "border-radius:6px;padding:7px 9px;font:11px monospace;color:#d7e0ea;display:none;z-index:9;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.45)";
    container.style.position = "relative"; container.appendChild(tip);

    const swatch = (c, isLine) => `<span style="display:inline-block;width:9px;height:${isLine ? 3 : 9}px;` +
      `border-radius:2px;background:${c};margin-right:6px;vertical-align:middle"></span>`;
    const trow = (c, label, val, isLine) =>
      `<div style="display:flex;justify-content:space-between;gap:16px;line-height:1.55">` +
      `<span>${swatch(c, isLine)}${label}</span><b>${val}</b></div>`;

    function tipHTML(d) {
      let html = `<div style="margin-bottom:4px;color:#8b97a5">${d.period}</div>`;
      series.forEach((s) => {
        const v = d[s.key];
        if (v != null) html += trow(colorOf(s), s.label, yFmt(v) + (s.tip ? s.tip(d) : ""), false);
      });
      lines.forEach((s) => {
        const v = d[s.key];
        if (v != null) html += trow(colorOf(s), s.label, (s.fmt || y2Fmt)(v), true);
      });
      return html;
    }

    function showTip(i, e) {
      band.setAttribute("x", m.l + group * i); band.setAttribute("visibility", "visible");
      tip.style.display = "block"; tip.innerHTML = tipHTML(data[i]);
      const r = container.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      tip.style.left = Math.max(4, Math.min(px + 14, r.width - tip.offsetWidth - 6)) + "px";
      tip.style.top = Math.max(4, py - tip.offsetHeight - 12) + "px";
    }

    data.forEach((d, i) => {
      const zone = el("rect", { x: m.l + group * i, y: m.t, width: group, height: H - m.t - 4, fill: "transparent", "pointer-events": "all", style: "cursor:crosshair" });
      zone.addEventListener("mousemove", (e) => showTip(i, e));
      svg.appendChild(zone);
    });
    svg.addEventListener("mouseleave", () => { band.setAttribute("visibility", "hidden"); tip.style.display = "none"; });

    container.appendChild(svg);
  }

  return { line, bars };
})();
