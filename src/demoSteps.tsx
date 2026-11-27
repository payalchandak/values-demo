import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import type { DemoStep } from "./types";
import neuripsLogo from "./assets/neurips-logo.svg";
import AnimatedHighlight from "./components/AnimatedHighlight";
import ClinicalCaseCard from "./components/ClinicalCaseCard";
import ModelResponse, { getResponseProgress } from "./components/ModelResponse";
import openaiLogo from "./assets/providers/openai.svg";
import {
  clinicalCases,
  clinicalDilemmaCopy,
  modelResponse,
  openingFrame,
  timing,
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

function Body({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 items-center justify-center py-8">{children}</div>;
}

function Slide({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full flex-col">{children}</div>;
}

/* -------------------------------------------------------------------------- */
/*  Step 0 — Hero                                                             */
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
/*  Step 1 — Title docks, static clinical dilemma                             */
/* -------------------------------------------------------------------------- */

interface ClinicalCaseStepProps {
  /**
   * Present only on the response-reveal step. `elapsedMs` is the step-local,
   * pause-aware playback time; when omitted the settled end state is shown.
   */
  response?: { elapsedMs?: number };
}

function ClinicalCaseStep({ response }: ClinicalCaseStepProps) {
  const clinicalCase = clinicalCases[0];
  const progress = response && getResponseProgress(response.elapsedMs, modelResponse.timing);
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
/*  Step 2 — Card morphs into a staggered dashboard                           */
/* -------------------------------------------------------------------------- */

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
  exit: { transition: { staggerChildren: 0.01, staggerDirection: -1 } },
};
const cellVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.07 } },
};

const metrics = [
  { label: "Cases", value: "1,284", delta: "+12.4%" },
  { label: "Agreement", value: "92.7%", delta: "+3.1%" },
  { label: "Latency", value: "184ms", delta: "-9.0%" },
];

const bars = [42, 68, 55, 80, 61, 92, 74];

function DashboardStep() {
  return (
    <Slide>
      <Header chapter="02 · Dashboard" />
      <Body>
        <StageCard className="w-full p-6 md:p-8">
          <motion.div
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
            variants={gridVariants}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {metrics.map((m) => (
              <motion.div
                key={m.label}
                variants={cellVariants}
                className="rounded-xl border border-line bg-[#FAFAFA] p-5"
              >
                <p className="text-sm text-gray-500">{m.label}</p>
                <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-gray-900">
                  {m.value}
                </p>
                <p className="mt-1 font-mono text-xs text-emerald-600">{m.delta}</p>
              </motion.div>
            ))}

            <motion.div
              variants={cellVariants}
              className="rounded-xl border border-line bg-white p-5 md:col-span-2"
            >
              <p className="text-sm text-gray-500">Weekly activity</p>
              <div className="mt-4 flex h-28 items-end gap-3">
                {bars.map((h, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 rounded-md bg-gray-900"
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%`, transition: { delay: 0.25 + i * 0.025, duration: 0.25, ease: "easeOut" } }}
                    exit={{ height: 0, transition: { duration: 0.07 } }}
                  />
                ))}
              </div>
            </motion.div>

            <motion.div variants={cellVariants} className="rounded-xl border border-line bg-white p-5">
              <p className="text-sm text-gray-500">Recent runs</p>
              <ul className="mt-3 space-y-2 font-mono text-xs text-gray-700">
                {["run_0412 ✓", "run_0411 ✓", "run_0410 ✗", "run_0409 ✓"].map((r) => (
                  <li key={r} className="flex justify-between border-b border-line pb-1.5 last:border-0">
                    <span>{r.split(" ")[0]}</span>
                    <span className={r.endsWith("✗") ? "text-rose-500" : "text-emerald-600"}>
                      {r.split(" ")[1]}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </StageCard>
      </Body>
    </Slide>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 3 — Focus view: highlights synced with callout badges                */
/* -------------------------------------------------------------------------- */

// One timeline drives both the highlight sweeps and their badges.
const callouts = [
  { n: "01", label: "Explicit schemas", color: "#FDE68A", dot: "bg-amber-400", at: 1.0 },
  { n: "02", label: "Visible trade-offs", color: "#BFDBFE", dot: "bg-blue-400", at: 2.4 },
  { n: "03", label: "Traceable rationale", color: "#BBF7D0", dot: "bg-emerald-400", at: 3.8 },
];

function FocusStep() {
  const [a, b, c] = callouts;
  return (
    <Slide>
      <Header chapter="03 · Focus" />
      <Body>
        <StageCard className="w-full max-w-3xl p-10 md:p-12">
          <Reveal>
            <p className="mb-5 font-mono text-xs uppercase tracking-widest text-gray-400">
              Key ideas
            </p>
            <p className="text-3xl font-semibold leading-[1.7] tracking-tight text-gray-900">
              Every decision is grounded in{" "}
              <AnimatedHighlight color={a.color} delay={a.at}>
                explicit schemas
              </AnimatedHighlight>
              , so you can see{" "}
              <AnimatedHighlight color={b.color} delay={b.at}>
                where trade-offs happen
              </AnimatedHighlight>{" "}
              and read the{" "}
              <AnimatedHighlight color={c.color} delay={c.at}>
                rationale behind them
              </AnimatedHighlight>
              .
            </p>
          </Reveal>

          <div className="mt-10 flex flex-wrap gap-3">
            {callouts.map((k) => (
              <motion.div
                key={k.n}
                className="flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 shadow-sm"
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { delay: k.at + 0.3, type: "spring", stiffness: 260, damping: 20 },
                }}
                exit={{ opacity: 0, transition: { duration: 0.07 } }}
              >
                <span className={`h-2 w-2 rounded-full ${k.dot}`} />
                <span className="font-mono text-xs text-gray-400">{k.n}</span>
                <span className="text-sm font-medium text-gray-800">{k.label}</span>
              </motion.div>
            ))}
          </div>
        </StageCard>
      </Body>
    </Slide>
  );
}

/* -------------------------------------------------------------------------- */
/*  Steps                                                                     */
/* -------------------------------------------------------------------------- */

export const steps: DemoStep[] = [
  { id: "hero", durationMs: timing.openingFrameMs, render: () => <HeroStep /> },
  // The patient and response steps deliberately share one `id` (the player keys
  // the slide by id): the same slide stays mounted, so the case, its scroll
  // position, and the stage card persist and only the response layer changes.
  { id: "clinical-case", durationMs: timing.clinicalCaseMs, render: () => <ClinicalCaseStep /> },
  {
    id: "clinical-case",
    durationMs: modelResponse.timing.durationMs,
    // PLAYBACK LIMITATION: `render()` receives no elapsed time, so no clock is
    // passed and the settled end state is shown. See the task report.
    render: () => <ClinicalCaseStep response={{}} />,
  },
  { id: "dashboard", durationMs: 7000, render: () => <DashboardStep /> },
  { id: "focus", durationMs: 8500, render: () => <FocusStep /> },
];
