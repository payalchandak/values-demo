// Records the full autoplay (all ten chapters, real time, no input) as a video.
//
//   npm run build && npm run capture
//
// Serves the production build with `vite preview` (smoother than the dev
// server), plays from load until the final hold, and writes one .webm.
//
// Env: OUT_DIR   where the video goes (default: docs/capture)
//      SIZE      WIDTHxHEIGHT (default 1440x900)
//      BASE_URL  use a running server instead of starting `vite preview`
// (Node >= 22.18 strips TypeScript types natively.)

import { spawn } from "node:child_process";
import { mkdirSync, renameSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = process.env.OUT_DIR ?? join(root, "docs", "capture");
const [width, height] = (process.env.SIZE ?? "1440x900").split("x").map(Number);
/** Total autoplay length (about 147s) plus a final hold. */
const RECORD_MS = 152_000;

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

async function startPreview() {
  const port = await freePort();
  const child = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], { cwd: root, stdio: "pipe" });
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
  throw new Error("vite preview did not start (run `npm run build` first)");
}

const server = process.env.BASE_URL ? { url: process.env.BASE_URL, stop() {} } : await startPreview();
mkdirSync(OUT_DIR, { recursive: true });
const tmpDir = join(OUT_DIR, ".recording");
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: tmpDir, size: { width, height } },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`error: ${m.text()}`));
  await page.goto(server.url);
  await page.waitForSelector("[data-stage]");
  await page.waitForTimeout(RECORD_MS);
  const video = page.video();
  await context.close(); // flushes the video
  const out = join(OUT_DIR, `autoplay-${width}x${height}.webm`);
  renameSync(await video!.path(), out);
  console.log(`capture: ${out}`);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  server.stop();
}
