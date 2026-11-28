import { memo, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { ModelResponseTiming } from "../../components/ModelResponse";
import neuripsLogo from "../../assets/neurips-logo.svg";
import openaiLogo from "../../assets/providers/openai.svg";
import {
  FADE_MS,
  MOVE_MS,
  NEUTRAL,
  RECOMMENDATION_COLORS,
  TAGS,
  TagGlyph,
  VALUES,
  VALUE_ORDER,
} from "../../design";
import type { Tag } from "../../study/types";
import { openingCase } from "./openingCase";
import DecisionBoard from "./DecisionBoard";
import OpeningResponse from "./OpeningResponse";
import ValueStrip from "./ValueStrip";
import Vignette from "./Vignette";
import { PhysicianVotes } from "./DoctorSplit";
import { CARD_CLASS, CARD_SURFACE } from "./cardClass";
import { CHARCOAL, CHARCOAL_FAINT } from "./charcoal";
import { ROW_VARS } from "./rowMetrics";
import { valueSteps } from "./valueSteps";
import { triggerWords } from "./valueTriggers";
import { CASE_SHRINK_MS, COLLAPSE_MS, OPENING_BEATS, OFFSETS, PILL_ENTER_MS, at, caseCharsAt, modelHandoff, ramp, stripProgress, visibility, voteEnter } from "./timeline";

/* -------------------------------------------------------------------------- */
/*  Copy                                                                       */
/* -------------------------------------------------------------------------- */

/** Storyboard copy, verbatim. */
const HEADLINES = [
  { text: "Do Language Models Share Your Doctor's Priorities?", size: "2.6em" }, // ch1
  { text: "Physicians disagree on the decision", size: "1.7em" }, // ch2
  { text: "Doctors disagree because they prioritize different values.", size: "1.6em" }, // ch4
] as const;

/** Display name only. Never a model version. */
const PROVIDER = { name: "OpenAI", logo: openaiLogo } as const;

const RESPONSE = {
  panelLabel: `${PROVIDER.name} response`,
  wordsPerGroup: 4,
  groupFadeMs: FADE_MS,
  identifyLabel: "Identify the recommendation",
} as const;

const MODEL_BEATS = OPENING_BEATS.model;
const beat = (name: string) => MODEL_BEATS.find((b) => b.name === name)!.startMs;
const RESPONSE_TIMING: ModelResponseTiming = {
  thinkStartMs: beat("think"),
  revealStartMs: beat("reveal"),
  revealEndMs: beat("revealed"),
  groupFadeMs: RESPONSE.groupFadeMs,
  highlightStartMs: beat("highlight"),
  highlightEndMs: beat("highlight") + MOVE_MS,
  outlineStartMs: beat("extract"),
  outlineEndMs: beat("extract") + MOVE_MS,
};

/**
 * The framework chapter's first beat. GPT's row leaves while the
 * plain vignette and the new headline arrive; the value walk follows.
 */
const FRAMEWORK_AT = at("framework", "framework");

/** How long before the opening's last beat the patient card returns, when the stage asks for the stack handoff. */
const RECALL_LEAD_MS = 1800;

/**
 * Both options share one neutral accent. Rose would read as a judgment, and
 * the two choices are equal until a model actually picks one.
 */
const OPTION_ACCENT = RECOMMENDATION_COLORS.option2;

/* -------------------------------------------------------------------------- */
/*  Fit: pick the largest font size at which every chapter fits the viewport   */
/* -------------------------------------------------------------------------- */

const MIN_FONT_PX = 6;
const MAX_FONT_PX = 22;
/**
 * The opening card (logo + paper title) is on screen alone, so it is sized to
 * the viewport instead of the font that later, denser chapters fit into.
 * It eases back to that shared size before the case arrives.
 */
/** NeurIPS lockup, from the SVG's own width and height. */
const LOGO_ASPECT = 26.738739 / 59.671822;
const HERO_TITLE_CAP = 96;
const HERO_LOGO_CAP = 720;
/** Same break as the opening card: two lines, never a third. */
const HERO_TITLE_LINES = ["Do Language Models Share", "Your Doctor's Priorities?"] as const;
const HERO_LINE_HEIGHT = 1.12;
if (HERO_TITLE_LINES.join(" ") !== HEADLINES[0].text) {
  throw new Error("opening title lines drifted from the headline");
}

interface HeroLockup {
  logo: number;
  title: number;
  gap: number;
  fs: number;
  sceneW: number;
}

const EMPTY_LOCKUP: HeroLockup = { logo: 0, title: 0, gap: 0, fs: 16, sceneW: 0 };

const sameLockup = (a: HeroLockup, b: HeroLockup) =>
  Math.abs(a.logo - b.logo) < 0.5 &&
  Math.abs(a.title - b.title) < 0.5 &&
  Math.abs(a.gap - b.gap) < 0.5 &&
  Math.abs(a.fs - b.fs) < 0.05 &&
  Math.abs(a.sceneW - b.sceneW) < 0.5;

/**
 * Largest logo and two-line title that fill the opening card.
 * The title keeps its two lines; the size is whatever still fits the width.
 */
function measureHero(sceneW: number, sceneH: number, fs: number, lineProbe: HTMLElement): HeroLockup {
  const maxH = Math.max(0, sceneH * 0.9);
  const restTitle = 2.6 * fs;
  const restLogo = Math.min(16 * fs, sceneW * 0.68);
  const lineBudget = Math.max(0, sceneW * 0.98);
  const gapFor = (titlePx: number) => Math.max(fs * 0.9, titlePx * 0.32);
  const titleBlock = (titlePx: number) => titlePx * HERO_LINE_HEIGHT * HERO_TITLE_LINES.length;
  const linesFit = (titlePx: number) => {
    lineProbe.style.fontSize = `${titlePx}px`;
    for (const line of HERO_TITLE_LINES) {
      lineProbe.textContent = line;
      if (lineProbe.offsetWidth > lineBudget + 0.5) return false;
    }
    return true;
  };
  const blockFits = (logoW: number, titlePx: number) =>
    logoW * LOGO_ASPECT + gapFor(titlePx) + titleBlock(titlePx) <= maxH;

  if (sceneW <= 0 || sceneH <= 0) return { logo: restLogo, title: restTitle, gap: gapFor(restTitle), fs, sceneW };

  let lo = 8;
  let hi = HERO_TITLE_CAP;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (linesFit(mid)) lo = mid;
    else hi = mid;
  }
  let title = linesFit(lo) ? lo : restTitle;
  let logo = Math.min(sceneW * 0.96, HERO_LOGO_CAP);
  if (!blockFits(logo, title)) {
    let a = Math.min(restLogo, sceneW * 0.4);
    let b = logo;
    for (let i = 0; i < 12; i++) {
      const mid = (a + b) / 2;
      if (blockFits(mid, title)) a = mid;
      else b = mid;
    }
    logo = blockFits(a, title) ? a : restLogo;
  }
  if (!blockFits(logo, title)) {
    let a = 8;
    let b = title;
    for (let i = 0; i < 12; i++) {
      const mid = (a + b) / 2;
      if (linesFit(mid) && blockFits(logo, mid)) a = mid;
      else b = mid;
    }
    title = a;
  }

  return { logo, title, gap: gapFor(title), fs, sceneW };
}
/**
 * Below this size the full vignette is not comfortable to read, so the scene
 * switches to the focused vignette layout (see Vignette.tsx).
 */
