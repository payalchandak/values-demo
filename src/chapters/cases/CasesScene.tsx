import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { NEUTRAL, VALUE_ORDER } from "../../design";
import { beatStart } from "../../types";
import OpeningScene, {
  ChoiceLabels,
  SettledChoice,
  type LabelRowCue,
} from "../opening/OpeningScene";
import { GptDotRow } from "../opening/DecisionBoard";
import { CaseHeaderLine } from "../opening/TuckedCase";
import { openingCase } from "../opening/openingCase";
import { openingRows } from "../opening/openingRows";
import { dotRowVars } from "../opening/rowMetrics";
import { at } from "../opening/timeline";
import { addedCases, GPT_TRIALS, type DilemmaCard } from "./data";
import {
  ACT_LEAD_MS,
  ACT_MS,
  BOX_MS,
  CASE_STARTS,
  casesBeats,
  DOT_IN_MS,
  DOT_STAGGER_MS,
  FAST_IN_MS,
  FLY_MS,
  IN_MS,
  isFast,
  valueVoteAt,
  VOTE_FLY_MS,
  voteAt,
  WIN_LEAD_MS,
  WIN_MS,
} from "./beats";
import type { Value } from "../../study/types";
import { votingValues, winnerSide, winnerTag } from "./votes";

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
/** Each card under the top one shows a thin edge this tall, like paper in a stack. */
const EDGE_EM = 0.2;
/** And is this much narrower, so its corners tuck in. */
const EDGE_SHRINK = 0.005;
/** Edges past this depth sit together at the bottom of the pile. */
const MAX_EDGES = 10;
/** A new card slides up from this far below. */
const RISE_EM = 1;
/** Dots wait for the card to be mostly in. */
const DOT_DELAY_MS = 250;
const CARD_SHADOW =
  "0 1px 2px rgba(16,24,40,0.04), 0 10px 28px -14px rgba(16,24,40,0.12)";

const HELD_T = at("model", "end") - 1;

const gpt = openingRows.models[0];
if (gpt.trials !== GPT_TRIALS)
  throw new Error("cases: the opening GPT row is not 10 queries");

const openingCard: DilemmaCard = {
  id: openingCase.caseId,
  header: openingRows.caseHeader,
  choices: [openingCase.choices[0], openingCase.choices[1]],
  tags: openingCase.tags,
  gptChoice1: gpt.choice1,
};

/** The opening's own case first, then the four that flash in after it. */
export const CARDS: readonly DilemmaCard[] = [openingCard, ...addedCases];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (t: number, a: number, b: number) =>
  b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** When case `i` starts to flash in. Case 0 is already there. */
const startOf = (i: number) => (i === 0 ? -Infinity : CASE_STARTS[i - 1]);

/** 0 to 1 as case `i` lands on the pile. Case 0 is already there. */
function arrival(t: number, i: number): number {
  return i === 0
    ? 1
    : smooth(
        ramp(t, startOf(i), startOf(i) + (isFast(i) ? FAST_IN_MS : IN_MS)),
      );
}

/** How far up and back case `i` sits: each card that has landed on top of it adds a little. */
function sink(t: number, i: number): { up: number; shrink: number } {
  let depth = 0;
  for (let j = i + 1; j < CARDS.length; j++) {
    if (t < startOf(j)) break;
    depth += arrival(t, j);
  }
  const d = Math.min(depth, MAX_EDGES);
  return { up: d * EDGE_EM, shrink: d * EDGE_SHRINK };
}

/** How long a skipped card's text and marks take to blend in over the last card's. */
const BLEND_MS = 380;
/** The header and choice text blend slower and softer, so the skip reads as a haze. */
const TEXT_BLEND_MS = 900;
const TEXT_HAZE_OPACITY = 0.6;
const TEXT_HAZE_BLUR_EM = 0.06;

