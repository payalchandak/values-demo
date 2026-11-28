import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { NEUTRAL } from "../../design";
import { beatStart } from "../../types";
import OpeningScene, { ChoiceLabels, SettledChoice } from "../opening/OpeningScene";
import { GptDotRow } from "../opening/DecisionBoard";
import { CaseHeaderLine } from "../opening/TuckedCase";
import { openingCase } from "../opening/openingCase";
import { openingRows } from "../opening/openingRows";
import { ROW_VARS } from "../opening/rowMetrics";
import { at } from "../opening/timeline";
import { addedCases, GPT_TRIALS, type DilemmaCard } from "./data";
import { BOX_MS, CARD_MS, casesBeats, DOT_IN_MS, DOT_STAGGER_MS, NARROW_MS } from "./beats";

/** Three cards share the row from this viewport width up. */
const WIDE_AT = 900;
/** Side by side choices need about this much card width. Narrower cards stack them so the type can stay large. */
const SPLIT_MIN = 700;
const SIDE = 18;
const TOP = 12;
const BOTTOM = 100;
const GAP = 18;
/** Padding inside the settled white card, in px. */
const PAD_END = 20;
const MIN_TEXT = 8;
const MAX_TEXT = 48;
/**
 * Card content width, in px, per 1px of dot-row font, so ten dots keep the
 * opening's full pitch (1.15em) inside one choice column.
 */
const DOT_PER_EM = 33;
const CARD_SHADOW = "0 1px 2px rgba(16,24,40,0.04), 0 10px 28px -14px rgba(16,24,40,0.12)";

const HELD_T = at("model", "end") - 1;

const gpt = openingRows.models[0];
if (gpt.trials !== GPT_TRIALS) throw new Error("cases: the opening GPT row is not 10 queries");

const openingCard: DilemmaCard = {
  id: openingCase.caseId,
  header: openingRows.caseHeader,
  choices: [openingCase.choices[0], openingCase.choices[1]],
  tags: openingCase.tags,
  gptChoice1: gpt.choice1,
};

const CARDS: readonly DilemmaCard[] = [openingCard, ...addedCases];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a)));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

interface Group {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Metrics {
  stageW: number;
  viewW: number;
  viewH: number;
  openingPx: number;
  fitPx: number;
  group: Group | null;
}

const EMPTY: Metrics = { stageW: 0, viewW: 0, viewH: 0, openingPx: 16, fitPx: 16, group: null };

function sameMetrics(a: Metrics, b: Metrics): boolean {
  if (Math.abs(a.stageW - b.stageW) > 0.5 || Math.abs(a.viewW - b.viewW) > 0.5 || Math.abs(a.viewH - b.viewH) > 0.5) return false;
  if (Math.abs(a.openingPx - b.openingPx) > 0.2 || Math.abs(a.fitPx - b.fitPx) > 0.2) return false;
  if (a.group === null || b.group === null) return a.group === b.group;
  return (
    Math.abs(a.group.left - b.group.left) < 0.5 &&
    Math.abs(a.group.top - b.group.top) < 0.5 &&
    Math.abs(a.group.width - b.group.width) < 0.5 &&
    Math.abs(a.group.height - b.group.height) < 0.5
  );
}

function endRect(index: number, viewW: number, viewH: number, wide: boolean) {
  const inner = Math.max(0, viewW - SIDE * 2);
  const width = wide ? Math.max(0, (inner - GAP * 2) / 3) : inner;
  const left = SIDE + (wide ? index * (width + GAP) : 0);
  return { left, top: TOP, width, height: Math.max(0, viewH - TOP - BOTTOM) };
}

function dotPxFor(cardWidth: number, textPx: number, pad: number): number {
  const content = Math.max(0, cardWidth - pad * 2);
  return Math.max(8, Math.min(textPx, content / DOT_PER_EM));
}

function weights(elapsed: number, wide: boolean): [number, number, number] {
  const second = beatStart(casesBeats, "second");
  const third = beatStart(casesBeats, "third");
  if (wide) {
    return [1, ease(ramp(elapsed, second, second + CARD_MS)), ease(ramp(elapsed, third, third + CARD_MS))];
  }
  const a = ease(ramp(elapsed, second, second + NARROW_MS));
  const b = ease(ramp(elapsed, third, third + NARROW_MS));
  return [1 - a, a * (1 - b), b];
}

function dotOpacity(elapsed: number, enterAt: number, k: number, side: 0 | 1, index: number): number {
  const order = side === 0 ? index : k + index;
  const start = enterAt + order * DOT_STAGGER_MS;
  return ease(ramp(elapsed, start, start + DOT_IN_MS));
}

function measureGroup(body: HTMLElement): Group | null {
  const br = body.getBoundingClientRect();
  if (br.width < 2) return null;
  let top = Infinity;
  let bottom = -Infinity;
  for (const child of body.children) {
    if (!(child instanceof HTMLElement)) continue;
    const r = child.getBoundingClientRect();
    if (r.height < 1 || r.width < 1) continue;
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(top) || bottom - top < 2) return null;
  return { left: br.left, top, width: br.width, height: bottom - top };
}

function sticksOut(card: HTMLElement): boolean {
  const edge = card.getBoundingClientRect();
  const walk = (el: Element): boolean => {
    for (const child of el.children) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.hasAttribute("data-measure")) continue;
      const style = getComputedStyle(child);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (style.textOverflow === "ellipsis") continue;
      const b = child.getBoundingClientRect();
      if (b.width >= 1 && b.height >= 1) {
        if (b.right > edge.right + 1.5 || b.left < edge.left - 1.5 || b.bottom > edge.bottom + 1.5 || b.top < edge.top - 1.5) {
          return true;
        }
      }
      if (walk(child)) return true;
    }
    return false;
  };
  return walk(card);
}

