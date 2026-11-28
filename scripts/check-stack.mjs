// Browser check for #/dev/stack: renders frozen frames at every beat, plus the
// live transport bar, and fails on clipping, overlap, console errors or a fit
// header that disagrees with the table. Screenshots go to OUT_DIR.
//
//   npm i --no-save playwright && npx playwright install chromium   # once
//   node scripts/check-stack.mjs [390x844 1440x900 ...]
//
// Env: BASE_URL (use a running dev server; otherwise one is started),
//      OUT_DIR (default: <os tmp>/check-stack),
//      PLAYWRIGHT_MODULE (path to a playwright entry file, if it is not
//      installed in this repo's node_modules).

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = process.env.OUT_DIR ?? join(tmpdir(), "check-stack");
const VIEWPORTS = (process.argv.slice(2).length ? process.argv.slice(2) : ["390x844", "1440x900"]).map((v) => {
  const [width, height] = v.split("x").map(Number);
  if (!width || !height) throw new Error(`Bad viewport "${v}", expected WIDTHxHEIGHT`);
  return { width, height };
});

// Frozen-frame times (ms): inside or at the end of every phase in src/chapters/stack/beats.ts.
const FRAMES = {
  card: 600,
  turn_mid: 1550,
  values_mid: 2900,
  shrink_mid: 4250,
  reveal_mid: 6100,
  grid_end: 8300,
  flip_mid: 10600,
  settle_mid: 12900,
  markers_mid: 14500,
  observed_mid: 15700,
  gather_row1: 17400,
  gather_row2: 18900,
  gather_row3: 20400,
  gather_wave: 22800,
  morph_end: 23150,
  highlight_mid: 23200,
  end: 23400,
};
// From here on only the table is on screen, so its text must be legible.
const TABLE_FRAMES = new Set(["morph_end", "highlight_mid", "end"]);
const MIN_TABLE_FONT_PX = 7;
const LIVE_BEATS = ["morph", "highlight", "end"];

