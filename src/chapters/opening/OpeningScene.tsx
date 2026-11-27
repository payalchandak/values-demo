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
import type { Tag, Value } from "../../study/types";
import { openingCase } from "./openingCase";
import OpeningResponse from "./OpeningResponse";
import ValueStrip from "./ValueStrip";
import Vignette from "./Vignette";
import { CHARCOAL, CHARCOAL_FAINT } from "./charcoal";
import { valueSteps } from "./valueSteps";
import { COLLAPSE_MS, OPENING_BEATS, OFFSETS, at, caseCharsAt, modelHandoff, ramp, visibility } from "./timeline";

/* -------------------------------------------------------------------------- */
/*  Copy                                                                       */
/* -------------------------------------------------------------------------- */

/** Storyboard copy, verbatim. */
const HEADLINES = [
  { text: "Do Language Models Share Your Doctor's Priorities?", size: "2.6em" }, // ch1
  { text: "What would you recommend?", size: "1.7em" }, // ch2, then it leaves and the model answers
  { text: "Clinical decisions require prioritizing competing values.", size: "1.7em" }, // ch4
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
 * The framework chapter's first beat. The model answer leaves here and the
 * plain vignette arrives with the new headline; the value walk follows.
 */
const FRAMEWORK_AT = at("framework", "framework");

/** After that beat, the shared icon needs its option slot for this long while it leaves. */
export const ICON_LEAVE_MS = MOVE_MS;

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
 * Below this size the full vignette is not comfortable to read, so the scene
 * switches to the focused vignette layout (see Vignette.tsx).
 */
const MIN_READABLE_PX = 12;

/**
 * The paper title leaves, the heading eases down to one line, then
 * "What would you recommend?" fades in whole. Readable type is never clipped.
 * The move finishes as the dilemma chapter starts.
 */
const HEADING_SWAP_MS = 980;
/** The two choices fade in and the case eases up to make room. */
const OPTIONS_IN_MS = 680;

/** Gap between stacked blocks. The heading clip folds one of these into itself. */
const STACK_GAP = "0.9em";

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);

/**
 * Times inside each chapter at which that chapter's layout is at its fullest.
 * Hidden copies of the scene at these times are measured, so the font size is
 * chosen once per viewport and never changes during playback. The framework
 * chapter is probed once per value (at its highlight and once both labels have landed)
 * because the focused layout enlarges a different sentence for each. The hook
 * is probed before the heading swap, while the title still occupies its full space.
 */
const PROBE_TIMES: readonly number[] = [
  at("hook", "end") - HEADING_SWAP_MS - 1,
  at("dilemma", "end") - 1,
  at("model", "extracted"),
  ...VALUE_ORDER.map((v) => at("framework", `${v}Highlight`) + 400),
  ...VALUE_ORDER.map((v) => at("framework", `${v}Chip2`) + FADE_MS),
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
        overflow: settled ? "visible" : "hidden",
      }}
    >
      <div ref={ref} style={{ opacity: p }}>
        {children}
      </div>
    </div>
  );
}

const HEADING_CLASS =
  "mx-auto w-full max-w-[30em] text-balance text-center font-semibold leading-[1.12] tracking-tight";