/** Share of case `j` in the blend at time `t`: in as it starts, out as the next one starts. */
function blendWeight(t: number, j: number, ms: number): number {
  const fade = (k: number) =>
    k === 0 ? 1 : smooth(ramp(t, startOf(k), startOf(k) + ms));
  const next = j + 1 < CARDS.length ? fade(j + 1) : 0;
  return fade(j) * (1 - next);
}

/** The cases still showing in a skipped card's blend, oldest first. */
function blendOf(
  t: number,
  i: number,
  ms = BLEND_MS,
): { card: DilemmaCard; w: number }[] {
  const out: { card: DilemmaCard; w: number }[] = [];
  for (let j = Math.max(0, i - 12); j <= i; j++) {
    const w = blendWeight(t, j, ms);
    if (w > 0.005) out.push({ card: CARDS[j], w });
  }
  return out;
}

function Blend({
  items,
  text,
}: {
  items: { card: DilemmaCard; w: number }[];
  text: (c: DilemmaCard) => string;
}) {
  // One case alone reads sharp; a mix of several goes soft and faint.
  const haze = 1 - Math.max(0, ...items.map((it) => it.w));
  return (
    <span
      className="grid min-w-0"
      style={{
        filter: haze > 0.01 ? `blur(${haze * TEXT_HAZE_BLUR_EM}em)` : undefined,
      }}
    >
      {items.map(({ card, w }) => (
        <span
          key={card.id}
          className="col-start-1 row-start-1 min-w-0 truncate"
          style={{ opacity: w * lerp(1, TEXT_HAZE_OPACITY, haze) }}
        >
          {text(card)}
        </span>
      ))}
    </span>
  );
}

interface VoteCue {
  /** 0..1 the winning choice is locked in. Fades back out after the last vote lands. */
  win: number;
  /** 0..1 per voting value, lit before its judgment leaves. */
  hot: Record<Value, number>;
  /** 0..1 per voting value, the pill has left and not yet returned. */
  spent: Record<Value, number>;
  /** Values whose pills are the origin of a vote still to be measured or in flight. */
  sources: ReadonlySet<Value>;
}

/**
 * The readable case's vote, as weights on the clock. The choice GPT landed on
 * locks in, then each value it judged lights and leaves in turn. Skipped cases
 * and ties cast nothing you can watch.
 */
function voteCue(t: number, index: number, card: DilemmaCard): VoteCue | null {
  if (isFast(index) || winnerSide(card) === null) return null;
  const cast = voteAt(index);
  const begin = cast - WIN_LEAD_MS;
  const end = cast + FLY_MS + 300;
  if (t <= begin || t >= end) return null;
  const rest = 1 - smooth(ramp(t, cast + FLY_MS, end));
  const win = smooth(ramp(t, begin, begin + WIN_MS)) * rest;
  const voting = new Set(votingValues(card));
  const hot = { A: 0, B: 0, N: 0, J: 0 };
  const spent = { A: 0, B: 0, N: 0, J: 0 };
  const sources = new Set<Value>();
  VALUE_ORDER.forEach((v, k) => {
    if (!voting.has(v)) return;
    const depart = valueVoteAt(index, k);
    const light = depart - ACT_LEAD_MS;
    const lit = smooth(ramp(t, light, light + ACT_MS));
    const leave = smooth(ramp(t, depart, depart + 140));
    hot[v] = lit * (1 - leave) * rest;
    const back = smooth(ramp(t, cast + FLY_MS, end));
    spent[v] = leave * (1 - back);
    if (t >= light && t < depart + VOTE_FLY_MS) sources.add(v);
  });
  return { win, hot, spent, sources };
}

function rowCues(card: DilemmaCard, cue: VoteCue, side: 0 | 1): Record<Value, LabelRowCue> | undefined {
  const won = winnerSide(card);
  if (won === null) return undefined;
  const voting = new Set(votingValues(card));
  const cueFor = (v: Value): LabelRowCue => {
    const on = side === won;
    const casts = on && voting.has(v);
    return {
      hot: casts ? cue.hot[v] : 0,
      dim: casts ? 0 : cue.win,
      spent: casts ? cue.spent[v] : 0,
      source: casts && cue.sources.has(v) && winnerTag(card, v) !== null,
    };
  };
  return { A: cueFor("A"), B: cueFor("B"), N: cueFor("N"), J: cueFor("J") };
}

