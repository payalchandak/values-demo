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
import { BOX_MS, CASE_STARTS, casesBeats, DOT_IN_MS, DOT_STAGGER_MS, IN_MS, isFast, SKIP_MS, SKIP_START } from "./beats";

/** The opening's width cap, and the card's width once it has narrowed, in em. */
const OPEN_EM = 46;
const CARD_EM = 34;
/** Padding the white card opens around its content, in em. */
const PAD_EM = 0.9;
/** Space around the card on the stage, in px. */
const SIDE = 12;
/** Card width, in em of type, that two columns of labels need. Narrower stages shrink the type. */
const FIT_EM = 32;
/** Gap between the stacked parts, as in the opening. */
const STACK_GAP = "0.9em";
/** Each card on the pile sits this far higher and a little smaller than the one above it. */
const PEEK_EM = 0.8;
const SHRINK = 0.04;
/** Cards this deep show behind the top one. */
const PILE = 3;
/** A new card slides up from this far below. */
const RISE_EM = 1;
/** Dots wait for the card to be mostly in. */
const DOT_DELAY_MS = 250;
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

/** The opening's own case first, then the four that flash in after it. */
const CARDS: readonly DilemmaCard[] = [openingCard, ...addedCases];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a)));
const smooth = (x: number) => x * x * (3 - 2 * x);
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** When case `i` starts to flash in. Case 0 is already there. */
const startOf = (i: number) => (i === 0 ? -Infinity : CASE_STARTS[i - 1]);

/** 0 to 1 as case `i` lands on the pile. Case 0 is already there. */
function arrival(t: number, i: number): number {
  return i === 0 ? 1 : smooth(ramp(t, startOf(i), startOf(i) + IN_MS));
}

/** How far down the pile case `i` has sunk: one per case that has landed on top of it. */
function depthOf(t: number, i: number): number {
  let d = 0;
  for (let j = i + 1; j < CARDS.length; j++) {
    if (isFast(j)) continue;
    if (t < startOf(j)) break;
    d += arrival(t, j);
  }
  return d;
}

function dotOpacity(t: number, i: number, k: number, side: 0 | 1, index: number): number {
  if (i === 0 || isFast(i)) return 1;
  const order = side === 0 ? index : k + index;
  const start = startOf(i) + DOT_DELAY_MS + order * DOT_STAGGER_MS;
  return smooth(ramp(t, start, start + DOT_IN_MS));
}

/**
 * The dot pitch for up to ten dots on one side: the opening's own pitch when the
 * card is wide, tighter when the card is narrow so ten dots stay in their column.
 */
const PITCH = `min(1.15em, (((min(${OPEN_EM}em, 100cqw) - 0.6em) / 2) - 3.85em) / ${GPT_TRIALS})`;