/** NeurIPS mark above the title. Its slot closes as it fades, so the title eases up. */
function OpeningMark({
  opacity,
  lift,
  drift,
  open,
}: {
  opacity: number;
  lift: number;
  drift: number;
  open: number;
}) {
  const [ref, measured] = useBoxHeight();
  const p = Math.min(1, Math.max(0, lift));
  return (
    <div
      className="w-full overflow-hidden"
      style={{
        height: p <= 0 || measured === 0 ? "auto" : measured * (1 - p),
        marginBottom: `calc(${STACK_GAP} * -1)`,
      }}
    >
      <div ref={ref} className="flex flex-col items-center">
        <img
          src={neuripsLogo}
          alt="NeurIPS"
          className="w-[min(16em,68%)]"
          style={{
            opacity,
            transform: `translateY(${drift * -0.45}em) scale(${0.94 + 0.06 * open})`,
          }}
        />
        <div aria-hidden style={{ height: STACK_GAP }} />
      </div>
    </div>
  );
}

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
}: {
  /** 0 = the paper title's box, 1 = the question's box. */
  mix: number;
  /** 1 collapses the question after it has replaced the title. */
  exit?: number;
  /** 0..1. The question drifts up while it fades, ahead of the slot closing. */
  drift?: number;
  titleOpacity: number;
  questionOpacity: number;
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
          overflow: settledTitle || settledQuestion ? "visible" : "hidden",
        }}
      >
        <h1
          ref={titleRef}
          className={HEADING_CLASS}
          style={{
            gridArea: "1 / 1",
            fontSize: HEADLINES[0].size,
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
          {HEADLINES[0].text}
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

const CARD_CLASS =
  "w-full rounded-[0.9em] border bg-white p-[0.9em] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_28px_-14px_rgba(16,24,40,0.12)]";

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
 * One value's tag on one choice: the full value name, then the tag. Three
 * redundant cues carry the tag, in charcoal only:
 *   promotes: solid chip + up arrow + "+1"
 *   violates: outlined chip + down arrow + "-1"
 *   neutral:  faint chip + dash + "0"
 */
function TagChip({ v, tag }: { v: Value; tag: Tag }) {
  const meta = TAGS[tag];
  const style =
    meta.chip === "solid"
      ? { borderColor: CHARCOAL, backgroundColor: CHARCOAL, color: "#fff" }
      : meta.chip === "outlined"
        ? { borderColor: CHARCOAL, backgroundColor: NEUTRAL.surface, color: CHARCOAL }
        : { borderColor: CHARCOAL_FAINT, backgroundColor: NEUTRAL.surface, color: NEUTRAL.inkFaint };
  return (
    <span
      aria-label={`${VALUES[v].name}: ${meta.word} (${meta.code})`}
      className="inline-flex max-w-full flex-wrap items-center gap-x-[0.35em] rounded-[1em] border px-[0.65em] py-[0.12em] font-semibold"
      style={{ ...style, fontSize: "0.9em", borderWidth: meta.chip === "outlined" ? 1.5 : 1 }}
    >
      <span aria-hidden="true">{VALUES[v].name}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-[0.25em]">
        <TagGlyph glyph={meta.glyph} size={11} />
        <span>{meta.code}</span>
      </span>
    </span>
  );
}

/**
 * The labels of a choice in a column, A B N J order. A row mounts when its
 * label starts to land, so the card stays compact until then, and a label
 * already on screen stays put when the next one arrives. Choice 1's label
 * lands first, then Choice 2's.
 */
function Chips({ index, t }: { index: 0 | 1; t: number }) {
  const steps = valueSteps(t);
  const tags = openingCase.tags[index];
  const weight = index === 0 ? steps.chip1 : steps.chip2;
  const shown = VALUE_ORDER.filter((v) => weight[v] > 0);
  if (shown.length === 0) return null;
  return (
    <div className="mt-[0.5em] flex w-full flex-col items-center gap-[0.2em]">
      {shown.map((v) => (
        <div
          key={v}
          className="flex min-h-[1.6em] max-w-full items-center"
          style={{ opacity: weight[v], transform: `scale(${0.85 + 0.15 * weight[v]})`, transformOrigin: "center" }}
        >
          <TagChip v={v} tag={tags[v]} />
        </div>
      ))}
    </div>
  );
}

function OptionCard({
  index,
  t,
  selected,
  showChips,
}: {
  index: 0 | 1;
  t: number;
  selected: boolean;
  showChips: boolean;
}) {
  const frame = selected ? OPTION_ACCENT : `color-mix(in srgb, ${NEUTRAL.ink} 28%, white)`;
  return (
    <li
      aria-current={selected ? "true" : undefined}
      className="flex flex-col items-center justify-center rounded-[0.7em] border bg-white px-[0.85em] py-[0.4em] text-center transition-colors duration-75 ease-out"
      style={{
        borderColor: frame,
        backgroundColor: selected ? "#F4F4F5" : "#FFFFFF",
        boxShadow: selected ? `0 0 0 1px ${OPTION_ACCENT}` : "0 1px 2px rgba(16,24,40,0.06)",
        color: NEUTRAL.ink,
      }}
    >
      <div className="relative flex w-full items-center justify-center">
        <p
          className="font-semibold leading-snug"
          style={{ fontSize: "1.05em" }}
        >
          {openingCase.choices[index]}
        </p>
      </div>
      {showChips ? <Chips index={index} t={t} /> : null}
    </li>
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
}: {
  t: number;
  probe: boolean;
  focused: boolean;
  sharedIcon: boolean;
  hidePatient: boolean;
  recallPatient: boolean;
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
  const headlineOpacity =
    (h === 0
      ? ramp(t, HEADLINE_STARTS[0], HEADLINE_STARTS[0] + FADE_MS)
      : ramp(t, HEADLINE_STARTS[h], HEADLINE_STARTS[h] + FADE_MS)) *
    (next === undefined
      ? recallPatient
        ? 1 - ramp(t, openingEnd, openingEnd + FADE_MS)
        : 1
      : 1 - ramp(t, next - FADE_MS, next));

  const dilemmaStart = at("dilemma", "question");
  const ask = at("model", "ask");
  // Title fades clear, then the slot eases down, then the question fades in whole.
  const swap = ramp(t, dilemmaStart - HEADING_SWAP_MS, dilemmaStart);
  const titleLeave = ease(Math.min(1, swap / 0.32));
  const space = ease(Math.min(1, Math.max(0, (swap - 0.24) / 0.44)));
  const questionIn = ease(Math.min(1, Math.max(0, (swap - 0.66) / 0.34)));
  // Logo and title open on the same curve. The logo then fades as the case starts.
  const logoOpen = ease(ramp(t, at("hook", "logo"), at("hook", "logoHold")));
  const riseT = ramp(t, at("hook", "logoRise"), at("hook", "logoGone"));
  // Fade in place first, then close the slot once the mark is gone.
  const logoFade = ease(Math.min(1, riseT / 0.62));
  const logoLift = ease(Math.min(1, Math.max(0, (riseT - 0.5) / 0.5)));
  const logoOpacity = logoOpen * (1 - logoFade);
  // The question fades, then its slot closes, while the response grows in below the options.
  const handoff = modelHandoff(t - ask);
  const questionExit = handoff.questionCollapse;

  // The verbatim case stays up through the model chapter; the response sits below it.
  // With the stack handoff, it returns once the framework has cleared, in time for the last beat.
  const showSummary = (t >= at("hook", "patient") && t < FRAMEWORK_AT) || (recallPatient && t >= recall + FADE_MS);
  const summaryOpacity =
    recallPatient && t >= recall
      ? ramp(t, recall + FADE_MS, recall + FADE_MS * 2)
      : visibility(t, at("hook", "patient"), at("hook", "patient") + FADE_MS, FRAMEWORK_AT - FADE_MS, FRAMEWORK_AT);
  // The mark stays after the framework starts, only until the stage icon has left for its dock.
  const responseEnter = handoff.responseEnter;
  const showResponse = t >= ask && responseEnter > 0 && t < FRAMEWORK_AT + ICON_LEAVE_MS;
  const collapse = ramp(t, at("model", "collapse"), at("model", "collapse") + COLLAPSE_MS);
  const responseFadeOut = 1 - ramp(t, FRAMEWORK_AT - FADE_MS, FRAMEWORK_AT);

  // The annotatable vignette replaces the case card as the framework chapter starts.
  const showVignette = t >= FRAMEWORK_AT && !cleared;
  const vignetteOpacity = ramp(t, FRAMEWORK_AT, FRAMEWORK_AT + FADE_MS) * (1 - clearP);

  const showOptions = t >= at("dilemma", "options") && !cleared;
  const optionsEnter =
    ease(ramp(t, at("dilemma", "options"), at("dilemma", "options") + OPTIONS_IN_MS)) * (1 - clearP);
  const optionsMoving = showOptions && optionsEnter > 0 && optionsEnter < 1;
  const selectedIndex = t >= at("model", "extract") && t < at("model", "collapse") ? openingCase.response.chosen : null;
  const showChips = t >= FRAMEWORK_AT;

  const showStrip = t >= at("framework", "framework") && !cleared;
  const handoffMoving = (questionExit > 0 && questionExit < 1) || (responseEnter > 0 && responseEnter < 1);
  const headingMoving = (space > 0 && space < 1) || handoffMoving;
  const showQuestionHeading = h === 0 || (h === 1 && questionExit < 1);

  return (
    <div
      className={`relative mx-auto flex w-full max-w-[46em] flex-col items-center ${
        probe ? "" : "h-full justify-center"
      }`}
      style={{ gap: STACK_GAP }}
    >
      {riseT < 1 && (
        <OpeningMark opacity={logoOpacity} lift={logoLift} drift={logoFade} open={logoOpen} />
      )}

      {showQuestionHeading && (
        <HeadlineReplace
          mix={h === 0 ? space : 1}
          exit={h === 0 ? 0 : questionExit}
          drift={h === 0 ? 0 : handoff.questionFade}
          titleOpacity={h === 0 ? logoOpen * (1 - titleLeave) : 0}
          questionOpacity={h === 0 ? questionIn : 1 - handoff.questionFade}
        />
      )}

      {h > 1 && (
        <Block probe={probe} className="w-full">
          <h1
            className="mx-auto max-w-[30em] text-balance text-center font-semibold leading-[1.12] tracking-tight"
            style={{ fontSize: HEADLINES[h].size, color: NEUTRAL.ink, opacity: headlineOpacity }}
          >
            {HEADLINES[h].text}
          </h1>
        </Block>
      )}

      {showSummary && (
        <Block probe={probe} className="w-full" layout={!headingMoving && !optionsMoving}>
          <div style={{ opacity: summaryOpacity }} aria-hidden={summaryOpacity === 0 || hidePatient}>
            <div style={{ visibility: hidePatient ? "hidden" : undefined }}>
              <PatientCard shared={!probe} typedChars={caseCharsAt(t)} />
            </div>
          </div>
        </Block>
      )}

      {showVignette && (
        <Block probe={probe} className="w-full">
          <div style={{ opacity: vignetteOpacity }}>
            <Vignette t={t} focused={focused} />
          </div>
        </Block>
      )}

      {showStrip && (
        <Block probe={probe} className="w-full">
          <div style={{ opacity: 1 - clearP }}>
            <ValueStrip t={t} introAt={at("framework", "framework")} />
          </div>
        </Block>
      )}

      {showOptions && (
        <Block probe={probe} className="w-full" layout={!headingMoving && !optionsMoving}>
          <FadeSlot enter={optionsEnter}>
            <ul className="grid w-full grid-cols-1 items-stretch gap-[0.6em] @md:grid-cols-2">
              <OptionCard index={0} t={t} selected={selectedIndex === 0} showChips={showChips} />
              <OptionCard index={1} t={t} selected={selectedIndex === 1} showChips={showChips} />
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
            <div style={{ opacity: responseFadeOut }}>
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
            </div>
          </GrowIn>
        </Block>
      )}
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
  // Narrow-screen vignette layout; chosen by the fit below, not by a fixed breakpoint.
  const [focused, setFocused] = useState(false);

  // Choose the largest font size at which the fullest state of every chapter
  // fits the box. If the full vignette would need type smaller than
  // MIN_READABLE_PX, use the focused vignette layout instead. Runs on resize
  // only; pure DOM measurement.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const full = fullProbesRef.current;
    const narrow = focusedProbesRef.current;
    if (!root || !full || !narrow) return;

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
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, []);

  const probeSet = (ref: typeof fullProbesRef, isFocused: boolean) => (
    <div ref={ref} data-probe aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 w-full">
      {PROBE_TIMES.map((pt) => (
        <div key={pt} className="absolute left-0 top-0 w-full">
          <SceneBody t={pt} probe focused={isFocused} sharedIcon={false} hidePatient={false} recallPatient={false} />
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
      <SceneBody
        t={t}
        probe={false}
        focused={focused}
        sharedIcon={sharedIcon}
        hidePatient={hidePatient}
        recallPatient={recallPatient}
      />
      {probeSet(fullProbesRef, false)}
      {probeSet(focusedProbesRef, true)}
    </div>
  );
}
