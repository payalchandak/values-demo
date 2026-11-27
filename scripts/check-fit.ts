// Fit check for every chapter, at 1440x900 and 390x844.
//
// Plays the main demo (/) and each registered dev route (#/dev/<name>) in
// real time, sampling every SAMPLE_MS. Each sample fails on content that
// is clipped by the viewport, text clipped by its own box, a horizontally
// scrolling page, or an unscrollable page overflow. Console errors and page
// errors fail the run. Screenshots land in OUT_DIR.
//
//   npx playwright install chromium   # once
//   npm run check:fit [-- 390x844 1440x900 ...]
//
// Env: BASE_URL  use a running dev server (otherwise one is started)
//      OUT_DIR   screenshots (default: <os tmp>/check-fit)
//      ONLY      comma-separated targets to run, e.g. ONLY=main,stack
// (Node >= 22.18 strips TypeScript types natively.)

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = process.env.OUT_DIR ?? join(tmpdir(), "check-fit");
const SAMPLE_MS = 400;
const MAIN_MS = 172_000; // all ten chapters (about 168s), plus margin
const DEV_MS = 40_000;

const VIEWPORTS = (process.argv.slice(2).length ? process.argv.slice(2) : ["1440x900", "390x844"]).map((v) => {
  const [width, height] = v.split("x").map(Number);
  if (!width || !height) throw new Error(`Bad viewport "${v}", expected WIDTHxHEIGHT`);
  return { width, height };
});

// Dev routes come from the registry so a new chapter is covered automatically.
const registrySource = readFileSync(join(root, "src/dev/registry.ts"), "utf8");
const devNames = [...registrySource.replace(/^\s*\/\/.*$/gm, "").matchAll(/\{\s*name:\s*"([^"]+)"/g)].map((m) => m[1]);
const only = process.env.ONLY?.split(",");
const TARGETS = [
  { name: "main", hash: "", ms: MAIN_MS },
  ...devNames.map((name) => ({ name, hash: `#/dev/${name}`, ms: DEV_MS })),
].filter((t) => t.name !== "primitives" && (!only || only.includes(t.name))); // primitives is a gallery, not a chapter

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function startDevServer() {
  const port = await freePort();
  const child = spawn("npx", ["vite", "--port", String(port), "--strictPort", "--bypass-lock"], { cwd: root, stdio: "pipe" });
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

/** Runs in the page. Returns the fit problems visible right now. */
function measure(): string[] {
  const eps = 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out: string[] = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > vw + eps) out.push(`page scrolls horizontally (${doc.scrollWidth} > ${vw})`);

  const label = (el: Element) => {
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `<${el.tagName.toLowerCase()}>${text ? ` "${text}"` : ""}`;
  };
  const scrollsY = (el: Element) => {
    const s = getComputedStyle(el);
    return ["auto", "scroll"].includes(s.overflowY) && el.scrollHeight > el.clientHeight;
  };
  const visible = (el: Element) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) < 0.15) return false;
    }
    return true;
  };

  /** Entirely outside an ancestor that clips it (overflow hidden/clip): not on screen by design. */
  const hiddenByAncestor = (el: Element, r: DOMRect) => {
    // A scrolling track clips by design: slides entering or leaving are partly out of frame.
    if (el.closest("[data-scroll-track]")) return true;
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (!["hidden", "clip"].includes(s.overflowX) && !["hidden", "clip"].includes(s.overflowY)) continue;
      const c = n.getBoundingClientRect();
      if (r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom) return true;
    }
    return false;
  };

  const reported = new Set<string>();
  const add = (msg: string) => {
    if (!reported.has(msg) && out.length < 8) {
      reported.add(msg);
      out.push(msg);
    }
  };

  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("[data-playback-ui]") || el instanceof SVGElement && !(el instanceof SVGSVGElement)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || !visible(el) || hiddenByAncestor(el, r)) continue;
    const style = getComputedStyle(el);
    const hasText = [...el.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? "").trim());

    // Text cut off by its own overflow:hidden box.
    if (hasText && ["hidden", "clip"].includes(style.overflowX) && el.scrollWidth > el.clientWidth + eps) {
      add(`text clipped by its box: ${label(el)}`);
    }

    if (!hasText && !(el instanceof HTMLImageElement) && !(el instanceof SVGSVGElement)) continue;
    // Anything inside a vertical scroller may legitimately sit below the fold.
    let scroller: Element | null = null;
    for (let n = el.parentElement; n; n = n.parentElement) if (scrollsY(n)) scroller = n;
    const clipAgainst = scroller ? scroller.getBoundingClientRect() : { left: 0, top: 0, right: vw, bottom: vh };
    const horizontal = r.left < -eps || r.right > vw + eps;
    const vertical = !scroller && (r.top < -eps || r.bottom > vh + eps);
    if (horizontal || vertical) {
      add(`clipped by viewport [${[r.left, r.top, r.right, r.bottom].map(Math.round)}]: ${label(el)}`);
    } else if (scroller && (r.left < clipAgainst.left - eps || r.right > clipAgainst.right + eps)) {
      add(`clipped by scroll container [${[r.left, r.right].map(Math.round)}]: ${label(el)}`);
    }
  }
  return out;
}

const server = process.env.BASE_URL ? { url: process.env.BASE_URL, stop() {} } : await startDevServer();
mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
const fail = (where: string, msg: string) => {
  failures++;
  console.error(`FAIL ${where}: ${msg}`);
};

async function runTarget(vp: { width: number; height: number }, target: (typeof TARGETS)[number]) {
  const vpTag = `${vp.width}x${vp.height}`;
  const where = `${vpTag} ${target.name}`;
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const logs: string[] = [];
  page.on("pageerror", (e) => logs.push(`pageerror: ${e}`));
  page.on("console", (msg) => msg.type() === "error" && logs.push(`error: ${msg.text()}`));

  // Real clock: framer-motion animations do not advance under a faked clock.
  await page.goto(`${server.url}/${target.hash}`);
  const started = Date.now();
  let samples = 0;
  const seen = new Set<string>();
  while (Date.now() - started <= target.ms) {
    const t = Date.now() - started;
    for (const p of await page.evaluate(measure)) {
      if (seen.has(p)) continue; // report each distinct problem once per target
      seen.add(p);
      const step = await page.evaluate(
        () => document.querySelector("div[data-playback-ui]")?.textContent?.match(/\d\d\/\d\d/)?.[0] ?? "",
      );
      fail(`${where} @${t}ms${step ? ` (chapter ${step})` : ""}`, p);
      await page.screenshot({ path: join(OUT_DIR, `${vpTag}-${target.name}-${t}.png`) });
    }
    samples++;
    await page.waitForTimeout(SAMPLE_MS);
  }
  await page.screenshot({ path: join(OUT_DIR, `${vpTag}-${target.name}-end.png`) });
  for (const line of logs) fail(where, `console ${line}`);
  console.log(`${where}: ${samples} samples`);
  await context.close();
}

try {
  // Real time, so run every viewport x target at once: wall time is the longest target.
  await Promise.all(VIEWPORTS.flatMap((vp) => TARGETS.map((t) => runTarget(vp, t))));
} finally {
  await browser.close();
  server.stop();
}

console.log(`screenshots: ${OUT_DIR}`);
if (failures) {
  console.error(`check-fit: ${failures} failure(s)`);
  process.exit(1);
}
console.log("check-fit: ok");
