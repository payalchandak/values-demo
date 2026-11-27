/*
 * Live-clock Playwright check of the ending chapters at 390x844 and 1440x900.
 *
 *   npx vite --port 5199 &            (from the repo root)
 *   NODE_PATH=<dir containing playwright> node src/chapters/ending/verify.playwright.cjs
 *
 * Pass 1 records every animation frame while the real clock plays both
 * chapters straight through (no screenshots, so nothing perturbs timing) and
 * analyzes clipping, overlap and jumps. Pass 2 replays on the live clock and
 * screenshots every beat plus mid-transition moments into ./ending-shots/.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const URL = process.env.URL || "http://localhost:5199/#/dev/ending";
const OUT = process.env.OUT || path.join(process.cwd(), "ending-shots");
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "1440x900", width: 1440, height: 900 },
];

// Live-clock moments (ms from start of playback). Chapter 1 pitch 3650 (hold 3500 + scroll 150), 3 models:
// ends 10800. Chapter 2 starts at 10800: shrink 0-150, physicians 205-, hold 3600, question 7600, end 12000.
const MODEL_HOLD_MS = 3500;
const MODEL_SCROLL_MS = 150;
const PITCH_MS = MODEL_HOLD_MS + MODEL_SCROLL_MS;
const CH1_END = 2 * PITCH_MS + MODEL_HOLD_MS;
const CH2 = CH1_END;
const SHRINK_MS = 150;
const QUESTION_MS = 7600;
const QUESTION_FADE_MS = 80;
const SHOTS = [
  ["ch1-beat-gpt", 600],
  ["ch1-hold-gpt-late", 3300],
  ["ch1-scroll-gpt-claude-early", MODEL_HOLD_MS + 30],
  ["ch1-scroll-gpt-claude-mid", MODEL_HOLD_MS + 75],
  ["ch1-scroll-gpt-claude-late", MODEL_HOLD_MS + 120],
  ["ch1-beat-claude", PITCH_MS + 600],
  ["ch1-scroll-claude-gemini-mid", PITCH_MS + MODEL_HOLD_MS + 75],
  ["ch1-beat-gemini", 2 * PITCH_MS + 600],
  ["ch1-end", CH1_END - 300],
  ["ch2-beat-models-start", CH2 + 40],
  ["ch2-shrink-mid", CH2 + 75],
  ["ch2-shrink-late", CH2 + 130],
  ["ch2-models-settled", CH2 + 200],
  ["ch2-beat-physicians-mid", CH2 + 205 + 4 * 55],
  ["ch2-beat-hold", CH2 + 3700],
  ["ch2-hold-late", CH2 + 7400],
  ["ch2-question-mid", CH2 + QUESTION_MS + 40],
  ["ch2-beat-question", CH2 + QUESTION_MS + QUESTION_FADE_MS + 40],
  ["ch2-end", CH2 + 12000 - 200],
];

/** Installed in the page: records every frame's geometry. */
function recorder() {
  const frames = [];
  const effOpacity = (el) => {
    let o = 1;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      o *= parseFloat(cs.opacity);
      if (cs.visibility === "hidden") return 0;
    }
    return o;
  };
  const r2 = (n) => Math.round(n * 10) / 10;
  const rect = (el) => {
    const b = el.getBoundingClientRect();
    return [r2(b.left), r2(b.top), r2(b.right), r2(b.bottom)];
  };
  const stageEl = () => document.querySelector("main");
  const tick = (now) => {
    const stage = stageEl();
    if (stage) {
      const atoms = [];
      // Radars
      for (const svg of stage.querySelectorAll('svg[role="img"]')) {
        const title = svg.querySelector("title")?.textContent ?? "?";
        atoms.push({ kind: "radar", id: title, rect: rect(svg), o: effOpacity(svg) });
        // text inside the svg must stay inside it
        const sr = svg.getBoundingClientRect();
        for (const t of svg.querySelectorAll("text")) {
          const tr = t.getBoundingClientRect();
          if (tr.width === 0) continue;
          if (tr.left < sr.left - 0.5 || tr.right > sr.right + 0.5 || tr.top < sr.top - 0.5 || tr.bottom > sr.bottom + 0.5) {
            atoms.push({ kind: "svg-text-clipped", id: title + ":" + t.textContent, rect: rect(t), o: effOpacity(svg) });
          }
        }
      }
      for (const img of stage.querySelectorAll("img")) atoms.push({ kind: "icon", id: img.alt, rect: rect(img.parentElement), o: effOpacity(img) });
      for (const el of stage.querySelectorAll("span.text-sm, span.text-xs, span.text-xl, h2, p")) {
        if (!el.textContent.trim()) continue;
        // text rect (inline) via range
        const range = document.createRange();
        range.selectNodeContents(el);
        const b = range.getBoundingClientRect();
        atoms.push({ kind: "text", id: el.textContent.trim().slice(0, 24), rect: [r2(b.left), r2(b.top), r2(b.right), r2(b.bottom)], o: effOpacity(el) });
      }
      for (const el of stage.querySelectorAll("a, button")) atoms.push({ kind: "button", id: el.textContent.trim(), rect: rect(el), o: effOpacity(el) });
      const legend = stage.querySelector("ul");
      if (legend) atoms.push({ kind: "legend", id: "legend", rect: rect(legend), o: effOpacity(legend) });
      const hud = document.querySelector("div.fixed[data-playback-ui]");
      const label = stage.querySelector("header span")?.textContent ?? "";
      const stageRect = stage.querySelector("div.relative.min-h-0");
      frames.push({
        t: now,
        label,
        atoms,
        hud: hud ? rect(hud) : null,
        body: stageRect ? rect(stageRect) : null,
        docScroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      });
    }
    window.__frames = frames;
    window.__raf = requestAnimationFrame(tick);
  };
  window.__raf = requestAnimationFrame(tick);
}

