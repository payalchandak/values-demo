import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { NEUTRAL } from "../../design";
import OpeningScene, { ChoiceLabels, SettledChoice } from "../opening/OpeningScene";
import { GptDotRow } from "../opening/DecisionBoard";
import { CaseHeaderLine } from "../opening/TuckedCase";
import { openingCase } from "../opening/openingCase";
import { openingRows } from "../opening/openingRows";
import { ROW_VARS } from "../opening/rowMetrics";
import { at } from "../opening/timeline";
import { beatStart } from "../../types";
import { addedCases, GPT_TRIALS, type DilemmaCard } from "./data";
import { BOX_MS, CARD_MS, casesBeats, DOT_IN_MS, DOT_STAGGER_MS, NARROW_MS } from "./beats";

/** Three cards share the row from this scene width up. */
const WIDE_AT = 900;
/** Choice buttons sit side by side from this scene width up. Matches the opening's @md container. */
const SPLIT_AT = 768;
const MIN_FONT = 6;
const CARD_SHADOW =
  "0 1px 2px rgba(16,24,40,0.04), 0 10px 28px -14px rgba(16,24,40,0.12)";

const HELD_T = at("model", "end") - 1;

const gpt = openingRows.models[0];

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

interface Metrics {
  w: number;
  openingPx: number;
  fitPx: number;
}

interface Place {
  left: number;
  width: number;
}

function endWidth(sceneW: number, fontPx: number, wide: boolean): number {
  const cap = 30 * fontPx;
  const gap = 0.6 * fontPx;
  const inset = 8;
  if (!wide) return Math.max(0, Math.min(sceneW - inset * 2, cap));
  const slot = (sceneW - inset * 2 - gap * 2) / 3;
  return Math.max(0, Math.min(slot, cap));
}

/** Card rectangles. Card 0 travels from the centered 46em group into the left slot. */
function places(sceneW: number, fontPx: number, wide: boolean, boxP: number): Place[] {
  const startW = Math.min(sceneW, 46 * fontPx);
  const startLeft = (sceneW - startW) / 2;
  const endW = endWidth(sceneW, fontPx, wide);
  const gap = 0.6 * fontPx;
  const rowW = wide ? endW * 3 + gap * 2 : endW;
  const rowLeft = (sceneW - rowW) / 2;
  const endLeft = (i: number) => (wide ? rowLeft + i * (endW + gap) : rowLeft);
  return CARDS.map((_, i) =>
    i === 0
      ? { left: lerp(startLeft, endLeft(0), boxP), width: lerp(startW, endW, boxP) }
      : { left: endLeft(i), width: endW },
  );
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

function sticksOut(card: HTMLElement): boolean {
  const edge = card.getBoundingClientRect();
  const walk = (el: Element): boolean => {
    for (const child of el.children) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.hasAttribute("data-measure")) continue;
      const b = child.getBoundingClientRect();
      if (b.width >= 1 && b.height >= 1) {
        if (b.right > edge.right + 1 || b.left < edge.left - 1 || b.bottom > edge.bottom + 1 || b.top < edge.top - 1) {
          return true;
        }
      }
      if (walk(child)) return true;
    }
    return false;
  };
  return walk(card);
}