/** Apply a candidate type size directly so the fit search can measure without another render. */
function paintSize(host: HTMLElement, textPx: number, cardW: number) {
  const dot = dotPxFor(cardW, textPx, PAD_END + 8);
  host.querySelectorAll<HTMLElement>("[data-fit-card]").forEach((card) => {
    const text = card.querySelector<HTMLElement>("[data-text]");
    const dots = card.querySelector<HTMLElement>("[data-dots]");
    if (!text || !dots) return;
    text.style.fontSize = `${textPx}px`;
    text.style.setProperty("--z", String(textPx / 16));
    text.style.padding = `${PAD_END + 8}px`;
    dots.style.fontSize = `${dot}px`;
    dots.style.setProperty("--z", String(dot / 16));
  });
}

function searchFit(host: HTMLElement, safeH: number, cardW: number): number {
  let lo = MIN_TEXT;
  let hi = MAX_TEXT;
  let best = MIN_TEXT;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    paintSize(host, mid, cardW);
    if (probeFits(host, safeH)) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  paintSize(host, best, cardW);
  if (!probeFits(host, safeH)) best = Math.max(MIN_TEXT, best - 1);
  return best;
}

function probeFits(host: HTMLElement, safeH: number): boolean {
  const cards = [...host.querySelectorAll<HTMLElement>("[data-fit-card]")];
  if (cards.length !== CARDS.length) return false;
  for (const card of cards) {
    if (card.offsetWidth < 2) return false;
    if (card.offsetHeight > safeH + 1) return false;
    if (card.scrollWidth > card.clientWidth + 2) return false;
    if (sticksOut(card)) return false;
  }
  return true;
}

function choiceClass(split: boolean): { ul: string; li: string } {
  if (split) {
    return {
      ul: "grid w-full min-w-0 grid-cols-2 grid-rows-[auto_auto] gap-x-[0.6em] gap-y-[0.45em]",
      li: "col-span-1 row-span-2 grid min-w-0 grid-rows-subgrid gap-y-[0.45em]",
    };
  }
  return {
    ul: "grid w-full min-w-0 grid-cols-1 gap-y-[0.75em]",
    li: "flex min-w-0 flex-col gap-[0.55em]",
  };
}

