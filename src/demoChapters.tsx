import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { beatStart, type Chapter } from "./types";
import neuripsLogo from "./assets/neurips-logo.svg";
import ClinicalCaseCard from "./components/ClinicalCaseCard";
import ModelResponse, { getResponseProgress, type ModelResponseTiming } from "./components/ModelResponse";
import openaiLogo from "./assets/providers/openai.svg";
import {
  clinicalCases,
  clinicalDilemmaCopy,
  modelResponse,
  openingFrame,
  type ProviderId,
} from "./data/demoData";

/** Logo asset per provider id (assets stay out of the data file). */
const PROVIDER_LOGOS: Record<ProviderId, string> = { openai: openaiLogo };

/* -------------------------------------------------------------------------- */
/*  Shared building blocks (placeholder content — swap freely)                */
/* -------------------------------------------------------------------------- */

const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.7 } as const;
const EXIT = { opacity: 0, y: -6, transition: { duration: 0.07 } };

/** Persistent project title: same `layoutId` on every step, so it morphs. */
function ProjectTitle({ size }: { size: "hero" | "header" }) {
  return (
    <motion.h1
      layoutId="project-title"
      transition={SPRING}
      className={
        size === "hero"
          ? "text-sm font-semibold tracking-[0.28em] text-[#1B2433]/70"
          : "text-xl font-semibold tracking-tight text-gray-900"
      }
    >
      {openingFrame.projectName}
    </motion.h1>
  );
}

/** Fades/slides content in after the shared layout has settled; fades out first. */
function Reveal({
  children,
  delay = 0.08,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { delay, duration: 0.2, ease: "easeOut" } }}
      exit={EXIT}
    >
      {children}
    </motion.div>
  );
}

/** Persistent container card: same `layoutId` on steps 1–3, so it morphs. */
function StageCard({
  className = "",
  fadeIn = false,
  children,
}: {
  className?: string;
  /** Only for the first appearance; later steps morph from the previous card. */
  fadeIn?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.section
      layoutId="stage-card"
      initial={fadeIn ? { opacity: 0, scale: 0.96 } : undefined}
      animate={fadeIn ? { opacity: 1, scale: 1 } : undefined}
      transition={SPRING}
      // Radius & shadow in `style` so Framer corrects them during layout scaling.
      style={{
        borderRadius: 20,
        boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 12px 32px -12px rgba(16,24,40,0.10)",
      }}
      className={`border border-line bg-white ${className}`}
    >
      {children}
    </motion.section>
  );
}

/** Top bar used on every non-hero step: docked title (left) + chapter label (right). */
function Header({ chapter, stackOnNarrow = false }: { chapter: string; stackOnNarrow?: boolean }) {
  return (
    <header
      className={
        stackOnNarrow
          ? "flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
          : "flex items-center justify-between"
      }
    >
      <ProjectTitle size="header" />
      <motion.span
        className="font-mono text-xs uppercase tracking-widest text-gray-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.15 } }}
        exit={{ opacity: 0, transition: { duration: 0.07 } }}
      >
        {chapter}
      </motion.span>
    </header>
  );
}