const MIN_READABLE_PX = 12;

/** The two choices fade in and the case eases up to make room. */
const OPTIONS_IN_MS = 680;

/** Gap between stacked blocks. The heading clip folds one of these into itself. */
const STACK_GAP = "0.9em";

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);
const easeOut = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

/**
 * Times inside each chapter at which that chapter's layout is at its fullest.
 * Hidden copies of the scene at these times are measured, so the font size is
 * chosen once per viewport and never changes during playback. The framework
 * chapter is probed once per value (at its highlight and once both labels have landed)
 * because the focused layout enlarges a different sentence for each. The hook
 * is probed at its last frame, where the question slot is already reserved.
 */
const PROBE_TIMES: readonly number[] = [
  at("hook", "end") - 1,
  at("dilemma", "end") - 1,
  at("model", "extracted"),
  at("model", "end") - 1, // the case still full, GPT's decision row on screen
  ...VALUE_ORDER.filter((v) => triggerWords(v) > 0).map((v) => at("framework", `${v}Highlight`) + 400),
  ...VALUE_ORDER.map((v) => at("framework", `${v}Chip2`) + PILL_ENTER_MS),
  at("framework", "all") + 800,
];

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                     */
/* -------------------------------------------------------------------------- */

/** Layout-animated block (smooths reflow when content above/below appears); plain in probes. */
function Block({
  probe,
  className = "",
  layout = true,
  style,
  children,
}: {
  probe: boolean;
  className?: string;
  /** Off while a clock-driven height change is already moving this block. */
  layout?: boolean;
  style?: { marginTop?: string };
  children: ReactNode;
}) {
  if (probe) return <div className={className} style={style}>{children}</div>;
  return (
    <motion.div
      layout={layout ? "position" : false}
      transition={{ duration: FADE_MS / 1000, ease: "easeOut" }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function useBoxHeight() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!node) return;
    const measure = () => setHeight(node.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, height] as const;
}

function useBox() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!node) return;
    const measure = () => setBox({ w: node.offsetWidth, h: node.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, box] as const;
}

/**
 * Opens a slot with `enter` while the content fades in at full size, unclipped.
 * At rest the slot is the content's own height, with no transform left on the type.
 */