function CardView({
  card,
  split,
  textPx,
  dotPx,
  pad,
  box,
  gapEm,
  height,
  lockHeight,
  sharedIcon,
  dotAt,
  fluid = false,
}: {
  card: DilemmaCard;
  split: boolean;
  textPx: number;
  dotPx: number;
  pad: number;
  box: number;
  gapEm: number;
  height?: number;
  lockHeight: boolean;
  sharedIcon: boolean;
  dotAt: (side: 0 | 1, index: number) => number;
  fluid?: boolean;
}) {
  const list = choiceClass(split);
  const textStyle: CSSProperties = {
    fontSize: textPx,
    ["--z" as string]: String(textPx / 16),
    padding: pad,
    gap: `${gapEm}em`,
  };
  const dotStyle: CSSProperties = {
    fontSize: dotPx,
    ["--z" as string]: String(dotPx / 16),
    ...ROW_VARS,
  };
  return (
    <div
      className="relative box-border w-full"
      style={{ minHeight: height, height: lockHeight ? height : undefined }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 border bg-white"
        style={{
          opacity: box,
          borderColor: NEUTRAL.line,
          borderRadius: 18,
          boxShadow: CARD_SHADOW,
        }}
      />
      <div data-text className="@container flex w-full min-w-0 flex-col" style={textStyle}>
        <CaseHeaderLine text={card.header} />
        <ul className={list.ul}>
          {([0, 1] as const).map((index) => (
            <li key={index} className={list.li}>
              <SettledChoice label={card.choices[index]} />
              <ChoiceLabels tags={card.tags[index]} fluid={fluid} />
            </li>
          ))}
        </ul>
        <div data-dots className="w-full min-w-0" style={dotStyle}>
          <GptDotRow
            left={card.gptChoice1}
            right={GPT_TRIALS - card.gptChoice1}
            opacityAt={dotAt}
            sharedIcon={sharedIcon}
            label={`${gpt.name} chose Choice 1 in ${card.gptChoice1} of ${GPT_TRIALS} queries`}
            iconSrc={gpt.logo.src}
            iconAlt={gpt.logo.alt}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Three dilemmas. The frame beat is the opening's held scene. A card then
 * draws around that group, and the row grows to fill the viewport. Every
 * weight is the chapter clock plus the measured stage size.
 */
export default function CasesScene({ elapsedMs, ownIcons = false }: { elapsedMs: number; ownIcons?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const memory = useRef<{ openingPx: number; group: Group | null }>({ openingPx: 16, group: null });
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);

  const boxAt = beatStart(casesBeats, "box");
  const secondAt = beatStart(casesBeats, "second");
  const thirdAt = beatStart(casesBeats, "third");
  const boxP = ease(ramp(elapsedMs, boxAt, boxAt + BOX_MS));
  const wide = metrics.viewW >= WIDE_AT;
  const show = weights(elapsedMs, wide);
  const slot = metrics.viewW > 0 ? endRect(0, metrics.viewW, metrics.viewH, wide) : null;
  const endSplit = slot !== null && slot.width >= SPLIT_MIN && metrics.stageW >= 768;

  useLayoutEffect(() => {
    let dead = false;
    void document.fonts?.ready.then(() => {
      if (!dead) setMetrics((prev) => ({ ...prev, stageW: -1 }));
    });
    return () => {
      dead = true;
    };
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const fitHost = fitRef.current;
    if (!root || !fitHost) return;

    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const stageW = root.clientWidth;
    if (viewW < 2 || viewH < 2) return;

    const openingRoot = probeRef.current?.querySelector<HTMLElement>("[data-opening-root]");
    if (openingRoot) {
      const px = parseFloat(getComputedStyle(openingRoot).fontSize);
      const body = openingRoot.querySelector<HTMLElement>("[data-scene-body]");
      const group = body ? measureGroup(body) : null;
      if (Number.isFinite(px) && px > 1) memory.current.openingPx = px;
      if (group) memory.current.group = group;
    }

    const openingPx = memory.current.openingPx;
    const group = memory.current.group;
    const isWide = viewW >= WIDE_AT;
    const end = endRect(0, viewW, viewH, isWide);
    const safeH = Math.max(0, viewH - TOP - BOTTOM);
    const sized = end.width > 2 && Math.abs(fitHost.clientWidth - end.width) < 1.5;
    const fitPx = sized ? searchFit(fitHost, safeH, end.width) : metrics.fitPx;

    const next: Metrics = { stageW, viewW, viewH, openingPx, fitPx, group };
    setMetrics((prev) => (sameMetrics(prev, next) ? prev : next));

    const ro = new ResizeObserver(() => {
      const w = root.clientWidth;
      setMetrics((prev) => (Math.abs(prev.stageW - w) < 0.5 ? prev : { ...prev, stageW: -1 }));
    });
    ro.observe(root);
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setMetrics((prev) => (Math.abs(prev.viewW - w) < 0.5 && Math.abs(prev.viewH - h) < 0.5 ? prev : { ...prev, viewW: -1 }));
    };
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  });

  const group = metrics.group;
  const enterAt = (index: number) => (index === 1 ? secondAt : index === 2 ? thirdAt : 0);
  const trackFirst = !ownIcons && show[0] > 0.98 && (wide || show[1] < 0.02);

  const cardRect = (index: number) => {
    const end = endRect(index, metrics.viewW, metrics.viewH, wide);
    if (index !== 0 || group === null) return end;
    return {
      left: lerp(group.left, end.left, boxP),
      top: lerp(group.top, end.top, boxP),
      width: lerp(group.width, end.width, boxP),
      height: lerp(group.height, end.height, boxP),
    };
  };

  return (
    <div ref={rootRef} className="relative h-full w-full">
      {boxP <= 0 && <OpeningScene t={HELD_T} sharedIcon />}

      {boxP < 1 && (
        <div ref={probeRef} data-probe aria-hidden className="pointer-events-none invisible absolute inset-0 overflow-hidden">
          <OpeningScene t={HELD_T} sharedIcon={false} />
        </div>
      )}

      <div
        ref={fitRef}
        data-probe
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 overflow-hidden"
        style={{ width: slot?.width ?? 0 }}
      >
        {CARDS.map((card) => (
          <div key={card.id} data-fit-card className="w-full">
            <CardView
              card={card}
              split={endSplit}
              textPx={metrics.fitPx}
              dotPx={dotPxFor(slot?.width ?? 0, metrics.fitPx, PAD_END)}
              pad={PAD_END}
              box={1}
              gapEm={1.05}
              lockHeight={false}
              sharedIcon={false}
              fluid
              dotAt={() => 1}
            />
          </div>
        ))}
      </div>

      {boxP > 0 && slot && (group !== null || boxP >= 1) && (
        <div className="pointer-events-none fixed inset-0 z-10 bg-canvas">
          {CARDS.map((card, i) => {
            const rect = cardRect(i);
            const textPx = i === 0 ? lerp(metrics.openingPx, metrics.fitPx, boxP) : metrics.fitPx;
            const pad = PAD_END * (i === 0 ? boxP : 1);
            const split = rect.width >= SPLIT_MIN && metrics.stageW >= 768;
            return (
              <div
                key={card.id}
                className="absolute"
                style={{ left: rect.left, top: rect.top, width: rect.width, opacity: show[i] }}
              >
                <CardView
                  card={card}
                  split={split}
                  textPx={textPx}
                  dotPx={dotPxFor(rect.width, textPx, pad)}
                  pad={pad}
                  box={i === 0 ? boxP : 1}
                  gapEm={i === 0 ? lerp(0.9, 1.05, boxP) : 1.05}
                  height={rect.height}
                  lockHeight={boxP >= 1}
                  sharedIcon={i === 0 && trackFirst}
                  dotAt={
                    i === 0
                      ? () => 1
                      : (side, index) => dotOpacity(elapsedMs, enterAt(i), card.gptChoice1, side, index)
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
