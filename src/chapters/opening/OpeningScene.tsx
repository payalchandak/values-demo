import { memo, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import ProviderIcon from "../../components/ProviderIcon";
import type { ModelResponseTiming } from "../../components/ModelResponse";
import openaiLogo from "../../assets/providers/openai.svg";
import {
  NEUTRAL,
  RECOMMENDATION_COLORS,
  TAGS,
  TagGlyph,
  VALUES,
  VALUE_ORDER,
  valueInk,
  valueTint,
} from "../../design";
import type { Tag, Value } from "../../study/types";
import { CHOICE_LABELS, openingCase } from "./openingCase";
import OpeningResponse from "./OpeningResponse";
import ValueStrip from "./ValueStrip";
import Vignette from "./Vignette";
import { valueSteps } from "./valueSteps";
import { MARK_INTERVAL_MS, OPENING_BEATS, OFFSETS, at, ramp, visibility } from "./timeline";

/* -------------------------------------------------------------------------- */
/*  Copy                                                                       */
/* -------------------------------------------------------------------------- */

const EYEBROW = "NeurIPS 2026";

/** Storyboard copy, verbatim. */
const HEADLINES = [
  { text: "Do Language Models Share Your Doctor's Priorities?", size: "2.6em" }, // ch1
  { text: "What would you recommend?", size: "1.7em" }, // ch2
  { text: "Ask again.", size: "1.7em" }, // ch3
  { text: "Each choice prioritizes some values over others.", size: "1.7em" }, // ch4
  { text: "Clinical decisions require prioritizing competing values.", size: "1.7em" }, // ch5
] as const;

/** Display name only. Never a model version. */
const PROVIDER = { name: "OpenAI", logo: openaiLogo } as const;

const RESPONSE = {
  panelLabel: `${PROVIDER.name} response`,
  wordsPerGroup: 4,
  groupFadeMs: 350,
  identifyLabel: "Identify the recommendation",
} as const;

const MODEL_BEATS = OPENING_BEATS.model;
const beat = (name: string) => MODEL_BEATS.find((b) => b.name === name)!.startMs;
const RESPONSE_TIMING: ModelResponseTiming = {
  revealStartMs: beat("reveal"),
  revealEndMs: beat("revealed"),
  groupFadeMs: RESPONSE.groupFadeMs,
  highlightStartMs: beat("highlight"),
  highlightEndMs: beat("extract"),
  outlineStartMs: beat("extract"),
  outlineEndMs: beat("extracted"),
};

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
 * Times inside each chapter at which that chapter's layout is at its fullest.
 * Hidden copies of the scene at these times are measured, so the font size is
 * chosen once per viewport and never changes during playback. Chapter 5 is
 * probed once per value because the focused layout enlarges a different
 * sentence for each.
 */
const PROBE_TIMES: readonly number[] = [
  at("hook", "end") - 1,
  at("dilemma", "end") - 1,
  at("model", "extracted"),
  at("tradeoff", "end") - 1,
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
  children,
}: {
  probe: boolean;
  className?: string;
  children: ReactNode;
}) {
  return probe ? (
    <div className={className}>{children}</div>
  ) : (
    <motion.div layout="position" transition={{ duration: 0.35, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

function PatientCard() {
  const { heading, paragraphs } = openingCase.patient;
  return (
    <div
      className="w-full rounded-[0.9em] border bg-white p-[1em] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_28px_-14px_rgba(16,24,40,0.12)]"
      style={{ borderColor: NEUTRAL.line, color: NEUTRAL.ink }}
    >
      <p className="font-semibold leading-snug" style={{ fontSize: "1.1em" }}>
        {heading}
      </p>
      <div className="mt-[0.45em] space-y-[0.5em] leading-snug" style={{ color: NEUTRAL.inkMuted }}>
        {paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
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
  const fadeOut = ramp(t, at("tradeoff", "statement") - 300, at("tradeoff", "statement"));
  return (
    <div
      role="img"
      aria-label={`${mine.length} of ${total} repeated queries chose ${CHOICE_LABELS[index]}`}
      className="mt-[0.5em] flex items-center gap-[0.3em]"
      style={{ height: ROW_H, opacity: 1 - fadeOut }}
    >
      {mine.map(({ i }) => {
        const p = ramp(t, start + i * MARK_INTERVAL_MS, start + i * MARK_INTERVAL_MS + 220);
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
 * One value's tag on one choice. Three redundant cues:
 *   promotes: solid chip + up arrow + "+1"
 *   violates: outlined chip + down arrow + "-1"
 *   neutral:  faint chip + dash + "0"
 */
function TagChip({ v, tag }: { v: Value; tag: Tag }) {
  const meta = TAGS[tag];
  const color = VALUES[v].color;
  const style =
    meta.chip === "solid"
      ? { borderColor: color, backgroundColor: color, color: "#fff" }
      : meta.chip === "outlined"
        ? { borderColor: color, backgroundColor: NEUTRAL.surface, color: valueInk(v) }
        : { borderColor: valueTint(v, 40), backgroundColor: NEUTRAL.surface, color: NEUTRAL.inkFaint };
  return (
    <span
      aria-label={`${VALUES[v].name}: ${meta.word} (${meta.code})`}
      className="inline-flex items-center gap-[0.25em] rounded-full border px-[0.55em] py-[0.12em] font-semibold"
      style={{ ...style, fontSize: "0.9em", borderWidth: meta.chip === "outlined" ? 1.5 : 1 }}
    >
      <span aria-hidden="true">{v}</span>
      <TagGlyph glyph={meta.glyph} size={11} />
      <span>{meta.code}</span>
    </span>
  );
}

/** The four chips of a choice, in A B N J order, each in its own slot so nothing shifts as they land. */
function Chips({ index, t }: { index: 0 | 1; t: number }) {
  const steps = valueSteps(t);
  const tags = openingCase.tags[index];
  return (
    <div className="mt-[0.5em] grid grid-cols-4 items-center gap-[0.3em]" style={{ height: ROW_H }}>
      {VALUE_ORDER.map((v) => (
        <div
          key={v}
          className="flex min-w-0 justify-start"
          style={{ opacity: steps.chip[v], transform: `scale(${0.85 + 0.15 * steps.chip[v]})`, transformOrigin: "left center" }}
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
  const color = OPTION_COLORS[index];
  const badge = visibility(
    t,
    at("model", "extract"),
    at("model", "extract") + 300,
    at("tradeoff", "statement") - 300,
    at("tradeoff", "statement"),
  );
  return (
    <li
      aria-current={selected ? "true" : undefined}
      className="rounded-[0.9em] border border-l-[0.3em] p-[0.8em] transition-colors duration-150 ease-out"
      style={{
        borderTopColor: selected ? color : NEUTRAL.line,
        borderRightColor: selected ? color : NEUTRAL.line,
        borderBottomColor: selected ? color : NEUTRAL.line,
        borderLeftColor: color,
        backgroundColor: selected ? "#F4F4F5" : "#FAFAFA",
        boxShadow: selected ? `0 0 0 1px ${color}` : "none",
        color: NEUTRAL.ink,
      }}
    >
      {/* Fixed-height label row: the icon arriving never resizes the card. */}
      <div className="flex items-center justify-between gap-[0.5em]" style={{ minHeight: "2em" }}>
        <p className="font-mono uppercase tracking-widest" style={{ fontSize: "0.7em", color: NEUTRAL.inkMuted }}>
          {CHOICE_LABELS[index]}
        </p>
        {selected && (
          <span className="inline-flex" style={{ opacity: badge, zoom: "var(--z)" }}>
            <ProviderIcon src={PROVIDER.logo} alt={PROVIDER.name} size={32} />
          </span>
        )}
      </div>
      <p className="font-semibold leading-snug" style={{ fontSize: "1.05em" }}>
        {openingCase.choices[index]}
      </p>
      {showChips ? <Chips index={index} t={t} /> : <Marks index={index} t={t} />}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Scene body: a pure function of the opening clock `t`                       */
/* -------------------------------------------------------------------------- */

const HEADLINE_STARTS = [
  at("hook", "headline"),
  at("dilemma", "question"),
  at("model", "ask"),
  at("tradeoff", "statement"),
  at("framework", "framework"),
] as const;

const SceneBody = memo(function SceneBody({
  t,
  probe,
  focused,
}: {
  t: number;
  probe: boolean;
  focused: boolean;
}) {
  /* Headline: the old one fades out as its chapter ends, the new one fades in just after. */
  let h = 0;
  HEADLINE_STARTS.forEach((s, i) => {
    if (t >= s) h = i;
  });
  const next = HEADLINE_STARTS[h + 1];
  const headlineOpacity =
    (h === 0
      ? ramp(t, HEADLINE_STARTS[0], HEADLINE_STARTS[0] + 500)
      : ramp(t, HEADLINE_STARTS[h] + 100, HEADLINE_STARTS[h] + 450)) *
    (next === undefined ? 1 : 1 - ramp(t, next - 250, next));

  const ask = at("model", "ask");
  const statement = at("tradeoff", "statement");
  const dilemmaStart = at("dilemma", "question");

  const showLabel = t < dilemmaStart;
  const labelOpacity = visibility(t, at("hook", "label"), at("hook", "label") + 400, dilemmaStart - 300, dilemmaStart);

  // The patient summary stays up through the model chapter; the response sits below it.
  const showSummary = t >= at("hook", "patient") && t < statement;
  const summaryOpacity = visibility(t, at("hook", "patient"), at("hook", "patient") + 600, statement - 300, statement);
  const showResponse = t >= ask && t < statement;
  const responseOpacity = visibility(
    t,
    beat("reveal") + OFFSETS.model,
    beat("reveal") + OFFSETS.model + 300,
    statement - 300,
    statement,
  );

  // From chapter 4 on, the full vignette replaces the summary.
  const showVignette = t >= statement;
  const vignetteOpacity = ramp(t, at("tradeoff", "vignette") - 300, at("tradeoff", "vignette") + 300);

  const showOptions = t >= at("dilemma", "options");
  const optionsOpacity = ramp(t, at("dilemma", "options"), at("dilemma", "options") + 500);
  const selectedIndex = t >= at("model", "extract") && t < statement ? openingCase.response.chosen : null;
  const showChips = t >= statement;

  const showStrip = t >= at("framework", "framework");

  return (
    <div
      className={`mx-auto flex w-full max-w-[46em] flex-col items-center gap-[0.9em] ${
        probe ? "" : "h-full justify-center"
      }`}
    >
      {showLabel && (
        <Block probe={probe}>
          <p
            className="font-mono font-medium tracking-[0.28em]"
            style={{ fontSize: "0.8em", color: NEUTRAL.inkMuted, opacity: labelOpacity }}
          >
            {EYEBROW}
          </p>
        </Block>
      )}

      <Block probe={probe} className="w-full">
        <h1
          className="mx-auto max-w-[30em] text-balance text-center font-semibold leading-[1.12] tracking-tight"
          style={{ fontSize: HEADLINES[h].size, color: NEUTRAL.ink, opacity: headlineOpacity }}
        >
          {HEADLINES[h].text}
        </h1>
      </Block>

      {showSummary && (
        <Block probe={probe} className="w-full">
          <div style={{ opacity: summaryOpacity }} aria-hidden={summaryOpacity === 0}>
            <PatientCard />
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
          <ValueStrip t={t} introAt={at("framework", "framework") + 300} />
        </Block>
      )}

      {showOptions && (
        <Block probe={probe} className="w-full">
          <ul
            className="grid w-full grid-cols-1 items-stretch gap-[0.6em] @md:grid-cols-2"
            style={{ opacity: optionsOpacity }}
          >
            <OptionCard index={0} t={t} selected={selectedIndex === 0} showChips={showChips} />
            <OptionCard index={1} t={t} selected={selectedIndex === 1} showChips={showChips} />
          </ul>
        </Block>
      )}
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */

export default function OpeningScene({ t }: { t: number }) {
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
    <div ref={ref} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 w-full">
      {PROBE_TIMES.map((pt) => (
        <div key={pt} className="absolute left-0 top-0 w-full">
          <SceneBody t={pt} probe focused={isFocused} />
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
      <SceneBody t={t} probe={false} focused={focused} />
      {probeSet(fullProbesRef, false)}
      {probeSet(focusedProbesRef, true)}
    </div>
  );
}