function Column({ card, split, dotAt }: { card: DilemmaCard; split: boolean; dotAt: (side: 0 | 1, index: number) => number }) {
  return (
    <div className="flex w-full min-w-0 flex-col items-center" style={{ gap: "0.9em" }}>
      <div className="w-full min-w-0">
        <CaseHeaderLine text={card.header} />
      </div>
      <ul
        className={
          split
            ? "grid w-full grid-cols-2 grid-rows-[auto_auto] gap-x-[0.6em] gap-y-[0.45em]"
            : "grid w-full grid-cols-1 gap-y-[0.7em]"
        }
      >
        {([0, 1] as const).map((index) => (
          <li
            key={index}
            className={
              split
                ? "col-span-1 row-span-2 grid min-w-0 grid-rows-subgrid gap-y-[0.45em]"
                : "flex min-w-0 flex-col gap-[0.45em]"
            }
          >
            <SettledChoice label={card.choices[index]} />
            <ChoiceLabels tags={card.tags[index]} />
          </li>
        ))}
      </ul>
      <GptDotRow
        left={card.gptChoice1}
        right={GPT_TRIALS - card.gptChoice1}
        opacityAt={dotAt}
        sharedIcon={false}
        label={`${gpt.name} chose Choice 1 in ${card.gptChoice1} of ${GPT_TRIALS} queries`}
        iconSrc={gpt.logo.src}
        iconAlt={gpt.logo.alt}
      />
    </div>
  );
}

