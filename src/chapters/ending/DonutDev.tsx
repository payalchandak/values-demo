import { useMemo, useState } from "react";
import Donut, { donutScene, ringRadii, type DonutScene } from "../../components/Donut";
import { ALL_MODELS, ALL_PHYSICIANS } from "./profiles";
import type { Profile } from "../../study/types";

/**
 * `#/dev/donut`: the hero and compact donut, scrubbed by hand.
 *
 *   ?from=<key>&to=<key>&t=<0..1>   one frozen frame
 *
 * "Audit" sweeps every pair of profiles over t at several frame sizes and counts
 * hero labels that overlap each other, touch the ring, or leave the frame.
 */

const ALL: readonly Profile[] = [...ALL_MODELS, ...ALL_PHYSICIANS];
const byKey = (key: string | null, fallback: Profile) => ALL.find((p) => p.key === key) ?? fallback;

const FRAMES: readonly [number, number][] = [
  [342, 420],
  [342, 560],
  [944, 460],
  [944, 620],
  [600, 500],
];
const STEPS = 10;

interface AuditResult {
  frames: number;
  overlaps: number;
  ringTouches: number;
  outside: number;
}

function violations(scene: DonutScene): { overlap: number; ring: number; outside: number } {
  let overlap = 0;
  let ring = 0;
  let outside = 0;
  const L = scene.labels;
  for (let i = 0; i < L.length; i++) {
    const a = L[i];
    if (a.left < -0.01 || a.top < -0.01 || a.left + a.w > scene.width + 0.01 || a.top + a.h > scene.height + 0.01) outside++;
    const nx = Math.min(Math.max(scene.cx, a.left), a.left + a.w);
    const ny = Math.min(Math.max(scene.cy, a.top), a.top + a.h);
    if (Math.hypot(nx - scene.cx, ny - scene.cy) < ringRadii(scene.R).rOut) ring++;
    for (let j = i + 1; j < L.length; j++) {
      const b = L[j];
      if (Math.min(a.left + a.w, b.left + b.w) - Math.max(a.left, b.left) > 0.01 && Math.min(a.top + a.h, b.top + b.h) - Math.max(a.top, b.top) > 0.01) overlap++;
    }
  }
  return { overlap, ring, outside };
}

export function auditLabels(): AuditResult {
  const out: AuditResult = { frames: 0, overlaps: 0, ringTouches: 0, outside: 0 };
  for (const [w, h] of FRAMES) {
    for (const a of ALL) {
      for (const b of ALL) {
        for (let k = 0; k <= STEPS; k++) {
          const v = violations(donutScene({ from: a.priorities, to: b.priorities, t: k / STEPS, mode: "hero", width: w, height: h }));
          out.frames++;
          out.overlaps += v.overlap;
          out.ringTouches += v.ring;
          out.outside += v.outside;
        }
      }
    }
  }
  return out;
}

export default function DonutDev() {
  const q = new URLSearchParams(window.location.search);
  const [from, setFrom] = useState(byKey(q.get("from"), ALL_MODELS[0]).key);
  const [to, setTo] = useState(byKey(q.get("to"), ALL_MODELS[1]).key);
  const [t, setT] = useState(Number(q.get("t") ?? 0.5));
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const a = byKey(from, ALL[0]);
  const b = byKey(to, ALL[1]);
  const compact = useMemo(() => ALL_MODELS.slice(0, 6), []);

  const select = "rounded border border-line bg-white px-1.5 py-0.5 text-xs";
  return (
    <div className="flex h-screen w-screen flex-col gap-2 bg-canvas px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
        <label className="flex items-center gap-1">
          from
          <select className={select} value={from} onChange={(e) => setFrom(e.target.value)}>
            {ALL.map((p) => (
              <option key={p.key}>{p.key}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          to
          <select className={select} value={to} onChange={(e) => setTo(e.target.value)}>
            {ALL.map((p) => (
              <option key={p.key}>{p.key}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          t
          <input type="range" min={0} max={1} step={0.01} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-32" />
          <span className="tabular-nums">{t.toFixed(2)}</span>
        </label>
        <button type="button" className={select} onClick={() => setAudit(auditLabels())}>
          Audit labels
        </button>
        {audit && (
          <span data-testid="donut-audit">
            {audit.frames} frames: {audit.overlaps} overlaps, {audit.ringTouches} on the ring, {audit.outside} outside
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <Donut from={a.priorities} to={b.priorities} t={t} mode="hero" />
      </div>
      <div className="flex shrink-0 flex-wrap items-end justify-center gap-3">
        {compact.map((p) => (
          <Donut key={p.key} from={p.priorities} to={p.priorities} t={0} mode="compact" size={56} />
        ))}
      </div>
    </div>
  );
}