let playwright;
try {
  playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
} catch {
  console.error("playwright is not installed. Run: npm i --no-save playwright && npx playwright install chromium");
  process.exit(2);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startDevServer() {
  const port = await freePort();
  const child = spawn("npx", ["vite", "--port", String(port), "--strictPort"], { cwd: root, stdio: "pipe" });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return { url, stop: () => child.kill() };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error("dev server did not start");
}

/** Runs in the page. Extents of everything visible in the stage, plus the header and bar. */
function measure() {
  const stage = document.querySelector("[data-testid=stack-stage]");
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, minFont = Infinity;
  for (const el of stage.querySelectorAll("*")) {
    let opacity = 1;
    for (let n = el; n && n !== stage.parentElement; n = n.parentElement) opacity *= parseFloat(getComputedStyle(n).opacity);
    if (opacity < 0.15) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const style = getComputedStyle(el);
    const hasText = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    const paints =
      hasText || style.backgroundImage !== "none" || style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.borderTopWidth !== "0px";
    if (!paints) continue;
    minX = Math.min(minX, r.left);
    minY = Math.min(minY, r.top);
    maxX = Math.max(maxX, r.right);
    maxY = Math.max(maxY, r.bottom);
    if (hasText) minFont = Math.min(minFont, parseFloat(style.fontSize) * (r.width / el.offsetWidth || 1));
  }
  const rect = (sel) => document.querySelector(sel)?.getBoundingClientRect();
  const header = rect("[data-testid=fit-header]");
  const bar = rect("[data-playback-ui]");
  const doc = document.documentElement;
  return {
    content: { minX, minY, maxX, maxY },
    minFont,
    viewport: { width: innerWidth, height: innerHeight },
    headerBottom: header ? header.bottom : null,
    barTop: bar ? bar.top : null,
    pageScrolls: doc.scrollWidth > innerWidth || doc.scrollHeight > innerHeight,
  };
}

/** Pure checks on one measurement. Returns a list of failure messages. */
function problems(m, { table }) {
  const out = [];
  const c = m.content;
  const eps = 0.5;
  if (c.minX < -eps || c.minY < -eps || c.maxX > m.viewport.width + eps || c.maxY > m.viewport.height + eps) {
    out.push(`content clipped by viewport [${[c.minX, c.minY, c.maxX, c.maxY].map(Math.round)}]`);
  }
  if (m.headerBottom !== null && c.minY < m.headerBottom - eps) out.push("content overlaps the fit header");
  if (m.barTop !== null && c.maxY > m.barTop + eps) out.push("content overlaps the transport bar");
  if (m.pageScrolls) out.push("page scrolls");
  if (table && m.minFont < MIN_TABLE_FONT_PX) out.push(`table text ${m.minFont.toFixed(1)}px < ${MIN_TABLE_FONT_PX}px`);
  return out;
}

/** Runs in the page. The three foreground rows (ids and k/10) and the header rows. */
function readTable() {
  const stage = document.querySelector("[data-testid=stack-stage]");
  const mono = [...stage.querySelectorAll("span.font-mono")].map((e) => e.textContent.trim());
  const ids = mono.filter((t) => /^[0-9a-f]{8}$/.test(t));
  const counts = mono.filter((t) => /^\d+\/10$/.test(t));
  const header = [...document.querySelectorAll("[data-testid=fit-header] tbody tr")].map((tr) =>
    [...tr.children].map((td) => td.textContent.replace(/\s*\(.*\)$/, "").trim()),
  );
  return { ids, counts, header };
}

const server = process.env.BASE_URL ? { url: process.env.BASE_URL, stop() {} } : await startDevServer();
mkdirSync(OUT_DIR, { recursive: true });
const browser = await playwright.chromium.launch();
let failures = 0;
const fail = (where, msg) => {
  failures++;
  console.error(`FAIL ${where}: ${msg}`);
};

try {
  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}x${vp.height}`;
    const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const logs = [];
    page.on("pageerror", (e) => logs.push(`pageerror: ${e}`));
    page.on("console", (msg) => ["error", "warning"].includes(msg.type()) && logs.push(`${msg.type()}: ${msg.text()}`));

    for (const [name, ms] of Object.entries(FRAMES)) {
      await page.goto(`${server.url}/?t=${ms}#/dev/stack`);
      await page.waitForSelector("[data-testid=stack-stage]");
      await page.waitForTimeout(150);
      const m = await page.evaluate(measure);
      await page.screenshot({ path: join(OUT_DIR, `${tag}-${name}.png`) });
      for (const p of problems(m, { table: TABLE_FRAMES.has(name) })) fail(`${tag} ${name}`, p);
      if (name === "end") {
        const t = await page.evaluate(readTable);
        const headerIds = t.header.map((r) => r[0]);
        const headerCounts = t.header.map((r) => r[1]);
        if (JSON.stringify(t.ids) !== JSON.stringify(headerIds)) fail(`${tag} end`, `row ids ${t.ids} != header ${headerIds}`);
        if (JSON.stringify(t.counts) !== JSON.stringify(headerCounts)) fail(`${tag} end`, `row counts ${t.counts} != header ${headerCounts}`);
        if (t.ids.length !== 3) fail(`${tag} end`, `expected 3 table rows, found ${t.ids.length}`);
        console.log(`${tag} table: ${t.ids.map((id, i) => `${id} ${t.counts[i]}`).join(", ")}`);
      }
    }

    // Live: the real transport bar on the engine clock.
    await page.goto(`${server.url}/#/dev/stack`);
    await page.waitForSelector("[data-playback-ui]");
    for (const beat of LIVE_BEATS) {
      await page.click(`[data-playback-ui] button:text-is("${beat}")`);
      await page.waitForTimeout(150);
      const m = await page.evaluate(measure);
      await page.screenshot({ path: join(OUT_DIR, `${tag}-live-${beat}.png`) });
      for (const p of problems(m, { table: TABLE_FRAMES.has(beat) })) fail(`${tag} live:${beat}`, p);
    }

    for (const line of logs) fail(tag, `console ${line}`);
    console.log(`${tag}: ${Object.keys(FRAMES).length} frames + ${LIVE_BEATS.length} live beats checked`);
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

console.log(`screenshots: ${OUT_DIR}`);
if (failures) {
  console.error(`check-stack: ${failures} failure(s)`);
  process.exit(1);
}
console.log("check-stack: ok");
