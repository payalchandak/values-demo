import { memo, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import ProviderIcon from "../../components/ProviderIcon";
import type { ModelResponseTiming } from "../../components/ModelResponse";
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
import { MARK_INTERVAL_MS, OPENING_BEATS, OFFSETS, at, caseCharsAt, ramp, visibility } from "./timeline";

/* -------------------------------------------------------------------------- */
/*  Copy                                                                       */
/* -------------------------------------------------------------------------- */

const EYEBROW = "NeurIPS 2026";

/** Storyboard copy, verbatim. */
const HEADLINES = [
  { text: "Do Language Models Share Your Doctor's Priorities?", size: "2.6em" }, // ch1
  { text: "What would you recommend?", size: "1.7em" }, // ch2
  { text: "Let's ask a language model.", size: "1.7em" }, // ch3, with thinking
  { text: "Each choice prioritizes some values over others.", size: "1.7em" }, // ch4
  { text: "Clinical decisions require prioritizing competing values.", size: "1.7em" }, // ch5
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

/** After the trade-off statement starts, the shared icon needs its option slot for this long while it leaves. */
export const ICON_LEAVE_MS = MOVE_MS;

/** How long before the opening's last beat the patient card returns, when the stage asks for the stack handoff. */
const RECALL_LEAD_MS = 1800;

/** Option accent colors come from the recommendation palette, never the value colors. */
const OPTION_COLORS = [RECOMMENDATION_COLORS.option1, RECOMMENDATION_COLORS.option2] as const;

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
 * The hook title gives its space to the question inside the case. Both move
 * on this one clock, and the move finishes as the dilemma chapter starts.
 * Long enough that the reflow reads as a single motion.
 */
const HEADING_SWAP_MS = 560;

/** Gap between stacked blocks. The heading clip folds one of these into itself. */
const STACK_GAP = "0.9em";

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);

/**
 * Times inside each chapter at which that chapter's layout is at its fullest.
 * Hidden copies of the scene at these times are measured, so the font size is
 * chosen once per viewport and never changes during playback. Chapter 5 is
 * probed once per value (at its highlight and at its caption) because the focused layout enlarges a different
 * sentence for each. The hook is probed before the heading swap, while the
 * title still occupies its full space.
 */
const PROBE_TIMES: readonly number[] = [
  at("hook", "end") - HEADING_SWAP_MS - 1,
  at("dilemma", "end") - 1,
  at("model", "extracted"),
  at("tradeoff", "end") - 1,
  ...VALUE_ORDER.map((v) => at("framework", `${v}Highlight`) + 400),
  ...VALUE_ORDER.map((v) => at("framework", `${v}Caption`) + 400),
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
  children,
}: {
  probe: boolean;
  className?: string;
  /** Off while a clock-driven height change is already moving this block. */
  layout?: boolean;
  children: ReactNode;
}) {
  if (probe) return <div className={className}>{children}</div>;
  return (
    <motion.div
      layout={layout ? "position" : false}
      transition={{ duration: FADE_MS / 1000, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Height follows `progress` (0 collapsed, 1 the content's own height) on the
 * opening clock, so a seek lands on the same frame playback would. The settled
 * state uses auto height and is what the fit probes measure.
 */
function Clip({
  progress,
  opacity = 1,
  trailGap = false,
  children,
}: {
  progress: number;
  opacity?: number;
  /** Shrink the parent stack gap away with the content, instead of leaving it behind. */
  trailGap?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setFull(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0) return null;
  const open = p >= 1;
  return (
    <div
      className="w-full"
      style={{
        height: open ? "auto" : full === 0 ? 0 : full * p,
        overflow: open ? "visible" : "hidden",
        marginBottom: trailGap ? `calc(${STACK_GAP} * -1)` : undefined,
      }}
    >
      <div ref={ref} style={{ display: "flow-root", opacity }}>
        {children}
        {trailGap && <div aria-hidden style={{ height: STACK_GAP }} />}
      </div>
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

/** Height of the row under each choice: holds the repeat-query marks, then the tag chips. */
const ROW_H = "1.9em";

function Marks({ index, t }: { index: 0 | 1; t: number }) {
  const total = openingCase.decisions.length;
  const start = at("model", "marks");
  const mine = openingCase.decisions
    .map((choice, i) => ({ choice, i }))
    .filter((d) => d.choice === index);
  const fadeOut = ramp(t, at("tradeoff", "statement") - FADE_MS, at("tradeoff", "statement"));
  return (
    <div
      role="img"
      aria-label={`${mine.length} of ${total} repeated queries chose: ${openingCase.choices[index]}`}
      className="mt-[0.5em] flex items-center gap-[0.3em]"
      style={{ height: ROW_H, opacity: 1 - fadeOut }}
    >
      {mine.map(({ i }) => {
        const p = ramp(t, start + i * MARK_INTERVAL_MS, start + i * MARK_INTERVAL_MS + FADE_MS);
        return (
          <span
            key={i}
            className="block aspect-square min-w-0 shrink rounded-full"
            style={{
              flex: "0 1 0.85em",
              backgroundColor: OPTION_COLORS[index],
              opacity: p,
              transform: `scale(${0.5 + 0.5 * p})`,
            }}
          />
        );
      })}
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
 * The four labels of a choice in a column, A B N J order, each in its own
 * slot so nothing shifts as they land. Choice 1's label lands first, then Choice 2's.
 */
function Chips({ index, t }: { index: 0 | 1; t: number }) {
  const steps = valueSteps(t);
  const tags = openingCase.tags[index];
  const weight = index === 0 ? steps.chip1 : steps.chip2;
  return (
    <div className="mt-[0.5em] flex flex-col items-start gap-[0.2em]">
      {VALUE_ORDER.map((v) => (
        <div
          key={v}
          className="flex min-h-[1.6em] max-w-full items-center"
          style={{ opacity: weight[v], transform: `scale(${0.85 + 0.15 * weight[v]})`, transformOrigin: "left center" }}
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
  showMarks,
  showChips,
  sharedIcon,
}: {
  index: 0 | 1;
  t: number;
  selected: boolean;
  showMarks: boolean;
  showChips: boolean;
  sharedIcon: boolean;
}) {
  // Chapters 4 and 5: neutral cards, no accent bar.
  const neutral = t >= at("tradeoff", "statement");
  const color = neutral ? NEUTRAL.line : OPTION_COLORS[index];
  const iconHere =
    sharedIcon &&
    index === openingCase.response.chosen &&
    t >= at("model", "extract") &&
    t < at("tradeoff", "statement") + ICON_LEAVE_MS;
  const badge = visibility(
    t,
    at("model", "extract"),
    at("model", "extract") + FADE_MS,
    at("tradeoff", "statement") - FADE_MS,
    at("tradeoff", "statement"),
  );
  const showIcon = sharedIcon ? iconHere : selected;
  return (
    <li
      aria-current={selected ? "true" : undefined}
      className="rounded-[0.9em] border p-[0.8em] transition-colors duration-75 ease-out"
      style={{
        borderLeftWidth: neutral ? 1 : "0.3em",
        paddingLeft: neutral ? "calc(0.8em + 0.3em - 1px)" : undefined,
        borderTopColor: selected ? color : NEUTRAL.line,
        borderRightColor: selected ? color : NEUTRAL.line,
        borderBottomColor: selected ? color : NEUTRAL.line,
        borderLeftColor: color,
        backgroundColor: selected ? "#F4F4F5" : "#FAFAFA",
        boxShadow: selected ? `0 0 0 1px ${color}` : "none",
        color: NEUTRAL.ink,
      }}
    >
      <div className="flex items-start justify-between gap-[0.6em]">
        <p className="font-semibold leading-snug" style={{ fontSize: "1.05em" }}>
          {openingCase.choices[index]}
        </p>
        {showIcon &&
          (sharedIcon ? (
            <span
              data-anchor="icon-option"
              className="inline-flex shrink-0"
              style={{ width: 32, height: 32, zoom: "var(--z)", visibility: "hidden" }}
            />
          ) : (
            <span className="inline-flex shrink-0" style={{ opacity: badge, zoom: "var(--z)" }}>
              <ProviderIcon src={PROVIDER.logo} alt={PROVIDER.name} size={32} />
            </span>
          ))}
      </div>
      {showChips ? <Chips index={index} t={t} /> : showMarks ? <Marks index={index} t={t} /> : null}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Scene body: a pure function of the opening clock `t`                       */
/* -------------------------------------------------------------------------- */

const HEADLINE_STARTS = [
  at("hook", "headline"),
  at("dilemma", "question"),
  at("model", "think"), // arrives with the thinking panel, after the recommendation question has left
  at("tradeoff", "statement"),
  at("framework", "framework"),
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

  const statement = at("tradeoff", "statement");
  const dilemmaStart = at("dilemma", "question");
  const thinkAt = at("model", "think");
  const ask = at("model", "ask");
  // The hook title and the in-case question trade space. Done by the dilemma chapter.
  const swap = ease(ramp(t, dilemmaStart - HEADING_SWAP_MS, dilemmaStart));
  const titleOpacity = ramp(t, HEADLINE_STARTS[0], HEADLINE_STARTS[0] + FADE_MS) * (1 - swap);
  const labelOpacity = ramp(t, at("hook", "label"), at("hook", "label") + FADE_MS) * (1 - swap);
  // The question leaves at the model chapter, before the language-model header.
  const questionOpacity = swap * (1 - ramp(t, ask, ask + FADE_MS));

  // The verbatim case stays up through the model chapter; the response sits below it.
  // With the stack handoff, it returns once the framework has cleared, in time for the last beat.
  const showSummary = (t >= at("hook", "patient") && t < statement) || (recallPatient && t >= recall + FADE_MS);
  const summaryOpacity =
    recallPatient && t >= recall
      ? ramp(t, recall + FADE_MS, recall + FADE_MS * 2)
      : visibility(t, at("hook", "patient"), at("hook", "patient") + FADE_MS, statement - FADE_MS, statement);
  const showResponse = t >= thinkAt && t < statement;
  const responseOpacity = visibility(
    t,
    beat("think") + OFFSETS.model,
    beat("think") + OFFSETS.model + FADE_MS,
    statement - FADE_MS,
    statement,
  );

  // From chapter 4 on, the same vignette is shown with value marks, until the handoff clears it.
  const showVignette = t >= statement && !cleared;
  const vignetteOpacity =
    ramp(t, at("tradeoff", "vignette"), at("tradeoff", "vignette") + FADE_MS) * (1 - clearP);

  const showOptions = t >= at("dilemma", "options") && !cleared;
  const optionsOpacity = ramp(t, at("dilemma", "options"), at("dilemma", "options") + FADE_MS) * (1 - clearP);
  const selectedIndex = t >= at("model", "extract") && t < statement ? openingCase.response.chosen : null;
  const showMarks = t < statement; // chapter 4 shows the choices plain; chapter 5 adds the labels
  const showChips = t >= at("framework", "framework");

  const showStrip = t >= at("framework", "framework") && !cleared;
  const headingSettled = swap <= 0 || swap >= 1;

  return (
    <div
      className={`mx-auto flex w-full max-w-[46em] flex-col items-center ${
        probe ? "" : "h-full justify-center"
      }`}
      style={{ gap: STACK_GAP }}
    >
      {h === 0 && (
        <Clip progress={1 - swap} trailGap>
          <div className="flex w-full flex-col items-center" style={{ gap: STACK_GAP }} aria-hidden={swap > 0.5}>
            <p
              className="font-mono font-medium tracking-[0.28em]"
              style={{ fontSize: "0.8em", color: NEUTRAL.inkMuted, opacity: labelOpacity }}
            >
              {EYEBROW}
            </p>
            <h1
              className="mx-auto w-full max-w-[30em] text-balance text-center font-semibold leading-[1.12] tracking-tight"
              style={{ fontSize: HEADLINES[0].size, color: NEUTRAL.ink, opacity: titleOpacity }}
            >
              {HEADLINES[0].text}
            </h1>
          </div>
        </Clip>
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
        <Block probe={probe} className="w-full" layout={headingSettled}>
          <div style={{ opacity: summaryOpacity }} aria-hidden={summaryOpacity === 0 || hidePatient}>
            <div style={{ visibility: hidePatient ? "hidden" : undefined }}>
              <PatientCard
                shared={!probe}
                typedChars={caseCharsAt(t)}
                question={
                  questionOpacity > 0 ? (
                    <Clip progress={swap} opacity={questionOpacity}>
                      <h1
                        className="font-semibold leading-[1.15] tracking-tight"
                        style={{
                          fontSize: HEADLINES[1].size,
                          marginTop: "0.75em",
                          paddingTop: "0.65em",
                          borderTop: `1px solid ${NEUTRAL.line}`,
                        }}
                      >
                        {HEADLINES[1].text}
                      </h1>
                    </Clip>
                  ) : undefined
                }
              />
            </div>
          </div>
        </Block>
      )}

      {showResponse && (
        <Block probe={probe} className="w-full">
          <div style={{ opacity: responseOpacity }}>
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
              hideIcon={sharedIcon}
            />
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
        <Block probe={probe} className="w-full">
          <ul
            className="grid w-full grid-cols-1 items-stretch gap-[0.6em] @md:grid-cols-2"
            style={{ opacity: optionsOpacity }}
          >
            <OptionCard index={0} t={t} selected={selectedIndex === 0} showMarks={showMarks} showChips={showChips} sharedIcon={sharedIcon} />
            <OptionCard index={1} t={t} selected={selectedIndex === 1} showMarks={showMarks} showChips={showChips} sharedIcon={sharedIcon} />
          </ul>
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
