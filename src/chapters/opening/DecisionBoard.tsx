import { useLayoutEffect, useRef } from "react";
import ProviderIcon from "../../components/ProviderIcon";
import { NEUTRAL } from "../../design";
import { IconSlot, MdBadge } from "./ModelRows";
import ModelRows from "./ModelRows";
import { openingCase } from "./openingCase";
import { decisionSummary, openingRows, type Camp } from "./openingRows";
import { COLUMN_GAP, DOT_GAP, DOT_SIZE, EDGE_PAD, ICON_GAP, ROW_HEIGHT } from "./rowMetrics";
import { CHARCOAL } from "./charcoal";
import {
  OFFSETS,
  bandLeaveProgress,
  easeInOut,
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
 *   gather    the dots fold in and the marks gather into choice 1, the split, and choice 2
 *   dock      those groups move to the bottom and stay while the next slide arrives
 *
 * Physicians are not sorted onto a choice. A near-even vote is the middle, so the
 * squares collapse into the MD mark under the split models, and that mark fades
 * as the models move down. The next slide keeps the models.
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
  captions: Partial<Record<"choice1" | "split" | "choice2" | "physicians", Box>>;
  /** Height of the model groups and their labels. */
  modelH: number;
  /** Height of the MD mark and its line, below the models. */
  mdBlockH: number;
}

const GROUP_PAD = 12;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Where the marks sit once the rows have gathered. Coordinates are inside the board. */
function layoutSummary(width: number, size: number, fontPx: number): Layout {
  const gap = Math.max(4, size * 0.16);
  const rowGap = Math.max(6, fontPx * 0.35);
  const labelGap = fontPx * 0.2;
  const captionH = fontPx * 1.35;
  const lineW = (n: number) => n * size + Math.max(0, n - 1) * gap;
  const perLine = (n: number, maxW: number) => Math.max(1, Math.min(n, Math.floor((maxW + gap) / (size + gap)) || 1));

  const place = (camp: Camp, left: number, maxW: number, y: number) => {
    const items = openingRows.camps[camp];
    const lines = chunk(items, perLine(items.length, maxW));
    const slots = new Map<string, Point>();
    lines.forEach((line, li) => {
      const w = lineW(line.length);
      const x0 = left + Math.max(0, (maxW - w) / 2);
      line.forEach((m, i) => slots.set(m.key, { x: x0 + i * (size + gap), y: y + li * (size + rowGap) }));
    });
    const bottom = lines.length === 0 ? y : y + lines.length * size + (lines.length - 1) * rowGap;
    return { slots, bottom };
  };

  const half = width / 2;
  const left = place("choice1", 0, half, 0);
  const right = place("choice2", half, half, 0);
  const icons = new Map<string, Point>([...left.slots, ...right.slots]);

  const middle = openingRows.camps.middle;
  const sideBottom = Math.max(left.bottom, right.bottom);
  if (middle.length > 0) {
    const midW = lineW(middle.length);
    const leftEdge = left.slots.size === 0 ? 0 : Math.max(...[...left.slots.values()].map((p) => p.x + size));
    const rightEdge = right.slots.size === 0 ? width : Math.min(...[...right.slots.values()].map((p) => p.x));
    const room = rightEdge - leftEdge;
    const inGap = leftEdge + (room - midW) / 2;
    const share = room > midW + GROUP_PAD * 2 && inGap >= 0 && inGap + midW <= width;
    const x0 = share ? inGap : Math.max(0, (width - midW) / 2);
    const y = share ? 0 : sideBottom + rowGap;
    middle.forEach((m, i) => icons.set(m.key, { x: x0 + i * (size + gap), y }));
  }

  let iconBottom = sideBottom;
  let midLeft = width;
  let midRight = 0;
  for (const m of middle) {
    const p = icons.get(m.key);
    if (!p) continue;
    iconBottom = Math.max(iconBottom, p.y + size);
    midLeft = Math.min(midLeft, p.x);
    midRight = Math.max(midRight, p.x + size);
  }

  const captionY = iconBottom + labelGap;
  const midW = Math.min(width * 0.28, fontPx * 7);
  const sideW = (width - midW) / 2;
  const captions: Layout["captions"] = {
    choice1: { x: 0, y: captionY, w: sideW },
    split: middle.length > 0 ? { x: sideW, y: captionY, w: midW } : undefined,
    choice2: { x: sideW + midW, y: captionY, w: sideW },
  };
  const modelH = captionY + captionH;

  const mdGap = fontPx * 0.45;
  const md = { x: (width - size) / 2, y: modelH + mdGap };
  captions.physicians = { x: 0, y: md.y + size + labelGap, w: width };
  const mdBlockH = mdGap + size + labelGap + captionH;
  // midLeft/midRight are only used to keep the split label honest if the group is off-center.
  if (captions.split && midRight > midLeft) {
    captions.split = { x: sideW, y: captionY, w: midW };
  }
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
  const dots = (n: number) => Array.from({ length: n }, (_, i) => <Dot key={i} opacity={enter} />);
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
          {dots(gpt.choice1)}
        </span>
      </div>
      <div className="flex min-w-0 items-center justify-end" style={{ paddingRight: EDGE_PAD, gap: DOT_GAP }}>
        {dots(gpt.choice2)}
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
      const leave = bandLeaveProgress(t);
      const mdSpace = 1 - ramp(stripProgress(t), 0.35, 0.75);
      const layout = layoutSummary(width, size, fontPx);
      const endH = layout.modelH + layout.mdBlockH * mdSpace;
      const boardH = fullH + (endH - fullH) * gather;
      const gap = fontPx * 0.5;

      // Idle rows keep their natural height, which is in em, so the font fit can scale them.
      // The pad is in em for the same reason: a px pad would stay put while the fit tries other sizes.
      slot.style.height = gather === 0 && settle === 0 ? "" : `${boardH * (1 - settle)}px`;
      slot.style.overflow = gather > 0 ? "hidden" : "visible";
      const padEm = ((boardH + gap) * settle * (1 - leave)) / fontPx;
      scene.style.setProperty("--band-pad", `${padEm}em`);

      const sceneBox = scene.getBoundingClientRect();
      const slotBox = slot.getBoundingClientRect();
      const top = slotBox.top - sceneBox.top + (sceneBox.height - boardH - (slotBox.top - sceneBox.top)) * settle;
      board.style.top = `${top}px`;
      board.style.height = `${boardH}px`;
      // Opacity, not visibility. A visible board would show through the hidden measuring copies.
      board.style.opacity = String(1 - leave);
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
        if (name !== "choice1" && name !== "split" && name !== "choice2" && name !== "physicians") continue;
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
      scene.style.setProperty("--band-pad", "0px");
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

        <span data-caption="choice1" className={captionClass} style={{ fontSize: "0.72em", lineHeight: 1.35, color: NEUTRAL.inkMuted, opacity: g }}>
          {openingCase.choices[0]}
        </span>
        <span data-caption="split" className={captionClass} style={{ fontSize: "0.72em", lineHeight: 1.35, color: NEUTRAL.inkMuted, opacity: g }}>
          Split
        </span>
        <span data-caption="choice2" className={captionClass} style={{ fontSize: "0.72em", lineHeight: 1.35, color: NEUTRAL.inkMuted, opacity: g }}>
          {openingCase.choices[1]}
        </span>
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
