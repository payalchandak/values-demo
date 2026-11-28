import { useLayoutEffect, useRef } from "react";
import ProviderIcon from "../../components/ProviderIcon";
import { NEUTRAL } from "../../design";
import { IconSlot, MdBadge } from "./ModelRows";
import ModelRows from "./ModelRows";
import { decisionSummary, openingRows, type Camp } from "./openingRows";
import { COLUMN_GAP, DOT_GAP, DOT_SIZE, EDGE_PAD, ICON_GAP, ROW_HEIGHT } from "./rowMetrics";
import { CHARCOAL } from "./charcoal";
import {
  OFFSETS,
  easeInOut,
  FIRST_DOT_CHOICE,
  gatherProgress,
  gptDecisionsEnter,
  modelRowEnter,
  physicianRowEnter,
  physicianSummaryOpacity,
  ramp,
  stripProgress,
} from "./timeline";

/**
 * The opening's decision picture, from the moment the dots arrive.
 *
 * Three phases, all a function of the opening clock plus measurement:
 *   rows      one dot row per model, physicians as squares
 *   gather    the dots fold in and the marks gather into three loose clouds: choice 1, the split, choice 2
 *   leave     those clouds fade as the values slide arrives, and do not stay on it
 *
 * Physicians are not sorted onto a choice. A near-even vote is the middle, so the
 * squares collapse into the MD mark under the split models, and that mark fades
 * with the clouds.
 */

interface Point {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
}

interface Layout {
  icons: Map<string, Point>;
  md: Point;
  captions: Partial<Record<"physicians", Box>>;
  /** Height of the three model clouds. */
  modelH: number;
  /** Height of the MD mark and its line, below the models. */
  mdBlockH: number;
}

/**
 * Which edge of the board each cloud hugs. The two choices sit at the far left and
 * far right, as far apart as they can be, so a clear decision looks like a clear split.
 */
const CLUSTER_EDGE: Record<Camp, "left" | "center" | "right"> = { choice1: "left", middle: "center", choice2: "right" };
const CLUSTER_WALL: Record<Camp, -1 | 0 | 1> = { choice1: -1, middle: 0, choice2: 1 };
/** Each cloud starts its spiral at a different angle, so the three do not look alike. */
const CLUSTER_SEED: Record<Camp, number> = { choice1: 0.4, middle: 2.1, choice2: 4.3 };

/** Repeatable noise in -1..1, so a cloud looks scattered but never changes between frames. */
const noise = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/**
 * A tight cloud of `n` marks: a sunflower spiral, nudged off its pattern, then
 * pulled toward its edge of the board and pushed apart until only a sliver of
 * overlap is left. `wall` is -1 for a pile against the left edge, 1 for the
 * right, 0 for a cloud that just gathers on its middle. Returns mark centres,
 * with the wall (if any) at x = 0.
 */
function cloud(n: number, size: number, seed: number, wall: -1 | 0 | 1): Point[] {
  const golden = 2.399963;
  const step = size * 0.5;
  const minDist = size * 0.94;
  const pts: Point[] = Array.from({ length: n }, (_, i) => {
    const r = step * Math.sqrt(i + 0.7) + noise(seed * 7 + i) * size * 0.08;
    const a = seed + i * golden + noise(seed * 3 + i * 5) * 0.25;
    const x = Math.cos(a) * r;
    return { x: wall === 0 ? x : -wall * (size / 2 + Math.abs(x)), y: Math.sin(a) * r * 1.05 };
  });
  for (let iter = 0; iter < 60; iter++) {
    for (const p of pts) {
      // Everything leans toward its edge (or the middle), and may not pass it.
      p.x = wall === 0 ? p.x * 0.97 : p.x + wall * size * 0.04;
      p.y *= 0.99;
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= minDist) continue;
        const push = (minDist - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        pts[i] = { x: pts[i].x - ux * push, y: pts[i].y - uy * push };
        pts[j] = { x: pts[j].x + ux * push, y: pts[j].y + uy * push };
      }
    }
    // The wall: marks rest against it, never past it. A left wall has the cloud on +x, a right wall on -x.
    if (wall !== 0) for (const p of pts) p.x = wall === -1 ? Math.max(p.x, size / 2) : Math.min(p.x, -size / 2);
  }
  return pts;
}

/**
 * Where the marks sit once the rows have gathered: three loose clouds, one per
 * camp: choice 1 packed against the left edge, choice 2 against the right, the
 * split in the middle. On a board too narrow for that they stack, one above the
 * other, keeping the same edges. Coordinates are inside the board.
 */