function dotOpacity(
  t: number,
  i: number,
  k: number,
  side: 0 | 1,
  index: number,
): number {
  if (i === 0 || isFast(i)) return 1;
  const order = side === 0 ? index : k + index;
  const start = startOf(i) + DOT_DELAY_MS + order * DOT_STAGGER_MS;
  return smooth(ramp(t, start, start + DOT_IN_MS));
}

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
  const fast = isFast(index);
  // A skipped card lands at once: its frames match the card under it, and its text and marks blend over.
  const arrive = fast ? (t >= startOf(index) ? 1 : 0) : arrival(t, index);
  const { up, shrink } = sink(t, index);
  const live = fast && !(up >= EDGE_EM * 2);
  const mix = live ? blendOf(t, index) : null;
  const textMix = live ? blendOf(t, index, TEXT_BLEND_MS) : null;
  // Skipped cards keep their content while on top, then go blank once buried, which is never seen.
  const blank = isFast(index) && up >= EDGE_EM * 2;
  const rise = (1 - arrive) * (fast ? 0 : RISE_EM);
  const buried = up > 0.001;
  const cue = top && !blank ? voteCue(t, index, card) : null;
  const won = cue ? winnerSide(card) : null;
  return (
    <div
      data-case-column
      className="relative isolate col-start-1 row-start-1 flex min-w-0 flex-col"
      style={{
        gap: STACK_GAP,
        padding: `${PAD_EM * boxP}em`,
        opacity: arrive,
        visibility: arrive <= 0 ? "hidden" : undefined,
        transform: `translateY(${rise - up}em) scale(${1 - shrink})`,
        transformOrigin: "50% 0%",
        zIndex: index,
        ...dotRowVars(`calc(100cqw - ${PAD_EM * 2 * boxP}em)`),
      }}
      aria-hidden={arrive <= 0 || buried}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 border bg-white"
        style={{
          borderColor: NEUTRAL.line,
          borderRadius: 18,
          // Only the top card casts the soft shadow; under it, a stack of shadows turns into a grey smear.
          boxShadow: up < EDGE_EM / 2 ? CARD_SHADOW : "none",
          // The surface is in place while the group is still settling, so the
          // card is what shrinks instead of arriving after the content has.
          opacity: index === 0 ? Math.min(1, boxP / 0.45) : 1,
        }}
      />
      {blank ? (
        <div aria-hidden className="invisible">
          <CaseHeaderLine text="." />
        </div>
      ) : (
        <>
          <CaseHeaderLine
            text={
              textMix ? (
                <Blend items={textMix} text={(c) => c.header} />
              ) : (
                card.header
              )
            }
          />
          <ul className="grid w-full min-w-0 grid-cols-2 grid-rows-[auto_auto] gap-x-[0.6em] gap-y-[0.45em] [&_li>div>p]:truncate">
            {([0, 1] as const).map((side) => (
              <li
                key={side}
                className="col-span-1 row-span-2 grid min-w-0 grid-rows-subgrid gap-y-[0.45em]"
              >
                <SettledChoice
                  label={
                    mix ? (
                      <Blend items={textMix!} text={(c) => c.choices[side]} />
                    ) : (
                      card.choices[side]
                    )
                  }
                  selected={cue && won === side ? cue.win : 0}
                  dim={cue && won !== null && won !== side ? cue.win : 0}
                />
                {mix ? (
                  <div className="grid">
                    {mix.map(({ card: c, w }) => (
                      <div
                        key={c.id}
                        className="col-start-1 row-start-1"
                        style={{ opacity: w }}
                      >
                        <ChoiceLabels tags={c.tags[side]} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <ChoiceLabels tags={card.tags[side]} rows={cue ? rowCues(card, cue, side) : undefined} />
                )}
              </li>
            ))}
          </ul>
          {mix ? (
            <div className="mt-auto grid" data-dot-row>
              <div className="col-start-1 row-start-1">
                <GptDotRow
                  left={0}
                  right={0}
                  opacityAt={() => 1}
                  sharedIcon={false}
                  label={`${gpt.name} chose Choice 1 in ${card.gptChoice1} of ${GPT_TRIALS} queries`}
                  iconSrc={gpt.logo.src}
                  iconAlt={gpt.logo.alt}
                />
              </div>
              {mix.map(({ card: c, w }) => (
                <div
                  key={c.id}
                  aria-hidden
                  className="col-start-1 row-start-1"
                  style={{ opacity: w }}
                >
                  <GptDotRow
                    left={c.gptChoice1}
                    right={GPT_TRIALS - c.gptChoice1}
                    opacityAt={() => 1}
                    sharedIcon
                    anchorName=""
                    label=""
                    iconSrc={gpt.logo.src}
                    iconAlt={gpt.logo.alt}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-auto" data-dot-row>
              <GptDotRow
                left={card.gptChoice1}
                right={GPT_TRIALS - card.gptChoice1}
                opacityAt={(dotSide, n) => {
                  const base = dotOpacity(t, index, card.gptChoice1, dotSide, n);
                  if (!cue || won === null || dotSide === won) return base;
                  return base * (1 - cue.win * 0.7);
                }}
                sharedIcon={sharedIcon}
                anchorName={top ? "icon-response" : ""}
                label={`${gpt.name} chose Choice 1 in ${card.gptChoice1} of ${GPT_TRIALS} queries`}
                iconSrc={gpt.logo.src}
                iconAlt={gpt.logo.alt}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface Metrics {
  openingPx: number;
  stageW: number;
}

/**
 * A hidden copy of the opening's last frame, fitted to the stage. The scene
 * mounts only once that box is known, so its font is never the shorter scene
 * zone's. `onPx` reports the size the card has to start from.
 */
function StageFontProbe({
  hostRef,
  onPx,
}: {
  hostRef: { current: HTMLDivElement | null };
  onPx: (px: number) => void;
}) {
  const onPxRef = useRef(onPx);
  onPxRef.current = onPx;
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const host = hostRef.current;
    const stage = host?.closest<HTMLElement>("[data-stage]");
    if (!host || !stage) return;
    const apply = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [hostRef]);
  useLayoutEffect(() => {
    if (!box) return;
    const root = hostRef.current?.querySelector<HTMLElement>("[data-opening-root]");
    if (!root) return;
    const read = () => {
      const px = parseFloat(getComputedStyle(root).fontSize);
      if (px > 1) onPxRef.current(px);
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ["style"] });
    void document.fonts?.ready.then(read);
    return () => mo.disconnect();
  }, [box, hostRef]);
  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none invisible absolute left-0 top-0 overflow-hidden"
      style={box ? { width: box.w, height: box.h } : undefined}
    >
      {box ? <OpeningScene t={HELD_T} sharedIcon={false} /> : null}
    </div>
  );
}

/** Scale from a CSS transform matrix, or 1 when the element is unscaled. */
function cssScale(el: HTMLElement | null): number {
  if (!el) return 1;
  const tr = getComputedStyle(el).transform;
  if (!tr || tr === "none") return 1;
  const n = parseFloat(tr.slice(tr.indexOf("(") + 1));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * The opening's last frame condensed into one card, then five cases flashing
 * through it. Every weight is the chapter clock plus the measured stage size.
 */
export default function CasesScene({ elapsedMs }: { elapsedMs: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<Metrics>({ openingPx: 0, stageW: 0 });

  // The opening fitted its type to the whole stage. This probe has to be that
  // same box before it measures, or the first paint uses the shorter scene
  // zone and the case snaps smaller just as the card starts to draw.
  const onOpeningPx = (px: number) => {
    setMetrics((prev) => (Math.abs(prev.openingPx - px) < 0.2 ? prev : { ...prev, openingPx: px }));
  };
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      setMetrics((prev) =>
        Math.abs(prev.stageW - root.clientWidth) < 0.5 ? prev : { ...prev, stageW: root.clientWidth },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const boxAt = beatStart(casesBeats, "box");
  // Gentler than the cubic: the middle of that curve was steep enough to read as a snap.
  const boxP = smooth(ramp(elapsedMs, boxAt, boxAt + BOX_MS));

  // If the opening's last frame is still scaled up to the stage, take that fill
  // off while the column width eases to the card. The scale must not shrink a
  // second time on top of the width, or the group snaps small and the card
  // chases it. Once the ease is done, no transform is left to measure.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const pile = pileRef.current;
    const probe = probeRef.current;
    const card = pile?.querySelector<HTMLElement>("[data-case-column]");
    const dotRow = card?.querySelector<HTMLElement>("[data-dot-row]");
    if (!root || !pile || !card) return;
    pile.style.height = "";
    pile.style.transform = "";
    card.style.height = "";
    card.style.justifyContent = "";
    if (dotRow) dotRow.style.marginTop = "";
    const fill = cssScale(probe?.querySelector<HTMLElement>("[data-scale-box]") ?? null);
    if (fill <= 1.001 || boxP >= 0.999) return;
    const packed = card.offsetHeight;
    const layoutW = pile.offsetWidth;
    const font = parseFloat(getComputedStyle(pile).fontSize) || 16;
    const openW = Math.min(root.clientWidth, OPEN_EM * font);
    const cardW = Math.min(Math.max(0, root.clientWidth - SIDE * 2), CARD_EM * font);
    const visualW = lerp(openW * fill, cardW, boxP);
    const scale = layoutW > 1 ? visualW / layoutW : 1;
    const visualH = lerp(root.clientHeight, packed, boxP);
    const layoutH = scale > 0.05 ? visualH / scale : packed;
    if (scale > 1.001) {
      pile.style.transform = `scale(${scale})`;
      pile.style.transformOrigin = "center";
    }
    if (layoutH > packed + 1) {
      pile.style.height = `${layoutH}px`;
      card.style.height = "100%";
      card.style.justifyContent = "space-between";
      if (dotRow) dotRow.style.marginTop = "0";
    }
  });

  // Type stays at the opening's size, or less when two columns of labels would not fit the stage.
  const fitPx = Math.max(8, (metrics.stageW - SIDE * 2) / FIT_EM);
  const fontPx = metrics.openingPx > 0 ? Math.min(metrics.openingPx, fitPx) : 0;

  let topIndex = 0;
  CARDS.forEach((_, i) => {
    if (arrival(elapsedMs, i) >= 0.5) topIndex = i;
  });

  // No side inset on the first frame: the opening's last frame fills the stage.
  // The inset eases in with the card, so a narrow stage still keeps a margin once the card has narrowed.
  const shell: CSSProperties = {
    width: `min(calc(100% - ${SIDE * 2 * boxP}px), ${lerp(OPEN_EM, CARD_EM, boxP)}em)`,
    fontSize: fontPx,
    ["--z" as string]: String(fontPx / 16),
  };

  return (
    <div ref={rootRef} className="relative h-full w-full">
      <StageFontProbe hostRef={probeRef} onPx={onOpeningPx} />

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          ref={pileRef}
          data-pile
          className="@container relative box-border grid origin-center"
          style={{ ...shell, visibility: fontPx > 0 ? undefined : "hidden" }}
        >
          {CARDS.map((card, i) => {
            if (i > 0 && elapsedMs < startOf(i)) return null;
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
        </div>
      </div>
    </div>
  );
}