function Shell({ box, opacity, children }: { box: number; opacity: number; children: ReactNode }) {
  return (
    <div className="relative w-full" style={{ opacity }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[0.9em] border bg-white"
        style={{ opacity: box, borderColor: NEUTRAL.line, boxShadow: CARD_SHADOW }}
      />
      <div className="@container w-full min-w-0" style={{ padding: `${0.9 * box}em`, ...ROW_VARS }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Three dilemmas. The first frame is the opening's held group. A card then
 * draws around it and narrows, and two more cases join it. Every weight is
 * `elapsedMs` plus the measured stage size.
 */
export default function CasesScene({ elapsedMs }: { elapsedMs: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const cache = useRef({ w: -1, openingPx: -1, sig: "", fitPx: 16, stable: false });
  const runRef = useRef<() => void>(() => {});
  const [metrics, setMetrics] = useState<Metrics>({ w: 0, openingPx: 16, fitPx: 16 });

  const boxAt = beatStart(casesBeats, "box");
  const secondAt = beatStart(casesBeats, "second");
  const thirdAt = beatStart(casesBeats, "third");
  const boxP = ease(ramp(elapsedMs, boxAt, boxAt + BOX_MS));
  const wide = metrics.w >= WIDE_AT;
  const split = metrics.w >= SPLIT_AT;
  const px = lerp(metrics.openingPx, metrics.fitPx, boxP);
  const laid = metrics.w > 0 ? places(metrics.w, px, wide, boxP) : null;
  const show = weights(elapsedMs, wide);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    const openingRoot = probeRef.current?.querySelector<HTMLElement>("[data-opening-root]");
    if (!root || !measure || !openingRoot) return;

    const apply = (fontPx: number) => {
      const sceneW = root.clientWidth;
      const wantWide = sceneW >= WIDE_AT;
      measure.style.fontSize = `${fontPx}px`;
      measure.style.setProperty("--z", String(fontPx / 16));
      const cardW = endWidth(sceneW, fontPx, wantWide);
      measure.querySelectorAll<HTMLElement>("[data-fit-card]").forEach((card) => {
        card.style.width = `${cardW}px`;
        card.style.minWidth = "0px";
        card.style.flex = "none";
      });
    };

    const fits = (fontPx: number) => {
      apply(fontPx);
      const sceneW = root.clientWidth;
      const sceneH = root.clientHeight;
      const wantWide = sceneW >= WIDE_AT;
      const cards = [...measure.querySelectorAll<HTMLElement>("[data-fit-card]")];
      if (cards.length !== CARDS.length) return false;
      for (const card of cards) {
        if (card.offsetHeight > sceneH - 4) return false;
        if (card.scrollWidth > card.clientWidth + 2) return false;
        if (sticksOut(card)) return false;
      }
      if (wantWide) {
        const row = measure.querySelector<HTMLElement>("[data-fit-row]");
        if (!row) return false;
        if (row.scrollWidth > sceneW + 2) return false;
        if (row.offsetHeight > sceneH - 4) return false;
      }
      return true;
    };

    const run = () => {
      const sceneW = root.clientWidth;
      const openingPx = parseFloat(getComputedStyle(openingRoot).fontSize);
      if (!Number.isFinite(openingPx) || openingPx < MIN_FONT || sceneW < 1) return;
      const wantWide = sceneW >= WIDE_AT;
      const wantSplit = sceneW >= SPLIT_AT;
      const renderedWide = metrics.w >= WIDE_AT;
      const renderedSplit = metrics.w >= SPLIT_AT;
      if (metrics.w < 1 || wantWide !== renderedWide || wantSplit !== renderedSplit || Math.abs(sceneW - metrics.w) > 0.5) {
        cache.current.stable = false;
        setMetrics((prev) => ({ ...prev, w: sceneW }));
        return;
      }
      const grids = [...measure.querySelectorAll<HTMLElement>("[data-label-grid]")];
      if (grids.length < CARDS.length * 2 || grids.some((g) => g.getBoundingClientRect().height < 4)) return;
      if (
        cache.current.stable &&
        Math.abs(cache.current.w - sceneW) < 0.5 &&
        Math.abs(cache.current.openingPx - openingPx) < 0.05
      ) {
        return;
      }

      let fitPx = openingPx;
      if (!fits(openingPx)) {
        let lo = MIN_FONT;
        let hi = openingPx;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
        fitPx = lo;
      }
      apply(fitPx);
      const sig = grids.map((g) => Math.round(g.getBoundingClientRect().width)).join(".");
      const stable = sig === cache.current.sig && cache.current.sig !== "";
      cache.current = { w: sceneW, openingPx, sig, fitPx, stable };
      setMetrics((prev) => {
        if (Math.abs(prev.w - sceneW) < 0.5 && Math.abs(prev.openingPx - openingPx) < 0.05 && Math.abs(prev.fitPx - fitPx) < 0.05) {
          return prev;
        }
        return { w: sceneW, openingPx, fitPx };
      });
    };

    runRef.current = run;
    run();
    const ro = new ResizeObserver(() => {
      cache.current.stable = false;
      run();
    });
    ro.observe(root);
    return () => ro.disconnect();
  });

  useLayoutEffect(() => {
    let dead = false;
    void document.fonts?.ready.then(() => {
      if (dead) return;
      cache.current.stable = false;
      runRef.current();
    });
    return () => {
      dead = true;
    };
  }, []);

  const fontStyle: CSSProperties = {
    fontSize: px,
    ["--z" as string]: String(px / 16),
  };

  const enterAt = (index: number) => (index === 1 ? secondAt : index === 2 ? thirdAt : 0);

  return (
    <div ref={rootRef} className="relative h-full w-full" style={fontStyle}>
      <div ref={probeRef} data-probe aria-hidden className="pointer-events-none invisible absolute inset-0">
        <OpeningScene t={HELD_T} sharedIcon={false} />
      </div>

      <div
        ref={measureRef}
        data-probe
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 w-full"
      >
        <div data-fit-row className={wide ? "flex w-full justify-center" : "relative w-full"} style={wide ? { gap: "0.6em" } : undefined}>
          {CARDS.map((card) => (
            <div key={card.id} data-fit-card className={wide ? "max-w-full" : "absolute left-0 top-0"}>
              <Shell box={1} opacity={1}>
                <Column card={card} split={split} dotAt={() => 1} />
              </Shell>
            </div>
          ))}
        </div>
      </div>

      {laid &&
        CARDS.map((card, i) => (
          <div
            key={card.id}
            className="absolute"
            style={{ left: laid[i].left, width: laid[i].width, top: "50%", transform: "translateY(-50%)" }}
          >
            <Shell box={boxP} opacity={show[i]}>
              <Column
                card={card}
                split={split}
                dotAt={
                  i === 0
                    ? () => 1
                    : (side, index) => dotOpacity(elapsedMs, enterAt(i), card.gptChoice1, side, index)
                }
              />
            </Shell>
          </div>
        ))}
    </div>
  );
}
