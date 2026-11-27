import { useLayoutEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import ProviderIcon from "../../components/ProviderIcon";
import ModelResponse, { type ModelResponseTiming } from "../../components/ModelResponse";
import { openingFrame, type ModelResponseConfig } from "../../data/demoData";
import openaiLogo from "../../assets/providers/openai.svg";
import {
  NEUTRAL,
  RECOMMENDATION_COLORS,
  TAGS,
  TagGlyph,
  VALUES,
  VALUE_ORDER,
  valueInk,
} from "../../design";
import type { Value } from "../../study/types";
import { CHOICE_LABELS, openingCase } from "./openingData";
import { PrinciplistFramework } from "./framework";
import { MARK_INTERVAL_MS, OPENING_BEATS, OFFSETS, at, ramp, visibility } from "./timeline";

/* -------------------------------------------------------------------------- */
/*  Copy                                                                       */
/* -------------------------------------------------------------------------- */

const HEADLINES = [
  { text: openingFrame.title, size: "2.6em" }, // hook
  { text: "What would you recommend?", size: "1.7em" }, // patient dilemma
  { text: "Ask again.", size: "1.7em" }, // model decision
  { text: "Each choice prioritizes some values over others.", size: "1.7em" }, // trade-off
  { text: "Four principles of medical ethics", size: "1.7em" }, // framework (TODO: confirm copy)
] as const;

/** Display name only. Never a model version. */
const PROVIDER = { name: "OpenAI", logo: openaiLogo } as const;

const RESPONSE_CONFIG: ModelResponseConfig = {
  providerId: "openai",
  iconLabel: PROVIDER.name,
  panelLabel: `${PROVIDER.name} response`,
  text: openingCase.response.text,
  recommendationSpan: openingCase.response.recommendationSpan,
  extractedOptionId: openingCase.response.chosen === 0 ? "option1" : "option2",
  revealWordsPerGroup: 4,
  groupFadeMs: 350,
  labels: { identify: "Identify the recommendation", extracted: "Extracted choice" },
};

const MODEL_BEATS = OPENING_BEATS.model;
const beat = (name: string) => MODEL_BEATS.find((b) => b.name === name)!.startMs;
const RESPONSE_TIMING: ModelResponseTiming = {
  revealStartMs: beat("reveal"),
  revealEndMs: beat("revealed"),
  groupFadeMs: RESPONSE_CONFIG.groupFadeMs,
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
 * One time inside each chapter at which that chapter's layout is at its
 * fullest. Hidden copies of the scene at these times are measured, so the
 * font size is chosen once per viewport and never changes during playback.
 */
const PROBE_TIMES: readonly number[] = [
  at("hook", "end") - 1,
  at("dilemma", "end") - 1,
  at("model", "extracted"),
  at("tradeoff", "end") - 1,
  at("framework", "all"),
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
      className="mt-[0.7em] flex h-[1em] items-center gap-[0.3em]"
      style={{ opacity: 1 - fadeOut }}
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

function Chips({ index, t }: { index: 0 | 1; t: number }) {
  const tags = openingCase.tags[index];
  const p = ramp(
    t,
    at("tradeoff", index === 0 ? "choice1" : "choice2"),
    at("tradeoff", index === 0 ? "choice1" : "choice2") + 400,
  );
  const rows = ([1, -1] as const)
    .map((tag) => ({ tag, values: VALUE_ORDER.filter((v: Value) => tags[v] === tag) }))
    .filter((r) => r.values.length > 0);
  return (
    <div className="mt-[0.7em] space-y-[0.45em]" style={{ opacity: p }}>
      {rows.map(({ tag, values }) => {
        const meta = TAGS[tag];
        return (
          <div key={tag} className="flex items-start gap-[0.4em]">
            <span
              className="w-[5.6em] shrink-0 pt-[0.5em] font-mono uppercase tracking-widest"
              style={{ fontSize: "0.65em", color: NEUTRAL.inkMuted }}
            >
              {meta.word}
            </span>
            <div className="flex min-w-0 flex-wrap gap-x-[0.4em] gap-y-[0.3em]">
              {values.map((v) => {
                const color = VALUES[v].color;
                const solid = meta.chip === "solid";
                return (
                  <span
                    key={v}
                    aria-label={`${VALUES[v].name}: ${meta.word} (${meta.code})`}
                    className="inline-flex items-center gap-[0.3em] rounded-full border px-[0.6em] py-[0.15em] font-medium"
                    style={{
                      fontSize: "0.9em",
                      borderColor: color,
                      backgroundColor: solid ? color : NEUTRAL.surface,
                      color: solid ? "#fff" : valueInk(v),
                    }}
                  >
                    <TagGlyph glyph={meta.glyph} size={11} />
                    {VALUES[v].name}
                    <span className="opacity-80">{meta.code}</span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
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
      className="rounded-[0.9em] border border-l-[0.3em] p-[0.9em] transition-colors duration-150 ease-out"
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
        <p
          className="font-mono uppercase tracking-widest"
          style={{ fontSize: "0.7em", color: NEUTRAL.inkMuted }}
        >
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

function frameworkHighlight(t: number): Value[] | undefined {
  if (t >= at("framework", "all")) return undefined;
  const order: Value[] = ["J", "N", "B", "A"];
  const hit = order.find((v) => t >= at("framework", v));
  return hit ? [hit] : undefined;
}

function SceneBody({ t, probe }: { t: number; probe: boolean }) {
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

  const showPatientRegion = t >= at("hook", "patient") && t < statement;
  const patientOpacity = visibility(t, at("hook", "patient"), at("hook", "patient") + 600, ask + 300, ask + 800);
  const showExcerpt = t >= ask && t < statement;
  const excerptOpacity = visibility(
    t,
    beat("reveal") + OFFSETS.model,
    beat("reveal") + OFFSETS.model + 300,
    statement - 300,
    statement,
  );

  const showOptions = t >= at("dilemma", "options") && t < at("framework", "framework");
  const optionsOpacity = visibility(
    t,
    at("dilemma", "options"),
    at("dilemma", "options") + 500,
    at("tradeoff", "end") - 300,
    at("tradeoff", "end"),
  );
  const selectedIndex = t >= at("model", "extract") && t < statement ? openingCase.response.chosen : null;
  const showChips = t >= statement;

  const showFramework = t >= at("framework", "framework");

  return (
    <div
      className={`mx-auto flex w-full max-w-[46em] flex-col items-center gap-[1em] ${
        probe ? "" : "h-full justify-center"
      }`}
    >
      {showLabel && (
        <Block probe={probe}>
          <p
            className="font-mono font-medium uppercase tracking-[0.28em]"
            style={{ fontSize: "0.8em", color: NEUTRAL.inkMuted, opacity: labelOpacity }}
          >
            {openingFrame.eyebrow}
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

      {showPatientRegion && (
        <Block probe={probe} className="grid w-full">
          <div
            className="col-start-1 row-start-1"
            style={{ opacity: patientOpacity }}
            aria-hidden={patientOpacity === 0}
          >
            <PatientCard />
          </div>
          {showExcerpt && (
            <div
              className="col-start-1 row-start-1 self-center"
              style={{ opacity: excerptOpacity, zoom: "var(--z)" }}
            >
              <ModelResponse
                config={RESPONSE_CONFIG}
                iconSrc={PROVIDER.logo}
                elapsedMs={Math.max(0, t - OFFSETS.model)}
                timing={RESPONSE_TIMING}
              />
            </div>
          )}
        </Block>
      )}

      {showOptions && (
        <Block probe={probe} className="w-full">
          <ul
            className="grid w-full grid-cols-1 items-stretch gap-[0.7em] @md:grid-cols-2"
            style={{ opacity: optionsOpacity }}
          >
            <OptionCard index={0} t={t} selected={selectedIndex === 0} showChips={showChips} />
            <OptionCard index={1} t={t} selected={selectedIndex === 1} showChips={showChips} />
          </ul>
        </Block>
      )}

      {showFramework && (
        <Block probe={probe} className="w-full">
          <div style={{ opacity: ramp(t, at("framework", "framework"), at("framework", "framework") + 500) }}>
            <PrinciplistFramework highlight={frameworkHighlight(t)} />
          </div>
        </Block>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */

export default function OpeningScene({ t }: { t: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probesRef = useRef<HTMLDivElement>(null);

  // Choose the largest font size at which the fullest state of every chapter
  // fits the box. Runs on resize only; pure DOM measurement, no React renders.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const probes = probesRef.current;
    if (!root || !probes) return;

    const apply = (px: number) => {
      root.style.setProperty("--fs", `${px}px`);
      root.style.setProperty("--z", String(px / 16));
    };
    const tallest = () =>
      Math.max(...Array.from(probes.children).map((el) => (el as HTMLElement).offsetHeight));
    const fit = () => {
      const budget = root.clientHeight - 2;
      let lo = MIN_FONT_PX;
      let hi = MAX_FONT_PX;
      apply(hi);
      if (tallest() <= budget) return;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        apply(mid);
        if (tallest() <= budget) lo = mid;
        else hi = mid;
      }
      apply(lo);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      data-opening-root
      className="@container relative h-full w-full"
      style={{ fontSize: "var(--fs)" }}
    >
      <SceneBody t={t} probe={false} />
      <div ref={probesRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 w-full">
        {PROBE_TIMES.map((pt) => (
          <div key={pt} className="absolute left-0 top-0 w-full">
            <SceneBody t={pt} probe />
          </div>
        ))}
      </div>
    </div>
  );
}
