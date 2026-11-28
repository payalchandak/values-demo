import { useLayoutEffect, useRef } from "react";
import type { ChapterContext } from "../types";
import { beatStart, chapterDuration } from "../types";
import ProviderIcon from "../components/ProviderIcon";
import openaiLogo from "../assets/providers/openai.svg";
import OpeningScene from "../chapters/opening/OpeningScene";
import { cardCollapse, markSpinDeg, modelHandoff } from "../chapters/opening/timeline";
import StackStage from "../chapters/stack/StackStage";
import { stackBeats } from "../chapters/stack/beats";
import { RegressionScene } from "../chapters/regression/RegressionChapter";
import { regressionBeats } from "../chapters/regression/beats";
import IndividualModels from "../chapters/ending/IndividualModels";
import ModelsAndPhysicians from "../chapters/ending/ModelsAndPhysicians";
import { AUTOPLAY_MODELS, GALLERY_PHYSICIANS, INDIVIDUAL_MODELS } from "../chapters/ending/profiles";
import { individualLabelWeight } from "../chapters/ending/beats";
import { clamp01, easeInOut } from "../chapters/ending/shared";
import { FADE_MS } from "../design/motion";
import { foregroundCases, gptProfile, stackCases } from "./data";
import Morph from "./Morph";
import { MORPH_TIMING, morphBeats } from "./morphBeats";
import {
  headlineAt,
  isOpening,
  openingTime,
  SEGMENT_OFFSET,
  type HeadlineState,
  type SegmentId,
} from "./plan";

const ICON_SIZE = 40;
/** Hand-off cross-fade: the previous chapter's last frame fades out over the start of the next. */
const GHOST_MS = FADE_MS;

const ramp = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a)));

/* -------------------------------------------------------------------------- */
/*  The persistent OpenAI icon                                                */
/* -------------------------------------------------------------------------- */

interface IconPlan {
  from: string | null;
  to?: string;
  /** 0 = at `from`, 1 = at `to`. */
  mix: number;
  opacity: number;
  /** Fade out as the anchor leaves the scene area (the scrolling profile list). */
  clipToScene?: boolean;
}

/**
 * Where the icon is, as a pure function of the chapter and its clock. Anchors
 * are real elements the scenes leave behind (`data-anchor`); One element, one image, never remounted.
 */
function iconPlan(segment: SegmentId, e: number): IconPlan {
  switch (segment) {
    case "opening-hook":
    case "opening-dilemma":
      return { from: null, mix: 0, opacity: 0 };
    case "opening-framework":
      // The model has not answered yet: the shared icon waits for the model chapter.
      return { from: null, mix: 0, opacity: 0 };
    case "opening-model":
      return { from: "icon-response", mix: 0, opacity: modelHandoff(e).responseEnter * (1 - cardCollapse(e)) };
    case "stack":
    case "regression":
      return { from: null, mix: 0, opacity: 0 };
    case "morph": {
      // The icon fades in at the donut hole when the labels arrive.
      const r = beatStart(morphBeats, "labels");
      return { from: "icon-label", mix: 0, opacity: easeInOut(ramp(e, r, r + MORPH_TIMING.labelsMs)), clipToScene: true };
    }
    case "individual-models":
      // The icon sits in the donut hole and cross-fades with the next model's icon.
      return { from: "icon-label", mix: 0, opacity: individualLabelWeight(e, INDIVIDUAL_MODELS[0].key), clipToScene: true };
    default:
      return { from: null, mix: 0, opacity: 0 };
  }
}

/** First live element with this anchor name (never one in the hidden measuring copies). */
function findAnchor(root: HTMLElement, name: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(`[data-anchor="${name}"]`)) {
    if (!el.closest("[data-probe]")) return el;
  }
  return null;
}

/** Positions the icon over its anchors. Writes styles directly: no state, no extra renders. */
function placeIcon(root: HTMLElement, icon: HTMLElement, plan: IconPlan) {
  const box = root.getBoundingClientRect();
  const rectOf = (name: string | null | undefined) => {
    if (!name) return null;
    return findAnchor(root, name)?.getBoundingClientRect() ?? null;
  };
  const a = rectOf(plan.from);
  const b = rectOf(plan.to);
  const mix = plan.mix;
  const at = mix >= 1 ? (b ?? a) : mix <= 0 ? (a ?? b) : a && b ? null : (a ?? b);
  let left: number, top: number, size: number;
  if (at) {
    left = at.left;
    top = at.top;
    size = at.width;
  } else if (a && b) {
    left = a.left + (b.left - a.left) * mix;
    top = a.top + (b.top - a.top) * mix;
    size = a.width + (b.width - a.width) * mix;
  } else {
    icon.style.opacity = "0";
    return;
  }
  let opacity = plan.opacity;
  if (plan.clipToScene) {
    const zone = root.querySelector("[data-scene-zone]")?.getBoundingClientRect();
    if (zone) {
      const cy = top + size / 2;
      opacity *= clamp01(Math.min(cy - zone.top, zone.bottom - cy) / 24);
    }
  }
  icon.style.opacity = String(opacity);
  icon.style.transform = `translate(${left - box.left}px, ${top - box.top}px) scale(${size / ICON_SIZE})`;
}

/* -------------------------------------------------------------------------- */
/*  Headline                                                                  */
/* -------------------------------------------------------------------------- */