function FadeSlot({ enter, children }: { enter: number; children: ReactNode }) {
  const [ref, measured] = useBoxHeight();
  const p = Math.min(1, Math.max(0, enter));
  const settled = p >= 1;
  return (
    <div className="relative w-full" style={{ height: settled || measured === 0 ? (settled ? "auto" : 0) : measured * p }}>
      <div
        ref={ref}
        className="w-full"
        style={{
          opacity: p,
          position: settled ? undefined : "absolute",
          top: settled ? undefined : 0,
          left: settled ? undefined : 0,
          width: "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Grows a block up from nothing so a new panel eases into the column. */
function GrowIn({ enter, children }: { enter: number; children: ReactNode }) {
  const [ref, measured] = useBoxHeight();
  const p = Math.min(1, Math.max(0, enter));
  const settled = p >= 1;
  return (
    <div
      className="w-full"
      style={{
        height: settled || measured === 0 ? (settled ? "auto" : 0) : measured * p,
        // The panel stays whole and fades. Clipping it would show a hard slice of the card.
        overflow: "visible",
      }}
    >
      <div
        ref={ref}
        style={{
          opacity: p,
          transform: settled ? undefined : `translateY(${(1 - p) * 0.6}em)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const HEADING_CLASS =
  "mx-auto w-full max-w-[30em] text-balance text-center font-semibold leading-[1.12] tracking-tight";

/**
 * The paper title and the question occupy one heading. The box eases from the
 * title's height to the question's, so the case card moves up instead of
 * jumping. While that height is between the two, both lines are centered in
 * the clip and taken out of flow — otherwise the row stays as tall as the
 * paper title and the question is sliced off. A seek measures the same box
 * playback uses.
 */
function HeadlineReplace({
  mix,
  exit = 0,
  drift = 0,
  titleOpacity,
  questionOpacity,
  titleSize,
}: {
  /** 0 = the paper title's box, 1 = the question's box. */
  mix: number;
  /** 1 collapses the question after it has replaced the title. */
  exit?: number;
  /** 0..1. The question drifts up while it fades, ahead of the slot closing. */
  drift?: number;
  titleOpacity: number;
  questionOpacity: number;
  /** Override for the opening card. Omit to use the shared headline size. */
  titleSize?: string;
}) {
  const [titleRef, titleH] = useBoxHeight();
  const [questionRef, questionH] = useBoxHeight();
  const p = Math.min(1, Math.max(0, mix));
  const gone = Math.min(1, Math.max(0, exit));
  const settledTitle = p <= 0 && gone <= 0;
  const settledQuestion = p >= 0.98 && gone <= 0;
  const from = titleH === 0 ? questionH : titleH;
  const to = questionH === 0 ? titleH : questionH;
  const headingH = (from + (to - from) * p) * (1 - gone);
  // Only the replacement move. The exit keeps the in-flow grid so its own drift still applies.
  const swapping = p > 0.001 && !settledQuestion && gone <= 0;
  const questionTransform = swapping
    ? "translateY(-50%)"
    : drift > 0
      ? `translateY(${drift * -0.35}em)`
      : undefined;
  return (
    <div className="w-full" style={{ marginBottom: `calc(${STACK_GAP} * -1)` }}>
      <div
        className="relative grid"
        style={{
          alignItems: "center",
          height: settledTitle || settledQuestion || headingH === 0 ? "auto" : headingH,
          // Keep the fading question visible. A shrinking box would clip it and read as a cut.
          overflow: questionOpacity > 0.04 ? "visible" : "hidden",
        }}
      >
        <h1
          ref={titleRef}
          className={HEADING_CLASS}
          style={{
            gridArea: "1 / 1",
            fontSize: titleSize ?? HEADLINES[0].size,
            color: NEUTRAL.ink,
            opacity: titleOpacity,
            position: swapping || settledQuestion ? "absolute" : undefined,
            top: swapping ? "50%" : undefined,
            left: swapping ? 0 : undefined,
            right: swapping ? 0 : undefined,
            transform: swapping ? "translateY(-50%)" : undefined,
          }}
          aria-hidden={titleOpacity < 0.5}
        >
          {titleSize
            ? HERO_TITLE_LINES.map((line) => (
                <span key={line} className="block whitespace-nowrap">
                  {line}
                </span>
              ))
            : HEADLINES[0].text}
        </h1>
        <h1
          ref={questionRef}
          className={HEADING_CLASS}
          style={{
            gridArea: "1 / 1",
            fontSize: HEADLINES[1].size,
            color: NEUTRAL.ink,
            opacity: questionOpacity,
            position: swapping || settledTitle ? "absolute" : undefined,
            top: swapping ? "50%" : undefined,
            left: swapping ? 0 : undefined,
            right: swapping ? 0 : undefined,
            transform: questionTransform,
          }}
          aria-hidden={questionOpacity < 0.5}
        >
          {HEADLINES[1].text}
        </h1>
      </div>
      <div aria-hidden style={{ height: `calc(${STACK_GAP} * ${1 - gone})` }} />
    </div>
  );
}

function CaseBody({ text, caret, question }: { text: string; caret?: boolean; question?: ReactNode }) {
  return (
    <>
      <p className="leading-[1.5]" style={{ textWrap: caret ? "wrap" : "pretty" }}>
        {caret ? <span aria-hidden>{text}</span> : text}
        {caret && (
          <span
            aria-hidden
            className="ml-[0.05em] inline-block w-[0.07em] translate-y-[0.12em] bg-current"
            style={{ height: "1.05em" }}
          />
        )}
      </p>
      {question}
    </>
  );
}

/**
 * The value-prism ED vignette, verbatim. Same card the stack takes over.
 * `typedChars` reveals a prefix while the opening types the case in. Omit it,
 * or pass the full length, for the settled card.
 */
export function PatientCard({
  shared = false,
  question,
  typedChars,
}: {
  shared?: boolean;
  question?: ReactNode;
  typedChars?: number;
}) {
  const text = openingCase.vignette;
  const count = typedChars === undefined ? text.length : Math.max(0, Math.min(typedChars, text.length));
  const shell = (body: ReactNode, mark: boolean) => (
    <div
      data-shared={mark ? "patient" : undefined}
      className={CARD_CLASS}
      style={{ borderColor: NEUTRAL.line, color: NEUTRAL.ink }}
    >
      {body}
    </div>
  );
  if (count >= text.length) return shell(<CaseBody text={text} question={question} />, shared);
  // Ghost holds the finished vignette's height so the title stays put while lines appear.
  return (
    <div className="relative w-full" aria-label={text}>
      <div aria-hidden className="invisible">
        {shell(<CaseBody text={text} />, false)}
      </div>
      {count > 0 && (
        <div className="absolute inset-x-0 top-0">
          {shell(<CaseBody text={text.slice(0, count)} caret />, shared)}
        </div>
      )}
    </div>
  );
}

/**
 * The relation only, inside the pill. The value name sits outside it.
 * Three redundant cues carry the relation, in charcoal only:
 *   promotes: up arrow + solid chip + "promotes"
 *   violates: down arrow + outlined chip + "violates"
 *   neutral:  dash + faint chip + "neutral"
 */
function RelationPill({ tag }: { tag: Tag }) {
  const meta = TAGS[tag];
  const style =
    meta.chip === "solid"
      ? { borderColor: CHARCOAL, backgroundColor: CHARCOAL, color: "#fff" }
      : meta.chip === "outlined"
        ? { borderColor: CHARCOAL, backgroundColor: NEUTRAL.surface, color: CHARCOAL }
        : { borderColor: CHARCOAL_FAINT, backgroundColor: NEUTRAL.surface, color: NEUTRAL.inkFaint };
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center gap-x-[0.22em] rounded-[1em] border px-[0.5em] py-[0.08em] font-semibold leading-none tracking-tight [&>svg]:h-[0.9em] [&>svg]:w-[0.9em]"
      style={{ ...style, borderWidth: meta.chip === "outlined" ? 1.5 : 1 }}
    >
      <TagGlyph glyph={meta.glyph} size={12} />
      <span>{meta.word}</span>
    </span>
  );
}

/** Space a new label opens between itself and the label above it. */
const CHIP_ROW_GAP = "0.28em";

/**
 * One label under a choice. The row's height follows the clock, so labels
 * already on screen stay put and the list opens instead of jumping. The name
 * leads; the pill resolves just after it. `rowHeight` is the settled line,
 * measured once outside the clip.
 */
function ChipRow({
  first,
  progress,
  rowHeight,
  name,
  tag,
}: {
  first: boolean;
  /** Linear 0..1 over the landing. */
  progress: number;
  rowHeight: number;
  name: string;
  tag: Tag;
}) {
  const p = Math.min(1, Math.max(0, progress));
  const settled = p >= 1 && rowHeight > 0;
  const grow = easeOut(p);
  // The name is readable first. The pill fades in across the rest of the open.
  const nameIn = easeOut(Math.min(1, p / 0.7));
  const pillIn = easeOut(Math.min(1, Math.max(0, (p - 0.22) / 0.78)));
  const rise = settled ? 0 : (1 - grow) * 0.45;
  const clip = {
    maxHeight: settled ? undefined : rowHeight * grow,
    marginTop: `calc(${CHIP_ROW_GAP} * ${first ? 0 : settled ? 1 : grow})`,
    minHeight: 0,
    overflow: settled ? ("visible" as const) : ("hidden" as const),
  };
  return (
    <>
      <span aria-hidden="true" className="self-center text-right font-semibold leading-none" style={clip}>
        <span className="block" style={{ opacity: nameIn, transform: rise === 0 ? undefined : `translateY(${rise}em)` }}>
          {name}:
        </span>
      </span>
      <span
        aria-label={`${name}: ${TAGS[tag].word}`}
        aria-hidden={p <= 0}
        className="self-center justify-self-start"
        style={clip}
      >
        <span
          className="block"
          style={{
            opacity: pillIn,
            transform: settled ? undefined : `translateY(${(1 - pillIn) * 0.4}em) scale(${0.96 + 0.04 * pillIn})`,
            transformOrigin: "left center",
          }}
        >
          <RelationPill tag={tag} />
        </span>
      </span>
    </>
  );
}

/**
 * The labels of one decision, outside the choice button. Each value's name
 * sits beside a pill that says promotes, violates, or neutral. Names share
 * one column and the pills share the next, so the judgments line up.
 * Every value is in the grid from the first label, at zero height until its
 * own landing, so a longer name does not shove the rows already on screen.
 * Choice 1's label lands first, then Choice 2's.
 */
function Chips({ index, t }: { index: 0 | 1; t: number }) {
  const steps = valueSteps(t);
  const tags = openingCase.tags[index];
  const weight = index === 0 ? steps.chip1 : steps.chip2;
  const [setName, nameBox] = useBox();
  const [setPill, pillBox] = useBox();
  const [setLine, lineBox] = useBox();
  if (VALUE_ORDER.every((v) => weight[v] <= 0)) return null;
  const measuredLine = Math.max(nameBox.h, lineBox.h);
  // The live row is a couple of pixels taller than the offscreen measure (grid
  // line box). Extra room keeps the pill from clipping, then popping, as it lands.
  const rowHeight = measuredLine > 0 ? measuredLine + 4 : 0;
  // A little slack so a rounded measurement never clips the glyph while the row is opening.
  const columns =
    nameBox.w > 0 && pillBox.w > 0 ? `${nameBox.w + 2}px ${pillBox.w + 2}px` : "max-content max-content";
  return (
    <div className="relative mx-auto w-fit" style={{ fontSize: "0.78em", color: CHARCOAL }}>
      <div aria-hidden className="pointer-events-none invisible absolute left-0 top-0">
        <span ref={setName} className="block whitespace-nowrap font-semibold leading-none">
          Nonmaleficence:
        </span>
        <span ref={setPill} className="flex w-max flex-col">
          <RelationPill tag={1} />
          <RelationPill tag={-1} />
          <RelationPill tag={0} />
        </span>
        <span ref={setLine} className="block w-max font-semibold leading-none">
          <RelationPill tag={-1} />
        </span>
      </div>
      <div className="grid items-center gap-x-[0.45em]" style={{ gridTemplateColumns: columns }}>
        {VALUE_ORDER.map((v, i) => (
          <ChipRow
            key={v}
            first={i === 0}
            progress={weight[v]}
            rowHeight={rowHeight}
            name={VALUES[v].name}
            tag={tags[v]}
          />
        ))}
      </div>
    </div>
  );
}

function OptionCard({
  index,
  t,
  selected,
  showChips,
  votes,
}: {
  index: 0 | 1;
  t: number;
  selected: boolean;
  showChips: boolean;
  /** Opening time while the physician icons are shown, or null once they are not. */
  votes: number | null;
}) {
  const frame = selected ? OPTION_ACCENT : `color-mix(in srgb, ${NEUTRAL.ink} 28%, white)`;
  return (
    <li className="flex min-w-0 flex-col gap-[0.45em] @md:col-span-1 @md:row-span-2 @md:grid @md:grid-rows-subgrid @md:gap-y-[0.45em]">
      <div
        aria-current={selected ? "true" : undefined}
        className="flex h-full items-center justify-center rounded-[0.7em] border bg-white px-[0.85em] py-[0.4em] text-center transition-colors duration-75 ease-out"
        style={{
          borderColor: frame,
          backgroundColor: selected ? "#F4F4F5" : "#FFFFFF",
          boxShadow: selected ? `0 0 0 1px ${OPTION_ACCENT}` : "0 1px 2px rgba(16,24,40,0.06)",
          color: NEUTRAL.ink,
        }}
      >
        <p className="font-semibold leading-snug" style={{ fontSize: "1.05em" }}>
          {openingCase.choices[index]}
        </p>
      </div>
      {showChips ? <Chips index={index} t={t} /> : votes !== null ? <PhysicianVotes index={index} enterOf={(i) => voteEnter(votes, i)} /> : null}
    </li>
  );
}

/**
 * The case card cross-fades into the vignette. `settle` is 0..1.
 * Both cards are measured, so a seek shows the height in between.
 */
function CaseHandoff({
  t,
  settle,
  focused,
  shared,
}: {
  t: number;
  settle: number;
  focused: boolean;
  shared: boolean;
}) {
  const [lineRef, lineH] = useBoxHeight();
  const [fullRef, fullH] = useBoxHeight();
  const p = Math.min(1, Math.max(0, settle));
  const height = lineH > 0 && fullH > 0 ? lineH + (fullH - lineH) * p : undefined;
  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      <div ref={lineRef} style={{ opacity: 1 - p }} aria-hidden={p > 0.6}>
        <PatientCard shared={shared && p < 0.5} />
      </div>
      <div ref={fullRef} className="absolute inset-x-0 top-0" style={{ opacity: p }} aria-hidden={p < 0.4}>
        <Vignette t={t} focused={focused} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hook and typing overlays: pure functions of the opening clock              */
/* -------------------------------------------------------------------------- */

/** Margin between the full-scene case card and the scene's edge, in px. */
const CASE_MARGIN_PX = 8;
const CASE_MIN_PX = 8;
const CASE_MAX_PX = 120;
/** The card's padding, in em of its own font. Matches CARD_CLASS. */
const CASE_PAD_EM = 0.9;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Font size in px of the text inside. */
  fs: number;
}

const sameRect = (a: Rect | null, b: Rect) =>
  a !== null &&
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5 &&
  Math.abs(a.fs - b.fs) < 0.05;

/** The case card's start and end of its settle, from where it sits in the dilemma layout. */
const dilemmaStartMs = at("dilemma", "question");
const caseTypingStartMs = at("hook", "patient");
/** Whether the full-scene card (typing, then shrinking) is on screen at `t`. */
const caseOverlayAt = (t: number) => t >= caseTypingStartMs && t < dilemmaStartMs + CASE_SHRINK_MS;

/** NeurIPS mark and paper title, filling the scene. Both open together and fade out together. */
function HeroOverlay({ t, lockup }: { t: number; lockup: HeroLockup }) {
  const gone = at("hook", "logoGone");
  if (t >= gone || lockup.sceneW <= 0) return null;
  const open = ease(ramp(t, at("hook", "logo"), at("hook", "logoHold")));
  const out = ease(ramp(t, at("hook", "logoRise"), gone));
  return (
    <div
      aria-hidden={open * (1 - out) < 0.5}
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
      style={{ opacity: open * (1 - out) }}
    >
      <img
        src={neuripsLogo}
        alt="NeurIPS"
        style={{
          width: lockup.logo,
          maxWidth: "100%",
          height: "auto",
          aspectRatio: "59.671822 / 26.738739",
          transform: `scale(${0.94 + 0.06 * open})`,
        }}
      />
      <h1
        className="text-center font-semibold tracking-tight"
        style={{
          marginTop: lockup.gap,
          fontSize: lockup.title,
          lineHeight: HERO_LINE_HEIGHT,
          color: NEUTRAL.ink,
        }}
      >
        {HERO_TITLE_LINES.map((line) => (
          <span key={line} className="block whitespace-nowrap">
            {line}
          </span>
        ))}
      </h1>
    </div>
  );
}

/**
 * The case, typed on a card that fills the scene. When the dilemma starts the
 * card shrinks onto `target`, the in-flow card's place, and hands over to it.
 * The full text is always laid out, with the untyped tail hidden, so nothing
 * reflows while it types.
 */
function CaseOverlay({ t, full, target }: { t: number; full: Rect | null; target: Rect | null }) {
  if (!caseOverlayAt(t) || full === null || target === null) return null;
  const text = openingCase.vignette;
  const typed = caseCharsAt(t);
  const p = easeOut(ramp(t, dilemmaStartMs, dilemmaStartMs + CASE_SHRINK_MS));
  const lerp = (a: number, b: number) => a + (b - a) * p;
  return (
    <div
      role="img"
      aria-label={text}
      className={`pointer-events-none absolute box-border flex items-center ${CARD_SURFACE}`}
      style={{
        left: lerp(full.left, target.left),
        top: lerp(full.top, target.top),
        width: lerp(full.width, target.width),
        height: lerp(full.height, target.height),
        fontSize: lerp(full.fs, target.fs),
        padding: `${CASE_PAD_EM}em`,
        borderColor: NEUTRAL.line,
        color: NEUTRAL.ink,
      }}
    >
      <p className="leading-[1.5]" style={{ textWrap: "pretty" }}>
        <span>{text.slice(0, typed)}</span>
        {typed < text.length && (
          <span aria-hidden className="relative inline-block w-0 align-baseline">
            <span
              className="absolute bg-current"
              style={{ left: "0.05em", width: "0.07em", height: "1.05em", top: "-0.85em" }}
            />
          </span>
        )}
        <span style={{ visibility: "hidden" }}>{text.slice(typed)}</span>
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Scene body: a pure function of the opening clock `t`                       */
/* -------------------------------------------------------------------------- */

const HEADLINE_STARTS = [
  at("hook", "headline"),
  at("dilemma", "question"),
  FRAMEWORK_AT, // the model chapter has no headline: the question leaves, then the response arrives
] as const;

const SceneBody = memo(function SceneBody({
  t,
  probe,
  focused,
  sharedIcon,
  hidePatient,
  recallPatient,
  caseOverlay,
  ghost = false,
}: {
  t: number;
  probe: boolean;
  focused: boolean;
  sharedIcon: boolean;
  hidePatient: boolean;
  recallPatient: boolean;
  /** The full-scene typing card (drawn by OpeningScene) is on screen: keep the in-flow card's place, unseen. */
  caseOverlay: boolean;
  /** An invisible copy that only holds the icon's anchor (see OpeningScene). Never the patient's shared card. */
  ghost?: boolean;
}) {
  /* Headline: the old one fades out as its chapter ends, the new one fades in just after. */
  let h = 0;
  HEADLINE_STARTS.forEach((s, i) => {
    if (t >= s) h = i;
  });
  const next = HEADLINE_STARTS[h + 1];
  const openingEnd = at("framework", "end");
  // The stack handoff brings the patient card back before the new framework beat ends.
  const recall = Math.max(at("framework", "all"), openingEnd - RECALL_LEAD_MS);
  const clearP = recallPatient ? ramp(t, recall, recall + FADE_MS) : 0;
  const cleared = recallPatient && t >= recall + FADE_MS;
  const headlineExit =
    next === undefined
      ? recallPatient
        ? 1 - ramp(t, openingEnd, openingEnd + FADE_MS)
        : 1
      : 1 - ramp(t, next - FADE_MS, next);

  const dilemmaStart = at("dilemma", "question");
  const ask = at("model", "ask");
  // The question fades in as the full-scene case card shrinks into its place.
  // It starts once the card has cleared its slot, and lands with it.
  const questionIn = ease(ramp(t, dilemmaStart + CASE_SHRINK_MS * 0.35, dilemmaStart + CASE_SHRINK_MS));
  // The question fades, then its slot closes, while the response grows in below the options.
  const handoff = modelHandoff(t - ask);
  const questionExit = handoff.questionCollapse;

  // The verbatim case stays up through the model chapter; the response sits below it.
  // With the stack handoff, it returns once the framework has cleared, in time for the last beat.
    const modelsAt = at("model", "models");
  const frameworkEnd = at("framework", "end");
  const sharedCard = !probe && !ghost;
  const showSummary = (t >= at("hook", "patient") && t < FRAMEWORK_AT) || (recallPatient && t >= recall + FADE_MS);
  const summaryOpacity =
    recallPatient && t >= recall
      ? ramp(t, recall + FADE_MS, recall + FADE_MS * 2)
      : visibility(t, at("hook", "patient"), at("hook", "patient") + FADE_MS);
  const responseEnter = handoff.responseEnter;
  // GPT's dot row takes over from the answer the moment it arrives, and stay through the framework chapter.
  const showResponse = t >= ask && responseEnter > 0 && t < modelsAt;
  const showBoard = t >= modelsAt && t < frameworkEnd;
  const collapse = ramp(t, at("model", "collapse"), at("model", "collapse") + COLLAPSE_MS);

  // The one-line case grows into the vignette as GPT's row leaves.
  const stripLinear = stripProgress(t);
  const stripP = ease(stripLinear);
  const stripping = t >= FRAMEWORK_AT && stripLinear < 1;
  const showVignette = t >= FRAMEWORK_AT && !stripping && !cleared;
  const vignetteOpacity = (1 - clearP);

  const showOptions = t >= at("dilemma", "options") && !cleared;
  const optionsEnter =
    ease(ramp(t, at("dilemma", "options"), at("dilemma", "options") + OPTIONS_IN_MS)) * (1 - clearP);
  const optionsMoving = showOptions && optionsEnter > 0 && optionsEnter < 1;
  const selectedIndex = t >= at("model", "extract") && t < at("model", "collapse") ? openingCase.response.chosen : null;
  const showChips = t >= FRAMEWORK_AT;
  // Space is held from the options on, so the icons arrive without moving anything.
  const votes = showOptions && t < at("model", "ask") ? t : null;
  const steps = valueSteps(t);
  // While a label is opening, its height already follows the clock. A layout
  // animation on top of that would trail the row and make the arrival feel late.
  const chipsMoving =
    showChips &&
    VALUE_ORDER.some((v) => {
      const a = steps.chip1[v];
      const b = steps.chip2[v];
      return (a > 0 && a < 1) || (b > 0 && b < 1);
    });

  const valuesAt = at("framework", VALUE_ORDER[0]);
  const showStrip = t >= valuesAt && !cleared;
  const handoffMoving = (questionExit > 0 && questionExit < 1) || (responseEnter > 0 && responseEnter < 1);
  const headingMoving = handoffMoving;
  const showQuestionHeading = h === 0 || (h === 1 && questionExit < 1);
  const sceneStill = !headingMoving && !optionsMoving && !stripping && !chipsMoving;

  return (
    <div
      data-scene-body
      className={`relative mx-auto flex w-full max-w-[46em] flex-col items-center ${
        probe ? "" : "h-full justify-center"
      }`}
      style={{ gap: STACK_GAP, ...ROW_VARS }}
    >
      {showQuestionHeading && (
        <HeadlineReplace
          mix={1}
          exit={h === 0 ? 0 : questionExit}
          drift={h === 0 ? 0 : handoff.questionFade}
          titleOpacity={0}
          questionOpacity={questionIn * (1 - handoff.questionFade)}
        />
      )}

      {h > 1 && (
        <Block probe={probe} className="w-full" layout={false}>
          <FadeSlot enter={stripP}>
            <h1
              className="mx-auto max-w-[30em] text-balance text-center font-semibold leading-[1.12] tracking-tight"
              style={{ fontSize: HEADLINES[h].size, color: NEUTRAL.ink, opacity: headlineExit }}
            >
              {HEADLINES[h].text}
            </h1>
          </FadeSlot>
        </Block>
      )}

      {showSummary && (
        <Block probe={probe} className="w-full" layout={sceneStill}>
          <div style={{ opacity: summaryOpacity }} aria-hidden={summaryOpacity === 0 || hidePatient || caseOverlay}>
            <div data-case-slot style={{ visibility: hidePatient || caseOverlay ? "hidden" : undefined }}>
              <PatientCard shared={sharedCard} />
            </div>
          </div>
        </Block>
      )}

      {stripping && (
        <Block probe={probe} className="w-full" layout={false}>
          <CaseHandoff t={t} settle={stripP} focused={focused} shared={sharedCard && !hidePatient} />
        </Block>
      )}

      {showVignette && (
        <Block probe={probe} className="w-full" layout={!chipsMoving}>
          <div style={{ opacity: vignetteOpacity }}>
            <Vignette t={t} focused={focused} />
          </div>
        </Block>
      )}

      {showStrip && (
        <Block probe={probe} className="w-full" layout={false}>
          <FadeSlot enter={ease(ramp(t, valuesAt, valuesAt + 420))}>
            <div style={{ opacity: 1 - clearP }}>
              <ValueStrip t={t} introAt={valuesAt - 1000} />
            </div>
          </FadeSlot>
        </Block>
      )}

      {showOptions && (
        <Block probe={probe} className="w-full" layout={sceneStill}>
          <FadeSlot enter={optionsEnter}>
            <ul
              className={`grid w-full grid-cols-1 gap-y-[0.7em] @md:grid-cols-2 @md:grid-rows-[auto_auto] @md:gap-x-[0.6em] @md:gap-y-[0.45em] ${
                // GPT's dot row sits under these two buttons.
                showBoard ? "@max-md:grid-cols-2 @max-md:gap-x-[0.6em] @max-md:gap-y-0" : ""
              }`}
            >
              <OptionCard index={0} t={t} selected={selectedIndex === 0} showChips={showChips} votes={votes} />
              <OptionCard index={1} t={t} selected={selectedIndex === 1} showChips={showChips} votes={votes} />
            </ul>
          </FadeSlot>
        </Block>
      )}

      {showResponse && (
        <Block
          probe={probe}
          className="w-full"
          layout={!headingMoving}
          style={responseEnter < 1 ? { marginTop: `calc(${STACK_GAP} * ${responseEnter - 1})` } : undefined}
        >
          <GrowIn enter={responseEnter}>
            <OpeningResponse
              text={openingCase.response.text}
              recommendationSpan={openingCase.response.recommendationSpan}
              wordsPerGroup={RESPONSE.wordsPerGroup}
              identifyLabel={RESPONSE.identifyLabel}
              panelLabel={RESPONSE.panelLabel}
              iconSrc={PROVIDER.logo}
              iconLabel={PROVIDER.name}
              elapsedMs={Math.max(0, t - OFFSETS.model)}
              timing={RESPONSE_TIMING}
              collapse={collapse}
              hideIcon={sharedIcon}
            />
          </GrowIn>
        </Block>
      )}

      {showBoard && <DecisionBoard t={t} sharedIcon={sharedIcon && !ghost} />}
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */

export default function OpeningScene({
  t,
  sharedIcon = false,
  hidePatient = false,
  recallPatient = false,
}: {
  t: number;
  /** The stage owns the OpenAI icon: leave anchor slots instead of drawing it. */
  sharedIcon?: boolean;
  /** The stage draws the patient card (as the stack's first card). */
  hidePatient?: boolean;
  /** Bring the patient card back before the opening ends so the stack can take it. */
  recallPatient?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fullProbesRef = useRef<HTMLDivElement>(null);
  const focusedProbesRef = useRef<HTMLDivElement>(null);
  const heroProbeRef = useRef<HTMLDivElement>(null);
  // Narrow-screen vignette layout; chosen by the fit below, not by a fixed breakpoint.
  const [focused, setFocused] = useState(false);
  const [lockup, setLockup] = useState<HeroLockup>(EMPTY_LOCKUP);
  // The full-scene card, and the in-flow card's place it shrinks into.
  const [fullRect, setFullRect] = useState<Rect | null>(null);
  const [target, setTarget] = useState<Rect | null>(null);
  const caseProbeRef = useRef<HTMLDivElement>(null);
  const overlayOn = caseOverlayAt(t);

  // Choose the largest font size at which the fullest state of every chapter
  // fits the box. If the full vignette would need type smaller than
  // MIN_READABLE_PX, use the focused vignette layout instead. Runs on resize
  // only; pure DOM measurement.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const full = fullProbesRef.current;
    const narrow = focusedProbesRef.current;
    const heroProbe = heroProbeRef.current;
    const caseProbe = caseProbeRef.current;
    if (!root || !full || !narrow || !heroProbe || !caseProbe) return;
    const lineProbe = heroProbe.querySelector<HTMLElement>("[data-hero-word]");
    if (!lineProbe) return;

    const apply = (px: number) => {
      root.style.setProperty("--fs", `${px}px`);
      root.style.setProperty("--z", String(px / 16));
    };
    const tallest = (set: HTMLElement) =>
      Math.max(...Array.from(set.children).map((el) => (el as HTMLElement).offsetHeight));
    /** Largest font at which `set` fits; leaves that size applied. */
    const fitSet = (set: HTMLElement): number => {
      const budget = root.clientHeight - 2;
      let lo = MIN_FONT_PX;
      let hi = MAX_FONT_PX;
      apply(hi);
      if (tallest(set) <= budget) return hi;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        apply(mid);
        if (tallest(set) <= budget) lo = mid;
        else hi = mid;
      }
      apply(lo);
      return lo;
    };
    const fit = () => {
      const fullPx = fitSet(full);
      if (fullPx >= MIN_READABLE_PX) {
        setFocused(false);
      } else {
        fitSet(narrow);
        setFocused(true);
      }
      root.dataset.fontPx = root.style.getPropertyValue("--fs");
      root.dataset.fullFitPx = String(fullPx);
      const fs = parseFloat(root.style.getPropertyValue("--fs")) || 16;
      const scene = root.querySelector<HTMLElement>(":scope > [data-scene-body]");
      const next = measureHero(scene?.clientWidth || root.clientWidth, root.clientHeight, fs, lineProbe);
      setLockup((prev) => (sameLockup(prev, next) ? prev : next));

      // Largest type at which the whole case fits the full-scene card.
      const width = Math.max(0, root.clientWidth - 2 * CASE_MARGIN_PX);
      const height = Math.max(0, root.clientHeight - 2 * CASE_MARGIN_PX);
      caseProbe.style.width = `${width}px`;
      const caseFits = (px: number) => {
        caseProbe.style.fontSize = `${px}px`;
        return caseProbe.offsetHeight <= height;
      };
      let lo = CASE_MIN_PX;
      let hi = CASE_MAX_PX;
      if (caseFits(hi)) lo = hi;
      else {
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2;
          if (caseFits(mid)) lo = mid;
          else hi = mid;
        }
      }
      const nextFull: Rect = { left: CASE_MARGIN_PX, top: CASE_MARGIN_PX, width, height, fs: Math.floor(lo * 10) / 10 };
      setFullRect((prev) => (sameRect(prev, nextFull) ? prev : nextFull));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, []);

  // Where the in-flow card sits. Measured only while the full-scene card needs it.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const slot = root?.querySelector<HTMLElement>("[data-case-slot]");
    if (!root || !slot || !overlayOn) return;
    const card = slot.firstElementChild ?? slot;
    const r = card.getBoundingClientRect();
    const o = root.getBoundingClientRect();
    const next: Rect = {
      left: r.left - o.left,
      top: r.top - o.top,
      width: r.width,
      height: r.height,
      fs: parseFloat(getComputedStyle(slot).fontSize) || 16,
    };
    setTarget((prev) => (sameRect(prev, next) ? prev : next));
  });

  const probeSet = (ref: typeof fullProbesRef, isFocused: boolean) => (
    <div ref={ref} data-probe aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 w-full">
      {PROBE_TIMES.map((pt) => (
        <div key={pt} className="absolute left-0 top-0 w-full">
          <SceneBody
            t={pt}
            probe
            focused={isFocused}
            sharedIcon={false}
            hidePatient={false}
            recallPatient={false}
            caseOverlay={false}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div
      ref={rootRef}
      data-opening-root
      data-layout={focused ? "focused" : "full"}
      className="@container relative h-full w-full"
      style={{ fontSize: "var(--fs)" }}
    >
      <CaseOverlay t={t} full={fullRect} target={target} />
      <SceneBody
        t={t}
        probe={false}
        focused={focused}
        sharedIcon={sharedIcon}
        hidePatient={hidePatient}
        recallPatient={recallPatient}
        caseOverlay={overlayOn}
      />
      <HeroOverlay t={t} lockup={lockup} />
      <div ref={heroProbeRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0">
        <span data-hero-word className="whitespace-nowrap font-semibold tracking-tight">
          {HERO_TITLE_LINES[1]}
        </span>
      </div>
      <div
        ref={caseProbeRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 box-border leading-[1.5]"
        style={{ padding: `${CASE_PAD_EM}em`, textWrap: "pretty" }}
      >
        {openingCase.vignette}
      </div>
      {probeSet(fullProbesRef, false)}
      {probeSet(focusedProbesRef, true)}
    </div>
  );
}