function Slide({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full flex-col">{children}</div>;
}

/* -------------------------------------------------------------------------- */
/*  Chapter 1 — Hero                                                             */
/* -------------------------------------------------------------------------- */

function HeroStep() {
  return (
    <Slide>
      <header className="flex items-center">
        <ProjectTitle size="hero" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-6 text-center">
        <Reveal delay={0.05} className="mb-7">
          <img
            src={neuripsLogo}
            alt={openingFrame.eyebrow}
            className="h-20 w-auto select-none md:h-32"
            draggable={false}
          />
        </Reveal>
        <Reveal delay={0.05} className="w-full max-w-[19rem] sm:max-w-xl md:max-w-3xl">
          <h2 className="text-balance text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-[#1B2433] sm:text-5xl md:text-[4.25rem]">
            {openingFrame.title}
          </h2>
        </Reveal>
        <Reveal delay={0.1} className="mt-7 max-w-md text-balance text-base text-[#1B2433]/65 md:max-w-xl md:text-xl">
          {openingFrame.subtitle}
        </Reveal>
      </div>
    </Slide>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chapters 2 and 3 — Title docks, clinical dilemma, model response                             */
/* -------------------------------------------------------------------------- */

interface ClinicalCaseStepProps {
  /**
   * Present only on the response chapter. `elapsedMs` is the chapter-local,
   * pause-aware playback time and `timing` comes from that chapter's beats.
   */
  response?: { elapsedMs: number; timing: ModelResponseTiming };
}

function ClinicalCaseStep({ response }: ClinicalCaseStepProps) {
  const clinicalCase = clinicalCases[0];
  const progress = response && getResponseProgress(response.elapsedMs, response.timing);
  return (
    <Slide>
      <Header chapter={clinicalDilemmaCopy.sectionLabel} stackOnNarrow />
      {/*
        Deliberate vertical scroll when the case doesn't fit (small screens).
        `m-auto` on the card centers it when there is room and avoids clipping
        the top when there isn't. Extra bottom padding below `md` keeps the last
        card clear of the fixed PAUSED pill that sits above the HUD. The edge
        mask softens the cut so scrolled content doesn't butt against the label.
      */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1 pb-12 pt-5 [mask-image:linear-gradient(to_bottom,transparent,black_14px,black_calc(100%_-_14px),transparent)] md:pb-4">
        <StageCard fadeIn className="m-auto w-full max-w-4xl p-5 sm:p-8 md:p-10">
          {clinicalCase && (
            <Reveal delay={0.08}>
              <ClinicalCaseCard
                copy={clinicalDilemmaCopy}
                clinicalCase={clinicalCase}
                // Both options stay neutral until extraction reaches the outline phase.
                selectedOptionId={progress?.extracted ? modelResponse.extractedOptionId : undefined}
                selectedOptionBadge={
                  progress && (
                    <span
                      className="font-mono text-[11px] uppercase tracking-widest text-[#3B4350]"
                      style={{ opacity: progress.extractedOpacity }}
                    >
                      {modelResponse.labels.extracted}
                    </span>
                  )
                }
                responseSlot={
                  response && (
                    <ModelResponse
                      config={modelResponse}
                      iconSrc={PROVIDER_LOGOS[modelResponse.providerId]}
                      elapsedMs={response.elapsedMs}
                      timing={response.timing}
                    />
                  )
                }
              />
            </Reveal>
          )}
        </StageCard>
      </div>
    </Slide>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chapters                                                                  */
/* -------------------------------------------------------------------------- */

// Beats are data. A chapter's length is the start of its last beat.
const heroBeats = [
  { name: "title", startMs: 0 },
  { name: "end", startMs: 8000 },
] as const;

// Provisional reading hold.
// TODO: tune after visual review
const caseBeats = [
  { name: "read", startMs: 0 },
  { name: "end", startMs: 25000 },
] as const;

// TODO: tune after visual review
const responseBeats = [
  { name: "reveal", startMs: 0 }, // response text fades in by phrase group
  { name: "revealed", startMs: 2000 },
  { name: "highlight", startMs: 6000 }, // recommendation span sweeps
  { name: "extract", startMs: 7000 }, // matching option is outlined
  { name: "extracted", startMs: 8000 },
  { name: "end", startMs: 12000 }, // final hold
] as const;

const responseTiming: ModelResponseTiming = {
  revealStartMs: beatStart(responseBeats, "reveal"),
  revealEndMs: beatStart(responseBeats, "revealed"),
  groupFadeMs: modelResponse.groupFadeMs,
  highlightStartMs: beatStart(responseBeats, "highlight"),
  highlightEndMs: beatStart(responseBeats, "extract"),
  outlineStartMs: beatStart(responseBeats, "extract"),
  outlineEndMs: beatStart(responseBeats, "extracted"),
};

export const chapters: Chapter[] = [
  { id: "hero", beats: heroBeats, render: () => <HeroStep /> },
  // The case and response chapters render the same component at the same spot
  // in the persistent stage, so the case card and its scroll position carry
  // over and only the response layer changes.
  { id: "case", beats: caseBeats, render: () => <ClinicalCaseStep /> },
  {
    id: "response",
    beats: responseBeats,
    render: (ctx) => (
      <ClinicalCaseStep response={{ elapsedMs: ctx.elapsedMs, timing: responseTiming }} />
    ),
  },
];