function CaseContent({
  card,
  index,
  t,
  sharedIcon,
  top,
  boxP,
}: {
  card: DilemmaCard;
  index: number;
  t: number;
  sharedIcon: boolean;
  /** The newest card on the pile holds the shared icon's anchor. */
  top: boolean;
  boxP: number;
}) {
  const arrive = arrival(t, index);
  const depth = depthOf(t, index);
  // Only the first few cards down the pile show. Deeper ones are gone.
  const shown = Math.min(depth, PILE);
  const fade = 1 - clamp01(depth - PILE);
  const rise = (1 - arrive) * RISE_EM;
  const buried = depth > 0.001;
  return (
    <div
      className="relative isolate col-start-1 row-start-1 flex min-w-0 flex-col"
      style={{
        gap: STACK_GAP,
        padding: `${PAD_EM * boxP}em`,
        opacity: arrive * fade,
        visibility: arrive <= 0 ? "hidden" : undefined,
        transform: `translateY(${rise - shown * PEEK_EM}em) scale(${1 - shown * SHRINK})`,
        transformOrigin: "50% 0%",
        zIndex: index,
        ...ROW_VARS,
        ["--pitch" as string]: PITCH,
      }}
      aria-hidden={arrive <= 0 || buried}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 border bg-white"
        style={{
          opacity: index === 0 ? boxP : 1,
          borderColor: NEUTRAL.line,
          borderRadius: 18,
          boxShadow: CARD_SHADOW,
        }}
      />
      <CaseHeaderLine text={card.header} />
      <ul className="grid w-full min-w-0 grid-cols-2 grid-rows-[auto_auto] gap-x-[0.6em] gap-y-[0.45em] [&_li>div>p]:truncate">
        {([0, 1] as const).map((side) => (
          <li key={side} className="col-span-1 row-span-2 grid min-w-0 grid-rows-subgrid gap-y-[0.45em]">
            <SettledChoice label={card.choices[side]} />
            <ChoiceLabels tags={card.tags[side]} />
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        <GptDotRow
          left={card.gptChoice1}
          right={GPT_TRIALS - card.gptChoice1}
          opacityAt={(side, n) => dotOpacity(t, index, card.gptChoice1, side, n)}
          sharedIcon={sharedIcon}
          anchorName={top ? "icon-response" : ""}
          label={`${gpt.name} chose Choice 1 in ${card.gptChoice1} of ${GPT_TRIALS} queries`}
          iconSrc={gpt.logo.src}
          iconAlt={gpt.logo.alt}
        />
      </div>
    </div>
  );
}

interface Metrics {
  openingPx: number;
  stageW: number;
}

/**
 * The opening's last frame condensed into one card, then five cases flashing
 * through it. Every weight is the chapter clock plus the measured stage size.
 */
export default function CasesScene({ elapsedMs }: { elapsedMs: number; ownIcons?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<Metrics>({ openingPx: 16, stageW: 0 });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const openingRoot = probeRef.current?.querySelector<HTMLElement>("[data-opening-root]");
      const px = openingRoot ? parseFloat(getComputedStyle(openingRoot).fontSize) : NaN;
      const next: Metrics = {
        openingPx: Number.isFinite(px) && px > 1 ? px : 16,
        stageW: root.clientWidth,
      };
      setMetrics((prev) =>
        Math.abs(prev.openingPx - next.openingPx) < 0.2 && Math.abs(prev.stageW - next.stageW) < 0.5 ? prev : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, []);

  const boxAt = beatStart(casesBeats, "box");
  const boxP = ease(ramp(elapsedMs, boxAt, boxAt + BOX_MS));

  // Type stays at the opening's size, or less when two columns of labels would not fit the stage.
  const fitPx = Math.max(8, (metrics.stageW - SIDE * 2) / FIT_EM);
  const fontPx = metrics.stageW > 0 ? Math.min(metrics.openingPx, fitPx) : metrics.openingPx;

  const skipP = ramp(elapsedMs, SKIP_START, SKIP_START + SKIP_MS);
  const skipShow = smooth(ramp(elapsedMs, SKIP_START, SKIP_START + 500)) * (1 - smooth(ramp(elapsedMs, SKIP_START + SKIP_MS - 400, SKIP_START + SKIP_MS)));
  let topIndex = 0;
  CARDS.forEach((_, i) => {
    if (arrival(elapsedMs, i) >= 0.5) topIndex = i;
  });

  const shell: CSSProperties = {
    width: `min(100%, ${lerp(OPEN_EM, CARD_EM, boxP)}em)`,
    fontSize: fontPx,
    ["--z" as string]: String(fontPx / 16),
  };

  return (
    <div ref={rootRef} className="relative h-full w-full">
      <div
        ref={probeRef}
        data-probe
        aria-hidden
        className="pointer-events-none invisible absolute inset-0 overflow-hidden"
      >
        <OpeningScene t={HELD_T} sharedIcon={false} />
      </div>

      <div className="absolute inset-0 flex items-center justify-center" style={{ padding: SIDE }}>
        <div className="@container relative box-border grid" style={shell}>
          {CARDS.map((card, i) => {
            if (isFast(i)) return null;
            if (i > 0 && elapsedMs < startOf(i)) return null;
            if (depthOf(elapsedMs, i) >= PILE + 1) return null;
            return (
              <CaseContent
                key={card.id}
                card={card}
                index={i}
                t={elapsedMs}
                sharedIcon={false}
                top={i === topIndex}
                boxP={boxP}
              />
            );
          })}
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-full flex flex-col items-center"
            style={{ marginTop: "1.2em", opacity: skipShow, color: NEUTRAL.inkFaint }}
          >
            <span className="text-[0.8em] font-semibold">46 more cases</span>
            <span className="mt-[0.5em] block h-[0.25em] w-[40%] overflow-hidden rounded-full" style={{ backgroundColor: NEUTRAL.line }}>
              <span className="block h-full" style={{ width: `${skipP * 100}%`, backgroundColor: NEUTRAL.inkFaint }} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