function Headline({ state }: { state: HeadlineState }) {
  return (
    <div
      className="grid shrink-0 place-items-center px-12 text-center text-xl font-semibold leading-snug tracking-tight text-[#1B2433] sm:text-2xl md:text-3xl"
      style={{ minHeight: "4.5rem" }}
    >
      <span className="col-start-1 row-start-1 text-balance" style={{ opacity: 1 - state.mix }} aria-hidden>
        {state.previous}
      </span>
      <span className="col-start-1 row-start-1 text-balance" style={{ opacity: state.mix }}>
        {state.current}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stage                                                                     */
/* -------------------------------------------------------------------------- */

const STACK_END = chapterDuration({ beats: stackBeats });
const REGRESSION_END = chapterDuration({ beats: regressionBeats });

function StackScene({ elapsedMs }: { elapsedMs: number }) {
  return (
    <StackStage
      cases={stackCases}
      beats={stackBeats}
      elapsedMs={elapsedMs}
      profileKey={gptProfile.key}
      profileLabel={gptProfile.displayName}
    />
  );
}

function RegressionLayer({ elapsedMs }: { elapsedMs: number }) {
  return <RegressionScene elapsedMs={elapsedMs} rows={foregroundCases} profile={gptProfile} showHeadline={false} />;
}

/**
 * The one stage every chapter renders into. It is a single component, never
 * keyed by chapter, so it stays mounted from the first frame to the last:
 * the opening layer, the scene layer and the OpenAI icon all persist, and what
 * changes between chapters is only the clock position each scene is drawn at.
 */
export default function Stage({ segment, ctx }: { segment: SegmentId; ctx: ChapterContext }) {
  const e = Math.max(0, ctx.elapsedMs);
  const T = SEGMENT_OFFSET[segment] + e;
  const rootRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  const inOpening = isOpening(segment);
  const showScenes = !inOpening;
  // The opening's last 1.5 s: everything shrinks and fades while the stack's first card fades in.
  const collapse = segment === "opening-model" ? cardCollapse(e) : 0;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const icon = iconRef.current;
    if (!root || !icon) return;
    const plan = iconPlan(segment, e);
    const run = () => placeIcon(root, icon, plan);
    run();
    // The hole slot appears after the donut measures, and moves when the frame
    // changes. Follow it. Ignore our own writes on the icon, or this loops.
    const ro = new ResizeObserver(run);
    ro.observe(root);
    const mo = new MutationObserver((records) => {
      if (records.every((r) => r.target === icon || icon.contains(r.target))) return;
      run();
    });
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  });
  // Two turns while the model thinks. The turn ends upright.
  const spinDeg = segment === "opening-model" ? markSpinDeg(e) : 0;

  return (
    <div ref={rootRef} data-stage className="relative h-full w-full">
      {inOpening && (
        <>
          <div
            className="absolute inset-0"
            key="opening"
            style={collapse > 0 ? { opacity: 1 - collapse, transform: `scale(${1 - 0.4 * collapse})` } : undefined}
          >
            <OpeningScene t={openingTime(segment, e)} sharedIcon />
          </div>
          {collapse > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex flex-col"
              key="card"
              style={{ opacity: collapse, transform: `scale(${0.75 + 0.25 * collapse})` }}
            >
              <div className="shrink-0" style={{ minHeight: "4.5rem" }} />
              <div className="relative min-h-0 flex-1">
                <StackScene elapsedMs={0} />
              </div>
            </div>
          )}
        </>
      )}

      {showScenes && (
        <div className="absolute inset-0 flex flex-col" key="scenes">
          <Headline state={headlineAt(T)} />
          <div data-scene-zone className="relative min-h-0 flex-1">
            {segment === "stack" && <StackScene elapsedMs={e} />}

            {segment === "regression" && (
              <>
                <RegressionLayer elapsedMs={e} />
                {e < GHOST_MS && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-canvas"
                    style={{ opacity: 1 - e / GHOST_MS }}
                  >
                    <StackScene elapsedMs={STACK_END} />
                  </div>
                )}
              </>
            )}

            {segment === "morph" && (
              <>
                <Morph profile={gptProfile} elapsedMs={e} />
                {e < GHOST_MS && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-canvas"
                    style={{ opacity: 1 - e / GHOST_MS }}
                  >
                    <RegressionLayer elapsedMs={REGRESSION_END} />
                  </div>
                )}
              </>
            )}

            {segment === "individual-models" && (
              <IndividualModels
                models={INDIVIDUAL_MODELS}
                elapsedMs={e}
                showHeader={false}
                sharedIconFor={INDIVIDUAL_MODELS[0].key}
              />
            )}

            {segment === "models-and-physicians" && (
              <ModelsAndPhysicians
                models={AUTOPLAY_MODELS}
                anchorKey={INDIVIDUAL_MODELS[INDIVIDUAL_MODELS.length - 1].key}
                physicians={GALLERY_PHYSICIANS}
                elapsedMs={e}
                onReplay={ctx.restart}
                showHeader={false}
              />
            )}
          </div>
        </div>
      )}

      <div ref={iconRef} aria-hidden className="pointer-events-none absolute left-0 top-0 z-30 origin-top-left" style={{ opacity: 0 }}>
        <div style={{ transform: `rotate(${spinDeg}deg)` }}>
          <ProviderIcon src={openaiLogo} alt="OpenAI" size={ICON_SIZE} />
        </div>
      </div>
    </div>
  );
}