function layoutSummary(width: number, size: number, fontPx: number): Layout {
  const gap = Math.max(4, size * 0.16);
  const labelGap = fontPx * 0.2;
  const captionH = fontPx * 1.35;
  const stackGap = Math.max(8, fontPx * 0.65);

  const clouds = (Object.keys(CLUSTER_EDGE) as Camp[])
    .map((camp) => {
      const items = openingRows.camps[camp];
      const pts = cloud(items.length, size, CLUSTER_SEED[camp], CLUSTER_WALL[camp]);
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const minX = Math.min(...xs) - size / 2;
      const maxX = Math.max(...xs) + size / 2;
      const minY = Math.min(...ys) - size / 2;
      const maxY = Math.max(...ys) + size / 2;
      return { camp, items, pts, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
    })
    .filter((c) => c.items.length > 0);

  // Side by side only if the three clouds fit on one line with room between them.
  const sideBySide = clouds.reduce((sum, c) => sum + c.w, 0) + gap * 4 <= width;
  const tallest = Math.max(0, ...clouds.map((c) => c.h));

  const icons = new Map<string, Point>();
  let stackY = 0;
  for (const c of clouds) {
    const edge = CLUSTER_EDGE[c.camp];
    const centreX = edge === "left" ? c.w / 2 : edge === "right" ? width - c.w / 2 : width / 2;
    const centreY = sideBySide ? tallest / 2 : stackY + c.h / 2;
    c.items.forEach((m, i) => {
      icons.set(m.key, { x: centreX + c.pts[i].x - c.cx - size / 2, y: centreY + c.pts[i].y - c.cy - size / 2 });
    });
    stackY += c.h + stackGap;
  }

  const modelH = sideBySide ? tallest : Math.max(0, stackY - stackGap);
  const mdGap = fontPx * 0.45;
  const md = { x: (width - size) / 2, y: modelH + mdGap };
  const captions: Layout["captions"] = { physicians: { x: 0, y: md.y + size + labelGap, w: width } };
  const mdBlockH = mdGap + size + labelGap + captionH;
  return { icons, md, captions, modelH, mdBlockH };
}

function Dot({ opacity }: { opacity: number }) {
  return (
    <span
      aria-hidden
      className="block shrink-0 rounded-full"
      style={{ width: DOT_SIZE, height: DOT_SIZE, backgroundColor: CHARCOAL, opacity }}
    />
  );
}

/** GPT's dot row. The mark itself is drawn with the others, so this row keeps its slot. */
function GptFlowRow({ t }: { t: number }) {
  const gpt = openingRows.models[0];
  const enter = gptDecisionsEnter(t - OFFSETS.model);
  // The excerpt's dot is already beside the mark. Only the rest fade in here.
  const dots = (side: 0 | 1, n: number) => {
    const lead = side === FIRST_DOT_CHOICE && n > 0;
    const rest = lead ? n - 1 : n;
    return (
      <>
        {lead && <Dot key="lead" opacity={1} />}
        {Array.from({ length: rest }, (_, i) => (
          <Dot key={i} opacity={enter} />
        ))}
      </>
    );
  };
  return (
    <div
      role="img"
      aria-label={`${gpt.name} chose Choice 1 in ${gpt.choice1} of ${gpt.trials} queries`}
      className="grid w-full grid-cols-2 items-center"
      style={{ height: ROW_HEIGHT, columnGap: COLUMN_GAP }}
    >
      <div className="flex min-w-0 items-center" style={{ paddingLeft: EDGE_PAD, gap: ICON_GAP }}>
        <IconSlot slot="gpt" />
        <span className="flex items-center" style={{ gap: DOT_GAP }}>
          {dots(0, gpt.choice1)}
        </span>
      </div>
      <div className="flex min-w-0 items-center justify-end" style={{ paddingRight: EDGE_PAD, gap: DOT_GAP }}>
        {dots(1, gpt.choice2)}
      </div>
    </div>
  );
}

const captionClass = "absolute truncate text-center font-medium";

export default function DecisionBoard({ t, sharedIcon }: { t: number; sharedIcon: boolean }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const g = easeInOut(gatherProgress(t));
  const mdFade = physicianSummaryOpacity(t);
  const summarizing = gatherProgress(t) > 0.55;
  const { left, right } = openingRows.physicians;

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const flow = flowRef.current;
    const board = boardRef.current;
    const scene = slot?.closest("[data-scene-body]");
    if (!slot || !flow || !board || !(scene instanceof HTMLElement)) return;

    const place = () => {
      const fontPx = parseFloat(getComputedStyle(scene).fontSize) || 16;
      const sample = flow.querySelector<HTMLElement>("[data-slot]");
      const size = sample?.getBoundingClientRect().width ?? 0;
      const width = flow.clientWidth;
      const fullH = flow.offsetHeight;
      if (size < 1 || width < 1 || fullH < 1) {
        board.style.opacity = "0";
        return;
      }

      const gather = easeInOut(gatherProgress(t));
      const settle = easeInOut(stripProgress(t));
      const mdSpace = 1 - ramp(stripProgress(t), 0.35, 0.75);
      const layout = layoutSummary(width, size, fontPx);
      const endH = layout.modelH + layout.mdBlockH * mdSpace;
      const boardH = fullH + (endH - fullH) * gather;

      // Idle rows keep their natural height, which is in em, so the font fit can scale them.
      // The clouds fade in place as the values slide arrives. Their slot closes with them.
      slot.style.height = gather === 0 && settle === 0 ? "" : `${boardH * (1 - settle)}px`;
      slot.style.overflow = gather > 0 ? "hidden" : "visible";

      const sceneBox = scene.getBoundingClientRect();
      const slotBox = slot.getBoundingClientRect();
      board.style.top = `${slotBox.top - sceneBox.top}px`;
      board.style.height = `${boardH}px`;
      // Opacity, not visibility. A visible board would show through the hidden measuring copies.
      board.style.opacity = String(1 - settle);
      flow.style.opacity = String(1 - Math.min(1, gather / 0.42));

      const boardBox = board.getBoundingClientRect();
      const starts = new Map<string, Point>();
      for (const el of flow.querySelectorAll<HTMLElement>("[data-slot]")) {
        const name = el.dataset.slot;
        if (!name) continue;
        const r = el.getBoundingClientRect();
        starts.set(name, { x: r.left - boardBox.left, y: r.top - boardBox.top });
      }

      for (const el of board.querySelectorAll<HTMLElement>("[data-fly]")) {
        const name = el.dataset.fly;
        if (!name) continue;
        const end = name === "md" ? layout.md : layout.icons.get(name);
        const start = starts.get(name);
        if (!end) continue;
        const p = gather >= 1 || !start ? end : { x: start.x + (end.x - start.x) * gather, y: start.y + (end.y - start.y) * gather };
        el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      }

      for (const el of board.querySelectorAll<HTMLElement>("[data-caption]")) {
        const name = el.dataset.caption;
        if (name !== "physicians") continue;
        const box = layout.captions[name];
        if (!box) continue;
        el.style.left = `${box.x}px`;
        el.style.top = `${box.y}px`;
        el.style.width = `${box.w}px`;
      }
    };

    place();
    const ro = new ResizeObserver(place);
    ro.observe(flow);
    ro.observe(scene);
    return () => {
      ro.disconnect();
    };
  });

  return (
    <>
      <div ref={slotRef} className="w-full shrink-0">
        <div ref={flowRef} aria-hidden={summarizing}>
          <GptFlowRow t={t} />
          <ModelRows t={t} grow={1} hideMarks />
        </div>
        <p
          aria-hidden={!summarizing}
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
        >
          {decisionSummary(openingRows)}
        </p>
      </div>

      <div
        ref={boardRef}
        className="pointer-events-none absolute inset-x-0 z-20 overflow-hidden"
        style={{ opacity: 0 }}
        aria-hidden
      >
        {openingRows.models.map((row, i) => (
          <div
            key={row.key}
            data-fly={row.key}
            className="absolute left-0 top-0"
            style={{ opacity: i === 0 ? 1 : modelRowEnter(t, i - 1) }}
          >
            <IconSlot anchor={sharedIcon && row.key === "gpt" ? "icon-response" : undefined}>
              {sharedIcon && row.key === "gpt" ? null : <ProviderIcon src={row.logo.src} alt={row.logo.alt} size={36} />}
            </IconSlot>
          </div>
        ))}
        <div data-fly="md" className="absolute left-0 top-0" style={{ opacity: physicianRowEnter(t) * mdFade }}>
          <IconSlot>
            <MdBadge />
          </IconSlot>
        </div>

        <span
          data-caption="physicians"
          className={captionClass}
          style={{ fontSize: "0.8em", lineHeight: 1.3, color: NEUTRAL.inkMuted, opacity: g * mdFade }}
        >
          {`Physicians split ${left.length}\u2013${right.length}`}
        </span>
      </div>
    </>
  );
}