const inter = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 1 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1;

function analyze(vp, frames) {
  let cut = null;
  const findings = new Map();
  const add = (key, detail) => {
    const f = findings.get(key) ?? { count: 0, first: detail, firstT: detail.t };
    f.count++;
    findings.set(key, f);
  };
  const t0 = frames[0].t;
  const W = vp.width, H = vp.height;
  // Phase of each frame, by label and time since the chapter switched.
  let chapterStart = t0;
  let prevLabel = frames[0].label;
  const phased = frames.map((f) => {
    if (f.label !== prevLabel) {
      chapterStart = f.t;
      prevLabel = f.label;
    }
    return { ...f, ch: f.label.startsWith("MODELS") || /models and/i.test(f.label) ? 2 : 1, tc: f.t - chapterStart };
  });

  for (const f of phased) {
    const t = Math.round(f.t - t0);
    const settled =
      f.ch === 1
        ? !(f.tc < 2 * PITCH_MS && f.tc % PITCH_MS > MODEL_HOLD_MS - 40) // not during a scroll window
        : (f.tc > SHRINK_MS + 40 && f.tc < QUESTION_MS) || f.tc > QUESTION_MS + QUESTION_FADE_MS + 40;
    const visible = f.atoms.filter((a) => a.o > 0.4);
    // Clipping against the viewport (HUD excluded) when settled.
    if (f.docScroll[0] > W || f.docScroll[1] > H) add("page scrolls (document larger than viewport)", { t, v: f.docScroll });
    for (const a of visible) {
      if (a.kind === "svg-text-clipped") add(`radar label clipped inside its svg: ${a.id}`, { t, ...a });
      if (!settled) continue;
      const [l, tp, r, b] = a.rect;
      if (r < 0 || l > W || b < 0 || tp > H) continue; // fully off-screen slot (ch1 neighbors)
      if (l < -0.5 || tp < -0.5 || r > W + 0.5 || b > H + 0.5) add(`clipped by viewport: ${a.kind} "${a.id}"`, { t, ...a });
    }
    // Overlaps among visible atoms when settled.
    if (settled) {
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          const a = visible[i], b = visible[j];
          if (a.kind === "svg-text-clipped" || b.kind === "svg-text-clipped") continue;
          const [al, at, ar, ab] = a.rect, [bl, bt] = [b.rect[0], b.rect[1]];
          void al; void at; void ar; void ab; void bl; void bt;
          // skip anything fully off-screen (ch1 neighbors)
          const off = (x) => x.rect[2] < 0 || x.rect[0] > W || x.rect[3] < 0 || x.rect[1] > H;
          if (off(a) || off(b)) continue;
          if (inter(a.rect, b.rect)) add(`overlap: ${a.kind} "${a.id}" x ${b.kind} "${b.id}" (ch${f.ch})`, { t, a, b });
        }
      }
      if (f.hud) {
        for (const a of visible) {
          if (a.kind === "svg-text-clipped") continue;
          if (inter(a.rect, f.hud)) add(`HUD covers ${a.kind} "${a.id}" (ch${f.ch})`, { t, ...a });
        }
      }
    }
  }

  // Jumps: per element id, frame-to-frame motion of center and size. Eased motion has small second differences.
  const byId = new Map();
  phased.forEach((f, idx) => {
    for (const a of f.atoms) {
      if (a.kind !== "radar" || a.o < 0.05) continue;
      const k = a.id;
      if (!byId.has(k)) byId.set(k, []);
      byId.get(k).push({ idx, ch: f.ch, t: f.t, tc: f.tc, cx: (a.rect[0] + a.rect[2]) / 2, cy: (a.rect[1] + a.rect[3]) / 2, w: a.rect[2] - a.rect[0], o: a.o });
    }
  });
  for (const [id, s] of byId) {
    for (let i = 1; i < s.length - 1; i++) {
      const p = s[i - 1], c = s[i], n = s[i + 1];
      if (c.ch !== p.ch || c.ch !== n.ch || n.idx - p.idx !== 2) continue; // across a chapter cut or a skipped frame
      const dtp = c.t - p.t, dtn = n.t - c.t;
      if (dtp > 40 || dtn > 40) continue; // long frame (clock clamps), not a layout jump
      // acceleration in px/ms^2 scaled to a 16.7ms frame
      const accel = (v1, v2, v3) => ((v3 - v2) / dtn - (v2 - v1) / dtp) / ((dtn + dtp) / 2) * 16.7 * 16.7;
      const ay = accel(p.cy, c.cy, n.cy), ax = accel(p.cx, c.cx, n.cx), aw = accel(p.w, c.w, n.w);
      const lim = 14; // px of change-in-per-frame-step; eased motion here is well under this
      if (Math.abs(ay) > lim || Math.abs(ax) > lim || Math.abs(aw) > lim)
        add(`jump in "${id}" (ch${c.ch})`, { t: Math.round(c.t - t0), ax: +ax.toFixed(1), ay: +ay.toFixed(1), aw: +aw.toFixed(1) });
      // Held radar must not drift during a hold.
      if (c.ch === 1) {
        const nearHold = (c.tc % PITCH_MS) < MODEL_HOLD_MS - 100 && Math.abs(c.cy - p.cy) > 0.6 && Math.abs(c.cy - n.cy) > 0.6 && Math.abs(p.cy - n.cy) < 0.2;
        if (nearHold) add(`held radar wobbles "${id}"`, { t: Math.round(c.t - t0) });
      }
    }
  }
  // Chapter cut: the anchor model (gemini) must be at the same center and plot size on either side.
  {
    const cutIdx = phased.findIndex((f, i) => i > 0 && f.ch !== phased[i - 1].ch);
    if (cutIdx > 0) {
      const get = (f) => f.atoms.find((a) => a.kind === "radar" && a.id === "Gemini priorities" && a.o > 0.9);
      const before = get(phased[cutIdx - 1]), after = get(phased[cutIdx]);
      if (before && after) {
        const c = (r) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
        const plot = (r, ch) => (r[2] - r[0]) * (ch === 1 ? 104 / 416 : 38 / 120);
        const [bx, by] = c(before.rect), [ax, ay] = c(after.rect);
        cut = { dCenter: +Math.hypot(ax - bx, ay - by).toFixed(1), dPlotRadius: +(plot(after.rect, 2) - plot(before.rect, 1)).toFixed(1), cutAtMs: Math.round(phased[cutIdx].t - t0) };
        if (cut.dCenter > 2 || Math.abs(cut.dPlotRadius) > 2) add("chapter cut: anchor radar jumps (center/plot size)", { t: cut.cutAtMs, ...cut });
      } else add("chapter cut: anchor radar not found on both sides", { t: 0 });
    }
  }
  // Held radar center: where is it during holds?
  const holdPos = [];
  for (const f of phased) {
    if (f.ch !== 1) continue;
    const m = f.tc % PITCH_MS;
    if (m < MODEL_HOLD_MS - 200 && m > 400) {
      const best = f.atoms.filter((a) => a.kind === "radar" && a.o > 0.4).sort((a, b) => Math.abs((a.rect[1] + a.rect[3]) / 2 - H / 2) - Math.abs((b.rect[1] + b.rect[3]) / 2 - H / 2))[0];
      if (best) holdPos.push([(best.rect[0] + best.rect[2]) / 2, (best.rect[1] + best.rect[3]) / 2, best.rect[2] - best.rect[0]]);
    }
  }
  const spread = (i) => holdPos.length ? +(Math.max(...holdPos.map((p) => p[i])) - Math.min(...holdPos.map((p) => p[i]))).toFixed(1) : null;
  const heldSummary = holdPos.length ? { cx: +(holdPos.reduce((s, p) => s + p[0], 0) / holdPos.length).toFixed(1), cxSpread: spread(0), cySpread: spread(1), widthSpread: spread(2), w: +holdPos[0][2].toFixed(1), viewportCenterX: W / 2 } : null;

  return { findings, cut, heldSummary, frameCount: frames.length, durationMs: Math.round(frames[frames.length - 1].t - t0) };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let failed = false;
  for (const vp of VIEWPORTS) {
    console.log(`\n===== ${vp.name} =====`);
    // ---- Pass 1: record every frame on the live clock ----
    {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
        if (m.type() === "log" && m.text().startsWith("[ending]")) console.log("  console:", m.text());
      });
      await page.goto(URL);
      await page.waitForSelector("main svg");
      await page.waitForTimeout(500);
      await page.evaluate(`(${recorder})()`);
      await page.evaluate(() => document.querySelector('[aria-label="Restart"]').click()); // live clock from 0
      const start = Date.now();
      await page.waitForFunction(() => document.body.innerText.includes("Read the paper") && window.__frames?.length > 0 && !document.querySelector('[aria-label^="Pause"]'), null, { timeout: 40000, polling: 200 });
      const frames = await page.evaluate(() => window.__frames);
      console.log(`  live run took ${((Date.now() - start) / 1000).toFixed(1)}s, ${frames.length} frames`);
      const { findings, heldSummary, durationMs, cut } = analyze(vp, frames);
      console.log("  chapter cut (anchor radar before/after):", JSON.stringify(cut));
      console.log(`  recorded ${durationMs}ms; held radar (ch1):`, JSON.stringify(heldSummary));
      const hdr = await page.evaluate(() => document.querySelector('[data-testid="ending-selection"]')?.textContent);
      console.log("  dev header:", hdr);
      if (errors.length) { failed = true; console.log("  CONSOLE/PAGE ERRORS:", errors); }
      if (findings.size === 0) console.log("  findings: none");
      for (const [k, v] of findings) {
        failed = true;
        console.log(`  FINDING x${v.count}: ${k}  first@${v.first.t}ms ${JSON.stringify(v.first).slice(0, 160)}`);
      }
      await ctx.close();
    }
    // ---- Pass 2: screenshots on the live clock ----
    {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(URL);
      await page.waitForSelector("main svg");
      await page.waitForTimeout(500);
      await page.evaluate(() => document.querySelector('[aria-label="Restart"]').click());
      const t0 = await page.evaluate(() => performance.now());
      for (const [name, at] of SHOTS) {
        await page.waitForFunction(([t0, at]) => performance.now() - t0 >= at, [t0, at], { polling: "raf", timeout: 60000 });
        const actual = Math.round(await page.evaluate((t0) => performance.now() - t0, t0));
        await page.screenshot({ path: path.join(OUT, `${vp.name}-${name}.png`) });
        console.log(`  shot ${name} @${actual}ms (target ${at})`);
      }
      await ctx.close();
    }
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
